import { html } from "lit-html";
import type { Field } from "../schema";
import type { PageDef } from "../stack";
import { fieldRow } from "../fields";
import type { DangerAction } from "../renderer";
import { THEME_OPTIONS, type PaletteDef, type ThemeValue } from "./theme";

export interface SystemPageDeps {
  systemInline: Field[];
  dangerActions: DangerAction[];
  current: Record<string, unknown>;
  theme: ThemeValue;
  palettes: PaletteDef[];
  palette: string | undefined;
  onChange: (key: string, value: unknown) => void;
  onThemeChange: (theme: ThemeValue) => void;
  onPaletteChange: (palette: string) => void;
  onReset: () => void;
  onDanger: (action: DangerAction) => void;
  onBack: () => void;
}

export function systemPage(deps: SystemPageDeps): PageDef {
  return {
    id: "system",
    title: "System",
    render: () => html`
      <div class="kit-section">
        <label class="kit-row" data-row="theme">
          <span class="kit-row-label">Theme</span>
          <select
            data-key="__kit_theme"
            class="kit-select"
            @change=${(e: Event) =>
              deps.onThemeChange((e.target as HTMLSelectElement).value as ThemeValue)}
          >
            ${THEME_OPTIONS.map(
              (opt) => html`<option value=${opt.value} ?selected=${opt.value === deps.theme}>${opt.label}</option>`,
            )}
          </select>
        </label>
        ${deps.palettes.length
          ? html`
              <div class="kit-row kit-row--column" data-row="palette">
                <span class="kit-row-label">Palette</span>
                <div class="kit-palette-grid">
                  ${deps.palettes.map((p) => {
                    const swatch = deps.theme === "light" ? p.lightSwatch : p.darkSwatch;
                    return html`
                      <button
                        type="button"
                        class=${`kit-palette-card ${p.id === deps.palette ? "kit-palette-card--active" : ""}`}
                        data-palette=${p.id}
                        title=${p.label}
                        @click=${() => deps.onPaletteChange(p.id)}
                      >
                        <span class="kit-palette-swatch">
                          ${swatch.map((c) => html`<span style=${`background:${c}`}></span>`)}
                        </span>
                        <span class="kit-palette-label">${p.label}</span>
                      </button>
                    `;
                  })}
                </div>
              </div>
            `
          : null}
        ${deps.systemInline
          .filter((f) => !f.visibleWhen || f.visibleWhen(deps.current))
          .map((f) =>
            fieldRow(f, deps.current[f.key], (v) => deps.onChange(f.key, v)),
          )}
      </div>

      <div class="kit-section kit-section--pinned-bottom">
        <div class="kit-section-title kit-section-danger">Danger zone</div>
        <div class="kit-row">
          <button class="kit-btn-danger" data-action="reset" @click=${deps.onReset}>
            Reset all settings
          </button>
        </div>
        ${deps.dangerActions.map(
          (a) => html`
            <div class="kit-row">
              <button
                class="kit-btn-danger"
                data-action=${`danger-${a.command}`}
                @click=${() => deps.onDanger(a)}
              >${a.label}</button>
            </div>
          `,
        )}
      </div>
    `,
  };
}
