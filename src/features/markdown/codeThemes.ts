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
      backgroundColor: '#fbfaf7',
      color: '#2f343b',
      border: '1px solid #ebe7df',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)',
    },
    inlineCode: {
      backgroundColor: '#f5f1e8',
      color: '#b45309',
      border: '1px solid #e5ddd1',
    },
    lineNumber: {
      color: '#c9c3b8',
    },
    tokens: {
      plain: '#374151',
      comment: '#b7b3ac',
      keyword: '#d97706',
      string: '#e11d48',
      number: '#2563eb',
      operator: '#9ca3af',
      builtin: '#2563eb',
      heading: '#1f2937',
    },
  },
}
