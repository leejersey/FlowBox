-- Butler Skills（技能/指令模板）管理
-- 从硬编码 BUTLER_ACTION_PREFIXES 升级为可管理的 Skills 系统

CREATE TABLE IF NOT EXISTS butler_skills (
    id            TEXT    PRIMARY KEY,
    name          TEXT    NOT NULL,
    icon          TEXT    NOT NULL DEFAULT 'zap',
    prompt_prefix TEXT    NOT NULL DEFAULT '',
    system_prompt TEXT    NOT NULL DEFAULT '',
    is_builtin    INTEGER NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    color         TEXT    NOT NULL DEFAULT '#6366f1',
    category      TEXT    NOT NULL DEFAULT '通用',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skills_sort ON butler_skills (sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_skills_category ON butler_skills (category);
