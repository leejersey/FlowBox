DELETE FROM item_links AS duplicate
WHERE EXISTS (
  SELECT 1 FROM item_links AS kept
  WHERE kept.id < duplicate.id
    AND kept.source_type = duplicate.target_type
    AND kept.source_id = duplicate.target_id
    AND kept.target_type = duplicate.source_type
    AND kept.target_id = duplicate.source_id
);

UPDATE item_links
SET
  source_type = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_type ELSE target_type END,
  source_id = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_id ELSE target_id END,
  target_type = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_type ELSE source_type END,
  target_id = CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_id ELSE source_id END
WHERE NOT (source_type < target_type OR (source_type = target_type AND source_id <= target_id));

CREATE UNIQUE INDEX idx_item_links_undirected ON item_links (
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_type ELSE target_type END,
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN source_id ELSE target_id END,
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_type ELSE source_type END,
  CASE WHEN source_type < target_type OR (source_type = target_type AND source_id <= target_id) THEN target_id ELSE source_id END
);
