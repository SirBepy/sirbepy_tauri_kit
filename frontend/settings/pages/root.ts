import { html } from "lit-html";
import type { Section, SettingsSchema } from "../schema";
import type { PageDef } from "../stack";
import { navRow } from "./parts";

export interface RootDeps {
  schema: SettingsSchema;
  onNavSection: (section: Section) => void;
  onNavSystem: () => void;
  onNavAbout: () => void;
}

function sectionId(section: Section): string {
  return `section-${section.title.toLowerCase().replace(/\s+/g, "-")}`;
}

interface RenderGroup {
  /** Undefined renders with no heading, for sections that opt out of grouping. */
  label?: string;
  sections: Section[];
}

/** Buckets sections by their own `category`, in order of each label's first
 * appearance, so a category can be declared non-consecutively in the schema
 * and still render as one heading. Uncategorized sections share a single
 * unlabelled group rather than an invented "More" bucket. */
function groupByCategory(sections: Section[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  const byLabel = new Map<string, RenderGroup>();
  let uncategorized: RenderGroup | null = null;
  for (const section of sections) {
    if (!section.category) {
      if (!uncategorized) {
        uncategorized = { sections: [] };
        groups.push(uncategorized);
      }
      uncategorized.sections.push(section);
      continue;
    }
    let group = byLabel.get(section.category);
    if (!group) {
      group = { label: section.category, sections: [] };
      byLabel.set(section.category, group);
      groups.push(group);
    }
    group.sections.push(section);
  }
  return groups;
}

export function rootPage(deps: RootDeps): PageDef {
  if (deps.schema.sections.length === 0) {
    return {
      id: "root",
      title: "Settings",
      render: () => html`
        <div class="kit-section">
          ${navRow("System", "system", deps.onNavSystem)}
          ${navRow("About", "about", deps.onNavAbout)}
        </div>
      `,
    };
  }

  const groups = groupByCategory(deps.schema.sections);
  const lastGroupIndex = groups.length - 1;

  return {
    id: "root",
    title: "Settings",
    render: () => html`
      ${groups.map((group, i) => {
        const isLast = i === lastGroupIndex;
        return html`
          <div class="kit-section">
            ${group.label ? html`<div class="kit-section-title">${group.label}</div>` : null}
            ${group.sections.map((section) =>
              navRow(section.title, sectionId(section), () => deps.onNavSection(section)),
            )}
            ${isLast ? navRow("System", "system", deps.onNavSystem) : null}
            ${isLast ? navRow("About", "about", deps.onNavAbout) : null}
          </div>
        `;
      })}
    `,
  };
}
