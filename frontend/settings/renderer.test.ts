import { describe, it, expect, beforeEach, vi } from "vitest";

const invoke = vi.fn();
const checkMock = vi.fn();
const relaunchMock = vi.fn();

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

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => checkMock(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => relaunchMock(...args),
}));

describe("renderSettingsPage v2", () => {
  let root: HTMLElement;

  beforeEach(() => {
    invoke.mockReset();
    checkMock.mockReset();
    relaunchMock.mockReset();
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

  it("renders root page with sections + System nav-row", async () => {
    invoke.mockImplementation(async () => ({}));
    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(root, {
      schema: { sections: [{ title: "Times", fields: [] }] },
    });

    expect(root.querySelector('[data-nav="section-times"]')).toBeTruthy();
    expect(root.querySelector('[data-nav="system"]')).toBeTruthy();
    // About lives on root; Theme/Reset live in the System subpage.
    expect(root.querySelector('[data-nav="about"]')).toBeTruthy();
    expect(root.querySelector('select[data-key="__kit_theme"]')).toBeFalsy();
    expect(root.querySelector('[data-action="reset"]')).toBeFalsy();
  });

  it("clicking System nav-row pushes the System subpage", async () => {
    invoke.mockImplementation(async () => ({}));
    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(root, {
      schema: { sections: [{ title: "Times", fields: [] }] },
    });

    const nav = root.querySelector<HTMLElement>('[data-nav="system"]')!;
    nav.click();
    expect(root.querySelector('select[data-key="__kit_theme"]')).toBeTruthy();
    // About is on root now, not inside System subpage.
    expect(root.querySelector('[data-nav="about"]')).toBeFalsy();
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
    // After push, root nav-row is replaced by section page with fields visible.
    expect(root.querySelector('input[data-key="work_minutes"]')).toBeTruthy();
  });

  it("renders grouped section as multiple sub-sections with sub-headers", async () => {
    invoke.mockImplementation(async () => ({}));
    const { renderSettingsPage } = await import("./renderer");
    await renderSettingsPage(root, {
      schema: {
        sections: [
          {
            title: "Timer",
            groups: [
              {
                title: "Durations",
                fields: [{ key: "work_minutes", kind: "integer", label: "Pomo" }],
              },
              {
                title: "Behavior",
                fields: [{ key: "auto_start_work", kind: "toggle", label: "Auto" }],
              },
            ],
          },
        ],
      },
    });

    root.querySelector<HTMLElement>('[data-nav="section-timer"]')!.click();

    const titles = Array.from(root.querySelectorAll(".kit-section-title")).map(
      (el) => el.textContent?.trim(),
    );
    expect(titles).toContain("Durations");
    expect(titles).toContain("Behavior");
    expect(root.querySelector('input[data-key="work_minutes"]')).toBeTruthy();
    expect(root.querySelector('[data-key="auto_start_work"]')).toBeTruthy();
  });

  describe("About page update flow", () => {
    async function openAbout() {
      invoke.mockImplementation(async () => ({}));
      const { renderSettingsPage } = await import("./renderer");
      await renderSettingsPage(root, { schema: { sections: [] } });
      root.querySelector<HTMLElement>('[data-nav="about"]')!.click();
      // navAbout is fire-and-forget (awaits dynamic getName/getVersion imports
      // before pushing the page), so wait for it to actually land.
      await vi.waitFor(() => {
        expect(root.querySelector('[data-action="check-now"]')).toBeTruthy();
      });
    }

    it("shows 'Up to date' after checking with no update available", async () => {
      checkMock.mockResolvedValue(null);
      await openAbout();

      root.querySelector<HTMLButtonElement>('[data-action="check-now"]')!.click();
      await vi.waitFor(() => {
        expect(root.querySelector(".kit-about-status")?.textContent).toBe("Up to date");
      });
      expect(root.querySelector('[data-action="update-action"]')).toBeFalsy();
    });

    it("shows the new version and a Download & Install action when an update is found", async () => {
      checkMock.mockResolvedValue({ version: "1.2.3", downloadAndInstall: vi.fn() });
      await openAbout();

      root.querySelector<HTMLButtonElement>('[data-action="check-now"]')!.click();
      await vi.waitFor(() => {
        expect(root.querySelector(".kit-about-status")?.textContent).toContain("1.2.3");
      });
      expect(root.querySelector('[data-action="update-action"]')?.textContent).toContain("Download & Install");
    });

    it("downloads with live progress, then offers Relaunch now which calls relaunch()", async () => {
      const downloadAndInstall = vi.fn(async (onEvent: (e: unknown) => void) => {
        onEvent({ event: "Started", data: { contentLength: 100 } });
        onEvent({ event: "Progress", data: { chunkLength: 100 } });
        onEvent({ event: "Finished" });
      });
      checkMock.mockResolvedValue({ version: "1.2.3", downloadAndInstall });
      await openAbout();

      root.querySelector<HTMLButtonElement>('[data-action="check-now"]')!.click();
      await vi.waitFor(() => {
        expect(root.querySelector('[data-action="update-action"]')).toBeTruthy();
      });

      root.querySelector<HTMLButtonElement>('[data-action="update-action"]')!.click();
      await vi.waitFor(() => {
        expect(root.querySelector(".kit-about-status")?.textContent).toContain("installed");
      });
      expect(downloadAndInstall).toHaveBeenCalled();

      const relaunchBtn = root.querySelector<HTMLButtonElement>('[data-action="update-action"]')!;
      expect(relaunchBtn.textContent).toContain("Relaunch now");
      relaunchBtn.click();
      await vi.waitFor(() => {
        expect(relaunchMock).toHaveBeenCalled();
      });
    });
  });
});
