import { html } from "lit-html";
import type { Section, SettingsSchema, Field } from "../schema";
import type { PageDef } from "../stack";
import type { DangerAction } from "../renderer";
import type { ThemeValue } from "./theme";

export interface RootDeps {
  schema: SettingsSchema;
  systemInline: Field[];
  dangerActions: DangerAction[];
  current: Record<string, unknown>;
  theme: ThemeValue;
  onChange: (key: string, value: unknown) => void;
  onNavSection: (section: Section) => void;
  onThemeChange: (theme: ThemeValue) => void;
  onNavAbout: () => void;
  onNavSystem: () => void;
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
              ${navRow("System", "system", deps.onNavSystem)}
            </div>
          `
        : html`
            <div class="kit-section">
              ${navRow("System", "system", deps.onNavSystem)}
            </div>
          `}
    `,
  };
}
