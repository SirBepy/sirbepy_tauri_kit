import { describe, it, expect, beforeEach } from "vitest";
import { render } from "lit-html";
import { themePage, applyTheme } from "./theme";

describe("themePage", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-theme");
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  it("renders 3 theme cards", () => {
    const page = themePage("system", () => {}, () => {});
    render(page.render(), root);
    const cards = root.querySelectorAll(".kit-theme-card");
    expect(cards.length).toBe(3);
  });

  it("marks active theme card", () => {
    const page = themePage("dark", () => {}, () => {});
    render(page.render(), root);
    const active = root.querySelector(".kit-theme-card-active");
    expect(active?.getAttribute("data-theme-value")).toBe("dark");
  });

  it("clicking a card calls onChange with the theme value", () => {
    const changes: string[] = [];
    const page = themePage("system", (t) => changes.push(t), () => {});
    render(page.render(), root);
    const lightCard = root.querySelector<HTMLDivElement>('[data-theme-value="light"]')!;
    lightCard.click();
    expect(changes).toEqual(["light"]);
  });
});

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
