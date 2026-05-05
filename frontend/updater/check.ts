import { check } from "@tauri-apps/plugin-updater";
import { ask, message } from "@tauri-apps/plugin-dialog";

export interface CheckOptions {
  /** Defaults to "Update available". */
  promptTitle?: string;
  /** Override the body. Receives the new version. */
  promptBody?: (version: string) => string;
}

export async function checkAndPromptUpdate(opts: CheckOptions = {}): Promise<void> {
  try {
    const update = await check();
    if (!update) {
      await message("You're up to date.", { title: "No updates found", kind: "info" });
      return;
    }

    const title = opts.promptTitle ?? "Update available";
    const body = opts.promptBody
      ? opts.promptBody(update.version)
      : `Version ${update.version} is available. Install now?`;

    const confirmed = await ask(body, { title, kind: "info" });
    if (!confirmed) return;

    await update.downloadAndInstall();
  } catch (err) {
    await message(`Update check failed: ${String(err)}`, { title: "Update error", kind: "error" });
  }
}
