//! 应用使用追踪后台服务
//!
//! 每 5 秒轮询 macOS 前台应用名称，当应用切换时发送事件通知前端记录使用时长。

use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::Emitter;

static TRACKING_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn set_tracking(enabled: bool) {
    TRACKING_ENABLED.store(enabled, Ordering::Relaxed);
}

pub fn is_tracking() -> bool {
    TRACKING_ENABLED.load(Ordering::Relaxed)
}

#[derive(Clone, Serialize)]
struct AppUsageTick {
    app_name: String,
    duration_seconds: u64,
}

/// 获取 macOS 前台应用名称（通过 osascript）
fn get_frontmost_app() -> Option<String> {
    let output = Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to get name of first application process whose frontmost is true"])
        .output()
        .ok()?;

    if output.status.success() {
        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if name.is_empty() {
            None
        } else {
            Some(name)
        }
    } else {
        None
    }
}

/// 启动后台追踪线程
pub fn start_app_usage_tracker(handle: tauri::AppHandle) {
    thread::spawn(move || {
        let mut current_app: Option<String> = None;
        let mut last_switch = Instant::now();

        loop {
            thread::sleep(Duration::from_secs(5));

            if !TRACKING_ENABLED.load(Ordering::Relaxed) {
                // 追踪关闭时重置状态
                current_app = None;
                last_switch = Instant::now();
                continue;
            }

            if let Some(frontmost) = get_frontmost_app() {
                let switched = match &current_app {
                    Some(prev) => prev != &frontmost,
                    None => true,
                };

                if switched {
                    // 上一个应用的使用时长
                    if let Some(prev_app) = &current_app {
                        let duration = last_switch.elapsed().as_secs();
                        if duration >= 3 {
                            let tick = AppUsageTick {
                                app_name: prev_app.clone(),
                                duration_seconds: duration,
                            };
                            let _ = handle.emit("app_usage://tick", tick);
                        }
                    }

                    current_app = Some(frontmost);
                    last_switch = Instant::now();
                }
            }
        }
    });
}
