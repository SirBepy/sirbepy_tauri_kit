import type { TemplateResult } from "lit-html";

export interface BaseField {
  key: string;
  label: string;
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

export type Field =
  | NumberField
  | IntegerField
  | RangeField
  | SelectField
  | ToggleField
  | TextField
  | FileField
  | CustomField;

export interface Section {
  title: string;
  fields: Field[];
}

export interface SettingsSchema {
  sections: Section[];
}

export function defineSchema(schema: SettingsSchema): SettingsSchema {
  return schema;
}
