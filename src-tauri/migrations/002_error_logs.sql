-- 错误日志表（架构文档 §4.3.2）
CREATE TABLE IF NOT EXISTS error_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT    NOT NULL DEFAULT (datetime('now')),
    level       TEXT    NOT NULL,
    module      TEXT    NOT NULL,
    code        TEXT,
    message     TEXT    NOT NULL,
    stack_trace TEXT,
    context     TEXT,
    resolved    INTEGER NOT NULL DEFAULT 0
);
