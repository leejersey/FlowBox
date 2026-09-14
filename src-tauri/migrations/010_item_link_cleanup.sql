CREATE TRIGGER cleanup_todo_item_links AFTER DELETE ON todos
BEGIN
  DELETE FROM item_links
  WHERE (source_type = 'todo' AND source_id = OLD.id)
     OR (target_type = 'todo' AND target_id = OLD.id);
END;

CREATE TRIGGER cleanup_idea_item_links AFTER DELETE ON ideas
BEGIN
  DELETE FROM item_links
  WHERE (source_type = 'idea' AND source_id = OLD.id)
     OR (target_type = 'idea' AND target_id = OLD.id);
END;

CREATE TRIGGER cleanup_voice_item_links AFTER DELETE ON voice_records
BEGIN
  DELETE FROM item_links
  WHERE (source_type = 'voice' AND source_id = OLD.id)
     OR (target_type = 'voice' AND target_id = OLD.id);
END;

CREATE TRIGGER cleanup_clipboard_item_links AFTER DELETE ON clipboard_items
BEGIN
  DELETE FROM item_links
  WHERE (source_type = 'clipboard' AND source_id = OLD.id)
     OR (target_type = 'clipboard' AND target_id = OLD.id);
END;
