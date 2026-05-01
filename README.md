# sirbepy_tauri_kit

Shared building blocks for SirBepy's Tauri desktop apps.

## What's inside

- `frontend/settings/` — schema-driven settings page (lit-html + TS)
- `frontend/updater/` — auto-update check helpers
- `tauri/settings/` — generic JSON-backed settings store (Rust crate)
- `tauri/updater/` — updater plugin registration helper (Rust crate)

## Consuming this kit

Add as a git submodule in your Tauri app:

```bash
git submodule add https://github.com/SirBepy/sirbepy_tauri_kit.git vendor/tauri_kit
```

Then reference Rust crates via cargo path-deps and import TS via Vite.

See the consumer apps (`pomodoro-overlay`, `claude_usage_in_taskbar`) for examples.
