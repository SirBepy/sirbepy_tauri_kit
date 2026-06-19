import type { TemplateResult } from "lit-html";

export type SettingsValue = Record<string, unknown>;

export interface BaseField {
  key: string;
  label: string;
  /** Optional info-icon tooltip shown next to the label. Plain text. */
  tooltip?: string;
  /** When provided, field renders only if the predicate returns true given current settings. */
  visibleWhen?: (current: SettingsValue) => boolean;
}

export interface NumberField extends BaseField {
  kind: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface IntegerField extends BaseField {
  kind: "integer";
  min?: number;
  max?: number;
}

export interface RangeField extends BaseField {
  kind: "range";
  min: number;
  max: number;
  step?: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectField extends BaseField {
  kind: "select";
  options: SelectOption[];
}

export interface ToggleField extends BaseField {
  kind: "toggle";
}

export interface TextField extends BaseField {
  kind: "text";
}

export interface FileField extends BaseField {
  kind: "file";
  pickerCommand: string;
  defaultLabel?: string;
}

export interface CustomField extends BaseField {
  kind: "custom";
  render: (
    value: unknown,
    onChange: (next: unknown) => void,
  ) => TemplateResult;
}

/**
 * A global-hotkey binding rendered as label + accelerator badge + Record/Clear.
 * Stored as a plain accelerator string (e.g. "Ctrl+Alt+P") or null when unset.
 * Capture, accelerator formatting, and display-only cross-row conflict
 * detection are handled by the kit. Consumers declare the field as data only.
 *
 * Reset rule: each keybind key MUST also exist on the app's Rust Settings struct
 * + Default impl (as Option<String> default None), or it resets on restart.
 */
export interface KeybindField extends BaseField {
  kind: "keybind";
}

export type Field =
  | NumberField
  | IntegerField
  | RangeField
  | SelectField
  | ToggleField
  | TextField
  | FileField
  | KeybindField
  | CustomField;

export interface SectionGroup {
  /** Optional sub-header rendered above this group of fields. */
  title?: string;
  fields: Field[];
}

export interface Section {
  title: string;
  /** Flat layout: a single list of fields under the section header. */
  fields?: Field[];
  /** Grouped layout: multiple sub-sections, each with an optional sub-header. */
  groups?: SectionGroup[];
}

export interface SettingsSchema {
  sections: Section[];
}

export function defineSchema(schema: SettingsSchema): SettingsSchema {
  return schema;
}
