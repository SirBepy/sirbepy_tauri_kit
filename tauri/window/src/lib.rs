//! Window capture-exclusion helper. `exclude_from_capture(&window, true)` makes a
//! window invisible to screen capture / screen-share (SetWindowDisplayAffinity with
//! WDA_EXCLUDEFROMCAPTURE) while it stays visible to the local user. Win10 2004+.

use tauri::{Runtime, WebviewWindow};

/// Toggle whether `window` is excluded from screen capture.
/// No-op (Ok) on non-Windows.
pub fn exclude_from_capture<R: Runtime>(
    window: &WebviewWindow<R>,
    excluded: bool,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
        };

        let handle = window.window_handle().map_err(|e| e.to_string())?;
        let hwnd = match handle.as_raw() {
            RawWindowHandle::Win32(h) => HWND(h.hwnd.get() as *mut core::ffi::c_void),
            _ => return Err("not a Win32 window".into()),
        };
        let affinity = if excluded { WDA_EXCLUDEFROMCAPTURE } else { WDA_NONE };
        unsafe {
            SetWindowDisplayAffinity(hwnd, affinity).map_err(|e| e.to_string())?;
        }
        log::info!("window: capture-excluded={excluded}");
    }
    #[cfg(not(windows))]
    {
        let _ = (window, excluded);
    }
    Ok(())
}

mod commands {
    use super::exclude_from_capture;
    use tauri::{Runtime, WebviewWindow};

    /// Tauri command wrapper so JS consumers can toggle it. Pomodoro drives this from
    /// Rust instead, but other apps may want the command.
    #[tauri::command]
    pub fn set_window_capture_excluded<R: Runtime>(
        window: WebviewWindow<R>,
        excluded: bool,
    ) -> Result<(), String> {
        exclude_from_capture(&window, excluded)
    }
}

/// Plugin that registers `set_window_capture_excluded`.
pub fn with_window_commands<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("kit-window")
        .invoke_handler(tauri::generate_handler![commands::set_window_capture_excluded])
        .build()
}
