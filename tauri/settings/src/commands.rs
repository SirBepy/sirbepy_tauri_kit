//! Tauri commands shipped by the kit. Apps register them via `with_kit_commands`.

use crate::paths::settings_path;
use std::fs;
use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    AppHandle, Emitter, Manager, Runtime,
};

/// Returns the contents of `<app-data>/app.log` if present, otherwise a placeholder.
#[tauri::command]
pub async fn kit_copy_logs<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let log_path = dir.join("app.log");
    if !log_path.exists() {
        return Ok("no logs available".to_string());
    }
    fs::read_to_string(&log_path).map_err(|e| e.to_string())
}

/// Deletes the settings file. Caller's main window listens for `settings-reset` event
/// and re-reads settings (which falls back to T::default()).
#[tauri::command]
pub async fn kit_reset_settings<R: Runtime>(
    app: AppHandle<R>,
    filename: String,
) -> Result<(), String> {
    let path = settings_path(&app, &filename).map_err(|e| e.to_string())?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    app.emit("settings-reset", ()).map_err(|e| e.to_string())?;
    Ok(())
}

/// Returns a Tauri plugin that registers all kit-shipped commands.
/// Apps call: `.plugin(tauri_kit_settings::with_kit_commands())`
pub fn with_kit_commands<R: Runtime>() -> TauriPlugin<R> {
    PluginBuilder::new("kit-commands")
        .invoke_handler(tauri::generate_handler![kit_copy_logs, kit_reset_settings])
        .build()
}
