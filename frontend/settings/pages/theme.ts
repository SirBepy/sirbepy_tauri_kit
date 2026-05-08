export type ThemeValue = "light" | "dark" | "system";

const VALID: ThemeValue[] = ["light", "dark", "system"];

/** Sets data-theme on <html>. Falls back to "system" for unknown values. */
export function applyTheme(theme: string): void {
  const valid = VALID.includes(theme as ThemeValue) ? theme : "system";
  document.documentElement.setAttribute("data-theme", valid);
}
