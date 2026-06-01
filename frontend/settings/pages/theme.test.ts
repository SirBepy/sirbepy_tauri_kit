import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme } from "./theme";

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-mode");
  });

  it("sets data-theme attribute on html and clears data-mode (no palette)", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-mode")).toBe(null);
  });

  it("falls back to system for unknown values", () => {
    applyTheme("not-a-theme" as never);
    expect(document.documentElement.getAttribute("data-theme")).toBe("system");
  });

  it("with a palette + dark mode writes the palette id + data-mode=dark", () => {
    applyTheme("dark", "void");
    expect(document.documentElement.getAttribute("data-theme")).toBe("void");
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
  });

  it("with a palette + light mode writes the palette id + data-mode=light", () => {
    applyTheme("light", "nebula");
    expect(document.documentElement.getAttribute("data-theme")).toBe("nebula");
    expect(document.documentElement.getAttribute("data-mode")).toBe("light");
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
      expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
    } finally {
      window.matchMedia = orig;
    }
  });
});
