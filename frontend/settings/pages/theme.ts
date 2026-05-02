import { html } from "lit-html";
import type { PageDef } from "../stack";

export type ThemeValue = "light" | "dark" | "system";

const VALID: ThemeValue[] = ["light", "dark", "system"];

/** Sets data-theme on <html>. Falls back to "system" for unknown values. */
export function applyTheme(theme: string): void {
  const valid = VALID.includes(theme as ThemeValue) ? theme : "system";
  document.documentElement.setAttribute("data-theme", valid);
}

/** Theme picker sub-page. */
export function themePage(
  current: ThemeValue,
  onChange: (theme: ThemeValue) => void,
  onBack: () => void,
): PageDef {
  return {
    id: "theme",
    title: "Theme",
    render: () => html`
      <header class="kit-header">
        <button class="kit-header-back" @click=${onBack}>‹ Settings</button>
        <h2 class="kit-header-title">Theme</h2>
        <span class="kit-header-spacer"></span>
      </header>
      <div class="kit-theme-cards">
        ${VALID.map(
          (t) => html`
            <div
              class=${`kit-theme-card ${t === current ? "kit-theme-card-active" : ""}`}
              data-theme-value=${t}
              @click=${() => {
                applyTheme(t);
                onChange(t);
              }}
            >
              <div class=${`kit-theme-swatch kit-theme-swatch-${t}`}></div>
              <div class="kit-theme-card-label">${t.charAt(0).toUpperCase() + t.slice(1)}</div>
            </div>
          `,
        )}
      </div>
    `,
  };
}
