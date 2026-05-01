import { describe, it, expect, vi, beforeEach } from "vitest";

const checkMock = vi.fn();
const askMock = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => checkMock(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => askMock(...args),
}));

describe("checkAndPromptUpdate", () => {
  beforeEach(() => {
    checkMock.mockReset();
    askMock.mockReset();
  });

  it("does nothing when no update available", async () => {
    checkMock.mockResolvedValue(null);
    const { checkAndPromptUpdate } = await import("./check");
    await checkAndPromptUpdate();
    expect(askMock).not.toHaveBeenCalled();
  });

  it("prompts user when update available, installs on confirm", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    checkMock.mockResolvedValue({ version: "0.3.0", downloadAndInstall });
    askMock.mockResolvedValue(true);

    const { checkAndPromptUpdate } = await import("./check");
    await checkAndPromptUpdate();

    expect(askMock).toHaveBeenCalled();
    expect(downloadAndInstall).toHaveBeenCalled();
  });

  it("does not install when user declines prompt", async () => {
    const downloadAndInstall = vi.fn();
    checkMock.mockResolvedValue({ version: "0.3.0", downloadAndInstall });
    askMock.mockResolvedValue(false);

    const { checkAndPromptUpdate } = await import("./check");
    await checkAndPromptUpdate();

    expect(downloadAndInstall).not.toHaveBeenCalled();
  });

  it("swallows errors from check", async () => {
    checkMock.mockRejectedValue(new Error("network down"));
    const { checkAndPromptUpdate } = await import("./check");
    await expect(checkAndPromptUpdate()).resolves.toBeUndefined();
  });
});
