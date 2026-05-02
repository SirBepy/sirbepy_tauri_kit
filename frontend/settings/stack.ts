import { html, render, type TemplateResult } from "lit-html";

export interface PageDef {
  id: string;
  title: string;
  render: () => TemplateResult;
}

/** In-memory page stack. Renders only the topmost page; emits state to root element. */
export class PageStack {
  private stack: PageDef[] = [];
  constructor(private root: HTMLElement) {}

  push(page: PageDef): void {
    this.stack.push(page);
    this.paint();
  }

  pop(): void {
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.paint();
  }

  replace(page: PageDef): void {
    if (this.stack.length === 0) {
      this.push(page);
      return;
    }
    this.stack[this.stack.length - 1] = page;
    this.paint();
  }

  depth(): number {
    return this.stack.length;
  }

  /** Re-runs the active page's render function. Used after state changes. */
  rerender(): void {
    this.paint();
  }

  /** Returns the active page id, or null if stack empty. */
  activeId(): string | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1].id : null;
  }

  private paint(): void {
    const active = this.stack[this.stack.length - 1];
    if (!active) {
      render(html``, this.root);
      return;
    }
    render(
      html`
        <div class="kit-stack">
          <div class="kit-page kit-page-active" data-page-id=${active.id}>
            ${active.render()}
          </div>
        </div>
      `,
      this.root,
    );
  }
}
