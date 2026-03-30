import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Sparkles, Diamond, UploadCloud, FolderOpen, Trash2, Copy, Check, FileText, ArrowRightLeft } from 'lucide-react'
import TurndownService from 'turndown'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'
import { showToast } from '@/store/useToastStore'
import { exportMarkdownToObsidian } from '@/services/obsidianService'
import { codeThemes } from '@/features/markdown/codeThemes'
import type { CodeTheme, CodeTokenType } from '@/features/markdown/codeThemes'

// Turndown 实例（配置 ATX 标题如 # 和 fenced 代码块 ```）
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

function padTimePart(value: number): string {
  return String(value).padStart(2, '0')
}

function sanitizeTitleSegment(title: string): string {
  const sanitized = title
    .replace(/[`*_#[\]()>~]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized || 'FlowBox Memo'
}

function generateDefaultFileName(markdown: string): string {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    padTimePart(now.getMonth() + 1),
    padTimePart(now.getDate())
  ].join('-') + ' ' + [
    padTimePart(now.getHours()),
    padTimePart(now.getMinutes()),
    padTimePart(now.getSeconds())
  ].join('')

  const firstMeaningfulLine = markdown
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0)
    ?.replace(/^#{1,6}\s+/, '')
    ?.replace(/^[-*+]\s+/, '')
    ?.replace(/^\d+[\.\)]\s+/, '')
    ?? ''

  return `${timestamp} ${sanitizeTitleSegment(firstMeaningfulLine)}.md`
}

function normalizePlainTextToMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trimEnd()
      if (!trimmed) return ''
      if (/^[•◦▪]\s+/.test(trimmed)) {
        return trimmed.replace(/^[•◦▪]\s+/, '- ')
      }
      return trimmed
    })
    .join('\n')
    .trim()
}

function cleanupMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function convertSourceToMarkdown(html: string, text: string): string {
  if (html) {
    return cleanupMarkdown(turndownService.turndown(html))
  }
  return cleanupMarkdown(normalizePlainTextToMarkdown(text))
}

function createMarkdownPreviewComponents(theme: CodeTheme): Components {
  return {
    pre: ({ children }) => <>{children}</>,
    code: ({ children, className }) => {
      const content = String(children ?? '').replace(/\n$/, '')
      const isBlock = Boolean(className) || content.includes('\n')
      const language = normalizeLanguage(className) ?? inferCodeLanguage(content)

      if (isBlock) {
        return (
          <pre
            style={{
              backgroundColor: theme.block.backgroundColor,
              color: theme.block.color,
              borderRadius: '14px',
              padding: '16px 18px',
              margin: '1em 0',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.7',
              border: theme.block.border,
              boxShadow: theme.block.boxShadow,
            }}
          >
            <code
              className={className}
              style={{
                fontFamily: "'SFMono-Regular', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontSize: '13px',
                backgroundColor: 'transparent',
                color: 'inherit',
                padding: '0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {renderHighlightedCode(content, language, theme)}
            </code>
          </pre>
        )
      }

      return (
        <code
          className={className}
          style={{
            fontFamily: "'SFMono-Regular', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: '0.92em',
            backgroundColor: theme.inlineCode.backgroundColor,
            color: theme.inlineCode.color,
            padding: '0.16em 0.42em',
            borderRadius: '6px',
            border: theme.inlineCode.border,
          }}
        >
          {renderHighlightedCode(content, language, theme)}
        </code>
      )
    },
  }
}

const languageKeywordMap: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'import', 'from', 'export', 'default', 'class', 'extends', 'try', 'catch', 'finally', 'async', 'await', 'throw', 'typeof', 'instanceof'],
  typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'import', 'from', 'export', 'default', 'class', 'extends', 'try', 'catch', 'finally', 'async', 'await', 'throw', 'interface', 'type', 'implements', 'public', 'private', 'protected', 'readonly'],
  python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'import', 'from', 'as', 'pass', 'break', 'continue', 'lambda', 'yield', 'with', 'in', 'is', 'not', 'and', 'or'],
  sql: ['select', 'from', 'where', 'and', 'or', 'insert', 'into', 'update', 'delete', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by', 'order', 'limit', 'having', 'as', 'distinct', 'create', 'table', 'values'],
  shell: ['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'case', 'esac', 'export', 'local', 'function', 'in', 'echo', 'cd', 'pwd', 'cat', 'grep', 'find', 'sed', 'awk'],
  json: ['true', 'false', 'null'],
  markdown: [],
}

function normalizeLanguage(className?: string): string | null {
  if (!className) return null
  const matched = className.match(/language-([\w-]+)/)?.[1]?.toLowerCase()
  if (!matched) return null
  if (matched === 'js' || matched === 'jsx') return 'javascript'
  if (matched === 'ts' || matched === 'tsx') return 'typescript'
  if (matched === 'bash' || matched === 'sh' || matched === 'zsh') return 'shell'
  if (matched === 'py') return 'python'
  return matched
}

function inferCodeLanguage(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return 'plaintext'
  if (/^#{1,6}\s/m.test(trimmed)) return 'markdown'
  if (/<\/?[a-z][^>]*>/i.test(trimmed)) return 'html'
  if (/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(trimmed)) return 'sql'
  if (/\bdef\b|\bimport\b|\bfrom\b|\bclass\b/.test(trimmed)) return 'python'
  if (/\b(const|let|function|=>|import|export)\b/.test(trimmed)) return 'typescript'
  if (/^\s*[{[]/.test(trimmed)) return 'json'
  if (/^\s*#/.test(trimmed) || /\becho\b|\bgrep\b|\bcat\b/.test(trimmed)) return 'shell'
  return 'plaintext'
}

function renderHighlightedCode(code: string, language: string, theme: CodeTheme) {
  const lines = code.split('\n')
  return lines.map((line, lineIndex) => (
    <Fragment key={`${language}-${lineIndex}`}>
      {tokenizeCodeLine(line, language).map((token, tokenIndex) => (
        <span
          key={`${language}-${lineIndex}-${tokenIndex}`}
          style={{ color: theme.tokens[token.type] }}
        >
          {token.text}
        </span>
      ))}
      {lineIndex < lines.length - 1 ? '\n' : null}
    </Fragment>
  ))
}

function tokenizeCodeLine(line: string, language: string): Array<{ text: string; type: CodeTokenType }> {
  if (!line) return [{ text: '', type: 'plain' }]

  if (language === 'markdown' && /^#{1,6}\s/.test(line.trimStart())) {
    return [{ text: line, type: 'heading' }]
  }

  const commentIndex = findCommentIndex(line, language)
  const contentPart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : ''

  const tokens = tokenizeCodeContent(contentPart, language)
  if (commentPart) {
    tokens.push({ text: commentPart, type: 'comment' })
  }
  return tokens
}

function findCommentIndex(line: string, language: string): number {
  if (language === 'sql') return line.indexOf('--')
  if (language === 'javascript' || language === 'typescript' || language === 'java' || language === 'go' || language === 'rust') {
    return line.indexOf('//')
  }
  if (language === 'html' && line.includes('<!--')) return line.indexOf('<!--')
  if ((language === 'shell' || language === 'python' || language === 'markdown' || language === 'yaml') && line.includes('#')) {
    return line.indexOf('#')
  }
  return -1
}

function tokenizeCodeContent(content: string, language: string): Array<{ text: string; type: CodeTokenType }> {
  if (!content) return []

  const keywords = languageKeywordMap[language] ?? []
  const pattern = /(`[^`]*`|"[^"\n]*"|'[^'\n]*'|\b\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z0-9_]*|[{}()[\].,;:+\-*/=<>!|&]+)/g
  const result: Array<{ text: string; type: CodeTokenType }> = []
  let lastIndex = 0

  for (const match of content.matchAll(pattern)) {
    const token = match[0]
    const start = match.index ?? 0

    if (start > lastIndex) {
      result.push({ text: content.slice(lastIndex, start), type: 'plain' })
    }

    let type: CodeTokenType = 'plain'
    if (/^["'`]/.test(token)) {
      type = 'string'
    } else if (/^\d/.test(token)) {
      type = 'number'
    } else if (keywords.includes(token.toLowerCase())) {
      type = 'keyword'
    } else if (/^(true|false|null|undefined|None)$/.test(token)) {
      type = 'builtin'
    } else if (/^[{}()[\].,;:+\-*/=<>!|&]+$/.test(token)) {
      type = 'operator'
    }

    result.push({ text: token, type })
    lastIndex = start + token.length
  }

  if (lastIndex < content.length) {
    result.push({ text: content.slice(lastIndex), type: 'plain' })
  }

  return result
}

export function MarkdownPage() {
  const { settings, setSetting } = useSettings()
  const activeCodeTheme = codeThemes.dark
  
  // State
  const [mode, setMode] = useState<'html2md' | 'md2html'>('html2md')
  const [markdownText, setMarkdownText] = useState('')
  const [vaultPath, setVaultPath] = useState('')
  const [fileName, setFileName] = useState('')
  const [copied, setCopied] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isFileNameCustomized, setIsFileNameCustomized] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const markdownPreviewComponents = useMemo(
    () => createMarkdownPreviewComponents(activeCodeTheme),
    [activeCodeTheme]
  )

  // Load settings on mount
  useEffect(() => {
    setVaultPath(settings['obsidian.vault_path'] || '')
    if (!markdownText) {
      setFileName(generateDefaultFileName(''))
    }
  }, [settings['obsidian.vault_path']])

  // Handle pasting Rich Text / HTML
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    
    setIsProcessing(true)
    try {
      // 提取 HTML 如果存在，否则提取纯文本
      const html = e.clipboardData.getData('text/html')
      const text = e.clipboardData.getData('text/plain')
      
      if (html) {
        if (editorRef.current) {
          editorRef.current.innerHTML = html
        }
      } else if (text) {
        const textToHtml = text.replace(/\n/g, '<br />')
        if (editorRef.current) {
          editorRef.current.innerHTML = textToHtml
        }
      } else {
        showToast('未能识别剪贴板内容', 'error')
        setIsProcessing(false)
        return
      }

      const md = convertSourceToMarkdown(html, text)
      setMarkdownText(md)
      setFileName(generateDefaultFileName(md))
      setIsFileNameCustomized(false)
    } catch (err) {
      showToast(`解析失败: ${err}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  // 纯文本变化时也尝试转换
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML
    const nextMarkdown = cleanupMarkdown(turndownService.turndown(html))
    setMarkdownText(nextMarkdown)
    if (!isFileNameCustomized) {
      setFileName(generateDefaultFileName(nextMarkdown))
    }
  }, [isFileNameCustomized])

  const handleClear = () => {
    setMarkdownText('')
    setFileName(generateDefaultFileName(''))
    setIsFileNameCustomized(false)
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
    }
    showToast('已清空', 'info')
  }

  const handleCopyMarkdown = async () => {
    if (!markdownText) return
    try {
      await navigator.clipboard.writeText(markdownText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('Markdown 已复制', 'success')
    } catch (err) {
      showToast('复制失败', 'error')
    }
  }

  const handleCopyRichText = async () => {
    if (!previewRef.current || !markdownText) return
    try {
      const htmlText = `<div style="font-family: var(--font-sans, sans-serif); color: inherit;">${previewRef.current.innerHTML}</div>`
      const plainText = previewRef.current.innerText
      if (typeof ClipboardItem !== 'undefined') {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlText], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
        await navigator.clipboard.write([clipboardItem])
      } else {
        await navigator.clipboard.writeText(plainText)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('富文本排版已复制', 'success')
    } catch (err) {
      console.error(err)
      showToast('复制富文本失败', 'error')
    }
  }

  const handleExportToObsidian = async () => {
    if (!markdownText) {
      showToast('没有可导出的 Markdown 内容', 'error')
      return
    }
    
    if (!vaultPath.trim()) {
      showToast('请先配置 Obsidian 库路径 (Vault Path)', 'error')
      return
    }

    const effectiveFileName = fileName.trim() || generateDefaultFileName(markdownText)

    await setSetting('obsidian.vault_path', vaultPath)

    try {
      const result = await exportMarkdownToObsidian({
        vaultPath: vaultPath.trim(),
        fileName: effectiveFileName,
        markdownText
      })
      setFileName(result.fileName)
      setIsFileNameCustomized(true)
      showToast(`已导出到 ${result.filePath}`, 'success')
    } catch (err) {
      showToast(`导出到 Obsidian 失败: ${String(err)}`, 'error')
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-5xl mx-auto py-2 px-2 overflow-hidden">
      
      {/* Top Toolbar */}
      <section className="px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-extrabold font-display tracking-tight text-on-surface flex items-center gap-3">
          <FileText className="text-primary w-8 h-8 stroke-[2.5]" />
          Markdown 转换器
        </h1>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMode(m => m === 'html2md' ? 'md2html' : 'html2md')}
            className="px-4 py-2 text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-full transition-all flex items-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" /> 
            {mode === 'html2md' ? '切换：MD 转网页' : '切换：网页 转 MD'}
          </button>
          <div className="w-[1px] h-6 bg-surface-container-highest mx-1"></div>
          <button 
            onClick={handleClear}
            className="px-4 py-2 text-sm font-semibold text-outline hover:text-on-surface hover:bg-surface-container-high rounded-full transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> 清空
          </button>
          <button 
            className="px-5 py-2 text-sm font-bold text-on-primary bg-primary rounded-full shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
          >
            <Sparkles className={cn("w-4 h-4", isProcessing && "animate-spin")} />
            ✨ AI 智能还原 (即将上线)
          </button>
        </div>
      </section>

      {/* Split Pane Area */}
      <div className="flex-1 px-6 pb-4 flex gap-6 overflow-hidden max-h-[calc(100vh-280px)]">
        
        {/* Left Pane (Source) */}
        <div className="w-1/2 flex flex-col gap-3 min-w-0 h-full">
          <div className="flex items-center justify-between px-2">
            <label className="text-xs font-bold uppercase tracking-widest text-outline">
              {mode === 'html2md' ? 'Rich Text / HTML Source' : 'Markdown Source'}
            </label>
            <span className="text-[10px] text-outline-variant">{isProcessing ? 'Processing...' : (mode === 'html2md' ? 'Auto-detecting format...' : 'Edit Markdown...')}</span>
          </div>
          
          <div className="flex-1 bg-surface-container-low rounded-2xl p-5 relative group overflow-hidden border border-white/40 shadow-sm flex flex-col">
            {mode === 'html2md' ? (
              <div 
                ref={editorRef}
                className="flex-1 h-full w-full overflow-y-auto overflow-x-hidden custom-scrollbar focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg p-2 transition-all ProseMirror leading-relaxed break-words"
                contentEditable 
                onPaste={handlePaste}
                onInput={handleInput}
                data-placeholder="在此处 Ctrl+V 粘贴来源文档、网页富文本，或直接输入..."
              >
              </div>
            ) : (
              <textarea
                className="flex-1 w-full h-full bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg p-2 custom-scrollbar font-mono text-[13px] leading-relaxed text-on-surface"
                placeholder="在此输入或粘贴 Markdown 代码..."
                value={markdownText}
                onChange={e => setMarkdownText(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* Vertical Divider Decorative */}
        <div className="w-[1px] h-full bg-surface-container-highest/50 self-center hidden md:block"></div>

        {/* Right Pane (Markdown Output) */}
        <div className="w-1/2 flex flex-col gap-3 min-w-0 h-full">
          <div className="flex items-center justify-between px-2">
            <label className="text-xs font-bold uppercase tracking-widest text-outline">
              {mode === 'html2md' ? 'Markdown Output' : 'Rich Text Preview'}
            </label>
            <button 
              onClick={mode === 'html2md' ? handleCopyMarkdown : handleCopyRichText}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-container transition-colors p-1 rounded-md hover:bg-primary/10"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? '已复制' : (mode === 'html2md' ? '复制 Markdown' : '复制富文本')}
            </button>
          </div>
          
          {mode === 'html2md' ? (
            <div className="flex-1 bg-surface-container-highest/30 rounded-2xl p-5 border border-white/20 shadow-inner font-mono text-[13px] leading-relaxed text-on-surface overflow-hidden relative group">
              <pre className="h-full w-full overflow-y-auto custom-scrollbar break-words whitespace-pre-wrap">
                <code className="text-primary/90">
                  {markdownText || (
                    <span className="text-on-surface-variant/50 flex flex-col items-center justify-center h-full opacity-50 select-none text-sm font-sans gap-2">
                      <FileText className="w-12 h-12 stroke-[1]" />
                      等待转换结果...
                    </span>
                  )}
                </code>
              </pre>
            </div>
          ) : (
            <div className="flex-1 bg-surface-container-lowest/80 rounded-2xl p-6 border border-white/20 shadow-inner overflow-hidden relative group flex flex-col">
              <div className="h-full w-full overflow-y-auto custom-scrollbar">
                {markdownText ? (
                  <div ref={previewRef} className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-display prose-a:text-primary">
                    <ReactMarkdown components={markdownPreviewComponents}>{markdownText}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-on-surface-variant/50 flex flex-col items-center justify-center h-full opacity-50 select-none text-sm font-sans gap-2">
                    <Sparkles className="w-12 h-12 stroke-[1]" />
                    输入 Markdown 查看实时排版...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar (Obsidian Bridge) */}
      {mode === 'html2md' && (
      <footer className="mx-6 mt-2 mb-6 p-6 bg-surface-container-low rounded-[24px] shadow-lg shadow-surface-tint/5 border border-white/40 shrink-0">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Diamond className="text-primary w-5 h-5 fill-primary/20" />
            </div>
            <h3 className="font-bold font-display text-lg text-on-surface">导出到 Obsidian</h3>
            <div className="h-[1px] flex-1 bg-surface-container-highest mx-4"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 flex flex-col gap-2">
              <label className="text-xs font-bold text-outline-variant ml-1">Obsidian 库路径 (Vault Path)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={vaultPath}
                  onChange={e => setVaultPath(e.target.value)}
                  placeholder="/Users/my_name/Documents/MyVault"
                  className="w-full h-11 bg-surface border hover:border-primary/30 border-transparent rounded-xl text-sm px-4 focus:ring-2 focus:ring-primary/20 text-on-surface-variant font-mono transition-colors" 
                />
                <button 
                  onClick={() => showToast('请手动填入绝对路径该功能暂仅支持前端 Mock', 'info')}
                  className="absolute right-3 top-2.5 text-outline hover:text-primary transition-colors"
                  title="浏览文件夹"
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="md:col-span-4 flex flex-col gap-2">
              <label className="text-xs font-bold text-outline-variant ml-1">文件名 (Filename)</label>
                    <input 
                      type="text" 
                      value={fileName}
                      onChange={e => {
                        setFileName(e.target.value)
                        setIsFileNameCustomized(true)
                      }}
                      placeholder="FlowBox_Memo.md"
                      className="w-full h-11 bg-surface border hover:border-primary/30 border-transparent rounded-xl text-sm px-4 focus:ring-2 focus:ring-primary/20 text-on-surface-variant font-mono transition-colors" 
                    />
            </div>
            
            <div className="md:col-span-3 pb-0.5">
              <button 
                onClick={handleExportToObsidian}
                className="w-full h-11 bg-on-surface text-surface rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-all active:scale-[0.98] shadow-lg shadow-on-surface/5"
              >
                <UploadCloud className="w-5 h-5" />
                确认导出
              </button>
            </div>
          </div>
        </div>
      </footer>
      )}

      {/* CSS For Placeholder styling and scrollbar */}
      <style>{`
        [contentEditable=true]:empty:before {
          content: attr(data-placeholder);
          color: var(--on-surface-variant);
          opacity: 0.5;
          pointer-events: none;
          display: block; // For Firefox
        }
      `}</style>
    </div>
  )
}
