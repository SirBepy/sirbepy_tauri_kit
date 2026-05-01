//! Per-app data directory resolution.

use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

/// Returns `<app-data-dir>/<filename>`. Creates the parent directory if missing.
pub fn settings_path<R: Runtime>(app: &AppHandle<R>, filename: &str) -> std::io::Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(filename))
}

#[cfg(test)]
mod tests {
    // Cannot easily unit-test settings_path because it requires a real AppHandle.
    // Coverage comes from Task 2 store tests via dependency injection of a base dir.
}
