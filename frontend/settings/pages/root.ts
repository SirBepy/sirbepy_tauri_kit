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

export function rootPage(deps: RootDeps): PageDef {
  return {
    id: "root",
    title: "Settings",
    render: () => html`
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
