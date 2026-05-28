import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme } from "./theme";

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("sets data-theme attribute on html", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("falls back to system for unknown values", () => {
    applyTheme("not-a-theme" as never);
    expect(document.documentElement.getAttribute("data-theme")).toBe("system");
  });

  it("with a palette + dark mode writes the bare palette id", () => {
    applyTheme("dark", "void");
    expect(document.documentElement.getAttribute("data-theme")).toBe("void");
  });

  it("with a palette + light mode writes the -light variant", () => {
    applyTheme("light", "nebula");
    expect(document.documentElement.getAttribute("data-theme")).toBe("nebula-light");
  });

  it("system mode resolves the palette from prefers-color-scheme", () => {
    const orig = window.matchMedia;
    try {
      window.matchMedia = ((q: string) => ({
        matches: true, // prefers dark
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia;
      applyTheme("system", "cosmo");
      expect(document.documentElement.getAttribute("data-theme")).toBe("cosmo");
    } finally {
      window.matchMedia = orig;
    }
  });
});
