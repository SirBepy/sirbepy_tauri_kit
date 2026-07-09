import { html, type TemplateResult } from "lit-html";
import type { Field } from "../schema";
import type { PageDef } from "../stack";
import { fieldRow } from "../fields";
import type { DangerAction } from "../renderer";
import { THEME_OPTIONS, type PaletteDef, type ThemeValue } from "./theme";

type SettingsValue = Record<string, unknown>;

/**
 * A plain-data System-page section: a title plus either kit `Field[]` rows,
 * a custom `render()` escape hatch, or both (fields render first, then the
 * custom render output). No app assumptions - a consumer that only wants the
 * generic sections layer (no built-in theme/palette/danger-zone) can pass
 * just `sections` and `onBack`.
 */
export interface SystemPageSection {
  title: string;
  fields?: Field[];
  render?: () => TemplateResult;
}

export interface SystemPageDeps {
  /** Plain-data sections rendered between the built-in rows and the danger zone. */
  sections?: SystemPageSection[];
  systemInline?: Field[];
  dangerActions?: DangerAction[];
  current?: SettingsValue;
  theme?: ThemeValue;
  palettes?: PaletteDef[];
  palette?: string | undefined;
  /** Called per field change (systemInline fields and `sections[].fields`). Never invokes a Tauri command itself - the consuming app decides how to persist. */
  onChange?: (key: string, value: unknown) => void;
  onThemeChange?: (theme: ThemeValue) => void;
  onPaletteChange?: (palette: string) => void;
  onReset?: () => void;
  onDanger?: (action: DangerAction) => void;
  onBack: () => void;
}

function renderSection(
  section: SystemPageSection,
  current: SettingsValue,
  onChange: (key: string, value: unknown) => void,
): TemplateResult {
  return html`
    <div class="kit-section">
      <div class="kit-section-title">${section.title}</div>
      ${(section.fields ?? [])
        .filter((f) => !f.visibleWhen || f.visibleWhen(current))
        .map((f) => fieldRow(f, current[f.key], (v) => onChange(f.key, v), current))}
      ${section.render ? section.render() : null}
    </div>
  `;
}

export function systemPage(deps: SystemPageDeps): PageDef {
  const current = deps.current ?? {};
  const onChange = deps.onChange ?? (() => {});
  const palettes = deps.palettes ?? [];
  const systemInline = deps.systemInline ?? [];
  const dangerActions = deps.dangerActions ?? [];
  const showTheme = deps.theme !== undefined && deps.onThemeChange !== undefined;
  const showBuiltins = showTheme || palettes.length > 0 || systemInline.length > 0;
  const showDangerZone = deps.onReset !== undefined || dangerActions.length > 0;

  return {
    id: "system",
    title: "System",
    render: () => html`
      ${showBuiltins
        ? html`
            <div class="kit-section">
              ${showTheme
                ? html`
                    <label class="kit-row" data-row="theme">
                      <span class="kit-row-label">Theme</span>
                      <select
                        data-key="__kit_theme"
                        class="kit-select"
                        @change=${(e: Event) =>
                          deps.onThemeChange?.((e.target as HTMLSelectElement).value as ThemeValue)}
                      >
                        ${THEME_OPTIONS.map(
                          (opt) => html`<option value=${opt.value} ?selected=${opt.value === deps.theme}>${opt.label}</option>`,
                        )}
                      </select>
                    </label>
                  `
                : null}
              ${palettes.length
                ? html`
                    <div class="kit-row kit-row--column" data-row="palette">
                      <span class="kit-row-label">Palette</span>
                      <div class="kit-palette-grid">
                        ${palettes.map((p) => {
                          const swatch = deps.theme === "light" ? p.lightSwatch : p.darkSwatch;
                          return html`
                            <button
                              type="button"
                              class=${`kit-palette-card ${p.id === deps.palette ? "kit-palette-card--active" : ""}`}
                              data-palette=${p.id}
                              title=${p.label}
                              @click=${() => deps.onPaletteChange?.(p.id)}
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
              ${systemInline
                .filter((f) => !f.visibleWhen || f.visibleWhen(current))
                .map((f) => fieldRow(f, current[f.key], (v) => onChange(f.key, v), current))}
            </div>
          `
        : null}
      ${(deps.sections ?? []).map((s) => renderSection(s, current, onChange))}

      ${showDangerZone
        ? html`
            <div class="kit-section kit-section--pinned-bottom">
              <div class="kit-section-title kit-section-danger">Danger zone</div>
              ${deps.onReset
                ? html`
                    <div class="kit-row">
                      <button class="kit-btn-danger" data-action="reset" @click=${deps.onReset}>
                        Reset all settings
                      </button>
                    </div>
                  `
                : null}
              ${dangerActions.map(
                (a) => html`
                  <div class="kit-row">
                    <button
                      class="kit-btn-danger"
                      data-action=${`danger-${a.command}`}
                      @click=${() => deps.onDanger?.(a)}
                    >${a.label}</button>
                  </div>
                `,
              )}
            </div>
          `
        : null}
    `,
  };
}
