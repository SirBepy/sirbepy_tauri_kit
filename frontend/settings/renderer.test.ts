import { describe, it, expect, beforeEach, vi } from "vitest";
import { defineSchema } from "./schema";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ close: vi.fn() }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
}));

describe("renderSettingsPage", () => {
  beforeEach(() => {
    invoke.mockReset();
    document.body.innerHTML = "";
  });

  it("loads settings on mount and populates fields", async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_settings") return { work_minutes: 25, sound_enabled: true };
      return undefined;
    });

    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(document.body, {
      schema: defineSchema({
        sections: [
          {
            title: "Times",
            fields: [
              { key: "work_minutes", kind: "number", label: "Work" },
              { key: "sound_enabled", kind: "toggle", label: "Sound" },
            ],
          },
        ],
      }),
    });

    const numberInput = document.querySelector<HTMLInputElement>(
      'input[data-key="work_minutes"]',
    );
    const toggleInput = document.querySelector<HTMLInputElement>(
      'input[data-key="sound_enabled"]',
    );
    expect(numberInput?.value).toBe("25");
    expect(toggleInput?.checked).toBe(true);
  });

  it("calls save_settings on save click with current form values", async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "get_settings") return { work_minutes: 25 };
      if (cmd === "save_settings") return undefined;
      return undefined;
    });

    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(document.body, {
      schema: defineSchema({
        sections: [
          {
            title: "Times",
            fields: [{ key: "work_minutes", kind: "number", label: "Work" }],
          },
        ],
      }),
    });

    const input = document.querySelector<HTMLInputElement>(
      'input[data-key="work_minutes"]',
    )!;
    input.value = "42";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const saveBtn = document.querySelector<HTMLButtonElement>(
      'button[data-action="save"]',
    )!;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(invoke).toHaveBeenCalledWith("save_settings", {
      settings: { work_minutes: 42 },
    });
  });

  it("renders select options", async () => {
    invoke.mockImplementation(async () => ({ corner: "tl" }));

    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(document.body, {
      schema: defineSchema({
        sections: [
          {
            title: "Pos",
            fields: [
              {
                key: "corner",
                kind: "select",
                label: "Corner",
                options: [
                  { value: "tl", label: "Top Left" },
                  { value: "tr", label: "Top Right" },
                ],
              },
            ],
          },
        ],
      }),
    });

    const select = document.querySelector<HTMLSelectElement>(
      'select[data-key="corner"]',
    )!;
    expect(select.value).toBe("tl");
    expect(select.options.length).toBe(2);
  });
});
