-- Dev Trending — GitHub 热门仓库本地缓存
-- 从 OSS Insight API 获取的周热门仓库数据

CREATE TABLE IF NOT EXISTS trending_repos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id         TEXT    NOT NULL,
    repo_name       TEXT    NOT NULL,
    description     TEXT    DEFAULT '',
    language        TEXT    DEFAULT '',
    stars           INTEGER NOT NULL DEFAULT 0,
    forks           INTEGER NOT NULL DEFAULT 0,
    pull_requests   INTEGER NOT NULL DEFAULT 0,
    total_score     REAL    NOT NULL DEFAULT 0,
    contributors    TEXT    DEFAULT '[]',
    ai_summary_zh   TEXT    DEFAULT NULL,
    period          TEXT    NOT NULL DEFAULT 'past_week',
    fetched_date    TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trending_date ON trending_repos (fetched_date);
CREATE INDEX IF NOT EXISTS idx_trending_score ON trending_repos (total_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_repo_date ON trending_repos (repo_id, fetched_date);
