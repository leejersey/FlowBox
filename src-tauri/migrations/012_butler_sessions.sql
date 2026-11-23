-- Butler 多会话管理（向下兼容已有历史消息）

CREATE TABLE IF NOT EXISTS butler_sessions (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL DEFAULT '新对话',
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_butler_sessions_updated
    ON butler_sessions (updated_at DESC);

ALTER TABLE butler_messages ADD COLUMN session_id TEXT DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_butler_msg_session_ts
    ON butler_messages (session_id, timestamp ASC);
