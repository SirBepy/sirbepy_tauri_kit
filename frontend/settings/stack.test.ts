import { describe, it, expect, beforeEach } from "vitest";
import { html } from "lit-html";
import { PageStack, type PageDef } from "./stack";

describe("PageStack", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  function makePage(id: string, title: string): PageDef {
    return {
      id,
      title,
      render: () => html`<div data-page=${id}>${title}</div>`,
    };
  }

  it("renders initial page", () => {
    const stack = new PageStack(root);
    stack.push(makePage("root", "Settings"));
    const el = root.querySelector('[data-page="root"]');
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe("Settings");
  });

  it("push adds a new page on top", () => {
    const stack = new PageStack(root);
    stack.push(makePage("root", "Settings"));
    stack.push(makePage("times", "Times"));
    expect(root.querySelector('[data-page="times"]')).toBeTruthy();
    expect(stack.depth()).toBe(2);
  });

  it("pop returns to previous page", () => {
    const stack = new PageStack(root);
    stack.push(makePage("root", "Settings"));
    stack.push(makePage("times", "Times"));
    stack.pop();
    expect(stack.depth()).toBe(1);
    expect(root.querySelector('[data-page="root"]')).toBeTruthy();
    expect(root.querySelector('[data-page="times"]')).toBeFalsy();
  });

  it("pop on root is a no-op", () => {
    const stack = new PageStack(root);
    stack.push(makePage("root", "Settings"));
    stack.pop();
    expect(stack.depth()).toBe(1);
  });

  it("replace swaps the top page", () => {
    const stack = new PageStack(root);
    stack.push(makePage("root", "Settings"));
    stack.replace(makePage("home", "Home"));
    expect(stack.depth()).toBe(1);
    expect(root.querySelector('[data-page="home"]')).toBeTruthy();
  });

  it("rerender re-runs the active page render fn", () => {
    const stack = new PageStack(root);
    let count = 0;
    const page: PageDef = {
      id: "p",
      title: "P",
      render: () => html`<div data-count=${++count}></div>`,
    };
    stack.push(page);
    stack.rerender();
    expect(root.querySelector('[data-count="2"]')).toBeTruthy();
  });
});
