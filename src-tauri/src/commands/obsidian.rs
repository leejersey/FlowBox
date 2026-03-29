use crate::services::obsidian_export::{
    export_markdown_to_obsidian, ObsidianExportRequest, ObsidianExportResult,
};

#[tauri::command]
pub fn obsidian_export_markdown(
    request: ObsidianExportRequest,
) -> Result<ObsidianExportResult, String> {
    export_markdown_to_obsidian(request)
}
