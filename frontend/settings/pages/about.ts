import { html } from "lit-html";
import type { PageDef } from "../stack";

export type AutoUpdateMode = "never" | "onStartup" | "immediate";

export interface AboutPageDeps {
  appName: string;
  version: string;
  developer: {
    name: string;
    links: Record<string, string | null | undefined>;
  };
  autoUpdate: AutoUpdateMode;
  lastChecked: Date | null;
  onAutoUpdateChange: (mode: AutoUpdateMode) => void;
  onCheckNow: () => Promise<void>;
  onCopyLogs: () => Promise<void>;
  onBack: () => void;
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
}

const TAP_WINDOW_MS = 3000;
const TAPS_REQUIRED = 5;

export function aboutPage(deps: AboutPageDeps): PageDef {
  const state: AboutState = { tapCount: 0, lastTapAt: 0, debugUnlocked: false };

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
      deps.onRerender?.();
    }
  };

  const formatLastChecked = (d: Date | null): string => {
    if (!d) return "Never";
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  return {
    id: "about",
    title: "About",
    render: () => html`
      <header class="kit-header">
        <button class="kit-header-back" @click=${deps.onBack}>‹ Settings</button>
        <h2 class="kit-header-title">About</h2>
        <span class="kit-header-spacer"></span>
      </header>

      <div class="kit-about-hero">
        <div class="kit-about-app-name">${deps.appName}</div>
        <div class="kit-about-version" @click=${onVersionTap}>v${deps.version}</div>
        <div class="kit-about-status">Up to date</div>
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
        <div class="kit-row">
          <span class="kit-row-label" style="color: var(--kit-text-dim)">Last checked</span>
          <span style="color: var(--kit-text-dim); font-size: 12px">${formatLastChecked(deps.lastChecked)}</span>
        </div>
        <div class="kit-row" style="border-top: 1px solid var(--kit-border)">
          <button
            class="kit-btn-secondary"
            style="width: 100%"
            data-action="check-now"
            @click=${() => void deps.onCheckNow()}
          >↻ Check for updates now</button>
        </div>

        ${state.debugUnlocked
          ? html`
              <div class="kit-row">
                <button
                  class="kit-btn-secondary"
                  style="width: 100%"
                  data-action="copy-logs"
                  @click=${() => void deps.onCopyLogs()}
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
                <a class="kit-dev-link" href=${url!} target="_blank" rel="noopener" title=${key}>
                  <i class=${iconClassFor(key)}></i>
                </a>
              `,
            )}
        </div>
      </div>
    `,
  };
}
