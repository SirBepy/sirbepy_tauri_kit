//! Generic JSON-backed settings store + Tauri command helpers.

pub mod paths;
pub mod store;
pub mod error;
pub mod kit_settings;
pub mod commands;

pub use error::Error;
pub use kit_settings::KitSettings;
pub use commands::{kit_copy_logs, kit_reset_settings, with_kit_commands};

/// Returns a `tauri-plugin-log` plugin pre-configured with sensible defaults:
/// stdout + `<app-data>/app.log`, max 5 MB, keep-all rotation, level capped at `Info`.
/// Apps call: `.plugin(tauri_kit_settings::with_logging())`
/// The kit's `kit_copy_logs` command reads `<app-data>/app.log`, so this
/// pairs automatically with the Copy debug logs button.
pub fn with_logging<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    with_logging_at(log::LevelFilter::Info)
}

/// Same as `with_logging`, but with an explicit level cap for callers that want
/// something other than `Info` (e.g. `Debug` while chasing a bug).
pub fn with_logging_at<R: tauri::Runtime>(level: log::LevelFilter) -> tauri::plugin::TauriPlugin<R> {
    // Builder::new() already seeds [Stdout, LogDir{file_name: None}] (its Default).
    // .target() APPENDS to that seed; .targets() REPLACES it. Use .targets() or every
    // event writes twice (two log files, two stdout lines).
    tauri_plugin_log::Builder::new()
        .targets([
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                file_name: Some("app".into()),
            }),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
        ])
        .level(level)
        .max_file_size(5_000_000)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
        .build()
}

use serde::{de::DeserializeOwned, Serialize};
use tauri::{AppHandle, Runtime};

/// Load settings of type `T` from `<app-data>/<filename>`. Default if missing.
pub fn load_for<R: Runtime, T: DeserializeOwned + Default>(
    app: &AppHandle<R>,
    filename: &str,
) -> Result<T, Error> {
    let path = paths::settings_path(app, filename)?;
    store::load(&path)
}

/// Save settings to `<app-data>/<filename>`. Atomic.
pub fn save_for<R: Runtime, T: Serialize>(
    app: &AppHandle<R>,
    filename: &str,
    value: &T,
) -> Result<(), Error> {
    let path = paths::settings_path(app, filename)?;
    store::save(&path, value)
}
