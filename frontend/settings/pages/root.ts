import { html } from "lit-html";
import type { Section, SettingsSchema, Field } from "../schema";
import type { PageDef } from "../stack";
import { fieldRow } from "../fields";
import type { DangerAction } from "../renderer";

export interface RootDeps {
  schema: SettingsSchema;
  systemInline: Field[];
  dangerActions: DangerAction[];
  current: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onNavSection: (section: Section) => void;
  onNavTheme: () => void;
  onNavAbout: () => void;
  onReset: () => void;
  onDanger: (action: DangerAction) => void;
}

function navRow(label: string, dataNav: string, onClick: () => void) {
  return html`
    <div class="kit-row kit-nav-row" data-nav=${dataNav} @click=${onClick}>
      <span class="kit-row-label">${label}</span>
      <span class="kit-nav-arrow">›</span>
    </div>
  `;
}

function sectionId(section: Section): string {
  return `section-${section.title.toLowerCase().replace(/\s+/g, "-")}`;
}

export function rootPage(deps: RootDeps): PageDef {
  return {
    id: "root",
    title: "Settings",
    render: () => html`
      <header class="kit-header">
        <span class="kit-header-spacer"></span>
        <h2 class="kit-header-title">Settings</h2>
        <span class="kit-header-spacer"></span>
      </header>

      ${deps.schema.sections.length > 0
        ? html`
            <div class="kit-section">
              ${deps.schema.sections.map((section) =>
                navRow(section.title, sectionId(section), () => deps.onNavSection(section)),
              )}
            </div>
          `
        : null}

      <div class="kit-section">
        <div class="kit-section-title">System</div>
        ${navRow("Theme", "theme", deps.onNavTheme)}
        ${deps.systemInline
          .filter((f) => !f.visibleWhen || f.visibleWhen(deps.current))
          .map((f) =>
            fieldRow(f, deps.current[f.key], (v) => deps.onChange(f.key, v)),
          )}
        ${navRow("About", "about", deps.onNavAbout)}
      </div>

      <div class="kit-section">
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
