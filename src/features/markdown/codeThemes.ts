export type CodeThemeName = 'light' | 'dark'

export type CodeTokenType =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'string'
  | 'number'
  | 'operator'
  | 'builtin'
  | 'heading'

export type CodeTheme = {
  block: {
    backgroundColor: string
    color: string
    border: string
    boxShadow: string
  }
  inlineCode: {
    backgroundColor: string
    color: string
    border: string
  }
  lineNumber: {
    color: string
  }
  tokens: Record<CodeTokenType, string>
}

export const codeThemes: Record<CodeThemeName, CodeTheme> = {
  dark: {
    block: {
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      border: '1px solid #1e293b',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    },
    inlineCode: {
      backgroundColor: '#eef2ff',
      color: '#4338ca',
      border: '1px solid #c7d2fe',
    },
    lineNumber: {
      color: '#64748b',
    },
    tokens: {
      plain: '#e2e8f0',
      comment: '#94a3b8',
      keyword: '#c084fc',
      string: '#fbbf24',
      number: '#60a5fa',
      operator: '#f8fafc',
      builtin: '#22d3ee',
      heading: '#38bdf8',
    },
  },
  light: {
    block: {
      backgroundColor: '#fcfcfb',
      color: '#30343f',
      border: '1px solid #e7e5df',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
    },
    inlineCode: {
      backgroundColor: '#f7f4ee',
      color: '#9a3412',
      border: '1px solid #eadfd2',
    },
    lineNumber: {
      color: '#c4c0b7',
    },
    tokens: {
      plain: '#30343f',
      comment: '#b6b3ab',
      keyword: '#d97706',
      string: '#e11d48',
      number: '#2563eb',
      operator: '#6b7280',
      builtin: '#0f766e',
      heading: '#1d4ed8',
    },
  },
}
