//! 番茄钟联动 macOS 专注模式：通过系统「快捷指令」CLI 运行用户配置的指令

use std::process::Command;

const SHORTCUTS_BIN: &str = "/usr/bin/shortcuts";

fn run_shortcuts(args: &[&str]) -> Result<String, String> {
    let output = Command::new(SHORTCUTS_BIN)
        .args(args)
        .output()
        .map_err(|e| format!("无法调用快捷指令: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("快捷指令执行失败: {}", stderr.trim()))
    }
}

/// 列出本机所有快捷指令名称，供设置页选择
#[tauri::command]
pub async fn macos_shortcuts_list() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        run_shortcuts(&["list"]).map(|out| {
            out.lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(String::from)
                .collect()
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 运行指定名称的快捷指令（参数直接传给进程，不经过 shell）
#[tauri::command]
pub async fn macos_shortcut_run(name: String) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("快捷指令名称不能为空".into());
    }
    tauri::async_runtime::spawn_blocking(move || run_shortcuts(&["run", &name]).map(|_| ()))
        .await
        .map_err(|e| e.to_string())?
}
