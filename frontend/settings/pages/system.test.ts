import { describe, it, expect, beforeEach } from "vitest";
import { render } from "lit-html";
import { systemPage } from "./system";
import type { DangerAction } from "../renderer";
import type { Field } from "../schema";

describe("systemPage", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  function defaultDeps(overrides: Partial<Parameters<typeof systemPage>[0]> = {}) {
    return {
      systemInline: [] as Field[],
      dangerActions: [] as DangerAction[],
      current: {} as Record<string, unknown>,
      theme: "system" as const,
      onChange: () => {},
      onThemeChange: () => {},
      onNavAbout: () => {},
      onReset: () => {},
      onDanger: () => {},
      onBack: () => {},
      ...overrides,
    };
  }

  it("renders an inline theme select with the current value", () => {
    const page = systemPage(defaultDeps({ theme: "dark" }));
    render(page.render(), root);
    const select = root.querySelector<HTMLSelectElement>('select[data-key="__kit_theme"]')!;
    expect(select).toBeTruthy();
    expect(select.value).toBe("dark");
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toEqual(["system", "light", "dark"]);
  });

  it("changing the theme select calls onThemeChange with the new value", () => {
    const calls: string[] = [];
    const page = systemPage(defaultDeps({ onThemeChange: (t) => calls.push(t) }));
    render(page.render(), root);
    const select = root.querySelector<HTMLSelectElement>('select[data-key="__kit_theme"]')!;
    select.value = "light";
    select.dispatchEvent(new Event("change"));
    expect(calls).toEqual(["light"]);
  });

  it("clicking About calls onNavAbout", () => {
    let called = false;
    const page = systemPage(defaultDeps({ onNavAbout: () => { called = true; } }));
    render(page.render(), root);
    const row = root.querySelector<HTMLElement>('[data-nav="about"]')!;
    row.click();
    expect(called).toBe(true);
  });

  it("clicking back calls onBack", () => {
    let called = false;
    const page = systemPage(defaultDeps({ onBack: () => { called = true; } }));
    render(page.render(), root);
    const back = root.querySelector<HTMLElement>(".kit-header-back")!;
    back.click();
    expect(called).toBe(true);
  });

  it("renders systemInline fields as inline rows", () => {
    const page = systemPage(defaultDeps({
      systemInline: [{ key: "autostart", kind: "toggle", label: "Launch at startup" }],
    }));
    render(page.render(), root);
    const toggle = root.querySelector<HTMLInputElement>('input[data-key="autostart"]');
    expect(toggle).toBeTruthy();
  });

  it("Reset button always renders in danger zone", () => {
    const page = systemPage(defaultDeps());
    render(page.render(), root);
    const reset = root.querySelector<HTMLButtonElement>('[data-action="reset"]');
    expect(reset).toBeTruthy();
  });

  it("dangerActions render as additional danger buttons", () => {
    const page = systemPage(defaultDeps({
      dangerActions: [{ label: "Log out", command: "logout" }],
    }));
    render(page.render(), root);
    const buttons = root.querySelectorAll(".kit-btn-danger");
    expect(buttons.length).toBe(2);
    expect(buttons[1].textContent).toContain("Log out");
  });

  it("clicking a dangerAction calls onDanger with that action", () => {
    const calls: string[] = [];
    const action: DangerAction = { label: "Log out", command: "logout" };
    const page = systemPage(defaultDeps({
      dangerActions: [action],
      onDanger: (a) => calls.push(a.command),
    }));
    render(page.render(), root);
    const logoutBtn = root.querySelectorAll<HTMLButtonElement>(".kit-btn-danger")[1];
    logoutBtn.click();
    expect(calls).toEqual(["logout"]);
  });
});
