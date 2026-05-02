import { html, type TemplateResult } from "lit-html";

export function resetModal(
  onConfirm: () => Promise<void>,
  onCancel: () => void,
): TemplateResult {
  return html`
    <div class="kit-modal-backdrop" @click=${onCancel}>
      <div class="kit-modal" @click=${(e: Event) => e.stopPropagation()}>
        <h3 class="kit-modal-title">Reset all settings?</h3>
        <p class="kit-modal-body">This will reset all settings to defaults. The app will reload.</p>
        <div class="kit-modal-actions">
          <button class="kit-btn-secondary" data-action="cancel" @click=${onCancel}>Cancel</button>
          <button
            class="kit-btn-danger"
            style="width: auto"
            data-action="confirm"
            @click=${() => void onConfirm()}
          >Reset</button>
        </div>
      </div>
    </div>
  `;
}
