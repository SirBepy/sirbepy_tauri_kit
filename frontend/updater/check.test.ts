import { describe, it, expect, vi, beforeEach } from "vitest";

const checkMock = vi.fn();
const askMock = vi.fn();
const messageMock = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => checkMock(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => askMock(...args),
  message: (...args: unknown[]) => messageMock(...args),
}));

describe("checkAndPromptUpdate", () => {
  beforeEach(() => {
    checkMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset().mockResolvedValue(undefined);
  });

  it("shows up-to-date message when no update available", async () => {
    checkMock.mockResolvedValue(null);
    const { checkAndPromptUpdate } = await import("./check");
    await checkAndPromptUpdate();
    expect(messageMock).toHaveBeenCalledWith("You're up to date.", expect.objectContaining({ title: "No updates found" }));
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

  it("shows error dialog on check failure", async () => {
    checkMock.mockRejectedValue(new Error("network down"));
    const { checkAndPromptUpdate } = await import("./check");
    await expect(checkAndPromptUpdate()).resolves.toBeUndefined();
    expect(messageMock).toHaveBeenCalledWith(expect.stringContaining("network down"), expect.objectContaining({ title: "Update error" }));
  });
});
