import { html } from "lit-html";
import type { Field, Section, SectionGroup } from "../schema";
import type { PageDef } from "../stack";
import { fieldRow } from "../fields";

type SettingsValue = Record<string, unknown>;

function renderFields(
  fields: Field[],
  current: SettingsValue,
  onChange: (key: string, value: unknown) => void,
) {
  return fields
    .filter((f) => !f.visibleWhen || f.visibleWhen(current))
    .map((f) => fieldRow(f, current[f.key], (v) => onChange(f.key, v)));
}

function renderGroup(
  group: SectionGroup,
  current: SettingsValue,
  onChange: (key: string, value: unknown) => void,
) {
  return html`
    <div class="kit-section">
      ${group.title
        ? html`<div class="kit-section-title">${group.title}</div>`
        : null}
      ${renderFields(group.fields, current, onChange)}
    </div>
  `;
}

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
      ${section.groups
        ? section.groups.map((g) => renderGroup(g, current, onChange))
        : html`
            <div class="kit-section">
              ${renderFields(section.fields ?? [], current, onChange)}
            </div>
          `}
    `,
  };
}
