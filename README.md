# sirbepy_tauri_kit

Shared building blocks for SirBepy's Tauri desktop apps.

## What's inside

Rust crates (`tauri/<name>`, cargo workspace members):

- `tauri/audio` (`tauri_kit_audio`) — device enumeration, a long-lived output-stream
  controller with hot-swap/failure-recovery, decode+play helpers, and an opt-in
  "follow the OS default device" watcher. No Tauri dependency, no app policy.
- `tauri/meeting` (`tauri_kit_meeting`) — polls Windows for camera/mic use and
  meeting-app audio, emits raw `meeting://changed` edges plus a `kit_meeting_state`
  query. Consumers apply their own latch/override policy on top.
- `tauri/settings` (`tauri_kit_settings`) — generic JSON-backed settings store and
  Tauri command helpers.
- `tauri/updater` (`tauri_kit_updater`) — `tauri-plugin-updater` registration helper;
  endpoints/pubkey stay per-app in `tauri.conf.json`.
- `tauri/window` (`tauri_kit_window`) — `exclude_from_capture`, a Windows
  `WDA_EXCLUDEFROMCAPTURE` wrapper that hides a window from screen capture/share
  while it stays visible locally.

Frontend (lit-html + TS, `frontend/<name>`):

- `frontend/audio/` — device-picker UI for the audio crate.
- `frontend/meeting/` — `meeting://changed` subscription helper.
- `frontend/settings/` — schema-driven settings page: field renderers, keybind
  capture, page/stack navigation, palettes.
- `frontend/updater/` — auto-update check helpers.
- `frontend/styleguide/themes/` — the four shared palettes (`void`, `nebula`,
  `glacier`, `cosmo`), each with a dark and light `[data-mode="light"]` block.

## Why the meeting module is forked, not path-depped

`claude_usage_in_taskbar`'s `src-tauri/src/meeting/{mod,signal,windows_source}.rs`
is a deliberate copy of this crate's logic, not a `tauri_kit_meeting` path-dep. The
two drifted: this crate's `SignalSource::camera_in_use`/`mic_in_use` are
browser-scoped (only browsers are checked, since native meeting apps are covered
separately by `probe_apps`'s mic-hold check), while the app's equivalent is
unscoped and also carries live `set_apps()`/`set_browsers()` calls the kit doesn't
expose the same way. Reconciling the two would mean picking one trait shape and
updating both consumers, a cross-repo change nobody has asked for. Decided
2026-08-17: document the fork and leave both as-is rather than converge them. If
this ever needs revisiting, start from `.claude/todos/81-tauri-kit-code-cleanup.md`
in the `claude_usage_in_taskbar` repo.

## Consuming this kit

Add as a git submodule in your Tauri app:

```bash
git submodule add https://github.com/SirBepy/sirbepy_tauri_kit.git vendor/tauri_kit
```

Then reference Rust crates via cargo path-deps and import TS via Vite.

See the consumer apps (`pomodoro-overlay`, `claude_usage_in_taskbar`) for examples.
