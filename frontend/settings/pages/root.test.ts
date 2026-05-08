import { describe, it, expect, beforeEach } from "vitest";
import { render } from "lit-html";
import { rootPage } from "./root";
import type { DangerAction } from "../renderer";
import type { SettingsSchema } from "../schema";
import type { Field } from "../schema";

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
      systemInline: [] as Field[],
      dangerActions: [] as DangerAction[],
      current: {} as Record<string, unknown>,
      theme: "system" as const,
      onChange: () => {},
      onNavSection: () => {},
      onThemeChange: () => {},
      onNavAbout: () => {},
      onReset: () => {},
      onDanger: () => {},
      ...overrides,
    };
  }

  it("renders one nav-row per schema section", () => {
    const page = rootPage(defaultDeps());
    render(page.render(), root);
    const navRows = root.querySelectorAll(".kit-nav-row");
    // schema sections (2) + About (1) = 3 nav-rows (Theme is now an inline select)
    expect(navRows.length).toBe(3);
  });

  it("clicking schema section calls onNavSection with that section", () => {
    const calls: string[] = [];
    const page = rootPage(defaultDeps({ onNavSection: (s) => calls.push(s.title) }));
    render(page.render(), root);
    const timesRow = root.querySelector<HTMLElement>('[data-nav="section-times"]')!;
    timesRow.click();
    expect(calls).toEqual(["Times"]);
  });

  it("renders an inline theme select with the current value", () => {
    const page = rootPage(defaultDeps({ theme: "dark" }));
    render(page.render(), root);
    const select = root.querySelector<HTMLSelectElement>('select[data-key="__kit_theme"]')!;
    expect(select).toBeTruthy();
    expect(select.value).toBe("dark");
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toEqual(["system", "light", "dark"]);
  });

  it("changing the theme select calls onThemeChange with the new value", () => {
    const calls: string[] = [];
    const page = rootPage(defaultDeps({ onThemeChange: (t) => calls.push(t) }));
    render(page.render(), root);
    const select = root.querySelector<HTMLSelectElement>('select[data-key="__kit_theme"]')!;
    select.value = "light";
    select.dispatchEvent(new Event("change"));
    expect(calls).toEqual(["light"]);
  });

  it("clicking About calls onNavAbout", () => {
    let called = false;
    const page = rootPage(defaultDeps({ onNavAbout: () => { called = true; } }));
    render(page.render(), root);
    const row = root.querySelector<HTMLElement>('[data-nav="about"]')!;
    row.click();
    expect(called).toBe(true);
  });

  it("renders systemInline fields as inline rows", () => {
    const page = rootPage(defaultDeps({
      systemInline: [{ key: "autostart", kind: "toggle", label: "Launch at startup" }],
    }));
    render(page.render(), root);
    const toggle = root.querySelector<HTMLInputElement>('input[data-key="autostart"]');
    expect(toggle).toBeTruthy();
  });

  it("Reset button always renders in danger zone", () => {
    const page = rootPage(defaultDeps());
    render(page.render(), root);
    const reset = root.querySelector<HTMLButtonElement>('[data-action="reset"]');
    expect(reset).toBeTruthy();
  });

  it("dangerActions render as additional danger buttons", () => {
    const page = rootPage(defaultDeps({
      dangerActions: [{ label: "Log out", command: "logout" }],
    }));
    render(page.render(), root);
    const buttons = root.querySelectorAll(".kit-btn-danger");
    // Reset (1) + Log out (1) = 2
    expect(buttons.length).toBe(2);
    expect(buttons[1].textContent).toContain("Log out");
  });

  it("clicking a dangerAction calls onDanger with that action", () => {
    const calls: string[] = [];
    const action: DangerAction = { label: "Log out", command: "logout" };
    const page = rootPage(defaultDeps({
      dangerActions: [action],
      onDanger: (a) => calls.push(a.command),
    }));
    render(page.render(), root);
    const logoutBtn = root.querySelectorAll<HTMLButtonElement>(".kit-btn-danger")[1];
    logoutBtn.click();
    expect(calls).toEqual(["logout"]);
  });
});
