-- Migration: 250_entity_translations.sql
-- Entity-level translations for multilingual support
-- Allows teams to work in their own languages

-- Main translations table
CREATE TABLE IF NOT EXISTS entity_translations (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,          -- 'initiative', 'task', 'assessment_axis', etc.
    entity_id TEXT NOT NULL,            -- FK to the main entity
    field_name TEXT NOT NULL,           -- 'name', 'description', 'summary', etc.
    locale TEXT NOT NULL,               -- 'en', 'pl', 'de', 'es', 'ar', 'ja'
    translated_value TEXT NOT NULL,
    is_machine_translated INTEGER DEFAULT 1,
    quality_score REAL,                 -- 0-1 translation quality (for ML translations)
    created_by TEXT,                    -- user_id who created/edited
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(entity_type, entity_id, field_name, locale)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_translations_lookup 
ON entity_translations(entity_type, entity_id, locale);

CREATE INDEX IF NOT EXISTS idx_translations_entity 
ON entity_translations(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_translations_locale 
ON entity_translations(locale);

-- Translation audit log
CREATE TABLE IF NOT EXISTS translation_audit_log (
    id TEXT PRIMARY KEY,
    translation_id TEXT NOT NULL,
    action TEXT NOT NULL,               -- 'created', 'updated', 'deleted'
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (translation_id) REFERENCES entity_translations(id)
);

-- Supported locales configuration
CREATE TABLE IF NOT EXISTS supported_locales (
    locale TEXT PRIMARY KEY,
    language_name TEXT NOT NULL,
    native_name TEXT NOT NULL,
    direction TEXT DEFAULT 'ltr',       -- 'ltr' or 'rtl'
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

-- Insert supported locales
INSERT OR IGNORE INTO supported_locales (locale, language_name, native_name, direction, sort_order) VALUES
    ('en', 'English', 'English', 'ltr', 1),
    ('pl', 'Polish', 'Polski', 'ltr', 2),
    ('de', 'German', 'Deutsch', 'ltr', 3),
    ('es', 'Spanish', 'Español', 'ltr', 4),
    ('ar', 'Arabic', 'العربية', 'rtl', 5),
    ('ja', 'Japanese', '日本語', 'ltr', 6);

-- Translation memory for AI consistency
CREATE TABLE IF NOT EXISTS translation_memory (
    id TEXT PRIMARY KEY,
    source_locale TEXT NOT NULL DEFAULT 'en',
    target_locale TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    context TEXT,                       -- e.g., 'manufacturing', 'digital_transformation'
    usage_count INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_locale, target_locale, source_text)
);

CREATE INDEX IF NOT EXISTS idx_translation_memory_lookup 
ON translation_memory(source_locale, target_locale, source_text);

-- Organization locale preferences
ALTER TABLE organizations ADD COLUMN default_locale TEXT DEFAULT 'en';
ALTER TABLE organizations ADD COLUMN enabled_locales TEXT DEFAULT '["en"]';

-- User locale preference (if not exists)
-- Note: May already exist in user_preferences
