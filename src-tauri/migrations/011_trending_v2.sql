-- Dev Trending v2 — 多周期缓存、板块分类、AI 深度速读卡与 README 缓存

DROP INDEX IF EXISTS idx_trending_repo_date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_repo_period_date
    ON trending_repos (repo_id, period, fetched_date);

CREATE INDEX IF NOT EXISTS idx_trending_period_date
    ON trending_repos (period, fetched_date);

ALTER TABLE trending_repos ADD COLUMN category TEXT DEFAULT '';
ALTER TABLE trending_repos ADD COLUMN ai_tags TEXT DEFAULT '[]';
ALTER TABLE trending_repos ADD COLUMN ai_deep_dive TEXT DEFAULT NULL;
ALTER TABLE trending_repos ADD COLUMN readme_excerpt TEXT DEFAULT NULL;
ALTER TABLE trending_repos ADD COLUMN homepage TEXT DEFAULT '';
ALTER TABLE trending_repos ADD COLUMN topics TEXT DEFAULT '[]';
