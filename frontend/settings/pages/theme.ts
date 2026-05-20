export type ThemeValue = "light" | "dark" | "system";

/** Single source of truth for theme select options (value + label). */
export const THEME_OPTIONS: { value: ThemeValue; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const VALID: ThemeValue[] = THEME_OPTIONS.map((o) => o.value);

/** Sets data-theme on <html>. Falls back to "system" for unknown values. */
export function applyTheme(theme: string): void {
  const valid = VALID.includes(theme as ThemeValue) ? theme : "system";
  document.documentElement.setAttribute("data-theme", valid);
}
