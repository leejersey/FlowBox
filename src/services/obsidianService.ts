import { invoke, isTauri } from '@tauri-apps/api/core'

export interface ObsidianExportResult {
  fileName: string
  filePath: string
}

export interface ObsidianExportRequest {
  vaultPath: string
  fileName: string
  markdownText: string
}

export async function exportMarkdownToObsidian(
  request: ObsidianExportRequest
): Promise<ObsidianExportResult> {
  if (!isTauri()) {
    throw new Error('仅桌面版支持导出到 Obsidian。')
  }

  return invoke('obsidian_export_markdown', {
    request: {
      vault_path: request.vaultPath,
      file_name: request.fileName,
      markdown_text: request.markdownText,
    },
  })
}
