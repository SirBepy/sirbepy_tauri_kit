// The generic manager's host hooks: lazy and eager mounting, host bar buttons
// routed to onAction, isHidden, and the per-owner layout store.
import { describe, it, expect, beforeEach } from "vitest";
import { PaneWindowManager, type PaneWindowsOptions } from "./manager";
import { defaultLayout, tearOff } from "./layout";
import { createLayoutStore } from "./memory";

type P = "notes" | "log";
const PANELS: readonly P[] = ["notes", "log"];
const META = { notes: { label: "Notes", icon: "ph-note" }, log: { label: "Log <raw>", icon: "ph-list" } };

function setup(extra: Partial<PaneWindowsOptions<P>> = {}) {
  const pane = document.createElement("div");
  const layer = document.createElement("div");
  pane.appendChild(layer);
  document.body.appendChild(pane);
  const mounts: P[] = [];
  const actions: string[] = [];
  const renders: boolean[] = [];
  const mgr = new PaneWindowManager<P>(
    pane,
    layer,
    {
      panels: PANELS,
      meta: (p) => META[p],
      mountPanel: (p, root) => {
        mounts.push(p);
        root.textContent = `body of ${p}`;
        return { destroy: () => {} };
      },
      sizeKey: "test.size",
      onAction: (_id, act) => actions.push(act),
      onRender: ({ scoping }) => renders.push(scoping),
      ...extra,
    },
    defaultLayout(PANELS),
  );
  return { pane, layer, mgr, mounts, actions, renders };
}

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("PaneWindowManager", () => {
  it("mounts a panel only once its tab is first shown, unless the host wants it eagerly", () => {
    const { mgr, mounts } = setup({ mountEagerly: (p) => p === "log" });
    mgr.refresh();
    expect(mounts).toEqual(["log"]);
    mgr.openPanel("notes");
    expect(mounts).toEqual(["log", "notes"]);
    mgr.closePanel("notes");
    mgr.openPanel("notes");
    expect(mounts).toEqual(["log", "notes"]);
  });

  it("paints a host bar button and routes its press to onAction, escaping panel labels", () => {
    const { layer, mgr, actions } = setup({
      chrome: (w) => ({ buttons: w.active === "log" ? `<button class="pw-btn" data-pw-act="share"></button>` : "" }),
    });
    mgr.openPanel("log");
    const win = layer.querySelector<HTMLElement>(".pw-window")!;
    expect(win.querySelector(".pw-tab.on")!.textContent).toBe("Log <raw>");
    win.querySelector<HTMLElement>('[data-pw-act="share"]')!.click();
    expect(actions).toEqual(["share"]);
    expect(mgr.isShowing("log")).toBe(true);
  });

  it("keeps a host-hidden window in the layout but off screen", () => {
    let hide = false;
    const { layer, mgr } = setup({ isHidden: (w) => hide && w.tabs.includes("log") });
    mgr.commit(tearOff(mgr.layout, "log", { kind: "float", rect: null }));
    const logWin = () => layer.querySelector<HTMLElement>('.pw-window[data-active="log"]')!;
    expect(logWin().hidden).toBe(false);
    hide = true;
    mgr.refresh();
    expect(logWin().hidden).toBe(true);
    expect(mgr.layout.windows.some((w) => w.tabs.includes("log") && w.open)).toBe(true);
  });

  it("tells onRender a load apart from a user's change", () => {
    const { mgr, renders } = setup();
    mgr.load(defaultLayout(PANELS));
    mgr.openPanel("notes");
    expect(renders).toEqual([true, false]);
  });

  it("closeFront closes the front-most open window and reports when there was none", () => {
    const { mgr } = setup();
    expect(mgr.closeFront()).toBe(false);
    mgr.openPanel("notes");
    expect(mgr.closeFront()).toBe(true);
    expect(mgr.isShowing("notes")).toBe(false);
  });
});

describe("createLayoutStore", () => {
  it("remembers a layout per owner and repairs it against the panels on recall", () => {
    const store = createLayoutStore<P>({ key: "test.layouts" });
    expect(store.recall("a", PANELS)).toBeNull();
    store.remember("a", tearOff(defaultLayout(PANELS), "log", { kind: "snap", corner: "ne" }));
    const back = store.recall("a", ["notes"])!;
    expect(back.windows.map((w) => w.tabs)).toEqual([["notes"]]);
  });

  it("drops the oldest owners past max", () => {
    const store = createLayoutStore<P>({ key: "test.layouts", max: 2 });
    store.remember("a", defaultLayout(PANELS));
    store.remember("b", defaultLayout(PANELS));
    store.remember("c", defaultLayout(PANELS));
    const kept = Object.keys(JSON.parse(localStorage.getItem("test.layouts")!));
    expect(kept).toHaveLength(2);
    expect(kept).toContain("c");
  });
});
