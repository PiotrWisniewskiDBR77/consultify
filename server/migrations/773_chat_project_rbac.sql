-- F2: Team projects RBAC (hybrid visibility).
-- Additive + idempotent. Existing team folders keep current behaviour because
-- visibility defaults to 'org' (whole-org visible, exactly as today).

-- Visibility model: 'org' = every org member sees it (current behaviour) ·
--                   'private' = only invited members (chat_project_members) see it.
ALTER TABLE chat_projects ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'org';

-- Per-project membership + roles (owner | editor | viewer).
CREATE TABLE IF NOT EXISTS chat_project_members (
  project_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'viewer',
  added_by   TEXT,
  added_at   TEXT,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cpm_user ON chat_project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cpm_project ON chat_project_members(project_id);

-- Chats are private-to-author by default inside a project; an explicit toggle
-- shares a chat with the project's members (Claude model, used when visibility='private').
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS shared_to_project BOOLEAN DEFAULT FALSE;

-- Backfill: every team project's creator becomes its owner member.
INSERT INTO chat_project_members (project_id, user_id, role, added_by, added_at)
SELECT cp.id, cp.user_id, 'owner', cp.user_id, NOW()::TEXT
FROM chat_projects cp
WHERE cp.scope = 'team'
  AND cp.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM chat_project_members m
    WHERE m.project_id = cp.id AND m.user_id = cp.user_id
  );
