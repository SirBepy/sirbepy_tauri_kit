import { html } from "lit-html";
import type { Section, SettingsSchema } from "../schema";
import type { PageDef } from "../stack";
import { navRow } from "./parts";

export interface RootDeps {
  schema: SettingsSchema;
  onNavSection: (section: Section) => void;
  onNavSystem: () => void;
}

function sectionId(section: Section): string {
  return `section-${section.title.toLowerCase().replace(/\s+/g, "-")}`;
}

/** Category label -> which schema section titles belong there. System is always appended to the last group. */
const SECTION_CATEGORIES: { label: string; titles: string[] }[] = [
  { label: "Pomodoro", titles: ["Timer", "Focus mode", "Meeting mode"] },
  { label: "Preferences", titles: ["Overlay", "Sound", "Keybinds"] },
  { label: "Data", titles: ["Stats"] },
];

export function rootPage(deps: RootDeps): PageDef {
  if (deps.schema.sections.length === 0) {
    return {
      id: "root",
      title: "Settings",
      render: () => html`
        <div class="kit-section">
          ${navRow("System", "system", deps.onNavSystem)}
        </div>
      `,
    };
  }

  const byTitle = new Map(deps.schema.sections.map((s) => [s.title, s]));
  const lastCategoryIndex = SECTION_CATEGORIES.length - 1;
  // Any schema section not claimed by a category above still renders here, so a
  // new section can never be silently dropped from the nav.
  const categorized = new Set(SECTION_CATEGORIES.flatMap((c) => c.titles));
  const uncategorized = deps.schema.sections.filter((s) => !categorized.has(s.title));

  return {
    id: "root",
    title: "Settings",
    render: () => html`
      ${SECTION_CATEGORIES.map(({ label, titles }, i) => {
        const sections = titles.map((t) => byTitle.get(t)).filter(Boolean) as typeof deps.schema.sections;
        const isLast = i === lastCategoryIndex;
        if (sections.length === 0 && !isLast) return null;
        return html`
          <div class="kit-section">
            <div class="kit-section-title">${label}</div>
            ${sections.map((section) =>
              navRow(section.title, sectionId(section), () => deps.onNavSection(section)),
            )}
            ${isLast ? navRow("System", "system", deps.onNavSystem) : null}
          </div>
        `;
      })}
      ${uncategorized.length
        ? html`
            <div class="kit-section">
              <div class="kit-section-title">More</div>
              ${uncategorized.map((section) =>
                navRow(section.title, sectionId(section), () => deps.onNavSection(section)),
              )}
            </div>
          `
        : null}
    `,
  };
}
