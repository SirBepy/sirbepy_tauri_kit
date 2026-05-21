import { html } from "lit-html";
import type { Field } from "../schema";
import type { PageDef } from "../stack";
import { fieldRow } from "../fields";
import type { DangerAction } from "../renderer";
import { THEME_OPTIONS, type ThemeValue } from "./theme";
import { navRow } from "./parts";

export interface SystemPageDeps {
  systemInline: Field[];
  dangerActions: DangerAction[];
  current: Record<string, unknown>;
  theme: ThemeValue;
  onChange: (key: string, value: unknown) => void;
  onThemeChange: (theme: ThemeValue) => void;
  onNavAbout: () => void;
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
        ${deps.systemInline
          .filter((f) => !f.visibleWhen || f.visibleWhen(deps.current))
          .map((f) =>
            fieldRow(f, deps.current[f.key], (v) => deps.onChange(f.key, v)),
          )}
        ${navRow("About", "about", deps.onNavAbout)}
      </div>

      <div class="kit-section kit-section--pinned-bottom">
        <div class="kit-section-title kit-section-danger">Danger zone</div>
        <div class="kit-row" style="border-top: 1px solid var(--kit-border)">
          <button class="kit-btn-danger" data-action="reset" @click=${deps.onReset}>
            Reset all settings
          </button>
        </div>
        ${deps.dangerActions.map(
          (a) => html`
            <div class="kit-row" style="border-top: 1px solid var(--kit-border)">
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
