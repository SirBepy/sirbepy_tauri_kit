/** Mode axis: how the active palette resolves to light or dark. */
export type ThemeMode = "light" | "dark" | "system";

/** Back-compat alias: older call sites imported `ThemeValue` for the mode. */
export type ThemeValue = ThemeMode;

/** A named palette an app registers with the kit. `id` is opaque to the kit. */
export interface PaletteDef {
  id: string;
  label: string;
  /** Swatch preview colours, e.g. [bg, surface, accent], for dark / light. */
  darkSwatch: string[];
  lightSwatch: string[];
}

/** Single source of truth for mode select options (value + label). */
export const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const DEFAULT_MODE: ThemeMode = "system";

const VALID_MODES: ThemeMode[] = THEME_OPTIONS.map((o) => o.value);

// A single live listener so `system` mode re-resolves when the OS flips. Torn
// down and re-created on every applyTheme call so we never stack listeners.
let mediaQuery: MediaQueryList | null = null;
let mediaListener: (() => void) | null = null;

function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

function clearMediaListener(): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener("change", mediaListener);
    mediaQuery = null;
    mediaListener = null;
  }
}

/**
 * Sets data-theme on <html>.
 *
 * Without a palette: writes the mode string ("light"/"dark"/"system") and lets
 * the kit's core CSS @media handle `system` — the original kit behaviour.
 *
 * With a palette: writes a concrete id ("<palette>" / "<palette>-light"),
 * resolving `system` from the OS and re-resolving live when it flips. Requires
 * the app to have loaded a palette CSS preset that defines those ids.
 */
export function applyTheme(mode: string, palette?: string): void {
  const m = (VALID_MODES.includes(mode as ThemeMode) ? mode : DEFAULT_MODE) as ThemeMode;
  clearMediaListener();

  if (!palette) {
    document.documentElement.setAttribute("data-theme", m);
    return;
  }

  const paint = () => {
    const isLight = m === "system" ? !prefersDark() : m === "light";
    document.documentElement.setAttribute("data-theme", isLight ? `${palette}-light` : palette);
  };
  paint();

  if (m === "system" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaListener = paint;
    mediaQuery.addEventListener("change", mediaListener);
  }
}
