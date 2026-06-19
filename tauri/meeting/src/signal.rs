//! Pure detection logic + the SignalSource abstraction (no OS calls here).

use serde::Serialize;

/// Snapshot of the three raw signals at one poll.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Sources {
    /// A browser currently holds the camera (web video call).
    pub camera: bool,
    /// A browser currently holds the mic (web call: Google Meet, Zoom-web).
    pub mic: bool,
    /// A native meeting app currently holds the mic device (desktop call).
    /// Mic-hold, not playback: the device stays held the whole call even while
    /// muted, and a notification ping / voice-message playback never holds it.
    pub app_mic: bool,
}

/// Per-app diagnostic snapshot, logged (not used for the decision) so we can see
/// each app's real behavior: holding the mic device vs merely playing audio.
/// This is how we learn whether an always-on-mic app like Discord can ever be
/// auto-detected by mic-hold, or must stay manual-toggle only.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct AppProbe {
    /// App process names currently holding the mic device (LastUsedTimeStop == 0).
    pub mic_held: Vec<String>,
    /// App process names with an active audio *render* (playback) session.
    pub audio_playing: Vec<String>,
}

/// Reads the raw signals. Implemented by the OS layer; faked in tests.
pub trait SignalSource: Send {
    /// True if a process whose name matches `browsers` currently holds the camera.
    /// Scoped to browsers because native meeting apps are covered by `probe_apps`;
    /// an unscoped check false-fires on any app that parks the device.
    fn camera_in_use(&self, browsers: &[String]) -> bool;
    /// True if a process whose name matches `browsers` currently holds the mic.
    /// Scoped to browsers for the same reason as `camera_in_use` (e.g. Discord holds
    /// the mic the whole time it runs for voice-activity detection, call or not).
    fn mic_in_use(&self, browsers: &[String]) -> bool;
    /// Probe each app in `apps`: which hold the mic device vs which are merely
    /// playing audio. The watcher derives the native `app_mic` signal from
    /// `mic_held` and logs the rest for diagnostics.
    fn probe_apps(&self, apps: &[String]) -> AppProbe;
}

/// Combine the raw signals into a single "in meeting" boolean.
pub fn compute_in_meeting(s: Sources) -> bool {
    s.camera || s.mic || s.app_mic
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

/// Map a known meeting-app exe name (lowercase) to its Store package family name
/// prefix (lowercase). Only apps where the packaged version is distinct from the
/// classic installer version and uses a known family name are listed here.
fn exe_to_package_family_prefix(exe: &str) -> Option<&'static str> {
    match exe.to_ascii_lowercase().as_str() {
        "ms-teams.exe" => Some("msteams"),
        _ => None,
    }
}

/// Check if a packaged app family key (e.g. `MSTeams_8wekyb3d8bbwe`) matches any
/// entry in `allow`. Two strategies:
///   1. Direct match (case-insensitive) — users can list a family name explicitly.
///   2. Built-in exe-to-family-prefix map — `ms-teams.exe` matches any key that
///      starts with `msteams` (case-insensitive), so new Teams is caught without
///      users having to know the family name.
/// Returns the matching allow-list entry so callers can push the canonical name.
pub fn packaged_family_match<'a>(family_key: &str, allow: &'a [String]) -> Option<&'a str> {
    let key_lower = family_key.to_ascii_lowercase();
    for entry in allow {
        if family_key.eq_ignore_ascii_case(entry) {
            return Some(entry.as_str());
        }
        if let Some(prefix) = exe_to_package_family_prefix(entry) {
            if key_lower.starts_with(prefix) {
                return Some(entry.as_str());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_meeting_when_any_signal_true() {
        assert!(!compute_in_meeting(Sources::default()));
        assert!(compute_in_meeting(Sources { camera: true, ..Default::default() }));
        assert!(compute_in_meeting(Sources { mic: true, ..Default::default() }));
        assert!(compute_in_meeting(Sources { app_mic: true, ..Default::default() }));
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

    #[test]
    fn packaged_family_key_matches_new_teams() {
        let apps = vec!["ms-teams.exe".to_string(), "zoom.exe".to_string()];
        // New Teams (Store): family key starts with "MSTeams".
        assert_eq!(
            packaged_family_match("MSTeams_8wekyb3d8bbwe", &apps),
            Some("ms-teams.exe")
        );
        // Case variation in family key still matches.
        assert_eq!(
            packaged_family_match("msteams_8wekyb3d8bbwe", &apps),
            Some("ms-teams.exe")
        );
        // Direct listing of the family name also works.
        let apps_with_family = vec!["MSTeams_8wekyb3d8bbwe".to_string()];
        assert_eq!(
            packaged_family_match("MSTeams_8wekyb3d8bbwe", &apps_with_family),
            Some("MSTeams_8wekyb3d8bbwe")
        );
        // Unrelated Store app does not match.
        assert_eq!(packaged_family_match("Microsoft.SkypeApp_kzf8qxf38zg5c", &apps), None);
        // Zoom (non-packaged exe in list) does not match a random family key.
        assert_eq!(packaged_family_match("zoom_somepackageid", &apps), None);
    }
}
