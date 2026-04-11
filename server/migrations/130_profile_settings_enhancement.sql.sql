-- Migration 130: Profile Settings Enhancement Tables
-- Adds columns for extended profile settings, working hours, email signatures, and recovery options

-- =====================================================
-- User Profile Extension Columns
-- =====================================================

-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- These will fail silently if columns already exist (handled by application)
-- You may need to run these manually or check if columns exist first

-- Add new profile columns to users table (run individually, ignore errors if already exist)

-- =====================================================
-- Working Hours Table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_working_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time VARCHAR(5), -- HH:MM format
    end_time VARCHAR(5),   -- HH:MM format
    is_working_day BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, day_of_week)
);

-- Working hours settings (timezone, sync preferences)
CREATE TABLE IF NOT EXISTS user_working_hours_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    timezone VARCHAR(100) DEFAULT 'UTC',
    sync_with_calendar BOOLEAN DEFAULT FALSE,
    block_outside_hours BOOLEAN DEFAULT FALSE,
    show_availability_to_team BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- Email Signatures Table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_email_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_signatures_user ON user_email_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_default ON user_email_signatures(user_id, is_default);

-- =====================================================
-- Recovery Options Table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_recovery_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    recovery_email VARCHAR(255),
    recovery_email_verified BOOLEAN DEFAULT FALSE,
    recovery_phone VARCHAR(50),
    recovery_phone_verified BOOLEAN DEFAULT FALSE,
    backup_codes_hash TEXT, -- Stored as JSON array of hashed codes
    backup_codes_generated_at DATETIME,
    backup_codes_remaining INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- Appearance Preferences Table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_appearance_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    theme VARCHAR(20) DEFAULT 'system', -- light, dark, system
    ui_density VARCHAR(20) DEFAULT 'comfortable', -- compact, comfortable, spacious
    start_page VARCHAR(50) DEFAULT 'dashboard',
    font_scale INTEGER DEFAULT 100, -- 90, 100, 110, 120
    sidebar_collapsed BOOLEAN DEFAULT FALSE,
    show_welcome_tips BOOLEAN DEFAULT TRUE,
    accent_color VARCHAR(20) DEFAULT 'purple',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- Keyboard Shortcuts Customization (future feature)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_keyboard_shortcuts (
    user_id TEXT PRIMARY KEY,
    shortcuts TEXT DEFAULT '{}', -- JSON object mapping action -> shortcut
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- Indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_working_hours_user ON user_working_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_options_email ON user_recovery_options(recovery_email);
CREATE INDEX IF NOT EXISTS idx_keyboard_shortcuts_user ON user_keyboard_shortcuts(user_id);

-- =====================================================
-- Insert default working hours for existing users
-- (This can be run separately if needed)
-- =====================================================

-- Note: Uncomment and run this if you want to seed default working hours
-- INSERT OR IGNORE INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
-- SELECT id, 1, '09:00', '17:00', 1 FROM users; -- Monday
-- INSERT OR IGNORE INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
-- SELECT id, 2, '09:00', '17:00', 1 FROM users; -- Tuesday
-- INSERT OR IGNORE INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
-- SELECT id, 3, '09:00', '17:00', 1 FROM users; -- Wednesday
-- INSERT OR IGNORE INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
-- SELECT id, 4, '09:00', '17:00', 1 FROM users; -- Thursday
-- INSERT OR IGNORE INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
-- SELECT id, 5, '09:00', '17:00', 1 FROM users; -- Friday
-- INSERT OR IGNORE INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
-- SELECT id, 6, '09:00', '17:00', 0 FROM users; -- Saturday (off)
-- INSERT OR IGNORE INTO user_working_hours (user_id, day_of_week, start_time, end_time, is_working_day)
-- SELECT id, 0, '09:00', '17:00', 0 FROM users; -- Sunday (off)

