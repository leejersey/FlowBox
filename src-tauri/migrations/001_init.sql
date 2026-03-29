-- FlowBox 数据库初始化迁移 v1
-- 对应架构文档 §2.1 全部 8 张核心数据表 + §2.3 索引

-- 表 1：待办事项
CREATE TABLE IF NOT EXISTS todos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    content      TEXT    NOT NULL DEFAULT '',
    priority     INTEGER NOT NULL DEFAULT 0,
    status       TEXT    NOT NULL DEFAULT 'pending',
    source       TEXT    DEFAULT 'manual',
    source_id    INTEGER,
    due_date     TEXT,
    tags         TEXT    NOT NULL DEFAULT '[]',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- 表 2：灵感速记
CREATE TABLE IF NOT EXISTS ideas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content     TEXT    NOT NULL,
    tags        TEXT    DEFAULT '[]',
    source      TEXT    DEFAULT 'manual',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 表 3：番茄钟记录
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    type             TEXT    NOT NULL DEFAULT 'focus',
    duration_minutes INTEGER NOT NULL DEFAULT 25,
    actual_minutes   INTEGER,
    status           TEXT    NOT NULL DEFAULT 'completed',
    related_todo_id  INTEGER,
    ai_summary       TEXT,
    started_at       TEXT    NOT NULL,
    ended_at         TEXT
);

-- 表 4：剪贴板历史
CREATE TABLE IF NOT EXISTS clipboard_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT    NOT NULL,
    text_content TEXT,
    image_path   TEXT,
    ocr_text     TEXT,
    category     TEXT,
    tags         TEXT    DEFAULT '[]',
    is_pinned    INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 表 5：语音记录
CREATE TABLE IF NOT EXISTS voice_records (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    audio_path       TEXT    NOT NULL,
    duration_seconds INTEGER NOT NULL,
    transcript       TEXT,
    ai_summary       TEXT,
    ai_todos         TEXT,
    status           TEXT    NOT NULL DEFAULT 'recording',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 表 6：应用使用时长
CREATE TABLE IF NOT EXISTS app_usage (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name         TEXT    NOT NULL,
    app_bundle_id    TEXT,
    window_title     TEXT,
    duration_seconds INTEGER NOT NULL,
    recorded_date    TEXT    NOT NULL,
    hour             INTEGER NOT NULL
);

-- 表 7：标签
CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    color      TEXT    DEFAULT '#6366f1',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 表 8：用户设置
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== 索引（§2.3） =====
CREATE INDEX IF NOT EXISTS idx_todos_status         ON todos (status);
CREATE INDEX IF NOT EXISTS idx_todos_priority        ON todos (priority, status);
CREATE INDEX IF NOT EXISTS idx_todos_created         ON todos (created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_created         ON ideas (created_at);
CREATE INDEX IF NOT EXISTS idx_pomo_started          ON pomodoro_sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_pomo_todo             ON pomodoro_sessions (related_todo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clip_hash      ON clipboard_items (content_hash);
CREATE INDEX IF NOT EXISTS idx_clip_type_created     ON clipboard_items (content_type, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_date_hour       ON app_usage (recorded_date, hour);
CREATE INDEX IF NOT EXISTS idx_usage_app_date        ON app_usage (app_name, recorded_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name      ON tags (name);
