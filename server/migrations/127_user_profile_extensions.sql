-- Migration 127: User Profile Extensions
-- Adds extended profile fields and activity status tracking

-- Rozszerzenie tabeli users
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN pronouns TEXT;
ALTER TABLE users ADD COLUMN birthday DATE;
ALTER TABLE users ADD COLUMN location TEXT;
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'online'; -- online, away, busy, dnd
ALTER TABLE users ADD COLUMN status_message TEXT;
ALTER TABLE users ADD COLUMN profile_visibility TEXT DEFAULT 'team'; -- public, team, private
ALTER TABLE users ADD COLUMN skills TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE users ADD COLUMN social_links TEXT DEFAULT '{}'; -- JSON object {twitter, github, website}
ALTER TABLE users ADD COLUMN emergency_contact TEXT DEFAULT '{}'; -- JSON object {name, phone, relationship}
ALTER TABLE users ADD COLUMN work_hours_start TIME DEFAULT '09:00';
ALTER TABLE users ADD COLUMN work_hours_end TIME DEFAULT '17:00';
ALTER TABLE users ADD COLUMN work_days TEXT DEFAULT '[1,2,3,4,5]'; -- JSON array, 1=Monday
ALTER TABLE users ADD COLUMN vacation_start DATE;
ALTER TABLE users ADD COLUMN vacation_end DATE;
ALTER TABLE users ADD COLUMN out_of_office INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN profile_completion_score INTEGER DEFAULT 0;

-- Nowa tabela dla activity status
CREATE TABLE IF NOT EXISTS user_activity_status (
    user_id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'online',
    status_message TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    currently_active INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_user_activity_status_status ON user_activity_status(status);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_profile_visibility ON users(profile_visibility);

