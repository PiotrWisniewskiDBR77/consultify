-- Migration 535: Add notification_comments and notification_activity_log tables
-- These support the full-featured notification detail view

-- Notification Comments
CREATE TABLE IF NOT EXISTS notification_comments (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_comments_notification_id ON notification_comments(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_comments_user_id ON notification_comments(user_id);

-- Notification Activity Log
CREATE TABLE IF NOT EXISTS notification_activity_log (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_activity_log_notification_id ON notification_activity_log(notification_id);
