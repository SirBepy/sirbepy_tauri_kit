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

  it("sections without a category render with no heading", () => {
    const page = rootPage(defaultDeps());
    render(page.render(), root);
    expect(root.querySelector(".kit-section-title")).toBeFalsy();
  });

  it("groups sections under their own declared category heading", () => {
    const schema: SettingsSchema = {
      sections: [
        { title: "Widgets", category: "General", fields: [] },
        { title: "Host", category: "General", fields: [] },
      ],
    };
    const page = rootPage(defaultDeps({ schema }));
    render(page.render(), root);
    const titles = Array.from(root.querySelectorAll(".kit-section-title")).map(
      (el) => el.textContent?.trim(),
    );
    expect(titles).toEqual(["General"]);
  });

  it("merges a non-consecutive category into one heading, preserving first-appearance order", () => {
    const schema: SettingsSchema = {
      sections: [
        { title: "Timer", category: "Pomodoro", fields: [] },
        { title: "Overlay", category: "Preferences", fields: [] },
        { title: "Focus mode", category: "Pomodoro", fields: [] },
      ],
    };
    const page = rootPage(defaultDeps({ schema }));
    render(page.render(), root);
    const titles = Array.from(root.querySelectorAll(".kit-section-title")).map(
      (el) => el.textContent?.trim(),
    );
    // One "Pomodoro" heading, ordered first since Timer appears before Overlay.
    expect(titles).toEqual(["Pomodoro", "Preferences"]);
    const pomodoroGroup = root.querySelectorAll(".kit-section")[0];
    const rowLabels = Array.from(pomodoroGroup.querySelectorAll(".kit-row-label")).map(
      (el) => el.textContent,
    );
    expect(rowLabels).toEqual(["Timer", "Focus mode"]);
  });

  it("appends System and About to the last group even when it has a category", () => {
    const schema: SettingsSchema = {
      sections: [{ title: "Stats", category: "General", fields: [] }],
    };
    const page = rootPage(defaultDeps({ schema }));
    render(page.render(), root);
    const group = root.querySelector(".kit-section")!;
    expect(group.querySelector(".kit-section-title")?.textContent?.trim()).toBe("General");
    expect(group.querySelector('[data-nav="system"]')).toBeTruthy();
    expect(group.querySelector('[data-nav="about"]')).toBeTruthy();
  });
});
