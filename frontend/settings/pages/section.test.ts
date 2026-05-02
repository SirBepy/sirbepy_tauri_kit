import { describe, it, expect, beforeEach } from "vitest";
import { render } from "lit-html";
import { sectionPage } from "./section";
import type { Section } from "../schema";

describe("sectionPage", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  it("renders all fields in the section", () => {
    const section: Section = {
      title: "Times",
      fields: [
        { key: "work_minutes", kind: "integer", label: "Pomodoro" },
        { key: "short_break_minutes", kind: "integer", label: "Short break" },
      ],
    };
    const page = sectionPage(section, { work_minutes: 25, short_break_minutes: 5 }, () => {}, () => {});
    render(page.render(), root);

    const inputs = root.querySelectorAll("input[type=number]");
    expect(inputs.length).toBe(2);
    expect((inputs[0] as HTMLInputElement).value).toBe("25");
    expect((inputs[1] as HTMLInputElement).value).toBe("5");
  });

  it("calls onChange when a field changes", () => {
    const section: Section = {
      title: "Times",
      fields: [{ key: "work_minutes", kind: "integer", label: "Pomodoro" }],
    };
    const changes: [string, unknown][] = [];
    const page = sectionPage(
      section,
      { work_minutes: 25 },
      (k, v) => changes.push([k, v]),
      () => {},
    );
    render(page.render(), root);

    const input = root.querySelector<HTMLInputElement>("input[type=number]")!;
    input.value = "42";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(changes).toEqual([["work_minutes", 42]]);
  });

  it("page id and title match section", () => {
    const section: Section = { title: "Times", fields: [] };
    const page = sectionPage(section, {}, () => {}, () => {});
    expect(page.title).toBe("Times");
    expect(page.id).toMatch(/^section-/);
  });

  it("renders back button that calls onBack", () => {
    const section: Section = { title: "Times", fields: [] };
    let backCalled = false;
    const page = sectionPage(section, {}, () => {}, () => { backCalled = true; });
    render(page.render(), root);

    const backBtn = root.querySelector<HTMLButtonElement>(".kit-header-back")!;
    backBtn.click();
    expect(backCalled).toBe(true);
  });
});
