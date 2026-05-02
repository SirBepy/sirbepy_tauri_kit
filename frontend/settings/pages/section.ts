import { html } from "lit-html";
import type { Section } from "../schema";
import type { PageDef } from "../stack";
import { fieldRow } from "../fields";

type SettingsValue = Record<string, unknown>;

/** Returns a PageDef that renders one schema section as a sub-page. */
export function sectionPage(
  section: Section,
  current: SettingsValue,
  onChange: (key: string, value: unknown) => void,
  onBack: () => void,
): PageDef {
  return {
    id: `section-${section.title.toLowerCase().replace(/\s+/g, "-")}`,
    title: section.title,
    render: () => html`
      <header class="kit-header">
        <button class="kit-header-back" @click=${onBack}>‹ Settings</button>
        <h2 class="kit-header-title">${section.title}</h2>
        <span class="kit-header-spacer"></span>
      </header>
      <div class="kit-section">
        ${section.fields.map((f) =>
          fieldRow(f, current[f.key], (v) => onChange(f.key, v)),
        )}
      </div>
    `,
  };
}
