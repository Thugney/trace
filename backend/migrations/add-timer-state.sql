-- Timer state sync table
-- Stores timer state for cross-device synchronization
CREATE TABLE IF NOT EXISTS timer_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  task_id INTEGER,
  quiz_attempt_id INTEGER,
  timer_type TEXT NOT NULL CHECK(timer_type IN ('task', 'quiz')),
  is_running BOOLEAN NOT NULL DEFAULT 0,
  is_paused BOOLEAN NOT NULL DEFAULT 0,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  start_time DATETIME,
  pause_time DATETIME,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  device_id TEXT,
  sync_version INTEGER NOT NULL DEFAULT 1,

  -- Only one of task_id or quiz_attempt_id should be set
  CHECK(
    (timer_type = 'task' AND task_id IS NOT NULL AND quiz_attempt_id IS NULL) OR
    (timer_type = 'quiz' AND quiz_attempt_id IS NOT NULL AND task_id IS NULL)
  ),

  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  -- Note: quiz_attempt_id references family_quiz_attempts(id) but that table might not exist yet
);

-- Index for fast lookups by profile and active timers
CREATE INDEX IF NOT EXISTS idx_timer_states_profile_active
ON timer_states(profile_id, is_running, timer_type, task_id, quiz_attempt_id);

-- Index for cleanup of stale timer states (older than 24 hours)
CREATE INDEX IF NOT EXISTS idx_timer_states_last_updated
ON timer_states(last_updated);

-- Cleanup trigger: remove timer states older than 24 hours
CREATE TRIGGER IF NOT EXISTS cleanup_old_timer_states
AFTER INSERT ON timer_states
BEGIN
  DELETE FROM timer_states
  WHERE last_updated < datetime('now', '-24 hours');
END;