import { check, type Update } from "@tauri-apps/plugin-updater";
import { ask, message } from "@tauri-apps/plugin-dialog";

export interface CheckOptions {
  /** Defaults to "Update available". */
  promptTitle?: string;
  /** Override the body. Receives the new version. */
  promptBody?: (version: string) => string;
}

export interface DownloadProgress {
  /** Bytes downloaded so far. */
  downloaded: number;
  /** Total bytes to download, or null if the server didn't report a content length. */
  total: number | null;
}

/** Wraps `update.downloadAndInstall`, tracking bytes downloaded so callers can render progress. */
export async function downloadAndInstallWithProgress(
  update: Update,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
    }
    onProgress?.({ downloaded, total });
  });
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

    await downloadAndInstallWithProgress(update);
  } catch (err) {
    await message(`Update check failed: ${String(err)}`, { title: "Update error", kind: "error" });
  }
}
