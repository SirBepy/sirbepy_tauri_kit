// Renders a pane's windows (layout.ts) into a window layer laid over it: one
// Frame per window, panels mounted once and moved only when a tab changes
// window, docked windows reserving their width as pane padding so the pane's
// own content shrinks beside them, and every drag - move, resize, tear-off -
// with its landing preview. On a compact (phone) screen each window is a full
// cover instead, one at a time, with no drag, dock or tear-off.
//
// The host supplies its panels, how each one mounts, and any extra bar
// buttons; it persists `layout` itself from onRender, since what "this
// layout's owner" means (a chat, a document, a tab) is the host's call.

import { Frame, type FrameChrome, type FrameEvents } from "./frame";
import { GestureController, paintRect, type GestureHost } from "./gestures";
import {
  centredRect, clampRect, cornerRect, dockRect, dockWidths, loadSize, saveSize, stackRects, type Bounds,
} from "./geometry";
import {
  appendDock, closeWindow, dockStack, focusWindow, isShowing, openPanel, place, weightOf, windowOf,
  type DockSide, type PaneLayout, type PaneWindow, type PanelMeta, type Rect,
} from "./layout";

/** pane-windows.css's phone block uses the same width. */
export const DEFAULT_COMPACT_QUERY = "(max-width: 768px)";

export interface PaneWindowsOptions<K extends string> {
  /** Every panel this pane hosts, in default tab order. */
  panels: readonly K[];
  meta(panel: K): PanelMeta;
  /** Builds a panel into `root` the first time its tab is shown. It then
   *  stays mounted, hidden or not, until destroy(). */
  mountPanel(panel: K, root: HTMLElement): { destroy(): void };
  /** A panel mounted on the first render whether shown or not, e.g. one
   *  that must hear events while closed. */
  mountEagerly?(panel: K): boolean;
  /** localStorage key for the floating size, which outlives the app. */
  sizeKey: string;
  /** Media query for the compact (phone) layout. */
  compactQuery?: string;
  /** Tooltip on a floating window's dock button. */
  dockTitle?: string;
  /** A window kept in the layout but not painted, e.g. one whose only panel
   *  the host has moved somewhere else for now. */
  isHidden?(w: PaneWindow<K>): boolean;
  /** Per-window extra bar chrome: buttons and an unseen-tab dot. */
  chrome?(w: PaneWindow<K>, compact: boolean): Partial<FrameChrome<K>>;
  /** A host bar button was pressed (its `data-pw-act`). */
  onAction?(windowId: string, act: string): void;
  /** Hooks hardware/browser back while a compact cover is up. Gets a handler
   *  that returns true when it closed something; returns its disposer. */
  registerBack?(handler: () => boolean): () => void;
  /** After every layout render. `scoping` is true for load(), so a host can
   *  tell a fresh layout landing from a user's change. */
  onRender?(info: { scoping: boolean }): void;
  /** After every geometry paint, including mid-drag and on resize. */
  onPaint?(): void;
}

export class PaneWindowManager<K extends string> implements GestureHost<K> {
  layout: PaneLayout<K>;
  readonly frames = new Map<string, Frame<K>>();
  private panelEls = new Map<K, HTMLElement>();
  private mounted = new Map<K, { destroy(): void }>();
  private obs: ResizeObserver | null = null;
  private readonly gestures: GestureController<K>;
  /** Held while a compact cover is up, so back closes it. */
  private disposeBack: (() => void) | null = null;

  constructor(
    readonly pane: HTMLElement,
    readonly layer: HTMLElement,
    private opts: PaneWindowsOptions<K>,
    initial: PaneLayout<K>,
  ) {
    this.layout = initial;
    this.gestures = new GestureController(this);
    if (typeof ResizeObserver !== "undefined") {
      this.obs = new ResizeObserver(() => this.paint());
      this.obs.observe(layer);
    }
  }

  // ── Public ───────────────────────────────────────────────────────────────

  get panels(): readonly K[] {
    return this.opts.panels;
  }

  /** Swaps in a whole layout (another owner's), without the rise-in a user's
   *  open gets. */
  load(layout: PaneLayout<K>): void {
    this.layout = layout;
    this.render(true);
  }

  /** Re-renders after host state the layout does not carry has changed. */
  refresh(): void {
    this.render();
  }

  commit(next: PaneLayout<K>): void {
    this.layout = next;
    this.render();
  }

  /** GestureHost's mid-drag path: a dock resize or stack-divider drag repaints
   *  every pointermove without the full render a commit would trigger. */
  setLayoutLive(next: PaneLayout<K>): void {
    this.layout = next;
    this.paint();
  }

  openPanel(panel: K): void {
    if (!this.opts.panels.includes(panel)) return;
    this.commit(openPanel(this.layout, panel));
  }

  togglePanel(panel: K): void {
    if (isShowing(this.layout, panel)) this.closePanel(panel);
    else this.openPanel(panel);
  }

  /** Closes the window a panel is showing in. */
  closePanel(panel: K): void {
    const w = windowOf(this.layout, panel);
    if (w) this.commit(closeWindow(this.layout, w.id));
  }

  isShowing(panel: K): boolean {
    return isShowing(this.layout, panel);
  }

  /** Escape: closes the front-most open window. False when none was open. */
  closeFront(): boolean {
    const front = this.front();
    if (!front) return false;
    this.commit(closeWindow(this.layout, front.id));
    return true;
  }

  /** Open, and not hidden by the host. */
  visible(w: PaneWindow<K>): boolean {
    return w.open && !this.opts.isHidden?.(w);
  }

  compact(): boolean {
    const q = this.opts.compactQuery ?? DEFAULT_COMPACT_QUERY;
    return typeof window.matchMedia === "function" && window.matchMedia(q).matches;
  }

  meta(panel: K): PanelMeta {
    return this.opts.meta(panel);
  }

  floatSize(): { w: number; h: number } {
    return loadSize(this.opts.sizeKey);
  }

  rememberFloatSize(r: Rect): void {
    saveSize(this.opts.sizeKey, r);
  }

  destroy(): void {
    this.obs?.disconnect();
    this.obs = null;
    this.disposeBack?.();
    this.disposeBack = null;
    for (const m of this.mounted.values()) m.destroy();
    this.mounted.clear();
    for (const f of this.frames.values()) f.destroy();
    this.frames.clear();
    this.pane.style.removeProperty("padding-left");
    this.pane.style.removeProperty("padding-right");
  }

  // ── Render ───────────────────────────────────────────────────────────────

  private front(): PaneWindow<K> | undefined {
    return [...this.layout.windows].reverse().find((w) => this.visible(w));
  }

  private syncBack(covering: boolean): void {
    if (covering && !this.disposeBack && this.opts.registerBack) {
      this.disposeBack = this.opts.registerBack(() => {
        const front = this.front();
        // offsetParent is null once the pane itself is off screen.
        if (!front || !this.compact() || this.pane.offsetParent === null) return false;
        this.commit(closeWindow(this.layout, front.id));
        return true;
      });
    } else if (!covering && this.disposeBack) {
      this.disposeBack();
      this.disposeBack = null;
    }
  }

  private panelEl(panel: K): HTMLElement {
    let el = this.panelEls.get(panel);
    if (!el) {
      el = document.createElement("div");
      el.className = "pw-panel";
      el.dataset.panel = panel;
      this.panelEls.set(panel, el);
    }
    return el;
  }

  private ensureMounted(panel: K): void {
    if (this.mounted.has(panel)) return;
    this.mounted.set(panel, this.opts.mountPanel(panel, this.panelEl(panel)));
  }

  private render(scoping = false): void {
    const compact = this.compact();
    const live = new Set(this.layout.windows.map((w) => w.id));
    for (const [id, f] of this.frames) {
      if (live.has(id)) continue;
      f.destroy();
      this.frames.delete(id);
    }
    // Compact: only the front-most open window shows, as a full cover.
    const front = this.front();
    this.layout.windows.forEach((w, i) => {
      let f = this.frames.get(w.id);
      if (!f) {
        f = new Frame(w, this.frameEvents, {
          meta: (p) => this.opts.meta(p),
          dockTitle: this.opts.dockTitle ?? "Dock to the side",
        });
        this.frames.set(w.id, f);
        this.layer.appendChild(f.el);
      }
      f.update(w, { buttons: "", unseen: null, ...this.opts.chrome?.(w, compact) });
      // z-index, never DOM order: re-appending a frame would reload an iframe inside it.
      f.el.style.zIndex = String(i + 1);
      const wasHidden = f.el.hidden;
      f.el.hidden = !this.visible(w) || (compact && w !== front);
      // Only a real open rises in, not a load landing on a window that was
      // already up there. A compact cover just appears.
      if (wasHidden && !f.el.hidden && !scoping && !compact) riseIn(f.el);
      for (const t of w.tabs) {
        const el = this.panelEl(t);
        if (el.parentElement !== f.body) f.body.appendChild(el);
        el.hidden = t !== w.active;
        if ((w.open && t === w.active) || this.opts.mountEagerly?.(t)) this.ensureMounted(t);
      }
    });
    this.syncBack(compact && !!front);
    this.paint();
    this.opts.onRender?.({ scoping });
  }

  // ── Geometry ─────────────────────────────────────────────────────────────

  bounds(): Bounds {
    const box = this.layer.getBoundingClientRect();
    return { w: box.width, h: box.height };
  }

  /** The windows on screen in `side`'s stack, top to bottom. */
  column(side: DockSide): PaneWindow<K>[] {
    return dockStack(this.layout, side).filter((w) => this.visible(w));
  }

  dockPx(b: Bounds, also?: DockSide): { left: number; right: number } {
    const on = (side: DockSide) => side === also || this.column(side).length > 0;
    return dockWidths(b.w, { left: on("left"), right: on("right") }, this.layout.dockShare);
  }

  rectFor(w: PaneWindow<K>, b: Bounds, dock: { left: number; right: number }): Rect {
    const p = w.placement;
    if (p.kind === "dock") {
      const col = this.column(p.side);
      const i = col.indexOf(w);
      if (i < 0) return dockRect(p.side, dock[p.side], b);
      return stackRects(p.side, dock[p.side], b, col.map(weightOf))[i]!;
    }
    if (p.kind === "snap") return cornerRect(p.corner, b);
    return p.rect ? clampRect(p.rect, b) : centredRect(this.floatSize(), b);
  }

  private paint(): void {
    const b = this.bounds();
    const compact = this.compact();
    const off = compact || b.w === 0 || b.h === 0;
    const dock = off ? { left: 0, right: 0 } : this.dockPx(b);
    // The split itself: the pane's content gives up what the docks take.
    this.pane.style.paddingLeft = dock.left ? `${dock.left}px` : "";
    this.pane.style.paddingRight = dock.right ? `${dock.right}px` : "";
    this.pane.style.setProperty("--pw-dock-l", `${dock.left}px`);
    this.pane.style.setProperty("--pw-dock-r", `${dock.right}px`);
    for (const w of this.layout.windows) {
      const f = this.frames.get(w.id);
      if (!f || f.el.hidden) continue;
      const above = !off && w.placement.kind === "dock" && this.column(w.placement.side).indexOf(w) > 0;
      f.el.toggleAttribute("data-stack-above", above);
      if (off) {
        for (const k of ["left", "top", "width", "height"] as const) f.el.style.removeProperty(k);
        continue;
      }
      paintRect(f.el, this.rectFor(w, b, dock));
    }
    this.opts.onPaint?.();
  }

  // ── Frame wiring ─────────────────────────────────────────────────────────
  // The gestures themselves live in gestures.ts; this just routes a Frame's
  // pointer events to them and to layout commits.

  private frameEvents: FrameEvents<K> = {
    focus: (id) => {
      if (this.layout.windows[this.layout.windows.length - 1]?.id === id) return;
      this.commit(focusWindow(this.layout, id));
    },
    barDown: (id, ev) =>
      this.compact() ? this.gestures.swipeBackGesture(id, ev) : this.gestures.moveGesture(id, ev),
    resizeDown: (id, dir, ev) => this.gestures.resizeGesture(id, dir, ev),
    tabDown: (id, panel, ev) =>
      this.compact() ? this.gestures.swipeBackGesture(id, ev, panel) : this.gestures.tabGesture(id, panel, ev),
    action: (id, act) => {
      const w = this.layout.windows.find((x) => x.id === id);
      if (!w) return;
      if (act === "close") this.commit(closeWindow(this.layout, id));
      else if (act !== "dock") this.opts.onAction?.(id, act);
      else if (w.placement.kind === "dock") this.commit(place(this.layout, id, { kind: "float", rect: null }));
      // An empty side first; with both taken it joins the bottom of the right stack.
      else if (!this.column("right").length) this.commit(place(this.layout, id, { kind: "dock", side: "right" }));
      else if (!this.column("left").length) this.commit(place(this.layout, id, { kind: "dock", side: "left" }));
      else this.commit(appendDock(this.layout, id, "right"));
    },
  };
}

function riseIn(el: HTMLElement): void {
  // Re-armed each time: a window hidden mid-rise never fired animationend.
  el.classList.remove("is-entering");
  void el.offsetWidth;
  el.classList.add("is-entering");
  el.addEventListener("animationend", () => el.classList.remove("is-entering"), { once: true });
}
