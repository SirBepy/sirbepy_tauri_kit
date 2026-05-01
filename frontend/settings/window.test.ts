import { describe, it, expect, vi, beforeEach } from "vitest";

const ctorMock = vi.fn();
const setFocusMock = vi.fn();
const getByLabelMock = vi.fn();

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: class {
    static getByLabel = getByLabelMock;
    constructor(label: string, opts: object) {
      ctorMock(label, opts);
    }
  },
}));

describe("openSettingsWindow", () => {
  beforeEach(() => {
    ctorMock.mockReset();
    setFocusMock.mockReset();
    getByLabelMock.mockReset();
  });

  it("creates a new window when none exists", async () => {
    getByLabelMock.mockResolvedValue(null);
    const { openSettingsWindow } = await import("./window");

    await openSettingsWindow({ url: "settings.html", title: "Settings" });

    expect(ctorMock).toHaveBeenCalledWith(
      "kit-settings",
      expect.objectContaining({ url: "settings.html", title: "Settings" }),
    );
  });

  it("focuses existing window if already open", async () => {
    getByLabelMock.mockResolvedValue({ setFocus: setFocusMock });
    const { openSettingsWindow } = await import("./window");

    await openSettingsWindow({ url: "settings.html" });

    expect(setFocusMock).toHaveBeenCalled();
    expect(ctorMock).not.toHaveBeenCalled();
  });
});
