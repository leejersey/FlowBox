UPDATE pomodoro_sessions
SET status = 'interrupted'
WHERE status = 'completed' AND ended_at IS NULL AND actual_minutes IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pomodoro_single_running
ON pomodoro_sessions (status)
WHERE status = 'running';
