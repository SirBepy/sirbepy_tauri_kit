import { describe, it, expect, beforeEach, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ close: vi.fn() }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getName: () => Promise.resolve("Mocked App"),
  getVersion: () => Promise.resolve("0.0.1-mock"),
}));

describe("renderSettingsPage v2", () => {
  let root: HTMLElement;

  beforeEach(() => {
    invoke.mockReset();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-theme");
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  it("loads settings and applies theme on mount", async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_settings") return { __kit_theme: "dark", work_minutes: 25 };
      return undefined;
    });

    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(root, {
      schema: { sections: [{ title: "Times", fields: [] }] },
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("renders root page with sections + System + Danger zone", async () => {
    invoke.mockImplementation(async () => ({}));
    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(root, {
      schema: { sections: [{ title: "Times", fields: [] }] },
    });

    expect(root.querySelector('[data-nav="section-times"]')).toBeTruthy();
    expect(root.querySelector('[data-nav="theme"]')).toBeTruthy();
    expect(root.querySelector('[data-nav="about"]')).toBeTruthy();
    expect(root.querySelector('[data-action="reset"]')).toBeTruthy();
  });

  it("clicking a section nav-row pushes that section page", async () => {
    invoke.mockImplementation(async () => ({}));
    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(root, {
      schema: {
        sections: [{ title: "Times", fields: [{ key: "work_minutes", kind: "integer", label: "Pomo" }] }],
      },
    });

    const nav = root.querySelector<HTMLElement>('[data-nav="section-times"]')!;
    nav.click();
    // After push, root nav-row is replaced by section page; back button visible.
    expect(root.querySelector(".kit-header-back")).toBeTruthy();
    expect(root.querySelector('input[data-key="work_minutes"]')).toBeTruthy();
  });
});
