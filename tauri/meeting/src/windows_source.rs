//! Windows implementation of SignalSource.
//! - camera/mic (browser-scoped): read the CapabilityAccessManager ConsentStore in
//!   HKCU. A subkey whose `LastUsedTimeStop` == 0 means that app holds the device
//!   right now. Scoped to browser processes because browsers only acquire the
//!   device for the duration of a call, so this catches Google Meet / Zoom-web
//!   without false-firing on apps that park the device.
//! - native apps (`probe_apps`): the meeting signal for desktop apps is *mic-hold*
//!   (the same ConsentStore `LastUsedTimeStop == 0`, but matched against the
//!   meeting-app list). Mic-hold is the canonical "mic in use" signal: it survives
//!   a long mute (app-level mute never releases the device) and ignores playback
//!   (notification pings, voice-message playback), which is what fixed the
//!   playback-based false positives. We also probe active audio *render* sessions
//!   purely for diagnostics, never for the decision.

#![cfg(windows)]

use crate::signal::{process_name_from_consent_key, process_name_matches, AppProbe, SignalSource};
use std::collections::HashMap;

pub struct WindowsSignalSource;

impl SignalSource for WindowsSignalSource {
    fn camera_in_use(&self, browsers: &[String]) -> bool {
        !consent_store_holders("webcam", browsers).is_empty()
    }
    fn mic_in_use(&self, browsers: &[String]) -> bool {
        !consent_store_holders("microphone", browsers).is_empty()
    }
    fn probe_apps(&self, apps: &[String]) -> AppProbe {
        AppProbe {
            mic_held: consent_store_holders("microphone", apps),
            audio_playing: audio_playing_apps(apps),
        }
    }
}

/// App process names (from `apps`) that currently have an active audio render
/// (playback) session. Diagnostic only - playback is NOT a meeting signal.
fn audio_playing_apps(apps: &[String]) -> Vec<String> {
    if apps.is_empty() {
        return Vec::new();
    }
    match active_audio_pids() {
        Ok(pids) if !pids.is_empty() => {
            let names = pid_name_map();
            let mut hits: Vec<String> = pids
                .iter()
                .filter_map(|pid| names.get(pid))
                .filter(|n| process_name_matches(n, apps))
                .cloned()
                .collect();
            hits.sort();
            hits.dedup();
            hits
        }
        Ok(_) => Vec::new(),
        Err(e) => {
            log::warn!("meeting: audio session scan failed: {e}");
            Vec::new()
        }
    }
}

// ---- registry (camera / mic) ----

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Process names (from `allow`) that currently hold `device` under
/// `...\CapabilityAccessManager\ConsentStore\<device>` (or its `NonPackaged`
/// subtree), i.e. their `LastUsedTimeStop` == 0. Apps not in `allow` are ignored.
fn consent_store_holders(device: &str, allow: &[String]) -> Vec<String> {
    if allow.is_empty() {
        return Vec::new();
    }
    let base = format!(
        "Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{device}"
    );
    let mut hits = active_children(&base, allow);
    hits.extend(active_children(&format!("{base}\\NonPackaged"), allow));
    hits.sort();
    hits.dedup();
    hits
}

/// Open `parent`, enumerate its immediate subkeys, and return the process names
/// (matched against `allow`) whose `LastUsedTimeStop` value equals 0.
fn active_children(parent: &str, allow: &[String]) -> Vec<String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    };

    let mut hits = Vec::new();
    let wparent = to_wide(parent);
    let mut hkey = HKEY::default();
    let opened = unsafe {
        RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(wparent.as_ptr()), 0, KEY_READ, &mut hkey)
    };
    if opened != ERROR_SUCCESS {
        return hits;
    }

    let mut index = 0u32;
    loop {
        let mut name_buf = [0u16; 256];
        let mut name_len = name_buf.len() as u32;
        let rc = unsafe {
            RegEnumKeyExW(
                hkey,
                index,
                windows::core::PWSTR(name_buf.as_mut_ptr()),
                &mut name_len,
                None,
                windows::core::PWSTR::null(),
                None,
                None,
            )
        };
        if rc != ERROR_SUCCESS {
            break;
        }
        let child = String::from_utf16_lossy(&name_buf[..name_len as usize]);
        index += 1;
        let name = process_name_from_consent_key(&child);
        // Only listed processes count; a parked device on any other app is noise.
        if !process_name_matches(name, allow) {
            continue;
        }
        let full = format!("{parent}\\{child}");
        if last_used_stop_is_zero(&full) {
            hits.push(name.to_string());
        }
    }
    unsafe {
        let _ = RegCloseKey(hkey);
    }
    hits
}

/// Read REG_QWORD `LastUsedTimeStop` under `key_path`; return true iff it equals 0.
fn last_used_stop_is_zero(key_path: &str) -> bool {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    };

    let wkey = to_wide(key_path);
    let wname = to_wide("LastUsedTimeStop");
    let mut hkey = HKEY::default();
    let opened = unsafe {
        RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(wkey.as_ptr()), 0, KEY_READ, &mut hkey)
    };
    if opened != ERROR_SUCCESS {
        return false;
    }

    let mut data = [0u8; 8];
    let mut size = data.len() as u32;
    let rc = unsafe {
        RegQueryValueExW(
            hkey,
            PCWSTR(wname.as_ptr()),
            None,
            None,
            Some(data.as_mut_ptr()),
            Some(&mut size),
        )
    };
    unsafe {
        let _ = RegCloseKey(hkey);
    }
    if rc != ERROR_SUCCESS {
        return false;
    }
    u64::from_le_bytes(data) == 0
}

// ---- WASAPI (audio render sessions) ----

/// PIDs that currently have an ACTIVE audio render session on the default endpoint.
fn active_audio_pids() -> Result<Vec<u32>, String> {
    use windows::core::Interface;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, AudioSessionStateActive, IAudioSessionControl2,
        IAudioSessionEnumerator, IAudioSessionManager2, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    let mut pids = Vec::new();
    unsafe {
        // Ignore RPC_E_CHANGED_MODE — COM may already be initialized on this thread.
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| e.to_string())?;
        let mgr: IAudioSessionManager2 =
            device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())?;
        let sessions: IAudioSessionEnumerator =
            mgr.GetSessionEnumerator().map_err(|e| e.to_string())?;
        let count = sessions.GetCount().map_err(|e| e.to_string())?;

        for i in 0..count {
            let ctrl = match sessions.GetSession(i) {
                Ok(c) => c,
                Err(_) => continue,
            };
            if ctrl.GetState().map_err(|e| e.to_string())? != AudioSessionStateActive {
                continue;
            }
            let ctrl2: IAudioSessionControl2 = match ctrl.cast() {
                Ok(c) => c,
                Err(_) => continue,
            };
            if let Ok(pid) = ctrl2.GetProcessId() {
                if pid != 0 {
                    pids.push(pid);
                }
            }
        }
    }
    Ok(pids)
}

/// Map every running PID to its process image name (e.g. "Teams.exe").
fn pid_name_map() -> HashMap<u32, String> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let mut map = HashMap::new();
    unsafe {
        let snapshot = match CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            Ok(s) => s,
            Err(_) => return map,
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let end = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..end]);
                map.insert(entry.th32ProcessID, name);
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = windows::Win32::Foundation::CloseHandle(snapshot);
    }
    map
}
