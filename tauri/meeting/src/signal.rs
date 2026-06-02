//! Pure detection logic + the SignalSource abstraction (no OS calls here).

use serde::Serialize;

/// Snapshot of the three raw signals at one poll.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Sources {
    pub camera: bool,
    pub mic: bool,
    pub audio: bool,
}

/// Reads the three raw signals. Implemented by the OS layer; faked in tests.
pub trait SignalSource: Send {
    /// True if a process whose name matches `browsers` currently holds the camera.
    /// Scoped to browsers because native meeting apps are covered by the audio-session
    /// check; an unscoped check false-fires on any app that parks the device.
    fn camera_in_use(&self, browsers: &[String]) -> bool;
    /// True if a process whose name matches `browsers` currently holds the mic.
    /// Scoped to browsers for the same reason as `camera_in_use` (e.g. Discord holds
    /// the mic the whole time it runs for voice-activity detection, call or not).
    fn mic_in_use(&self, browsers: &[String]) -> bool;
    /// True if any process whose name matches `allow` has an active audio render session.
    fn meeting_app_audio_active(&self, allow: &[String]) -> bool;
}

/// Combine the three raw signals into a single "in meeting" boolean.
pub fn compute_in_meeting(s: Sources) -> bool {
    s.camera || s.mic || s.audio
}

/// Case-insensitive match of a process image name against the allow list.
/// `proc_name` is e.g. "Teams.exe"; `allow` entries may be "teams.exe" or "Teams.exe".
pub fn process_name_matches(proc_name: &str, allow: &[String]) -> bool {
    allow.iter().any(|a| a.eq_ignore_ascii_case(proc_name))
}

/// Extract the process image name from a CapabilityAccessManager consent-store
/// subkey. NonPackaged keys encode the full exe path with `#` separators
/// (e.g. `C:#Program Files#Google#Chrome#Application#chrome.exe`); packaged keys
/// are package family names with no `#`, returned as-is (they never match a
/// browser exe, which is the intended outcome).
pub fn process_name_from_consent_key(key: &str) -> &str {
    match key.rfind('#') {
        Some(i) => &key[i + 1..],
        None => key,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_meeting_when_any_signal_true() {
        assert!(!compute_in_meeting(Sources::default()));
        assert!(compute_in_meeting(Sources { camera: true, ..Default::default() }));
        assert!(compute_in_meeting(Sources { mic: true, ..Default::default() }));
        assert!(compute_in_meeting(Sources { audio: true, ..Default::default() }));
    }

    #[test]
    fn process_match_is_case_insensitive() {
        let allow = vec!["Teams.exe".to_string(), "zoom.exe".to_string()];
        assert!(process_name_matches("teams.exe", &allow));
        assert!(process_name_matches("ZOOM.EXE", &allow));
        assert!(!process_name_matches("chrome.exe", &allow));
    }

    #[test]
    fn consent_key_yields_exe_name() {
        // NonPackaged: path encoded with '#'.
        assert_eq!(
            process_name_from_consent_key("C:#Program Files#Google#Chrome#Application#chrome.exe"),
            "chrome.exe"
        );
        // Packaged / no separator: returned unchanged.
        assert_eq!(
            process_name_from_consent_key("Microsoft.SkypeApp_kzf8qxf38zg5c"),
            "Microsoft.SkypeApp_kzf8qxf38zg5c"
        );
        // A browser key matches the browser allow list end-to-end.
        let browsers = vec!["chrome.exe".to_string(), "msedge.exe".to_string()];
        let name = process_name_from_consent_key("C:#x#chrome.exe");
        assert!(process_name_matches(name, &browsers));
        // Discord parks the mic but is not a browser, so it must not match.
        let name = process_name_from_consent_key("C:#Users#me#AppData#Discord#Discord.exe");
        assert!(!process_name_matches(name, &browsers));
    }
}
