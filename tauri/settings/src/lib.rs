//! Generic JSON-backed settings store + Tauri command helpers.

pub mod paths;
pub mod store;
pub mod error;
pub mod kit_settings;
pub mod commands;

pub use error::Error;
pub use kit_settings::KitSettings;
pub use commands::{kit_copy_logs, kit_reset_settings, with_kit_commands};

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
