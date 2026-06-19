//! Meeting detection: polls Windows for camera/mic use and meeting-app audio,
//! emits raw `meeting://changed` edges, and exposes a `kit_meeting_state` query.
//! Consumers apply their own latch/override policy on top of the raw edges.

pub mod signal;
mod watcher;
#[cfg(windows)]
pub mod windows_source;

pub use signal::{SignalSource, Sources};

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{plugin::TauriPlugin, AppHandle, Manager, Runtime, State};

/// Configuration for the meeting watcher.
#[derive(Clone, Debug)]
pub struct MeetingConfig {
    pub poll_interval: Duration,
    /// Process image names counted as meeting apps for the audio-session check.
    pub audio_app_names: Vec<String>,
    /// Browser process image names counted for the camera/mic consent check.
    /// Native meeting apps are intentionally excluded here (the audio-session
    /// check covers them); only browsers acquire the device solely during a call.
    pub browser_app_names: Vec<String>,
}

impl Default for MeetingConfig {
    fn default() -> Self {
        Self {
            poll_interval: Duration::from_secs(3),
            audio_app_names: default_meeting_apps(),
            browser_app_names: default_browser_apps(),
        }
    }
}

/// Built-in meeting-app process names. These are detected by *mic-hold*: they
/// acquire the mic device only during a call, so holding it == in a call.
/// Discord is intentionally absent - it parks the mic the whole time it runs, so
/// mic-hold can't tell a call apart from it merely being open; it is probed for
/// diagnostics (see `observe_only_apps`) and otherwise left to the manual toggle.
pub fn default_meeting_apps() -> Vec<String> {
    ["Teams.exe", "ms-teams.exe", "Zoom.exe", "CptHost.exe", "slack.exe", "Webex.exe"]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// Apps probed for diagnostics only - logged each poll (mic-held vs playing audio)
/// but never used for the in-meeting decision. Lets us learn an always-on-mic
/// app's real behavior (does Discord hold the mic when idle, or only in a call?)
/// without it causing false positives.
pub fn observe_only_apps() -> Vec<String> {
    ["Discord.exe"].iter().map(|s| s.to_string()).collect()
}

/// Built-in browser process names for the camera/mic consent check. Browsers hold
/// the device only for the duration of a call, so they are safe to detect this way;
/// native meeting apps (which park the device while merely running) are not listed.
pub fn default_browser_apps() -> Vec<String> {
    [
        "chrome.exe",
        "msedge.exe",
        "firefox.exe",
        "brave.exe",
        "opera.exe",
        "vivaldi.exe",
        "arc.exe",
        "zen.exe",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

/// Payload emitted on `meeting://changed` and returned by the query command.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct MeetingState {
    pub active: bool,
    pub sources: Sources,
}

/// Shared state store, written by the watcher, read by the query command.
/// `apps` is the live meeting-app allow list (the watcher reads it each poll).
pub(crate) struct MeetingStateStore {
    pub active: AtomicBool,
    pub camera: AtomicBool,
    pub mic: AtomicBool,
    pub app_mic: AtomicBool,
    pub apps: Mutex<Vec<String>>,
    pub browsers: Mutex<Vec<String>>,
}

#[tauri::command]
fn kit_meeting_state(store: State<'_, MeetingStateStore>) -> MeetingState {
    MeetingState {
        active: store.active.load(Ordering::Relaxed),
        sources: Sources {
            camera: store.camera.load(Ordering::Relaxed),
            mic: store.mic.load(Ordering::Relaxed),
            app_mic: store.app_mic.load(Ordering::Relaxed),
        },
    }
}

/// Update the live meeting-app allow list. Apps call this on setup and whenever
/// the user edits the list, so edits take effect without restarting the watcher.
pub fn set_apps<R: Runtime>(app: &AppHandle<R>, apps: Vec<String>) {
    if let Some(store) = app.try_state::<MeetingStateStore>() {
        if let Ok(mut g) = store.apps.lock() {
            *g = apps;
        }
    }
}

/// Update the live browser allow list used by the camera/mic consent check.
/// Mirrors `set_apps`: call on setup and whenever the user edits the list.
pub fn set_browsers<R: Runtime>(app: &AppHandle<R>, browsers: Vec<String>) {
    if let Some(store) = app.try_state::<MeetingStateStore>() {
        if let Ok(mut g) = store.browsers.lock() {
            *g = browsers;
        }
    }
}

/// Returns a plugin that, on setup, registers the state store + query command and
/// spawns the background watcher using the platform signal source.
pub fn plugin<R: Runtime>(config: MeetingConfig) -> TauriPlugin<R> {
    tauri::plugin::Builder::new("meeting")
        .invoke_handler(tauri::generate_handler![kit_meeting_state])
        .setup(move |app, _api| {
            app.manage(MeetingStateStore {
                active: AtomicBool::new(false),
                camera: AtomicBool::new(false),
                mic: AtomicBool::new(false),
                app_mic: AtomicBool::new(false),
                apps: Mutex::new(config.audio_app_names.clone()),
                browsers: Mutex::new(config.browser_app_names.clone()),
            });

            #[cfg(windows)]
            let source: Box<dyn SignalSource> = Box::new(windows_source::WindowsSignalSource);
            #[cfg(not(windows))]
            let source: Box<dyn SignalSource> = Box::new(NoopSource);

            watcher::spawn(app.clone(), config.poll_interval, source);
            Ok(())
        })
        .build()
}

#[cfg(not(windows))]
struct NoopSource;
#[cfg(not(windows))]
impl SignalSource for NoopSource {
    fn camera_in_use(&self, _browsers: &[String]) -> bool { false }
    fn mic_in_use(&self, _browsers: &[String]) -> bool { false }
    fn probe_apps(&self, _apps: &[String]) -> signal::AppProbe { signal::AppProbe::default() }
}
