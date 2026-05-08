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
});
