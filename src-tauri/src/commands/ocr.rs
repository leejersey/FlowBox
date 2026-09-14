use std::path::Path;

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn ocr_recognize_text(app: AppHandle, image_path: String) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| "file unreadable".to_string())?;
    crate::services::ocr::recognize_text(Path::new(&image_path), &app_data)
        .map_err(|error| error.to_string())
}
