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
 * Sets the theme attributes on <html>, using the styleguide's 2D convention:
 * `data-theme` carries the palette (or the bare mode when no palette is set)
 * and `data-mode` carries the resolved light/dark axis.
 *
 * Without a palette: writes the mode string ("light"/"dark"/"system") to
 * data-theme and clears data-mode — the kit's core CSS @media handles `system`.
 *
 * With a palette: writes data-theme="<palette>" + data-mode="light"|"dark",
 * resolving `system` from the OS and re-resolving live when it flips. Requires
 * the app to have loaded a palette CSS preset (the vendored styleguide themes)
 * that defines `[data-theme="<palette>"]` (dark) + `[...][data-mode="light"]`.
 */
export function applyTheme(mode: string, palette?: string): void {
  const m = (VALID_MODES.includes(mode as ThemeMode) ? mode : DEFAULT_MODE) as ThemeMode;
  clearMediaListener();

  if (!palette) {
    document.documentElement.setAttribute("data-theme", m);
    document.documentElement.removeAttribute("data-mode");
    return;
  }

  const paint = () => {
    const isLight = m === "system" ? !prefersDark() : m === "light";
    const el = document.documentElement;
    el.setAttribute("data-theme", palette);
    el.setAttribute("data-mode", isLight ? "light" : "dark");
  };
  paint();

  if (m === "system" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaListener = paint;
    mediaQuery.addEventListener("change", mediaListener);
  }
}
