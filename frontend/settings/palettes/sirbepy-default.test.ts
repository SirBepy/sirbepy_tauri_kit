import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SIRBEPY_PALETTES } from "./sirbepy-default";

const here = dirname(fileURLToPath(import.meta.url));
const themesDir = join(here, "../../styleguide/themes");
const presetCss = readFileSync(join(here, "sirbepy-default.css"), "utf8");

function themeCss(id: string): string {
  return readFileSync(join(themesDir, `theme-${id}.css`), "utf8").replace(/\r/g, "");
}

function tokenValue(css: string, selector: string, token: string): string | undefined {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return undefined;
  const body = css.slice(start, css.indexOf("}", start));
  return new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(body)?.[1].toLowerCase();
}

describe("SIRBEPY_PALETTES", () => {
  it("has unique ids", () => {
    const ids = SIRBEPY_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const p of SIRBEPY_PALETTES) {
    describe(p.id, () => {
      it("is imported by the preset stylesheet", () => {
        expect(presetCss).toContain(`themes/theme-${p.id}.css`);
      });

      it("declares a dark and a light block", () => {
        const css = themeCss(p.id);
        expect(css).toContain(`[data-theme="${p.id}"] {`);
        expect(css).toContain(`[data-theme="${p.id}"][data-mode="light"] {`);
      });

      it("swatches match the theme file's background, surface, primary, secondary and text", () => {
        const css = themeCss(p.id);
        const tokens = ["--color-background", "--color-surface", "--color-primary", "--color-secondary", "--color-text"];
        const dark = `[data-theme="${p.id}"]`;
        const light = `${dark}[data-mode="light"]`;
        expect(p.darkSwatch).toEqual(tokens.map((t) => tokenValue(css, dark, t)));
        expect(p.lightSwatch).toEqual(tokens.map((t) => tokenValue(css, light, t)));
      });
    });
  }
});
