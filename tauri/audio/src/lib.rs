//! Reusable audio-output primitives for SirBepy Tauri apps.
//!
//! This crate owns the *universal* slice of audio handling - device
//! enumeration, the long-lived `OutputStream` controller (open / hot-swap /
//! failure-recovery), generic decode+play helpers, and an opt-in watcher that
//! makes a "System default" preference follow live OS default-device changes.
//!
//! It is deliberately free of any Tauri dependency and of any app policy
//! (muting, meeting-pause, notification queueing). Consumers wrap a thin
//! `#[tauri::command]` around `list_audio_output_devices`, build their own
//! playback queue on top of `AudioStreamCtrl::handle_arc`, and call
//! `spawn_default_follow` if they want the follow-OS behaviour.

use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

/// Shared reference to the active `OutputStreamHandle`. `None` while no device
/// is open. Consumers clone this (via [`AudioStreamCtrl::handle_arc`]) into
/// their playback workers so a hot-swap is visible without restarting them.
pub type SharedHandle = Arc<Mutex<Option<Arc<OutputStreamHandle>>>>;

// ── Device enumeration ────────────────────────────────────────────────────────

/// A system audio output device, as surfaced to a settings UI.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, ts_rs::TS)]
pub struct AudioOutputDevice {
    pub name: String,
    pub is_default: bool,
}

/// Enumerate system audio output devices. Returns an empty Vec (not an error)
/// if enumeration fails, so a frontend can still offer "System default".
pub fn list_audio_output_devices() -> Vec<AudioOutputDevice> {
    let host = cpal::default_host();
    let default_name = host.default_output_device().and_then(|d| d.name().ok());
    match host.output_devices() {
        Ok(devs) => {
            let mut default_marked = false;
            devs.filter_map(|d| d.name().ok())
                .map(|name| {
                    let is_default = !default_marked && Some(&name) == default_name.as_ref();
                    if is_default {
                        default_marked = true;
                    }
                    AudioOutputDevice { name, is_default }
                })
                .collect()
        }
        Err(e) => {
            log::warn!("audio: device enumeration failed: {e}");
            vec![]
        }
    }
}

/// Name of the current OS default output device, if any.
pub fn current_default_device_name() -> Option<String> {
    cpal::default_host()
        .default_output_device()
        .and_then(|d| d.name().ok())
}

// ── Device opening helpers ────────────────────────────────────────────────────

/// Open a named output device, or the OS default if `name` is None.
/// Falls back to `try_default()` if the named device is not found or fails.
fn open_device(name: Option<&str>) -> Option<(OutputStream, OutputStreamHandle)> {
    if let Some(name) = name {
        let host = cpal::default_host();
        if let Ok(mut devs) = host.output_devices() {
            if let Some(dev) = devs.find(|d| d.name().ok().as_deref() == Some(name)) {
                if let Ok(pair) = OutputStream::try_from_device(&dev) {
                    return Some(pair);
                }
                log::warn!("audio: failed to open device {name:?}, falling back to default");
            } else {
                log::warn!("audio: device {name:?} not found, falling back to default");
            }
        }
    }
    OutputStream::try_default().ok()
}

/// Spawn a background thread that keeps an `OutputStream` alive.
/// The thread blocks on `shutdown_rx` and exits (dropping the stream) when signaled.
/// Returns (handle, shutdown_tx) on success, None if the device can't be opened within 500 ms.
fn spawn_stream_thread(
    device_name: Option<String>,
) -> Option<(Arc<OutputStreamHandle>, mpsc::SyncSender<()>)> {
    let (result_tx, result_rx) = mpsc::sync_channel::<Option<OutputStreamHandle>>(1);
    let (shutdown_tx, shutdown_rx) = mpsc::sync_channel::<()>(1);

    std::thread::spawn(move || {
        match open_device(device_name.as_deref()) {
            Some((_stream, handle)) => {
                let _ = result_tx.send(Some(handle));
                let _ = shutdown_rx.recv(); // block; _stream drops when thread exits
            }
            None => {
                log::warn!("audio: failed to open output stream");
                let _ = result_tx.send(None);
            }
        }
    });

    result_rx
        .recv_timeout(Duration::from_millis(500))
        .ok()
        .flatten()
        .map(|h| (Arc::new(h), shutdown_tx))
}

// ── AudioStreamCtrl ───────────────────────────────────────────────────────────

/// Owns the lifetime of the `OutputStream` background thread and exposes a
/// shared handle reference that consumers' playback workers read from.
pub struct AudioStreamCtrl {
    handle: SharedHandle,
    shutdown_tx: Mutex<Option<mpsc::SyncSender<()>>>,
}

impl AudioStreamCtrl {
    /// Initialize with the named device or OS default.
    pub fn init(device_name: Option<&str>) -> Self {
        let shared = Arc::new(Mutex::new(None::<Arc<OutputStreamHandle>>));
        let shutdown = Mutex::new(None::<mpsc::SyncSender<()>>);
        let ctrl = Self { handle: shared, shutdown_tx: shutdown };
        if let Some((h, tx)) = spawn_stream_thread(device_name.map(|s| s.to_string())) {
            *ctrl.handle.lock().unwrap() = Some(h);
            *ctrl.shutdown_tx.lock().unwrap() = Some(tx);
        }
        ctrl
    }

    /// Hot-swap to a different device. Signals the old thread to exit cleanly,
    /// then starts a new thread. Falls back to OS default if the device can't be opened.
    pub fn reinit(&self, device_name: Option<&str>) {
        // Signal old thread to exit (drops old OutputStream and releases WASAPI client).
        if let Some(tx) = self.shutdown_tx.lock().unwrap().take() {
            let _ = tx.send(());
        }
        match spawn_stream_thread(device_name.map(|s| s.to_string())) {
            Some((h, tx)) => {
                *self.handle.lock().unwrap() = Some(h);
                *self.shutdown_tx.lock().unwrap() = Some(tx);
            }
            None => {
                *self.handle.lock().unwrap() = None;
                log::warn!("audio: reinit failed, audio disabled until next restart");
            }
        }
    }

    /// Clone of the shared handle reference for use by consumer playback workers.
    pub fn handle_arc(&self) -> SharedHandle {
        Arc::clone(&self.handle)
    }
}

// ── Follow-OS-default watcher ──────────────────────────────────────────────────

/// Poll interval for the default-device watcher.
const FOLLOW_POLL: Duration = Duration::from_secs(3);

/// Opt-in watcher that makes a "System default" preference follow live OS
/// default-device changes. Spawns a detached background thread that, every
/// ~3 s, checks the current OS default output device; when the preference is
/// "Default" (`pref_provider` returns `None`) and the OS default has changed
/// since last seen, it calls `reinit(None)` so the held stream re-binds to the
/// new default.
///
/// Named-device preferences (`pref_provider` returns `Some(name)`) are left
/// alone - those are covered by the consumer's own save-time `reinit` and by
/// failure-recovery if the device disappears.
///
/// `reinit` is typically a closure capturing the consumer's `AudioStreamCtrl`
/// (e.g. through its Tauri app handle) that calls `ctrl.reinit(dev)`.
pub fn spawn_default_follow<P, R>(pref_provider: P, reinit: R) -> std::thread::JoinHandle<()>
where
    P: Fn() -> Option<String> + Send + 'static,
    R: Fn(Option<String>) + Send + 'static,
{
    std::thread::spawn(move || {
        let mut last_default = current_default_device_name();
        loop {
            std::thread::sleep(FOLLOW_POLL);
            // Only follow while the user is on "System default".
            if pref_provider().is_some() {
                // Keep last_default fresh so a later switch back to Default
                // doesn't immediately fire on a change that happened meanwhile.
                last_default = current_default_device_name();
                continue;
            }
            let cur = current_default_device_name();
            if cur != last_default {
                log::info!(
                    "audio: OS default device changed ({last_default:?} -> {cur:?}), re-binding"
                );
                last_default = cur;
                reinit(None);
            }
        }
    })
}

// ── Failure recovery ──────────────────────────────────────────────────────────

/// On Sink failure (device disappeared), try to recover by opening the OS default.
/// Swaps the shared handle on success. The old OutputStream thread (for the gone
/// device) is left dormant - the OS releases the audio client when the device
/// disconnects.
pub fn try_recover_handle(shared: &SharedHandle) {
    let (result_tx, result_rx) = mpsc::sync_channel::<Option<OutputStreamHandle>>(1);
    std::thread::spawn(move || match OutputStream::try_default() {
        Ok((_stream, handle)) => {
            let _ = result_tx.send(Some(handle));
            // Keep _stream alive. Recovery is rare; thread count is bounded by
            // device-disconnect events.
            std::thread::park();
        }
        Err(e) => {
            log::warn!("audio: fallback reinit failed: {e}");
            let _ = result_tx.send(None);
        }
    });
    if let Ok(Some(h)) = result_rx.recv_timeout(Duration::from_millis(500)) {
        *shared.lock().unwrap() = Some(Arc::new(h));
        log::info!("audio: recovered to OS default device");
    }
}

// ── Decode + play helpers ─────────────────────────────────────────────────────

/// Decode an audio file into a rodio source. Format support is governed by this
/// crate's `rodio` feature set (mp3 / wav / ogg-vorbis).
pub fn load_source(path: &Path) -> Result<Decoder<BufReader<File>>> {
    let file = File::open(path).with_context(|| format!("open {path:?}"))?;
    Decoder::new(BufReader::new(file)).context("decode")
}

/// Play a file to completion on the given handle (blocks until the sound ends).
pub fn play_blocking(handle: &OutputStreamHandle, path: &Path) -> Result<()> {
    let source = load_source(path)?;
    let sink = Sink::try_new(handle).context("sink")?;
    sink.append(source);
    sink.sleep_until_end();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_stream_ctrl_handle_arc_is_shared() {
        // Works even when no audio device exists (CI). Tests that both arcs
        // point to the same allocation, not just equal values.
        let ctrl = AudioStreamCtrl::init(None);
        let arc1 = ctrl.handle_arc();
        let arc2 = ctrl.handle_arc();
        assert!(Arc::ptr_eq(&arc1, &arc2));
    }

    #[test]
    fn open_device_unknown_name_falls_back_to_default() {
        // Should not panic; may return None in headless CI.
        let _result = open_device(Some("__nonexistent_device_xyz__"));
    }

    #[test]
    fn list_devices_marks_at_most_one_default() {
        let devices = list_audio_output_devices();
        let defaults = devices.iter().filter(|d| d.is_default).count();
        assert!(defaults <= 1, "at most one device can be the OS default");
        for d in &devices {
            assert!(!d.name.is_empty(), "device name must not be empty");
        }
    }

    #[test]
    fn decodes_ogg_vorbis() {
        // Regression: rodio must be built with the `vorbis` feature, or every
        // .ogg clip decodes to silence. This fixture is a real trimmed Ogg
        // Vorbis clip; it must decode through the same rodio::Decoder the
        // playback paths use, on every platform.
        use rodio::Source;
        use std::io::Cursor;
        let bytes: &[u8] = include_bytes!("../tests/fixtures/vorbis-sample.ogg");
        assert_eq!(&bytes[..4], b"OggS", "fixture is not an Ogg container");
        let decoder = Decoder::new(Cursor::new(bytes))
            .expect("Ogg Vorbis must decode (rodio needs the `vorbis` feature)");
        assert!(decoder.channels() >= 1, "decoded source has no channels");
        let sample_count = decoder.take(1000).count();
        assert!(sample_count > 0, "Ogg Vorbis decoder yielded zero samples");
    }
}
