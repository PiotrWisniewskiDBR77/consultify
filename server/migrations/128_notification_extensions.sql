-- Migration 128: Notification Extensions
-- Adds advanced notification preferences (sounds, grouping, digest, quiet hours, DND)

-- Rozszerzenie user_notification_preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences_v3 (
    user_id TEXT PRIMARY KEY,
    -- Sounds
    sound_enabled INTEGER DEFAULT 1,
    sound_per_type TEXT DEFAULT '{}', -- JSON: {task_assigned: 'default', ...}
    desktop_position TEXT DEFAULT 'top-right', -- top-right, bottom-right, etc.
    desktop_duration INTEGER DEFAULT 5000, -- milliseconds
    -- Grouping
    grouping_enabled INTEGER DEFAULT 1,
    grouping_by TEXT DEFAULT 'project', -- project, type, time
    -- Digest
    digest_frequency TEXT DEFAULT 'instant', -- instant, hourly, daily, weekly
    digest_content TEXT DEFAULT 'summary', -- summary, full
    digest_format TEXT DEFAULT 'html', -- html, plain
    -- Quiet hours per day
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_days TEXT DEFAULT '[1,2,3,4,5]', -- JSON array, 1=Monday
    -- DND mode
    dnd_enabled INTEGER DEFAULT 0,
    dnd_until DATETIME,
    -- Batching
    batching_enabled INTEGER DEFAULT 1,
    batch_window_minutes INTEGER DEFAULT 5,
    -- Priority filter
    priority_only INTEGER DEFAULT 0,
    -- Badge limit
    badge_count_limit INTEGER DEFAULT 99,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_notification_prefs_v3_user ON user_notification_preferences_v3(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_v3_dnd ON user_notification_preferences_v3(dnd_enabled, dnd_until);






