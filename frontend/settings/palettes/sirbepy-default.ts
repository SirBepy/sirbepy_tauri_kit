import type { PaletteDef } from "../pages/theme";

/**
 * SirBepy's default palette set. Opt-in: an app imports this list (and the
 * matching sirbepy-default.css) and passes it to renderSettingsPage. The kit
 * core ships no palettes — these are app policy, not kit infra.
 */
export const SIRBEPY_PALETTES: PaletteDef[] = [
  { id: "void",    label: "Void",    darkSwatch: ["#16151f", "#1e1d2b", "#9d7dfc"], lightSwatch: ["#f0eff5", "#ffffff", "#7c5cdb"] },
  { id: "nebula",  label: "Nebula",  darkSwatch: ["#0f1629", "#172040", "#c084fc"], lightSwatch: ["#f2f0fa", "#ffffff", "#9333ea"] },
  { id: "glacier", label: "Glacier", darkSwatch: ["#0c1a24", "#112430", "#38bdf8"], lightSwatch: ["#eef6fa", "#ffffff", "#0284c7"] },
  { id: "cosmo",   label: "Cosmo",   darkSwatch: ["#1a0a1e", "#241430", "#f472b6"], lightSwatch: ["#faf0f4", "#ffffff", "#db2777"] },
];

export const SIRBEPY_DEFAULT_PALETTE = "void";
