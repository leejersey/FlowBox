import { useEffect, useState } from 'react'
import { showToast } from '@/store/useToastStore'

/**
 * 数据库初始化 hook
 * 
 * tauri-plugin-sql 在 Rust 端已完成数据库初始化和迁移。
 * 前端通过此 hook 确认数据库可用后再渲染主界面。
 */
export function useDatabase() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { default: Database } = await import('@tauri-apps/plugin-sql')
        // 连接 Rust 端已初始化的数据库（不会重复建表）
        const db = await Database.load('sqlite:flowbox.db')

        // 验证表创建成功
        const tables = await db.select<{ name: string }[]>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_sqlx%' AND name != 'sqlite_sequence' ORDER BY name"
        )
        console.log('✅ FlowBox DB ready, tables:', tables.map(t => t.name).join(', '))
        setReady(true)
      } catch (err) {
        const msg = String(err)
        // 非 Tauri 环境（浏览器 dev）→ 直接放行
        if (msg.includes('__TAURI__') || msg.includes('not a function') || msg.includes('Cannot find module') || msg.includes('invoke') || msg.includes('undefined')) {
          console.log('ℹ️ 非 Tauri 环境，跳过数据库')
          setReady(true)
          return
        }
        // database locked → 短暂等待后重试
        if (msg.includes('database is locked')) {
          console.warn('⏳ 数据库锁定，500ms 后重试...')
          setTimeout(() => init(), 500)
          return
        }
        console.error('❌ 数据库连接失败:', err)
        setError(msg)
        showToast(`数据库初始化失败: ${msg}`, 'error')
      }
    }

    init()
  }, [])

  return { ready, error }
}
