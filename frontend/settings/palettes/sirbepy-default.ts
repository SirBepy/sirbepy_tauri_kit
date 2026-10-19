import type { PaletteDef } from "../pages/theme";

/**
 * SirBepy's default palette set. Opt-in: an app imports this list (and the
 * matching sirbepy-default.css) and passes it to renderSettingsPage. The kit
 * core ships no palettes — these are app policy, not kit infra.
 *
 * Swatches are [background, surface, primary, secondary, text], read straight
 * from each styleguide theme file, so a picker card previews the real palette.
 */
export const SIRBEPY_PALETTES: PaletteDef[] = [
  { id: "void",       label: "Void",        darkSwatch: ["#16151f", "#1e1d2b", "#9d7dfc", "#6e8fff", "#e2e0f0"], lightSwatch: ["#f0eff6", "#f8f7fc", "#7c5ce7", "#5a75e0", "#1a1830"] },
  { id: "nebula",     label: "Nebula",      darkSwatch: ["#0f1629", "#172040", "#c084fc", "#a78bfa", "#e2dff0"], lightSwatch: ["#f2f0fa", "#ffffff", "#9333ea", "#7c3aed", "#1a1040"] },
  { id: "glacier",    label: "Glacier",     darkSwatch: ["#0c1a24", "#112430", "#38bdf8", "#22d3ee", "#e0f0f8"], lightSwatch: ["#eef6fa", "#ffffff", "#0284c7", "#0891b2", "#0c2430"] },
  { id: "cosmo",      label: "Cosmo",       darkSwatch: ["#1a0a1e", "#241430", "#f472b6", "#fb923c", "#f0e4f5"], lightSwatch: ["#faf0f4", "#ffffff", "#db2777", "#ea580c", "#2a1030"] },
  { id: "forest",     label: "Forest",      darkSwatch: ["#0f1a14", "#16241c", "#4ade80", "#a3e635", "#e2f0e6"], lightSwatch: ["#eff7f1", "#ffffff", "#15803d", "#4d7c0f", "#10251a"] },
  { id: "ember",      label: "Ember",       darkSwatch: ["#1c130c", "#271a10", "#f59e0b", "#f97316", "#f5e9dc"], lightSwatch: ["#fbf5ee", "#ffffff", "#b45309", "#c2410c", "#2a1a0c"] },
  { id: "graphite",   label: "Graphite",    darkSwatch: ["#141414", "#1e1e1e", "#d4d4d4", "#60a5fa", "#ededed"], lightSwatch: ["#f4f4f5", "#ffffff", "#3f3f46", "#2563eb", "#18181b"] },
  { id: "crimson",    label: "Crimson",     darkSwatch: ["#1a0d10", "#251418", "#f43f5e", "#fb7185", "#f5e1e5"], lightSwatch: ["#fbf1f3", "#ffffff", "#be123c", "#e11d48", "#2a0f16"] },
  { id: "catppuccin", label: "Catppuccin",  darkSwatch: ["#181825", "#1e1e2e", "#cba6f7", "#89b4fa", "#cdd6f4"], lightSwatch: ["#e6e9ef", "#eff1f5", "#8839ef", "#1e66f5", "#4c4f69"] },
  { id: "gruvbox",    label: "Gruvbox",     darkSwatch: ["#1d2021", "#282828", "#fe8019", "#fabd2f", "#ebdbb2"], lightSwatch: ["#fbf1c7", "#f9f5d7", "#af3a03", "#b57614", "#3c3836"] },
  { id: "nord",       label: "Nord",        darkSwatch: ["#2e3440", "#3b4252", "#88c0d0", "#81a1c1", "#eceff4"], lightSwatch: ["#e5e9f0", "#eceff4", "#4a6c96", "#4c7a8a", "#2e3440"] },
  { id: "solarized",  label: "Solarized",   darkSwatch: ["#002b36", "#073642", "#268bd2", "#2aa198", "#eee8d5"], lightSwatch: ["#eee8d5", "#fdf6e3", "#1f6fa8", "#23877f", "#073642"] },
  { id: "tokyonight", label: "Tokyo Night", darkSwatch: ["#16161e", "#1a1b26", "#7aa2f7", "#bb9af7", "#c0caf5"], lightSwatch: ["#e1e2e7", "#f3f4f8", "#2563c9", "#9854f1", "#3760bf"] },
  { id: "rosepine",   label: "Rose Pine",   darkSwatch: ["#191724", "#1f1d2e", "#ebbcba", "#c4a7e7", "#e0def4"], lightSwatch: ["#faf4ed", "#fffaf3", "#a5566d", "#907aa9", "#575279"] },
  { id: "dracula",    label: "Dracula",     darkSwatch: ["#21222c", "#282a36", "#bd93f9", "#ff79c6", "#f8f8f2"], lightSwatch: ["#f6f3e4", "#fffbeb", "#644ac9", "#a3144d", "#1f1f1f"] },
  { id: "one",        label: "One",         darkSwatch: ["#21252b", "#282c34", "#61afef", "#c678dd", "#abb2bf"], lightSwatch: ["#f0f0f0", "#fafafa", "#3366d6", "#a626a4", "#383a42"] },
];

export const SIRBEPY_DEFAULT_PALETTE = "void";
