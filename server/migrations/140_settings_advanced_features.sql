-- Migration 140: Advanced Settings Features
-- Adds tables for keyboard shortcuts, templates, history, and appearance settings

-- Appearance Settings Table
CREATE TABLE IF NOT EXISTS user_appearance_settings (
    user_id TEXT PRIMARY KEY,
    theme TEXT DEFAULT 'system',
    accent_color TEXT DEFAULT '#6366f1',
    font_family TEXT DEFAULT 'Inter',
    font_size TEXT DEFAULT 'medium',
    display_density TEXT DEFAULT 'comfortable',
    sidebar_collapsed BOOLEAN DEFAULT 0,
    dashboard_layout TEXT DEFAULT 'default',
    color_blind_mode TEXT DEFAULT 'none',
    reduced_motion BOOLEAN DEFAULT 0,
    high_contrast BOOLEAN DEFAULT 0,
    custom_css TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Keyboard Shortcuts Table
CREATE TABLE IF NOT EXISTS user_keyboard_shortcuts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    keys_json TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    is_custom BOOLEAN DEFAULT 0,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, action)
);

-- Settings Templates Table
CREATE TABLE IF NOT EXISTS user_settings_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📋',
    settings_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings History Table
CREATE TABLE IF NOT EXISTS user_settings_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    setting TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    device TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_keyboard_shortcuts_user ON user_keyboard_shortcuts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_templates_user ON user_settings_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_history_user ON user_settings_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_history_timestamp ON user_settings_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_settings_history_category ON user_settings_history(category);

-- Update triggers
CREATE TRIGGER IF NOT EXISTS update_user_appearance_settings_updated_at
AFTER UPDATE ON user_appearance_settings
FOR EACH ROW
BEGIN
    UPDATE user_appearance_settings SET updated_at = datetime('now') WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_keyboard_shortcuts_updated_at
AFTER UPDATE ON user_keyboard_shortcuts
FOR EACH ROW
BEGIN
    UPDATE user_keyboard_shortcuts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_settings_templates_updated_at
AFTER UPDATE ON user_settings_templates
FOR EACH ROW
BEGIN
    UPDATE user_settings_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;









