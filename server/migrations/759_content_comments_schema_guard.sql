-- Ensure shared content comments exist on drifted staging/demo databases.
-- Historical schemas can have the service code without migration 047 applied,
-- which caused 500s on interview insight comment reads.

CREATE TABLE IF NOT EXISTS content_comments (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    parent_comment_id TEXT,
    thread_id TEXT,
    position_ref TEXT,
    is_resolved INTEGER DEFAULT 0,
    resolved_by TEXT,
    resolved_at TEXT,
    mentioned_user_ids TEXT DEFAULT '[]',
    is_edited INTEGER DEFAULT 0,
    edited_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES content_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_comments_content ON content_comments(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_comments_user ON content_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_thread ON content_comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_parent ON content_comments(parent_comment_id);
