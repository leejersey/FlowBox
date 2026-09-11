UPDATE pomodoro_sessions
SET status = 'interrupted'
WHERE status = 'completed' AND ended_at IS NULL AND actual_minutes IS NULL;
