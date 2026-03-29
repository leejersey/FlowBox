-- FlowBox 跨模块关联迁移 v4
-- 为灵感表补充 source_id，新建通用关联表 item_links

-- 灵感表补充 source_id 字段（与 todos 表对齐）
ALTER TABLE ideas ADD COLUMN source_id INTEGER;

-- 通用跨模块关联表（多对多）
CREATE TABLE IF NOT EXISTS item_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT    NOT NULL,   -- 'todo' | 'idea' | 'voice' | 'clipboard'
    source_id   INTEGER NOT NULL,
    target_type TEXT    NOT NULL,
    target_id   INTEGER NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_links_source ON item_links (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON item_links (target_type, target_id);
