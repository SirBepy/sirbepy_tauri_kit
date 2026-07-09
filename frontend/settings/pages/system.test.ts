import { describe, it, expect, beforeEach } from "vitest";
import { render, html } from "lit-html";
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
      palettes: [],
      palette: undefined,
      onChange: () => {},
      onThemeChange: () => {},
      onPaletteChange: () => {},
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

  const samplePalettes = [
    { id: "void", label: "Void", darkSwatch: ["#16151f"], lightSwatch: ["#f0eff5"] },
    { id: "cosmo", label: "Cosmo", darkSwatch: ["#1a0a1e"], lightSwatch: ["#faf0f4"] },
  ];

  it("renders no palette picker when no palettes are provided", () => {
    const page = systemPage(defaultDeps());
    render(page.render(), root);
    expect(root.querySelector('[data-row="palette"]')).toBeFalsy();
  });

  it("renders a palette card per provided palette and marks the active one", () => {
    const page = systemPage(defaultDeps({ palettes: samplePalettes, palette: "cosmo" }));
    render(page.render(), root);
    const cards = root.querySelectorAll(".kit-palette-card");
    expect(cards.length).toBe(2);
    const active = root.querySelector(".kit-palette-card--active");
    expect(active?.getAttribute("data-palette")).toBe("cosmo");
  });

  it("clicking a palette card calls onPaletteChange with its id", () => {
    const calls: string[] = [];
    const page = systemPage(defaultDeps({
      palettes: samplePalettes,
      palette: "void",
      onPaletteChange: (p) => calls.push(p),
    }));
    render(page.render(), root);
    root.querySelector<HTMLButtonElement>('[data-palette="cosmo"]')!.click();
    expect(calls).toEqual(["cosmo"]);
  });

  describe("sections-as-data", () => {
    it("renders a data section's title and Field[] rows, wired to onChange", () => {
      const calls: Array<[string, unknown]> = [];
      const page = systemPage(defaultDeps({
        sections: [
          { title: "Startup", fields: [{ key: "autostart", kind: "toggle", label: "Launch at login" }] },
        ],
        current: { autostart: true },
        onChange: (k, v) => calls.push([k, v]),
      }));
      render(page.render(), root);
      const titles = Array.from(root.querySelectorAll(".kit-section-title")).map((t) => t.textContent);
      expect(titles).toContain("Startup");
      const toggle = root.querySelector<HTMLInputElement>('input[data-key="autostart"]')!;
      expect(toggle.checked).toBe(true);
      toggle.click();
      expect(calls).toEqual([["autostart", false]]);
    });

    it("renders a section's custom render() escape hatch", () => {
      const page = systemPage(defaultDeps({
        sections: [{ title: "Custom", render: () => html`<div class="my-custom-section">hi</div>` }],
      }));
      render(page.render(), root);
      expect(root.querySelector(".my-custom-section")?.textContent).toBe("hi");
    });

    it("renders multiple sections in order", () => {
      const page = systemPage(defaultDeps({
        onReset: undefined,
        dangerActions: [],
        sections: [
          { title: "First", render: () => html`<span>1</span>` },
          { title: "Second", render: () => html`<span>2</span>` },
        ],
      }));
      render(page.render(), root);
      const titles = Array.from(root.querySelectorAll(".kit-section-title")).map((t) => t.textContent);
      expect(titles).toEqual(["First", "Second"]);
    });
  });

  it("renders nothing but the shell when every optional prop is omitted", () => {
    const page = systemPage({ onBack: () => {} });
    render(page.render(), root);
    expect(root.querySelector('[data-row="theme"]')).toBeFalsy();
    expect(root.querySelector('[data-row="palette"]')).toBeFalsy();
    expect(root.querySelector('[data-action="reset"]')).toBeFalsy();
    expect(root.querySelectorAll(".kit-section").length).toBe(0);
  });
});
