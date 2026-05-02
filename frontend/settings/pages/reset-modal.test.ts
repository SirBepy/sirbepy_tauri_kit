import { describe, it, expect, beforeEach } from "vitest";
import { render } from "lit-html";
import { resetModal } from "./reset-modal";

describe("resetModal", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  it("renders title + body + 2 buttons", () => {
    render(
      resetModal(async () => {}, () => {}),
      root,
    );
    expect(root.querySelector(".kit-modal-title")?.textContent).toContain("Reset");
    const buttons = root.querySelectorAll("button");
    expect(buttons.length).toBe(2);
  });

  it("clicking confirm calls onConfirm", async () => {
    let confirmed = false;
    render(
      resetModal(async () => { confirmed = true; }, () => {}),
      root,
    );
    const confirm = root.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;
    confirm.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(confirmed).toBe(true);
  });

  it("clicking cancel calls onCancel", () => {
    let cancelled = false;
    render(
      resetModal(async () => {}, () => { cancelled = true; }),
      root,
    );
    const cancel = root.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
    cancel.click();
    expect(cancelled).toBe(true);
  });

  it("clicking backdrop calls onCancel", () => {
    let cancelled = false;
    render(
      resetModal(async () => {}, () => { cancelled = true; }),
      root,
    );
    const backdrop = root.querySelector<HTMLDivElement>(".kit-modal-backdrop")!;
    backdrop.click();
    expect(cancelled).toBe(true);
  });

  it("clicking inside modal does not propagate to backdrop", () => {
    let cancelled = false;
    render(
      resetModal(async () => {}, () => { cancelled = true; }),
      root,
    );
    const modal = root.querySelector<HTMLDivElement>(".kit-modal")!;
    modal.click();
    expect(cancelled).toBe(false);
  });
});
