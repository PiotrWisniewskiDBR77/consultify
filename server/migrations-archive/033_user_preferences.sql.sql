-- Migration: 033_user_preferences.sql
-- User Preferences and UX Settings
-- Created: 2025-12-21

-- User preferences
ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN locale TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN date_format TEXT DEFAULT 'YYYY-MM-DD';
ALTER TABLE users ADD COLUMN time_format TEXT DEFAULT '24h'; -- '12h' or '24h'
ALTER TABLE users ADD COLUMN first_day_of_week INTEGER DEFAULT 1; -- 0=Sunday, 1=Monday

-- Accessibility settings
ALTER TABLE users ADD COLUMN accessibility_settings TEXT DEFAULT '{}'; -- JSON

-- Notification preferences (JSON for flexibility)
ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}';

-- UI preferences
ALTER TABLE users ADD COLUMN ui_preferences TEXT DEFAULT '{}'; -- sidebar state, theme, etc.

-- User sessions tracking for device fingerprinting
ALTER TABLE users ADD COLUMN known_devices TEXT DEFAULT '[]'; -- JSON array of known device fingerprints

-- Auditor role support
-- Adding 'AUDITOR' to the role check (if using check constraint)
-- Note: SQLite doesn't support modifying constraints, so this is just documentation
-- The AUDITOR role has read-only access to all org data for compliance reviews
