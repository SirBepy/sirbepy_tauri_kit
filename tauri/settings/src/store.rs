//! Atomic JSON-backed store. Pure file I/O, decoupled from Tauri.

use crate::error::Error;
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;

/// Read JSON at `path` and deserialize. Returns `T::default()` if file is missing.
/// Returns `T::default()` and logs a warning if file exists but is unparseable.
pub fn load<T: DeserializeOwned + Default>(path: &Path) -> Result<T, Error> {
    if !path.exists() {
        return Ok(T::default());
    }
    let bytes = std::fs::read(path)?;
    match serde_json::from_slice::<T>(&bytes) {
        Ok(v) => Ok(v),
        Err(e) => {
            eprintln!(
                "[tauri_kit_settings] settings file {} unparseable: {}; using defaults",
                path.display(),
                e
            );
            Ok(T::default())
        }
    }
}

/// Atomic write: serialize T, write to `<path>.tmp`, fsync, rename to `path`.
pub fn save<T: Serialize>(path: &Path, value: &T) -> Result<(), Error> {
    let bytes = serde_json::to_vec_pretty(value)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &bytes)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use tempfile::tempdir;

    #[derive(Serialize, Deserialize, Default, Debug, PartialEq)]
    struct TestSettings {
        name: String,
        count: u32,
    }

    #[test]
    fn load_returns_default_when_file_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("missing.json");
        let s: TestSettings = load(&path).unwrap();
        assert_eq!(s, TestSettings::default());
    }

    #[test]
    fn load_returns_default_when_file_corrupt() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("corrupt.json");
        std::fs::write(&path, b"{not valid json").unwrap();
        let s: TestSettings = load(&path).unwrap();
        assert_eq!(s, TestSettings::default());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("ok.json");
        let s = TestSettings { name: "foo".into(), count: 42 };
        save(&path, &s).unwrap();
        let loaded: TestSettings = load(&path).unwrap();
        assert_eq!(loaded, s);
    }

    #[test]
    fn save_creates_parent_dir() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("sub").join("dir").join("ok.json");
        let s = TestSettings { name: "x".into(), count: 1 };
        save(&path, &s).unwrap();
        assert!(path.exists());
    }

    #[test]
    fn save_does_not_leave_tmp_on_success() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("ok.json");
        let s = TestSettings::default();
        save(&path, &s).unwrap();
        assert!(!path.with_extension("tmp").exists());
    }
}
