//! Background poll loop: every `poll_interval`, compute raw in-meeting and emit
//! `meeting://changed` on each transition. Stores latest state for the query
//! command. The app list is read from the shared store each poll, so app-list
//! edits take effect live (via `set_apps`) without rebuilding the plugin.

use crate::signal::{compute_in_meeting, process_name_matches, SignalSource, Sources};
use crate::{observe_only_apps, MeetingState, MeetingStateStore};
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
        let mut last_diag: Option<(Vec<String>, Vec<String>)> = None;
        loop {
            let store = app.try_state::<MeetingStateStore>();
            let allow: Vec<String> = store
                .as_ref()
                .and_then(|s| s.apps.lock().ok().map(|g| g.clone()))
                .unwrap_or_default();
            let browsers: Vec<String> = store
                .as_ref()
                .and_then(|s| s.browsers.lock().ok().map(|g| g.clone()))
                .unwrap_or_default();

            // Probe the configured apps plus the observe-only apps (Discord) so the
            // diagnostic log captures the latter; observe-only apps never drive the
            // signal, even if a user has one in their saved list (it'd false-fire).
            let observe = observe_only_apps();
            let mut probe_apps = allow.clone();
            for o in &observe {
                if !probe_apps.iter().any(|a| a.eq_ignore_ascii_case(o)) {
                    probe_apps.push(o.clone());
                }
            }
            let probe = source.probe_apps(&probe_apps);
            let app_mic = probe.mic_held.iter().any(|n| {
                process_name_matches(n, &allow) && !process_name_matches(n, &observe)
            });

            let sources = Sources {
                camera: source.camera_in_use(&browsers),
                mic: source.mic_in_use(&browsers),
                app_mic,
            };
            let active = compute_in_meeting(sources);

            // Update the shared store for the query command.
            if let Some(store) = app.try_state::<MeetingStateStore>() {
                store.active.store(active, Ordering::Relaxed);
                store.camera.store(sources.camera, Ordering::Relaxed);
                store.mic.store(sources.mic, Ordering::Relaxed);
                store.app_mic.store(sources.app_mic, Ordering::Relaxed);
            }

            // Diagnostic: log per-app mic-hold vs playback whenever it changes, so we
            // can see (e.g.) whether Discord holds the mic when idle or only in a call.
            let diag = (probe.mic_held.clone(), probe.audio_playing.clone());
            if last_diag.as_ref() != Some(&diag) {
                last_diag = Some(diag);
                if !probe.mic_held.is_empty() || !probe.audio_playing.is_empty() {
                    log::info!(
                        "meeting: diag mic_held={:?} audio_playing={:?}",
                        probe.mic_held,
                        probe.audio_playing
                    );
                }
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
