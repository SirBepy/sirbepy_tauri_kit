//! Brings an app's WebView2 back after one of its out-of-process pieces dies.
//!
//! WebView2 renders in `msedgewebview2.exe` children, not in the app's own
//! process. When they die (crash, OOM, or something force-killing processes by
//! name) the Tauri host keeps running with a blank or frozen window and never
//! notices, so a tray app can sit invisible-but-alive for days. `plugin()`
//! hooks WebView2's `ProcessFailed` event on every webview the app creates and
//! recovers:
//!
//! - renderer gone or hung: reload that page in place;
//! - browser process gone: the whole WebView2 environment is dead and cannot be
//!   revived from inside it, so the app restarts through `request_restart`,
//!   which still delivers `RunEvent::ExitRequested` to the app's own handler.
//!
//! Everything else (GPU, utility, sandbox helper, iframe renderers) WebView2
//! recreates by itself.

use std::sync::OnceLock;
use std::time::{Duration, Instant};

use tauri::{plugin::TauriPlugin, Runtime};

/// What to do about one `ProcessFailed` event.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Recovery {
    Reload,
    Relaunch,
    Ignore,
}

/// A browser-process loss this soon after start means the fresh instance died
/// on startup too; relaunching again would loop forever.
pub const RELAUNCH_GRACE: Duration = Duration::from_secs(60);

// COREWEBVIEW2_PROCESS_FAILED_KIND values, kept as plain ints so the decision
// stays testable on every platform.
const BROWSER_PROCESS_EXITED: i32 = 0;
const RENDER_PROCESS_EXITED: i32 = 1;
const RENDER_PROCESS_UNRESPONSIVE: i32 = 2;

/// Maps a `COREWEBVIEW2_PROCESS_FAILED_KIND` to a recovery, given how long the
/// app has been running.
pub fn recovery_for(kind: i32, uptime: Duration) -> Recovery {
    match kind {
        BROWSER_PROCESS_EXITED if uptime < RELAUNCH_GRACE => Recovery::Ignore,
        BROWSER_PROCESS_EXITED => Recovery::Relaunch,
        RENDER_PROCESS_EXITED | RENDER_PROCESS_UNRESPONSIVE => Recovery::Reload,
        _ => Recovery::Ignore,
    }
}

static STARTED: OnceLock<Instant> = OnceLock::new();

/// Plugin that hooks every webview the app creates, config windows included.
/// No-op off Windows.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    STARTED.get_or_init(Instant::now);
    tauri::plugin::Builder::new("kit-webview-recovery")
        .on_webview_ready(|webview| {
            #[cfg(windows)]
            win::hook(webview);
            #[cfg(not(windows))]
            let _ = webview;
        })
        .build()
}

#[cfg(windows)]
mod win {
    use super::{recovery_for, Recovery, STARTED};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Instant;
    use tauri::{AppHandle, Manager, Runtime, Webview};
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2Controller, ICoreWebView2ProcessFailedEventArgs,
        COREWEBVIEW2_PROCESS_FAILED_KIND,
    };
    use webview2_com::ProcessFailedEventHandler;

    // Every webview shares one browser process, so its loss fires on all of
    // them at once; only the first may ask for the restart.
    static RELAUNCHING: AtomicBool = AtomicBool::new(false);

    pub fn hook<R: Runtime>(webview: Webview<R>) {
        let app = webview.app_handle().clone();
        let label = webview.label().to_string();
        let result = webview.with_webview(move |platform| {
            if let Err(e) = attach(platform.controller(), app, label.clone()) {
                log::warn!("webview_recovery: could not hook '{label}': {e}");
            }
        });
        if let Err(e) = result {
            log::warn!("webview_recovery: with_webview failed: {e}");
        }
    }

    fn attach<R: Runtime>(
        controller: ICoreWebView2Controller,
        app: AppHandle<R>,
        label: String,
    ) -> windows_core::Result<()> {
        let started = *STARTED.get_or_init(Instant::now);
        let handler = ProcessFailedEventHandler::create(Box::new(
            move |sender: Option<ICoreWebView2>,
                  args: Option<ICoreWebView2ProcessFailedEventArgs>| {
                let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND::default();
                if let Some(args) = &args {
                    unsafe { args.ProcessFailedKind(&mut kind)? };
                }
                match recovery_for(kind.0, started.elapsed()) {
                    Recovery::Reload => {
                        log::warn!("webview_recovery: '{label}' renderer failed (kind {}), reloading", kind.0);
                        if let Some(webview) = sender {
                            unsafe { webview.Reload()? };
                        }
                    }
                    Recovery::Relaunch => {
                        if !RELAUNCHING.swap(true, Ordering::SeqCst) {
                            log::error!("webview_recovery: WebView2 browser process exited ('{label}'), restarting app");
                            app.request_restart();
                        }
                    }
                    Recovery::Ignore => {
                        log::warn!("webview_recovery: '{label}' process failed (kind {}), not recovering", kind.0);
                    }
                }
                Ok(())
            },
        ));
        let mut token = 0i64;
        unsafe {
            let core = controller.CoreWebView2()?;
            core.add_ProcessFailed(&handler, &mut token)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LATE: Duration = Duration::from_secs(3600);

    #[test]
    fn browser_exit_relaunches_once_past_grace() {
        assert_eq!(recovery_for(BROWSER_PROCESS_EXITED, LATE), Recovery::Relaunch);
    }

    #[test]
    fn browser_exit_right_after_start_does_not_loop() {
        assert_eq!(
            recovery_for(BROWSER_PROCESS_EXITED, Duration::from_secs(5)),
            Recovery::Ignore
        );
    }

    #[test]
    fn renderer_loss_or_hang_reloads() {
        assert_eq!(recovery_for(RENDER_PROCESS_EXITED, LATE), Recovery::Reload);
        assert_eq!(recovery_for(RENDER_PROCESS_UNRESPONSIVE, LATE), Recovery::Reload);
        // Reloading cannot loop the way a relaunch can, so no grace applies.
        assert_eq!(recovery_for(RENDER_PROCESS_EXITED, Duration::ZERO), Recovery::Reload);
    }

    #[test]
    fn self_healing_kinds_are_left_alone() {
        // frame renderer, utility, sandbox helper, gpu, ppapi plugin/broker, unknown
        for kind in 3..=9 {
            assert_eq!(recovery_for(kind, LATE), Recovery::Ignore, "kind {kind}");
        }
    }
}
