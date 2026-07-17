import { html, render } from "lit-html";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SettingsSchema, Section, Field } from "./schema";
import { PageStack } from "./stack";
import { rootPage } from "./pages/root";
import { sectionPage } from "./pages/section";
import { applyTheme, DEFAULT_MODE, type PaletteDef, type ThemeValue } from "./pages/theme";
import { aboutPage, type AboutUpdateDeps, type AutoUpdateMode } from "./pages/about";
import type { Update } from "@tauri-apps/plugin-updater";
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
  /** Default mode (light/dark/system). */
  default?: ThemeValue;
  /** Default palette id. Only meaningful when `palettes` is provided. */
  defaultPalette?: string;
}

export interface AboutVersionInfo {
  buildDate?: string;
  installedAt?: string;
}

export interface RenderOptions {
  schema: SettingsSchema;
  systemInline?: Field[];
  dangerActions?: DangerAction[];
  about?: AboutConfig;
  /**
   * Resolves the About page's "Built"/"Installed" info cards. Called lazily
   * inside navAbout(), same as the appName/version lookups below, so apps
   * that never open About never pay for it.
   */
  getVersionInfo?: () => Promise<AboutVersionInfo>;
  theme?: ThemeConfig;
  /** Opt-in named palettes. When provided, the System page shows a palette picker. */
  palettes?: PaletteDef[];
  loadCommand?: string;
  saveCommand?: string;
  savedEvent?: string;
  onSaved?: (settings: Record<string, unknown>) => void;
  closeOnSave?: boolean;
  onHeaderChange?: (title: string, depth: number, pop: () => void) => void;
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

  const palettes = opts.palettes ?? [];
  const hasPalettes = palettes.length > 0;
  const defaultMode = opts.theme?.default ?? DEFAULT_MODE;
  const defaultPalette = hasPalettes
    ? (opts.theme?.defaultPalette ?? palettes[0].id)
    : undefined;
  const modeOf = (s: SettingsValue) => (s["__kit_theme"] as ThemeValue) ?? defaultMode;
  const paletteOf = (s: SettingsValue): string | undefined =>
    hasPalettes ? ((s["__kit_palette"] as string) ?? defaultPalette) : undefined;

  // Apply default theme only if nothing is already applied (first app paint). On
  // subsequent navigations back to settings the HTML element already has the
  // user's saved theme; overwriting it with the default causes a visible flash
  // back to "system" before hydration restores the saved value.
  if (!document.documentElement.hasAttribute("data-theme")) {
    applyTheme(defaultMode, defaultPalette);
  }

  // Synchronous DOM scaffold + first paint with empty values.
  // Settings hydrate asynchronously below; sections list is schema-driven and renders immediately.
  let current: SettingsValue = {};
  const stackRoot = document.createElement("div");
  stackRoot.className = "kit-settings";
  root.replaceChildren(stackRoot);
  const stack = new PageStack(stackRoot);
  if (opts.onHeaderChange) {
    const cb = opts.onHeaderChange;
    stack.onPageChange = (page, depth, pop) => cb(page.title, depth, pop);
  }

  // Modal layer (separate from stack, overlays everything).
  const modalRoot = document.createElement("div");
  root.appendChild(modalRoot);

  // Hydration gate: setField waits for initial load so user clicks during hydration
  // don't race-overwrite saved settings with the empty placeholder object.
  const hydrated = (async () => {
    const initial = (await invoke<SettingsValue>(loadCmd)) ?? {};
    current = { ...initial };
    applyTheme(modeOf(current), paletteOf(current));
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
    applyTheme(t, paletteOf(current));
    await setField("__kit_theme", t);
  };

  const onPaletteChange = async (p: string) => {
    applyTheme(modeOf(current), p);
    await setField("__kit_palette", p);
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
    let versionInfo: AboutVersionInfo = {};
    if (opts.getVersionInfo) {
      try {
        versionInfo = await opts.getVersionInfo();
      } catch { /* ignore, cards just stay hidden */ }
    }

    // Mutated in place by the check/download/relaunch flow below; aboutPage's
    // render() reads these fields fresh on every stack.rerender() call.
    const updateState: AboutUpdateDeps = {};
    let pendingUpdate: Update | null = null;

    const installPendingUpdate = async () => {
      const update = pendingUpdate;
      if (!update) return;
      const { downloadAndInstallWithProgress } = await import("../updater/check");
      updateState.statusText = "Downloading… 0%";
      updateState.statusColor = undefined;
      updateState.actionLabel = undefined;
      updateState.onAction = undefined;
      stack.rerender();
      try {
        await downloadAndInstallWithProgress(update, ({ downloaded, total }) => {
          updateState.statusText = total
            ? `Downloading… ${Math.round((downloaded / total) * 100)}%`
            : `Downloading… ${Math.round(downloaded / 1024)} KB`;
          stack.rerender();
        });
        updateState.statusText = `Update v${update.version} installed`;
        updateState.actionLabel = "Relaunch now";
        updateState.onAction = () => {
          void (async () => {
            const { relaunch } = await import("@tauri-apps/plugin-process");
            await relaunch();
          })();
        };
      } catch (err) {
        updateState.statusText = `Update failed: ${String(err)}`;
        updateState.statusColor = "var(--kit-danger)";
        updateState.actionLabel = "Retry";
        updateState.onAction = () => void installPendingUpdate();
      }
      stack.rerender();
    };

    stack.push(
      aboutPage({
        appName,
        version,
        buildDate: versionInfo.buildDate,
        installedAt: versionInfo.installedAt,
        developer,
        autoUpdate: ((current["__kit_auto_update"] as AutoUpdateMode) ?? "onStartup"),
        onAutoUpdateChange: (m) => void setField("__kit_auto_update", m),
        onCheckNow: async () => {
          const { check } = await import("@tauri-apps/plugin-updater");
          const update = await check();
          if (!update) {
            pendingUpdate = null;
            updateState.statusText = "Up to date";
            updateState.statusColor = undefined;
            updateState.actionLabel = undefined;
            updateState.onAction = undefined;
            return;
          }
          pendingUpdate = update;
          updateState.statusText = `Update v${update.version} available`;
          updateState.statusColor = undefined;
          updateState.actionLabel = "Download & Install";
          updateState.onAction = () => void installPendingUpdate();
        },
        onCopyLogs: async () => {
          const logs = await invoke<string>("kit_copy_logs");
          await navigator.clipboard.writeText(logs);
        },
        onBack: () => stack.pop(),
        update: updateState,
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
    void hydrated.then(() => {
      stack.push(
        systemPage({
          systemInline: opts.systemInline ?? [],
          dangerActions: opts.dangerActions ?? [],
          current,
          palettes,
          get theme() {
            return modeOf(current);
          },
          get palette() {
            return paletteOf(current);
          },
          onChange: setField,
          onThemeChange,
          onPaletteChange,
          onReset,
          onDanger,
          onBack: () => stack.pop(),
        }),
      );
    });
  };

  // First paint: schema-driven shell renders immediately with empty `current`.
  // Hydration above will rerender once settings load, swapping defaults for saved values.
  stack.push(
    rootPage({
      schema: opts.schema,
      onNavSection: navSection,
      onNavSystem: navSystem,
      onNavAbout: navAboutSync,
    }),
  );

  // Listen for settings-reset events so the settings window also re-reads if app modified state.
  // Registered after first paint; fire-and-forget so listener wiring never blocks initial render.
  let unlisten: (() => void) | null = null;
  void listen("settings-reset", async () => {
    const fresh = (await invoke<SettingsValue>(loadCmd)) ?? {};
    current = { ...fresh };
    applyTheme(modeOf(current), paletteOf(current));
    stack.rerender();
  }).then((fn) => { unlisten = fn; });

  // Wait for hydration before resolving so callers (and tests) observe loaded state on resolve.
  await hydrated;

  return () => {
    if (unlisten) unlisten();
    render(html``, root);
  };
}
