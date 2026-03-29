-- Butler 对话历史持久化
-- 从 localStorage 迁移至 SQLite

-- 对话消息表
CREATE TABLE IF NOT EXISTS butler_messages (
    id         TEXT    PRIMARY KEY,
    role       TEXT    NOT NULL,
    content    TEXT    NOT NULL DEFAULT '',
    timestamp  INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_butler_msg_ts ON butler_messages (timestamp ASC);

-- Butler 状态键值表（model, promptTemplate, lastRequest 等）
CREATE TABLE IF NOT EXISTS butler_state (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
