import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export type AutoUpdateMode = "never" | "onStartup" | "immediate";

export interface AutoCheckOptions {
  /** Defaults to "get_settings". */
  loadCommand?: string;
}

/** Reads __kit_auto_update from settings, then dispatches accordingly. */
export async function runAutoUpdateCheck(opts: AutoCheckOptions = {}): Promise<void> {
  try {
    const settings = (await invoke<Record<string, unknown>>(
      opts.loadCommand ?? "get_settings",
    )) ?? {};
    const mode = (settings["__kit_auto_update"] as AutoUpdateMode) ?? "onStartup";

    if (mode === "never") return;

    const update = await check();
    if (!update) return;

    if (mode === "immediate") {
      await update.downloadAndInstall();
      return;
    }

    // onStartup: prompt
    const confirmed = await ask(
      `Version ${update.version} is available. Install now?`,
      { title: "Update available", kind: "info" },
    );
    if (confirmed) {
      await update.downloadAndInstall();
    }
  } catch (err) {
    console.warn("[tauri_kit_updater] auto-check failed:", err);
  }
}
