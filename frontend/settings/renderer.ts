import { html, render, type TemplateResult } from "lit-html";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SettingsSchema, Field } from "./schema";

export interface RenderOptions {
  schema: SettingsSchema;
  /** Defaults to "get_settings". */
  loadCommand?: string;
  /** Defaults to "save_settings". */
  saveCommand?: string;
  /** Event emitted after a successful save. Defaults to "settings-updated". */
  savedEvent?: string;
  /** Called after successful save with the saved settings object. */
  onSaved?: (settings: Record<string, unknown>) => void;
  /** Close the host window after save. Defaults to true. */
  closeOnSave?: boolean;
}

type SettingsValue = Record<string, unknown>;

export async function renderSettingsPage(
  root: HTMLElement,
  opts: RenderOptions,
): Promise<() => void> {
  const loadCmd = opts.loadCommand ?? "get_settings";
  const saveCmd = opts.saveCommand ?? "save_settings";
  const savedEvent = opts.savedEvent ?? "settings-updated";
  const closeOnSave = opts.closeOnSave ?? true;

  // Clear any stale lit-html part state on the root (e.g. after innerHTML reset).
  // Lit stores the active part as a property on the container; if the container
  // is wiped by other means, the cached part's markers are detached and a
  // subsequent render() throws "ChildPart has no parentNode".
  delete (root as unknown as Record<string, unknown>)["_$litPart$"];

  const original = (await invoke<SettingsValue>(loadCmd)) ?? {};
  let current: SettingsValue = { ...original };
  let dirty = false;

  const setField = (key: string, value: unknown) => {
    current[key] = value;
    dirty = true;
    paint();
  };

  const paint = () => {
    render(view(opts.schema, current, dirty, setField, save, cancel), root);
  };

  const save = async () => {
    await invoke(saveCmd, { settings: current });
    await emit(savedEvent, current);
    opts.onSaved?.(current);
    dirty = false;
    if (closeOnSave) {
      await getCurrentWindow().close();
    } else {
      paint();
    }
  };

  const cancel = async () => {
    await getCurrentWindow().close();
  };

  paint();

  return () => render(html``, root);
}

function view(
  schema: SettingsSchema,
  current: SettingsValue,
  dirty: boolean,
  set: (k: string, v: unknown) => void,
  onSave: () => void,
  onCancel: () => void,
): TemplateResult {
  return html`
    <div class="kit-settings">
      <h1>Settings</h1>
      ${schema.sections.map(
        (section) => html`
          <section>
            <h2>${section.title}</h2>
            ${section.fields.map((f) => fieldView(f, current[f.key], (v) => set(f.key, v)))}
          </section>
        `,
      )}
      <div class="kit-actions">
        <button data-action="cancel" @click=${onCancel}>Cancel</button>
        <button data-action="save" class="primary" ?disabled=${!dirty} @click=${onSave}>
          Save
        </button>
      </div>
    </div>
  `;
}

function fieldView(
  field: Field,
  value: unknown,
  onChange: (v: unknown) => void,
): TemplateResult {
  switch (field.kind) {
    case "number":
    case "integer": {
      const step = field.kind === "integer" ? 1 : "step" in field ? field.step : undefined;
      return html`
        <label>
          <span>${field.label}</span>
          <input
            type="number"
            data-key=${field.key}
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
        <label>
          <span>${field.label}</span>
          <input
            type="range"
            data-key=${field.key}
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
        <label>
          <span>${field.label}</span>
          <select
            data-key=${field.key}
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
        <label>
          <span>${field.label}</span>
          <input
            type="checkbox"
            data-key=${field.key}
            .checked=${Boolean(value)}
            @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)}
          />
        </label>
      `;
    case "text":
      return html`
        <label>
          <span>${field.label}</span>
          <input
            type="text"
            data-key=${field.key}
            .value=${String(value ?? "")}
            @input=${(e: Event) => onChange((e.target as HTMLInputElement).value)}
          />
        </label>
      `;
    case "file": {
      const display = value ? String(value) : field.defaultLabel ?? "(none)";
      return html`
        <label>
          <span>${field.label}</span>
          <span style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:#666;">${display}</span>
            <button
              type="button"
              data-key=${field.key}
              @click=${async () => {
                const picked = await invoke<string | null>(field.pickerCommand);
                if (picked) onChange(picked);
              }}
            >
              Pick...
            </button>
            <button type="button" @click=${() => onChange(null)}>Reset</button>
          </span>
        </label>
      `;
    }
    case "custom":
      return field.render(value, onChange);
  }
}
