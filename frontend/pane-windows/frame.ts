// One pane window's DOM: a title bar (grip, browser-style tabs - or just the
// name when it holds one panel - actions, X) and the body the panels live in.
// The body element is created once and never rebuilt, so a panel inside it
// (an iframe above all) is never re-parented by a chrome update.

import type { PaneWindow, PanelMeta } from "./layout";
import type { ResizeDir } from "./geometry";

const DIRS: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface FrameEvents<K extends string> {
  /** Any press inside the window: bring it forward. */
  focus(id: string): void;
  /** A press on the bar's empty stretch: start a move. */
  barDown(id: string, ev: PointerEvent): void;
  resizeDown(id: string, dir: ResizeDir, ev: PointerEvent): void;
  /** A press on a tab: a click switches, a drag tears it off. */
  tabDown(id: string, panel: K, ev: PointerEvent): void;
  /** A bar button: the built-in "close" and "dock", or a host button's own
   *  `data-pw-act` name. */
  action(id: string, act: string): void;
}

export interface FrameChrome<K extends string> {
  /** Extra bar buttons, as HTML, painted before dock and close. Each one's
   *  `data-pw-act` comes back through FrameEvents.action. */
  buttons: string;
  /** A tab carrying news its window is not showing: it gets a dot. */
  unseen: K | null;
}

export class Frame<K extends string> {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private bar: HTMLElement;
  private id: string;
  /** What the chrome was last painted from. A press inside the window brings
   *  it forward, which re-renders; rewriting the bar then would replace the
   *  very button being pressed and swallow its click. */
  private painted = "";

  constructor(
    win: PaneWindow<K>,
    private events: FrameEvents<K>,
    private opts: { meta: (panel: K) => PanelMeta; dockTitle: string },
  ) {
    this.id = win.id;
    this.el = document.createElement("div");
    this.el.className = "pw-window";
    this.el.dataset.win = win.id;
    this.bar = document.createElement("div");
    this.bar.className = "pw-bar";
    this.body = document.createElement("div");
    this.body.className = "pw-body";
    this.el.append(this.bar, this.body);
    this.el.insertAdjacentHTML(
      "beforeend",
      DIRS.map((d) => `<span class="pw-rz pw-rz-${d}" data-rz="${d}" aria-hidden="true"></span>`).join(""),
    );
    this.el.addEventListener("pointerdown", this.onPointerDown);
    this.el.addEventListener("click", this.onClick);
    this.update(win, { buttons: "", unseen: null });
  }

  /** Repaints the bar only; the body and its panels stay put. */
  update(win: PaneWindow<K>, chrome: FrameChrome<K>): void {
    const sig = JSON.stringify([win.tabs, win.active, win.placement.kind, chrome]);
    if (sig === this.painted && this.el.dataset.side === (win.placement.kind === "dock" ? win.placement.side : undefined)) return;
    this.painted = sig;
    const docked = win.placement.kind === "dock";
    this.el.dataset.placement = win.placement.kind;
    if (win.placement.kind === "dock") this.el.dataset.side = win.placement.side;
    else delete this.el.dataset.side;
    this.el.dataset.active = win.active;
    const tabbed = win.tabs.length > 1;
    this.el.classList.toggle("has-tabs", tabbed);
    const meta = this.opts.meta(win.active);
    // data-spine names the tab's panel; tests and the tear-off both key on it.
    const head = tabbed
      ? `<span class="pw-tabs">` +
        win.tabs
          .map((t) => {
            const m = this.opts.meta(t);
            return (
              `<button type="button" class="pw-tab${t === win.active ? " on" : ""}` +
              `${t === chrome.unseen && t !== win.active ? " has-unseen" : ""}" data-spine="${t}" ` +
              `title="${escapeHtml(m.label)} - drag out for its own window">` +
              `<i class="ph ${m.icon}"></i>${escapeHtml(m.label)}</button>`
            );
          })
          .join("") +
        `</span>`
      : `<span class="pw-title"><i class="ph ${meta.icon}"></i>${escapeHtml(meta.label)}</span>`;
    this.bar.innerHTML =
      `<span class="pw-grip" aria-hidden="true"><i class="ph ph-dots-six"></i></span>` +
      head +
      `<span class="pw-grow"></span>` +
      chrome.buttons +
      `<button type="button" class="pw-btn" data-pw-act="dock" ` +
        `title="${docked ? "Float it again" : escapeHtml(this.opts.dockTitle)}">` +
        `<i class="ph ${docked ? "ph-arrows-out-simple" : "ph-square-split-horizontal"}"></i></button>` +
      `<button type="button" class="pw-btn pw-x" data-pw-act="close" data-card-close title="Close">` +
        `<i class="ph ph-x"></i></button>`;
  }

  /** The bar, where a dragged tab or window can be dropped in. */
  dropRect(): DOMRect[] {
    return [this.bar.getBoundingClientRect()];
  }

  /** Tab slot the pointer is over, so a dropped tab lands where aimed. */
  tabIndexAt(clientX: number): number | undefined {
    const tabs = [...this.bar.querySelectorAll<HTMLElement>("[data-spine]")];
    if (!tabs.length) return undefined;
    const i = tabs.findIndex((t) => clientX < t.getBoundingClientRect().left + t.offsetWidth / 2);
    return i < 0 ? tabs.length : i;
  }

  destroy(): void {
    this.el.removeEventListener("pointerdown", this.onPointerDown);
    this.el.removeEventListener("click", this.onClick);
    this.el.remove();
  }

  private onPointerDown = (ev: PointerEvent): void => {
    this.events.focus(this.id);
    if (ev.button !== 0) return;
    const el = ev.target as HTMLElement;
    const rz = el.closest<HTMLElement>("[data-rz]");
    if (rz) {
      this.events.resizeDown(this.id, rz.dataset.rz as ResizeDir, ev);
      return;
    }
    const tab = el.closest<HTMLElement>("[data-spine]");
    if (tab) {
      this.events.tabDown(this.id, tab.dataset.spine as K, ev);
      return;
    }
    if (el.closest(".pw-bar") && !el.closest("button")) this.events.barDown(this.id, ev);
  };

  private onClick = (ev: MouseEvent): void => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>("[data-pw-act]");
    if (btn) this.events.action(this.id, btn.dataset.pwAct!);
  };
}
