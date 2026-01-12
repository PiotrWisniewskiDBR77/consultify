-- Migration 132: Appearance Extensions
-- Adds advanced appearance preferences

CREATE TABLE IF NOT EXISTS user_appearance_preferences (
    user_id TEXT PRIMARY KEY,
    -- Theme
    theme TEXT DEFAULT 'system', -- light, dark, system
    accent_color TEXT DEFAULT '#8B5CF6', -- hex color
    custom_theme TEXT DEFAULT '{}', -- JSON object for custom themes
    -- Typography
    font_size TEXT DEFAULT 'medium', -- small, medium, large
    font_family TEXT DEFAULT 'system',
    line_height REAL DEFAULT 1.5,
    -- Layout
    sidebar_width INTEGER DEFAULT 240,
    spacing_density TEXT DEFAULT 'comfortable', -- compact, comfortable, spacious
    -- UI Elements
    show_breadcrumbs INTEGER DEFAULT 1,
    show_status_bar INTEGER DEFAULT 1,
    show_sidebar INTEGER DEFAULT 1,
    -- Customization
    custom_css TEXT, -- Advanced users
    animation_preferences TEXT DEFAULT '{}', -- JSON: {reduceMotion: false}
    high_contrast_mode INTEGER DEFAULT 0,
    colorblind_palette TEXT, -- deuteranopia, protanopia, tritanopia
    -- Dashboard
    dashboard_layout TEXT DEFAULT '{}', -- JSON object
    widget_visibility TEXT DEFAULT '{}', -- JSON object
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_appearance_prefs_user ON user_appearance_preferences(user_id);








