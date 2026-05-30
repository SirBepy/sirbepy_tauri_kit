import { describe, it, expect, beforeEach } from "vitest";
import { render } from "lit-html";
import { rootPage } from "./root";
import type { SettingsSchema } from "../schema";

describe("rootPage", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  function defaultDeps(overrides: Partial<Parameters<typeof rootPage>[0]> = {}) {
    const schema: SettingsSchema = {
      sections: [
        { title: "Times", fields: [] },
        { title: "Sound", fields: [] },
      ],
    };
    return {
      schema,
      onNavSection: () => {},
      onNavSystem: () => {},
      onNavAbout: () => {},
      ...overrides,
    };
  }

  it("renders one nav-row per schema section plus System and About nav-rows", () => {
    const page = rootPage(defaultDeps());
    render(page.render(), root);
    const navRows = root.querySelectorAll(".kit-nav-row");
    // schema sections (2) + System (1) + About (1) = 4
    expect(navRows.length).toBe(4);
  });

  it("clicking schema section calls onNavSection with that section", () => {
    const calls: string[] = [];
    const page = rootPage(defaultDeps({ onNavSection: (s) => calls.push(s.title) }));
    render(page.render(), root);
    const timesRow = root.querySelector<HTMLElement>('[data-nav="section-times"]')!;
    timesRow.click();
    expect(calls).toEqual(["Times"]);
  });

  it("clicking System nav-row calls onNavSystem", () => {
    let called = false;
    const page = rootPage(defaultDeps({ onNavSystem: () => { called = true; } }));
    render(page.render(), root);
    const row = root.querySelector<HTMLElement>('[data-nav="system"]')!;
    row.click();
    expect(called).toBe(true);
  });

  it("clicking About nav-row calls onNavAbout", () => {
    let called = false;
    const page = rootPage(defaultDeps({ onNavAbout: () => { called = true; } }));
    render(page.render(), root);
    const row = root.querySelector<HTMLElement>('[data-nav="about"]')!;
    row.click();
    expect(called).toBe(true);
  });

  it("System and About nav-rows appear even with empty schema", () => {
    const page = rootPage(defaultDeps({ schema: { sections: [] } }));
    render(page.render(), root);
    expect(root.querySelector<HTMLElement>('[data-nav="system"]')).toBeTruthy();
    expect(root.querySelector<HTMLElement>('[data-nav="about"]')).toBeTruthy();
  });
});
