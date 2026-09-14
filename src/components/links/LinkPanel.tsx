import { useCallback, useEffect, useState } from 'react'
import { Link2, Search, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { globalSearch, type SearchResult } from '@/services/searchService'
import {
  linkCreate,
  linkDelete,
  linksByItem,
  type ItemLink,
  type LinkableType,
} from '@/services/linkService'

const LINK_PATH: Record<LinkableType, string> = {
  todo: '/',
  idea: '/idea',
  voice: '/voice',
  clipboard: '/clipboard',
}

const TYPE_LABEL: Record<LinkableType, string> = {
  todo: '待办',
  idea: '灵感',
  voice: '语音',
  clipboard: '剪贴板',
}

interface LinkPanelProps {
  type: LinkableType
  id: number
  onClose: () => void
}

function otherEndpoint(link: ItemLink, type: LinkableType, id: number) {
  return link.source_type === type && link.source_id === id
    ? { type: link.target_type, id: link.target_id }
    : { type: link.source_type, id: link.source_id }
}

export function LinkPanel({ type, id, onClose }: LinkPanelProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [links, setLinks] = useState<ItemLink[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLinks(await linksByItem(type, id))
  }, [type, id])

  useEffect(() => {
    refresh().catch(err => setError(err instanceof Error ? err.message : '关联加载失败'))
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const found = await globalSearch(query)
        if (!cancelled) setResults(found.filter(item => item.type !== type || item.id !== id))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '搜索失败')
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, type, id])

  const add = async (target: SearchResult) => {
    try {
      setError('')
      await linkCreate(type, id, target.type, target.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '关联创建失败')
    }
  }

  const remove = async (linkId: number) => {
    try {
      setError('')
      await linkDelete(linkId)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '关联删除失败')
    }
  }

  const open = (target: { type: LinkableType; id: number }) => {
    navigate(`${LINK_PATH[target.type]}?highlight=${target.type}-${target.id}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface border border-white/20 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-surface-container-highest">
          <h2 className="font-bold text-on-surface flex items-center gap-2"><Link2 className="w-4 h-4" /> 关联项目</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-on-surface-variant mb-2">已有关联</h3>
            <div className="space-y-2">
              {links.map(link => {
                const target = otherEndpoint(link, type, id)
                return (
                  <div key={link.id} className="flex items-center gap-2 rounded-xl bg-surface-container-low p-2">
                    <button onClick={() => open(target)} className="flex-1 text-left text-sm text-on-surface hover:text-primary">
                      {TYPE_LABEL[target.type]} #{target.id}
                    </button>
                    <button onClick={() => remove(link.id)} title="删除关联" className="p-1.5 text-on-surface-variant hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )
              })}
              {links.length === 0 && <p className="text-sm text-on-surface-variant">暂无关联</p>}
            </div>
          </div>

          <div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索要关联的内容" className="w-full rounded-xl bg-surface-container-low py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            {query.trim() && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {results.map(result => (
                  <button key={`${result.type}-${result.id}`} onClick={() => add(result)} className="w-full rounded-xl p-2 text-left hover:bg-surface-container-low">
                    <span className="text-xs text-primary mr-2">{TYPE_LABEL[result.type]}</span>
                    <span className="text-sm text-on-surface">{result.title}</span>
                  </button>
                ))}
              </div>
            )}
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
