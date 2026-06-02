-- Bundle 22 (T073) — Contextual Micro-Video Help System
-- Tracks per-user per-module video dismissal state and watch events.
-- Leverages existing help_video_progress for watch progress;
-- this table stores the "first time in module" dismissal preference.

CREATE TABLE IF NOT EXISTS help_micro_video_dismissals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    module_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('watched', 'skipped', 'dont_show_again')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, module_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_micro_video_dismissals_user
    ON help_micro_video_dismissals(user_id);

CREATE INDEX IF NOT EXISTS idx_micro_video_dismissals_module
    ON help_micro_video_dismissals(user_id, module_id);
