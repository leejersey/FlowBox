/**
 * Settings 数据类型 — 对应架构文档 §2.1 表8 + §3.1 模块6
 */

export interface Setting {
  key: string
  value: string
  updated_at: string
}
