//! Background poll loop: every `poll_interval`, compute raw in-meeting and emit
//! `meeting://changed` on each transition. Stores latest state for the query
//! command. The app list is read from the shared store each poll, so app-list
//! edits take effect live (via `set_apps`) without rebuilding the plugin.

use crate::signal::{compute_in_meeting, SignalSource, Sources};
use crate::{MeetingState, MeetingStateStore};
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub fn spawn<R: Runtime>(
    app: AppHandle<R>,
    poll_interval: Duration,
    source: Box<dyn SignalSource>,
) {
    std::thread::spawn(move || {
        let mut last: Option<bool> = None;
        loop {
            let allow: Vec<String> = app
                .try_state::<MeetingStateStore>()
                .and_then(|s| s.apps.lock().ok().map(|g| g.clone()))
                .unwrap_or_default();

            let sources = Sources {
                camera: source.camera_in_use(),
                mic: source.mic_in_use(),
                audio: source.meeting_app_audio_active(&allow),
            };
            let active = compute_in_meeting(sources);

            // Update the shared store for the query command.
            if let Some(store) = app.try_state::<MeetingStateStore>() {
                store.active.store(active, Ordering::Relaxed);
                store.camera.store(sources.camera, Ordering::Relaxed);
                store.mic.store(sources.mic, Ordering::Relaxed);
                store.audio.store(sources.audio, Ordering::Relaxed);
            }

            if last != Some(active) {
                last = Some(active);
                let _ = app.emit("meeting://changed", MeetingState { active, sources });
                log::info!("meeting: active={active} sources={sources:?}");
            }
            std::thread::sleep(poll_interval);
        }
    });
}
