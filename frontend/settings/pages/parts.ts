import { html } from "lit-html";

/** A tappable settings row that drills into another page. */
export function navRow(label: string, dataNav: string, onClick: () => void) {
  return html`
    <div class="kit-row kit-nav-row" data-nav=${dataNav} @click=${onClick}>
      <span class="kit-row-label">${label}</span>
      <span class="kit-nav-arrow">›</span>
    </div>
  `;
}
