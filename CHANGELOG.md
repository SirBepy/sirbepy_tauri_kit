# Changelog

## Unreleased

- New crate `tauri_kit_webview_recovery`: WebView2 `ProcessFailed` handling
  (renderer loss reloads, browser-process loss restarts the app).

- README/CHANGELOG rewritten to the real crate inventory: `tauri_kit_audio`,
  `tauri_kit_meeting`, `tauri_kit_settings`, `tauri_kit_updater`, `tauri_kit_window`
  (previously only settings + updater were listed).
- Documented why `claude_usage_in_taskbar`'s meeting module forks this crate
  instead of path-depping it (README).
