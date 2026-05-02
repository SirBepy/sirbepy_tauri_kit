import { describe, it, expect, vi, beforeEach } from "vitest";

const checkMock = vi.fn();
const askMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => checkMock(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => askMock(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe("runAutoUpdateCheck", () => {
  beforeEach(() => {
    checkMock.mockReset();
    askMock.mockReset();
    invokeMock.mockReset();
  });

  it("does nothing in 'never' mode", async () => {
    invokeMock.mockResolvedValue({ __kit_auto_update: "never" });
    const { runAutoUpdateCheck } = await import("./auto-check");
    await runAutoUpdateCheck();
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("prompts user in 'onStartup' mode", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    invokeMock.mockResolvedValue({ __kit_auto_update: "onStartup" });
    checkMock.mockResolvedValue({ version: "0.3.0", downloadAndInstall });
    askMock.mockResolvedValue(true);

    const { runAutoUpdateCheck } = await import("./auto-check");
    await runAutoUpdateCheck();

    expect(askMock).toHaveBeenCalled();
    expect(downloadAndInstall).toHaveBeenCalled();
  });

  it("auto-installs without prompting in 'immediate' mode", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    invokeMock.mockResolvedValue({ __kit_auto_update: "immediate" });
    checkMock.mockResolvedValue({ version: "0.3.0", downloadAndInstall });

    const { runAutoUpdateCheck } = await import("./auto-check");
    await runAutoUpdateCheck();

    expect(askMock).not.toHaveBeenCalled();
    expect(downloadAndInstall).toHaveBeenCalled();
  });

  it("falls back to onStartup if mode is missing", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    invokeMock.mockResolvedValue({}); // no __kit_auto_update key
    checkMock.mockResolvedValue({ version: "0.3.0", downloadAndInstall });
    askMock.mockResolvedValue(true);

    const { runAutoUpdateCheck } = await import("./auto-check");
    await runAutoUpdateCheck();

    expect(askMock).toHaveBeenCalled();
  });
});
