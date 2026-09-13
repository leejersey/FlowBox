use crate::services::secrets;

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    secrets::get(&key)
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    secrets::set(&key, &value)
}

#[tauri::command]
pub fn secret_exists(key: String) -> Result<bool, String> {
    Ok(secrets::get(&key)?.is_some())
}
