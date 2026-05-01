import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface OpenSettingsOptions {
  url: string;
  width?: number;
  height?: number;
  title?: string;
  label?: string;
  resizable?: boolean;
}

export async function openSettingsWindow(opts: OpenSettingsOptions): Promise<void> {
  const label = opts.label ?? "kit-settings";
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow(label, {
    url: opts.url,
    title: opts.title ?? "Settings",
    width: opts.width ?? 480,
    height: opts.height ?? 720,
    resizable: opts.resizable ?? true,
    center: true,
  });
}
