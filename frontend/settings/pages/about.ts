import { html } from "lit-html";
import type { PageDef } from "../stack";

/** Browser-safe fallback opener used when the host app does not inject one. */
function defaultOpenLink(url: string): void {
  window.open(url, "_blank", "noopener");
}

export type AutoUpdateMode = "never" | "onStartup" | "immediate";

export interface AboutUpdateDeps {
  statusText?: string;
  statusColor?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface AboutPageDeps {
  appName: string;
  version: string;
  /** Build timestamp embedded at compile time, e.g. "2026-06-15". */
  buildDate?: string;
  /** Date the current version was first launched on this machine, e.g. "2026-06-15". */
  installedAt?: string;
  developer: {
    name: string;
    links: Record<string, string | null | undefined>;
  };
  autoUpdate: AutoUpdateMode;
  onAutoUpdateChange: (mode: AutoUpdateMode) => void;
  onCheckNow: () => Promise<void>;
  onCopyLogs: () => Promise<void>;
  onBack: () => void;
  /**
   * Opens an external link. The consuming Tauri app should route this through its
   * own opener (e.g. an `open_external` IPC). Defaults to `window.open`. The kit
   * deliberately does NOT import `@tauri-apps/plugin-opener` so it carries no
   * Tauri dependency and bundles cleanly in any consumer.
   */
  onOpenLink?: (url: string) => void;
  /** Update state for display + action button. When omitted, shows "Up to date". */
  update?: AboutUpdateDeps;
  /** Called when internal state changes (e.g. version tap counter), so host can re-render. */
  onRerender?: () => void;
}

/** Phosphor icon class for a known link key. */
function iconClassFor(linkKey: string): string {
  switch (linkKey) {
    case "github": return "ph ph-github-logo";
    case "youtube": return "ph ph-youtube-logo";
    case "twitter": return "ph ph-twitter-logo";
    case "website": return "ph ph-globe";
    default: return "ph ph-link-simple";
  }
}

/** Persistent state across renders within the same About page instance. */
interface AboutState {
  tapCount: number;
  lastTapAt: number;
  debugUnlocked: boolean;
  checking: boolean;
}

const TAP_WINDOW_MS = 3000;
const TAPS_REQUIRED = 5;
const DEBUG_STORAGE_KEY = "kit_debug_unlocked";

export function aboutPage(deps: AboutPageDeps): PageDef {
  const openLink = deps.onOpenLink ?? defaultOpenLink;
  const state: AboutState = {
    tapCount: 0,
    lastTapAt: 0,
    debugUnlocked: localStorage.getItem(DEBUG_STORAGE_KEY) === "1",
    checking: false,
  };

  const onCheckClick = async () => {
    if (state.checking) return;
    state.checking = true;
    deps.onRerender?.();
    try {
      await deps.onCheckNow();
    } finally {
      state.checking = false;
      deps.onRerender?.();
    }
  };

  const onVersionTap = () => {
    const now = Date.now();
    if (now - state.lastTapAt > TAP_WINDOW_MS) {
      state.tapCount = 1;
    } else {
      state.tapCount += 1;
    }
    state.lastTapAt = now;
    if (state.tapCount >= TAPS_REQUIRED && !state.debugUnlocked) {
      state.debugUnlocked = true;
      localStorage.setItem(DEBUG_STORAGE_KEY, "1");
      deps.onRerender?.();
    }
  };

  return {
    id: "about",
    title: "About",
    render: () => html`
      <div class="kit-about-page">
      <div class="kit-about-hero">
        <div class="kit-about-app-name">${deps.appName}</div>
        <div class="kit-about-version" @click=${onVersionTap}>v${deps.version}</div>
        ${deps.buildDate ? html`<div class="kit-about-meta">Built ${deps.buildDate}</div>` : null}
        ${deps.installedAt ? html`<div class="kit-about-meta">Installed ${deps.installedAt}</div>` : null}
        <div
          class="kit-about-status"
          style=${deps.update?.statusColor ? `color: ${deps.update.statusColor}` : ""}
        >${deps.update?.statusText ?? "Up to date"}</div>
      </div>

      <div class="kit-section">
        <label class="kit-row">
          <span class="kit-row-label">Auto-update</span>
          <select
            class="kit-select"
            data-key="kit-auto-update"
            .value=${deps.autoUpdate}
            @change=${(e: Event) =>
              deps.onAutoUpdateChange((e.target as HTMLSelectElement).value as AutoUpdateMode)}
          >
            <option value="never">Never</option>
            <option value="onStartup">On startup</option>
            <option value="immediate">Immediate</option>
          </select>
        </label>
        <div class="kit-row" style="border-top: 1px solid var(--kit-border)">
          <button
            class="kit-btn-secondary"
            style="width: 100%"
            data-action="check-now"
            ?disabled=${state.checking}
            @click=${() => void onCheckClick()}
          >${state.checking
            ? html`<i class="ph ph-circle-notch kit-spin"></i> Checking…`
            : html`↻ Check for updates now`}</button>
        </div>

        ${deps.update?.actionLabel && deps.update.onAction
          ? html`
            <div class="kit-row">
              <button
                class="kit-btn-primary"
                style="width: 100%"
                data-action="update-action"
                @click=${deps.update.onAction}
              >${deps.update.actionLabel}</button>
            </div>
          `
          : null}

        ${state.debugUnlocked
          ? html`
              <div class="kit-row">
                <button
                  class="kit-btn-secondary"
                  style="width: 100%"
                  data-action="copy-logs"
                  @click=${async (e: MouseEvent) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    const orig = btn.textContent;
                    try {
                      await deps.onCopyLogs();
                      btn.textContent = "Copied!";
                    } catch (err) {
                      console.error("copy logs failed", err);
                      btn.textContent = "Copy failed";
                    }
                    setTimeout(() => {
                      if (document.contains(btn)) btn.textContent = orig;
                    }, 1500);
                  }}
                >Copy debug logs</button>
              </div>
            `
          : null}
      </div>

      <div class="kit-dev-block">
        <div class="kit-dev-name">Made by ${deps.developer.name}</div>
        <div class="kit-dev-links">
          ${Object.entries(deps.developer.links)
            .filter(([, url]) => !!url)
            .map(
              ([key, url]) => html`
                <button
                  class="kit-dev-link"
                  type="button"
                  title=${key}
                  @click=${() => openLink(url!)}
                >
                  <i class=${iconClassFor(key)}></i>
                </button>
              `,
            )}
        </div>
      </div>
      </div>
    `,
  };
}
