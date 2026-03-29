//! 截图命令 — 调用系统截图并返回图片路径

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// 获取截图存储目录
fn screenshot_dir(app: &AppHandle) -> Option<PathBuf> {
    let app_data = app.path().app_data_dir().ok()?;
    let dir = app_data.join("screenshots");
    fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// 从系统剪贴板读取图片并保存到文件
/// 返回保存的文件路径
#[tauri::command]
pub fn screenshot_from_clipboard(app: AppHandle) -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("无法访问剪贴板: {}", e))?;

    let image = clipboard
        .get_image()
        .map_err(|_| "剪贴板中没有图片。请先使用系统截图工具截取屏幕。".to_string())?;

    let width = image.width;
    let height = image.height;
    let rgba_bytes = image.bytes;

    // 使用简单 BMP 格式保存，避免引入额外图片编码库
    // 实际上我们直接将 RGBA 数据编码为 PNG 格式
    let save_dir = screenshot_dir(&app)
        .ok_or("无法创建截图存储目录。".to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let file_name = format!("screenshot_{}.bmp", timestamp);
    let file_path = save_dir.join(&file_name);

    // 写入 BMP 格式（无压缩，兼容性好）
    let bmp_data = encode_bmp(width as u32, height as u32, &rgba_bytes);
    fs::write(&file_path, &bmp_data)
        .map_err(|e| format!("保存截图失败: {}", e))?;

    log::info!("screenshot saved: {}", file_path.display());
    Ok(file_path.to_string_lossy().to_string())
}

/// 简易 BMP 编码器（RGBA → 24-bit BMP）
fn encode_bmp(width: u32, height: u32, rgba: &[u8]) -> Vec<u8> {
    let row_size = ((width * 3 + 3) / 4) * 4; // 每行对齐到 4 字节
    let pixel_data_size = row_size * height;
    let file_size = 54 + pixel_data_size;

    let mut data = Vec::with_capacity(file_size as usize);

    // BMP File Header (14 bytes)
    data.extend_from_slice(b"BM");
    data.extend_from_slice(&(file_size as u32).to_le_bytes());
    data.extend_from_slice(&[0u8; 4]); // reserved
    data.extend_from_slice(&54u32.to_le_bytes()); // pixel data offset

    // DIB Header (40 bytes)
    data.extend_from_slice(&40u32.to_le_bytes()); // header size
    data.extend_from_slice(&(width as i32).to_le_bytes());
    data.extend_from_slice(&(height as i32).to_le_bytes()); // positive = bottom-up
    data.extend_from_slice(&1u16.to_le_bytes()); // color planes
    data.extend_from_slice(&24u16.to_le_bytes()); // bits per pixel
    data.extend_from_slice(&0u32.to_le_bytes()); // no compression
    data.extend_from_slice(&(pixel_data_size as u32).to_le_bytes());
    data.extend_from_slice(&2835u32.to_le_bytes()); // h resolution (72 DPI)
    data.extend_from_slice(&2835u32.to_le_bytes()); // v resolution
    data.extend_from_slice(&0u32.to_le_bytes()); // colors in palette
    data.extend_from_slice(&0u32.to_le_bytes()); // important colors

    // Pixel data (bottom-up, BGR)
    let padding = (row_size - width * 3) as usize;
    for y in (0..height).rev() {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            if idx + 2 < rgba.len() {
                data.push(rgba[idx + 2]); // B
                data.push(rgba[idx + 1]); // G
                data.push(rgba[idx]);     // R
            } else {
                data.extend_from_slice(&[0, 0, 0]);
            }
        }
        for _ in 0..padding {
            data.push(0);
        }
    }

    data
}
