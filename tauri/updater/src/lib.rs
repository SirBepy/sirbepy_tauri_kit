//! Tauri updater plugin registration helper.
//!
//! Apps call `tauri_kit_updater::plugin()` and add it to their Tauri builder.
//! Endpoints + pubkey are configured per-app in `tauri.conf.json`.

use tauri::{plugin::TauriPlugin, Wry};
use tauri_plugin_updater::Config;

/// Returns a configured `tauri-plugin-updater` plugin instance.
pub fn plugin() -> TauriPlugin<Wry, Config> {
    tauri_plugin_updater::Builder::new().build()
}
