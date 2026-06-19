import { describe, it, expect } from "vitest";
import { render } from "lit-html";
import { buildAccelerator, findKeybindConflict, keybindControls } from "./keybind";

// buildAccelerator only reads key/code + modifier flags, so a plain object
// standing in for KeyboardEvent is enough (no DOM needed).
const ev = (over: Partial<KeyboardEvent>): KeyboardEvent =>
  ({ key: "", code: "", ctrlKey: false, altKey: false, shiftKey: false, ...over }) as KeyboardEvent;

describe("buildAccelerator", () => {
  it("builds Shift+digit (e.key is the shifted glyph, so must read e.code)", () => {
    // Real browser event for Shift+1: key="!", code="Digit1".
    expect(buildAccelerator(ev({ key: "!", code: "Digit1", shiftKey: true }))).toBe("Shift+1");
  });

  it("builds Shift+letter", () => {
    expect(buildAccelerator(ev({ key: "A", code: "KeyA", shiftKey: true }))).toBe("Shift+A");
  });

  it("builds Ctrl+digit without shift", () => {
    expect(buildAccelerator(ev({ key: "1", code: "Digit1", ctrlKey: true }))).toBe("Ctrl+1");
  });

  it("orders modifiers Ctrl+Alt+Shift", () => {
    expect(
      buildAccelerator(ev({ key: "P", code: "KeyP", ctrlKey: true, altKey: true, shiftKey: true })),
    ).toBe("Ctrl+Alt+Shift+P");
  });

  it("maps Space and arrows", () => {
    expect(buildAccelerator(ev({ key: " ", code: "Space", altKey: true }))).toBe("Alt+Space");
    expect(buildAccelerator(ev({ key: "ArrowRight", code: "ArrowRight", altKey: true }))).toBe("Alt+Right");
  });

  it("returns null with no modifier", () => {
    expect(buildAccelerator(ev({ key: "a", code: "KeyA" }))).toBeNull();
  });

  it("returns null for an unsupported key", () => {
    expect(buildAccelerator(ev({ key: "Tab", code: "Tab", ctrlKey: true }))).toBeNull();
  });
});

describe("findKeybindConflict", () => {
  it("flags two keys holding the same accelerator", () => {
    const current = { keybind_pause: "Ctrl+P", keybind_skip: "Ctrl+P" };
    expect(findKeybindConflict(current, "keybind_pause", "Ctrl+P")).toBe(true);
  });

  it("does not flag a unique accelerator", () => {
    const current = { keybind_pause: "Ctrl+P", keybind_skip: "Ctrl+S" };
    expect(findKeybindConflict(current, "keybind_pause", "Ctrl+P")).toBe(false);
  });

  it("ignores the field's own value (no self-conflict)", () => {
    const current = { keybind_pause: "Ctrl+P" };
    expect(findKeybindConflict(current, "keybind_pause", "Ctrl+P")).toBe(false);
  });

  it("never flags an unset (null/empty) binding even if another is unset", () => {
    const current = { keybind_pause: null, keybind_skip: null };
    expect(findKeybindConflict(current, "keybind_pause", null)).toBe(false);
  });
});

describe("keybindControls render", () => {
  const renderRow = (value: unknown, current: Record<string, unknown>) => {
    const root = document.createElement("div");
    render(keybindControls(value, current, "keybind_pause", () => {}), root);
    return root;
  };

  it("shows the accelerator in the badge", () => {
    const badge = renderRow("Ctrl+P", { keybind_pause: "Ctrl+P" }).querySelector(".kit-keybind-badge");
    expect(badge?.textContent?.trim()).toBe("Ctrl+P");
  });

  it("shows 'Not set' when unbound and hides the Clear button", () => {
    const root = renderRow(null, { keybind_pause: null });
    expect(root.querySelector(".kit-keybind-badge")?.textContent?.trim()).toBe("Not set");
    // Only the Record button is present when unbound.
    expect(root.querySelectorAll("button").length).toBe(1);
  });

  it("adds the conflict modifier class when another binding matches", () => {
    const badge = renderRow("Ctrl+P", {
      keybind_pause: "Ctrl+P",
      keybind_skip: "Ctrl+P",
    }).querySelector(".kit-keybind-badge");
    expect(badge?.classList.contains("kit-keybind-badge--conflict")).toBe(true);
  });

  it("omits the conflict class when the binding is unique", () => {
    const badge = renderRow("Ctrl+P", {
      keybind_pause: "Ctrl+P",
      keybind_skip: "Ctrl+S",
    }).querySelector(".kit-keybind-badge");
    expect(badge?.classList.contains("kit-keybind-badge--conflict")).toBe(false);
  });
});
