use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ObsidianExportRequest {
    pub vault_path: String,
    pub file_name: String,
    pub markdown_text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianExportResult {
    pub file_name: String,
    pub file_path: String,
}

pub fn export_markdown_to_obsidian(
    request: ObsidianExportRequest,
) -> Result<ObsidianExportResult, String> {
    let vault_path = PathBuf::from(request.vault_path.trim());
    if request.markdown_text.trim().is_empty() {
        return Err("没有可导出的 Markdown 内容。".to_string());
    }
    if request.file_name.trim().is_empty() {
        return Err("文件名不能为空。".to_string());
    }
    if !vault_path.exists() {
        return Err("Obsidian Vault 路径不存在。".to_string());
    }
    if !vault_path.is_dir() {
        return Err("Obsidian Vault 路径不是文件夹。".to_string());
    }

    let inbox_dir = vault_path.join("Inbox");
    fs::create_dir_all(&inbox_dir)
        .map_err(|err| format!("无法创建 Obsidian Inbox 目录: {err}"))?;

    let sanitized_file_name = sanitize_file_name(&request.file_name);
    let target_path = dedupe_target_path(&inbox_dir, &sanitized_file_name);

    fs::write(&target_path, request.markdown_text)
        .map_err(|err| format!("无法写入 Obsidian 笔记: {err}"))?;

    Ok(ObsidianExportResult {
        file_name: target_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Untitled.md")
            .to_string(),
        file_path: target_path.to_string_lossy().to_string(),
    })
}

fn dedupe_target_path(inbox_dir: &Path, file_name: &str) -> PathBuf {
    let candidate = inbox_dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled");
    let extension = Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("md");

    let mut index = 1;
    loop {
        let next = inbox_dir.join(format!("{stem}-{index}.{extension}"));
        if !next.exists() {
            return next;
        }
        index += 1;
    }
}

fn sanitize_file_name(file_name: &str) -> String {
    let mut sanitized = file_name
        .trim()
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\n' | '\r' | '\t' => '-',
            _ => ch,
        })
        .collect::<String>();

    sanitized = sanitized
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches('.')
        .trim()
        .to_string();

    if sanitized.is_empty() {
        sanitized = "Untitled".to_string();
    }

    if !sanitized.to_lowercase().ends_with(".md") {
        sanitized.push_str(".md");
    }

    sanitized
}
