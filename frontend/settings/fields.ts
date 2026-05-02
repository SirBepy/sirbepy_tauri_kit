import { html, type TemplateResult } from "lit-html";
import { invoke } from "@tauri-apps/api/core";
import type { Field } from "./schema";

/** Renders one field as a labeled row. Used by section pages and inline rows. */
export function fieldRow(
  field: Field,
  value: unknown,
  onChange: (next: unknown) => void,
): TemplateResult {
  switch (field.kind) {
    case "number":
    case "integer": {
      const step = field.kind === "integer" ? 1 : "step" in field ? field.step : undefined;
      return html`
        <label class="kit-row">
          <span class="kit-row-label">${field.label}</span>
          <input
            type="number"
            data-key=${field.key}
            class="kit-input"
            .value=${String(value ?? "")}
            min=${"min" in field && field.min !== undefined ? field.min : ""}
            max=${"max" in field && field.max !== undefined ? field.max : ""}
            step=${step !== undefined ? step : ""}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              onChange(field.kind === "integer" ? parseInt(v, 10) : parseFloat(v));
            }}
          />
        </label>
      `;
    }
    case "range":
      return html`
        <label class="kit-row">
          <span class="kit-row-label">${field.label}</span>
          <input
            type="range"
            data-key=${field.key}
            class="kit-range"
            .value=${String(value ?? field.min)}
            min=${field.min}
            max=${field.max}
            step=${field.step ?? 0.05}
            @input=${(e: Event) =>
              onChange(parseFloat((e.target as HTMLInputElement).value))}
          />
        </label>
      `;
    case "select":
      return html`
        <label class="kit-row">
          <span class="kit-row-label">${field.label}</span>
          <select
            data-key=${field.key}
            class="kit-select"
            .value=${String(value ?? "")}
            @change=${(e: Event) => onChange((e.target as HTMLSelectElement).value)}
          >
            ${field.options.map(
              (opt) => html`<option value=${opt.value}>${opt.label}</option>`,
            )}
          </select>
        </label>
      `;
    case "toggle":
      return html`
        <label class="kit-row">
          <span class="kit-row-label">${field.label}</span>
          <span class="kit-toggle">
            <input
              type="checkbox"
              data-key=${field.key}
              .checked=${Boolean(value)}
              @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)}
            />
            <span class="kit-toggle-track"></span>
          </span>
        </label>
      `;
    case "text":
      return html`
        <label class="kit-row">
          <span class="kit-row-label">${field.label}</span>
          <input
            type="text"
            data-key=${field.key}
            class="kit-input"
            .value=${String(value ?? "")}
            @input=${(e: Event) => onChange((e.target as HTMLInputElement).value)}
          />
        </label>
      `;
    case "file": {
      const display = value ? String(value) : field.defaultLabel ?? "(none)";
      return html`
        <label class="kit-row">
          <span class="kit-row-label">${field.label}</span>
          <span class="kit-file-row">
            <span class="kit-file-display">${display}</span>
            <button
              type="button"
              data-key=${field.key}
              class="kit-btn-secondary"
              @click=${async () => {
                const picked = await invoke<string | null>(field.pickerCommand);
                if (picked) onChange(picked);
              }}
            >
              Pick…
            </button>
            <button type="button" class="kit-btn-secondary" @click=${() => onChange(null)}>Reset</button>
          </span>
        </label>
      `;
    }
    case "custom":
      return field.render(value, onChange);
  }
}
