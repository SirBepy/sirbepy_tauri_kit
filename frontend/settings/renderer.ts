import { html, render } from "lit-html";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SettingsSchema, Section, Field } from "./schema";
import { PageStack } from "./stack";
import { rootPage } from "./pages/root";
import { sectionPage } from "./pages/section";
import { applyTheme, type ThemeValue } from "./pages/theme";
import { aboutPage, type AutoUpdateMode } from "./pages/about";
import { systemPage } from "./pages/system";
import { resetModal } from "./pages/reset-modal";

export interface DangerAction {
  label: string;
  command: string;
  confirmBody?: string;
}

export interface AboutConfig {
  appName?: string;
  appVersion?: string;
  developer?: {
    name?: string;
    links?: Record<string, string | null | undefined>;
  };
}

export interface ThemeConfig {
  default?: ThemeValue;
}

export interface RenderOptions {
  schema: SettingsSchema;
  systemInline?: Field[];
  dangerActions?: DangerAction[];
  about?: AboutConfig;
  theme?: ThemeConfig;
  loadCommand?: string;
  saveCommand?: string;
  savedEvent?: string;
  onSaved?: (settings: Record<string, unknown>) => void;
  closeOnSave?: boolean;
}

const KIT_DEFAULTS = {
  developer: {
    name: "SirBepy",
    links: {
      github: "https://github.com/SirBepy",
      youtube: "https://youtube.com/@SirBepy",
    },
  },
};

type SettingsValue = Record<string, unknown>;

export async function renderSettingsPage(
  root: HTMLElement,
  opts: RenderOptions,
): Promise<() => void> {
  const loadCmd = opts.loadCommand ?? "get_settings";
  const saveCmd = opts.saveCommand ?? "save_settings";
  const savedEvent = opts.savedEvent ?? "settings-updated";

  // Apply default theme before first paint to avoid a light-flash on dark setups.
  applyTheme(opts.theme?.default ?? "system");

  // Synchronous DOM scaffold + first paint with empty values.
  // Settings hydrate asynchronously below; sections list is schema-driven and renders immediately.
  let current: SettingsValue = {};
  const stackRoot = document.createElement("div");
  stackRoot.className = "kit-settings";
  root.replaceChildren(stackRoot);
  const stack = new PageStack(stackRoot);

  // Modal layer (separate from stack, overlays everything).
  const modalRoot = document.createElement("div");
  root.appendChild(modalRoot);

  // Hydration gate: setField waits for initial load so user clicks during hydration
  // don't race-overwrite saved settings with the empty placeholder object.
  const hydrated = (async () => {
    const initial = (await invoke<SettingsValue>(loadCmd)) ?? {};
    current = { ...initial };
    const theme = (current["__kit_theme"] as ThemeValue) ?? opts.theme?.default ?? "system";
    applyTheme(theme);
    stack.rerender();
  })();

  const setField = async (key: string, value: unknown) => {
    await hydrated;
    current[key] = value;
    // Auto-save on every change. Per spec: settings persist immediately.
    await invoke(saveCmd, { settings: current });
    await emit(savedEvent, current);
    opts.onSaved?.(current);
    stack.rerender();
  };

  const navSection = (section: Section) => {
    stack.push(
      sectionPage(section, current, setField, () => stack.pop()),
    );
  };

  const onThemeChange = async (t: ThemeValue) => {
    applyTheme(t);
    await setField("__kit_theme", t);
  };

  const navAbout = async () => {
    let appName = opts.about?.appName ?? "App";
    let version = opts.about?.appVersion ?? "0.0.0";
    if (!opts.about?.appName) {
      try {
        const { getName } = await import("@tauri-apps/api/app");
        appName = await getName();
      } catch { /* ignore */ }
    }
    if (!opts.about?.appVersion) {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        version = await getVersion();
      } catch { /* ignore */ }
    }
    const developer = {
      name: opts.about?.developer?.name ?? KIT_DEFAULTS.developer.name,
      links: { ...KIT_DEFAULTS.developer.links, ...opts.about?.developer?.links },
    };
    stack.push(
      aboutPage({
        appName,
        version,
        developer,
        autoUpdate: ((current["__kit_auto_update"] as AutoUpdateMode) ?? "onStartup"),
        onAutoUpdateChange: (m) => void setField("__kit_auto_update", m),
        onCheckNow: async () => {
          const { checkAndPromptUpdate } = await import("../updater/check");
          await checkAndPromptUpdate();
        },
        onCopyLogs: async () => {
          const logs = await invoke<string>("kit_copy_logs");
          await navigator.clipboard.writeText(logs);
        },
        onBack: () => stack.pop(),
        onRerender: () => stack.rerender(),
      }),
    );
  };

  const onReset = () => {
    render(
      resetModal(
        async () => {
          render(html``, modalRoot); // close modal
          // Determine settings filename — must match what the app uses.
          // Convention: apps using load_for/save_for with "settings.json" pass it implicitly.
          // We expose this as an opt for explicitness.
          await invoke("kit_reset_settings", { filename: "settings.json" });
          await getCurrentWindow().close();
        },
        () => render(html``, modalRoot),
      ),
      modalRoot,
    );
  };

  const onDanger = async (action: DangerAction) => {
    // For now, fire the command directly. Future: confirmation modal per action.
    try {
      await invoke(action.command);
    } catch (e) {
      console.warn("[kit] danger action failed:", e);
    }
  };

  // navAbout is async because of dynamic getName/getVersion. Wrap as fire-and-forget for the sync nav callback.
  const navAboutSync = () => { void navAbout(); };

  const navSystem = () => {
    stack.push(
      systemPage({
        systemInline: opts.systemInline ?? [],
        dangerActions: opts.dangerActions ?? [],
        current,
        get theme() {
          return (current["__kit_theme"] as ThemeValue) ?? opts.theme?.default ?? "system";
        },
        onChange: setField,
        onThemeChange,
        onNavAbout: navAboutSync,
        onReset,
        onDanger,
        onBack: () => stack.pop(),
      }),
    );
  };

  // First paint: schema-driven shell renders immediately with empty `current`.
  // Hydration above will rerender once settings load, swapping defaults for saved values.
  stack.push(
    rootPage({
      schema: opts.schema,
      onNavSection: navSection,
      onNavSystem: navSystem,
    }),
  );

  // Listen for settings-reset events so the settings window also re-reads if app modified state.
  // Registered after first paint; fire-and-forget so listener wiring never blocks initial render.
  let unlisten: (() => void) | null = null;
  void listen("settings-reset", async () => {
    const fresh = (await invoke<SettingsValue>(loadCmd)) ?? {};
    current = { ...fresh };
    applyTheme((current["__kit_theme"] as ThemeValue) ?? "system");
    stack.rerender();
  }).then((fn) => { unlisten = fn; });

  // Wait for hydration before resolving so callers (and tests) observe loaded state on resolve.
  await hydrated;

  return () => {
    if (unlisten) unlisten();
    render(html``, root);
  };
}
