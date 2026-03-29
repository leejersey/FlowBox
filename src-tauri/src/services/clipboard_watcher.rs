//! 剪贴板后台监听服务
//!
//! 启动一个独立线程，每秒轮询系统剪贴板。
//! 当检测到文本内容变化时，通过 Tauri Event 通知前端写入 SQLite。

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use std::{env, fs};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// 通过 Tauri Event 推送给前端的剪贴板数据载荷
#[derive(Debug, Clone, Serialize)]
pub struct ClipboardPayload {
    pub content_type: String,
    pub text_content: Option<String>,
    pub image_path: Option<String>,
    pub content_hash: String,
}

/// 全局开关——前端可通过 Tauri Command 控制
static WATCHER_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn set_watcher_enabled(enabled: bool) {
    WATCHER_ENABLED.store(enabled, Ordering::SeqCst);
    log::info!("clipboard watcher enabled = {}", enabled);
}

pub fn is_watcher_enabled() -> bool {
    WATCHER_ENABLED.load(Ordering::SeqCst)
}

#[cfg(target_os = "macos")]
fn read_clipboard_text() -> Option<String> {
    let output = Command::new("pbpaste").output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout).ok()
}

#[cfg(target_os = "macos")]
fn read_clipboard_image() -> Option<(Vec<u8>, &'static str)> {
    read_clipboard_data_by_class("PNGf")
        .or_else(|| export_clipboard_image_by_class("PNGf", "png"))
        .map(|bytes| (bytes, "png"))
        .or_else(|| {
            read_clipboard_data_by_class("TIFF")
                .or_else(|| export_clipboard_image_by_class("TIFF", "tiff"))
                .map(|bytes| (bytes, "tiff"))
        })
}

#[cfg(target_os = "macos")]
fn read_clipboard_data_by_class(class_code: &str) -> Option<Vec<u8>> {
    let script = format!(
        r#"try
set rawData to the clipboard as «class {class_code}»
return rawData as string
on error
return ""
end try"#
    );

    let output = Command::new("osascript").args(["-e", &script]).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let raw = String::from_utf8(output.stdout).ok()?;
    parse_applescript_hex_data(&raw, class_code)
}

#[cfg(target_os = "macos")]
fn parse_applescript_hex_data(raw: &str, class_code: &str) -> Option<Vec<u8>> {
    let mut compact: String = raw.chars().filter(|ch| !ch.is_whitespace()).collect();
    if compact.is_empty() {
        return None;
    }

    if compact.starts_with("«data") && compact.ends_with('»') {
        compact = compact
            .trim_start_matches("«data")
            .trim_end_matches('»')
            .to_string();
    }

    if let Some(rest) = compact.strip_prefix(class_code) {
        compact = rest.to_string();
    }

    if compact.is_empty() || compact.len() % 2 != 0 || !compact.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }

    let mut bytes = Vec::with_capacity(compact.len() / 2);
    let chars: Vec<char> = compact.chars().collect();
    for i in (0..chars.len()).step_by(2) {
        let pair = [chars[i], chars[i + 1]];
        let s: String = pair.iter().collect();
        let b = u8::from_str_radix(&s, 16).ok()?;
        bytes.push(b);
    }

    if bytes.is_empty() {
        None
    } else {
        Some(bytes)
    }
}

#[cfg(target_os = "macos")]
fn export_clipboard_image_by_class(class_code: &str, ext: &str) -> Option<Vec<u8>> {
    let tmp_path = env::temp_dir().join(format!("flowbox_clipboard_probe.{}", ext));
    let posix_path = tmp_path.to_string_lossy().replace('\\', "\\\\").replace('"', "\\\"");

    let script = format!(
        r#"try
set rawData to the clipboard as «class {class_code}»
set outFile to POSIX file "{posix_path}"
set fileRef to open for access outFile with write permission
set eof fileRef to 0
write rawData to fileRef
close access fileRef
return "ok"
on error
try
close access POSIX file "{posix_path}"
end try
return ""
end try"#
    );

    let output = Command::new("osascript").args(["-e", &script]).output().ok()?;
    if !output.status.success() || String::from_utf8_lossy(&output.stdout).trim() != "ok" {
        return None;
    }

    let data = fs::read(&tmp_path).ok()?;
    let _ = fs::remove_file(&tmp_path);
    if data.is_empty() {
        None
    } else {
        Some(data)
    }
}

#[cfg(not(target_os = "macos"))]
fn read_clipboard_text() -> Option<String> {
    let mut clipboard = arboard::Clipboard::new().ok()?;
    clipboard.get_text().ok()
}

#[cfg(not(target_os = "macos"))]
fn read_clipboard_image() -> Option<(Vec<u8>, &'static str)> {
    None
}

fn calculate_hash<T: Hash + ?Sized>(value: &T) -> u64 {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

fn persist_clipboard_image(
    app_handle: &AppHandle,
    hash: u64,
    image_bytes: &[u8],
    ext: &str,
) -> Option<String> {
    let app_data_dir = app_handle.path().app_data_dir().ok()?;
    let image_dir = app_data_dir.join("clipboard_images");
    std::fs::create_dir_all(&image_dir).ok()?;

    let stem = format!("{:016x}", hash);
    let file_path = image_dir.join(format!("{}.{}", stem, ext));
    if !file_path.exists() {
        std::fs::write(&file_path, image_bytes).ok()?;
    }

    // WebView 对 TIFF 预览兼容性不稳定，尽量转成 PNG 再返回
    if ext == "tiff" {
        let png_path = image_dir.join(format!("{}.png", stem));
        if !png_path.exists() {
            let _ = Command::new("sips")
                .args([
                    "-s",
                    "format",
                    "png",
                    &file_path.to_string_lossy(),
                    "--out",
                    &png_path.to_string_lossy(),
                ])
                .output();
        }
        if png_path.exists() {
            return Some(png_path.to_string_lossy().to_string());
        }
    }

    Some(file_path.to_string_lossy().to_string())
}

/// 在 setup 中调用一次
pub fn start_clipboard_watcher(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_hash: u64 = 0;

        // 初始化时记录当前剪贴板内容的 hash，避免启动后立刻把旧内容当「新」处理
        if let Some(text) = read_clipboard_text() {
            last_hash = calculate_hash(&text);
        }

        log::info!("clipboard watcher thread started");

        loop {
            thread::sleep(Duration::from_secs(1));

            // 检查全局开关
            if !WATCHER_ENABLED.load(Ordering::SeqCst) {
                continue;
            }

            let mut emitted = false;

            if let Some((image_bytes, ext)) = read_clipboard_image() {
                let hash = calculate_hash(&image_bytes);
                if hash != last_hash {
                    if let Some(image_path) = persist_clipboard_image(&app_handle, hash, &image_bytes, ext) {
                        last_hash = hash;
                        emitted = true;

                        let payload = ClipboardPayload {
                            content_type: "image".to_string(),
                            text_content: None,
                            image_path: Some(image_path),
                            content_hash: format!("{:016x}", hash),
                        };

                        log::debug!("clipboard new image: hash={:016x}, ext={}", hash, ext);

                        if let Err(e) = app_handle.emit("clipboard://new", &payload) {
                            log::error!("emit clipboard image event failed: {}", e);
                        }
                    }
                }
            }

            if emitted {
                continue;
            }

            if let Some(text) = read_clipboard_text() {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    continue;
                }

                let hash = calculate_hash(trimmed);
                if hash == last_hash {
                    continue;
                }

                last_hash = hash;

                let payload = ClipboardPayload {
                    content_type: detect_content_type(trimmed).to_string(),
                    text_content: Some(trimmed.to_string()),
                    image_path: None,
                    content_hash: format!("{:016x}", hash),
                };

                log::debug!("clipboard new: {} bytes, type={}", trimmed.len(), payload.content_type);

                if let Err(e) = app_handle.emit("clipboard://new", &payload) {
                    log::error!("emit clipboard event failed: {}", e);
                }
            }
        }
    });
}

/// 简单的内容类型推断
fn detect_content_type(text: &str) -> &str {
    // 如果包含代码特征，标记为 code
    let code_indicators = [
        "fn ", "def ", "class ", "import ", "const ", "let ", "var ",
        "function ", "return ", "if (", "for (", "while (",
        "pub ", "struct ", "enum ", "#include", "package ",
        "->", "=>", "&&", "||",
    ];

    let lines: Vec<&str> = text.lines().collect();

    // 多行 + 包含代码关键词 → code
    if lines.len() >= 2 {
        let has_code_indicator = code_indicators.iter().any(|ind| text.contains(ind));
        let has_braces = text.contains('{') && text.contains('}');
        let has_semicolons = text.matches(';').count() >= 2;

        if has_code_indicator && (has_braces || has_semicolons) {
            return "code";
        }
    }

    "text"
}
