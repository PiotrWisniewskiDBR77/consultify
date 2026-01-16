-- Step 128: User Contact Information
-- Migration: 128_user_contact_information.sql
-- Creates tables for multiple contact methods, addresses, and emergency contacts

-- =========================================
-- USER CONTACT EMAILS
-- =========================================
CREATE TABLE IF NOT EXISTS user_contact_emails (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('work', 'personal', 'other')),
    is_primary BOOLEAN DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    verified_at DATETIME,
    verification_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_contact_emails_user_id ON user_contact_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_emails_primary ON user_contact_emails(user_id, is_primary) WHERE is_primary = TRUE;

-- =========================================
-- USER CONTACT PHONES
-- =========================================
CREATE TABLE IF NOT EXISTS user_contact_phones (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('work', 'mobile', 'home', 'other')),
    country_code TEXT DEFAULT '+1',
    is_primary BOOLEAN DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    verified_at DATETIME,
    verification_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, phone, country_code)
);

CREATE INDEX IF NOT EXISTS idx_user_contact_phones_user_id ON user_contact_phones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_phones_primary ON user_contact_phones(user_id, is_primary) WHERE is_primary = 1;

-- =========================================
-- USER ADDRESSES
-- =========================================
CREATE TABLE IF NOT EXISTS user_addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('office', 'home', 'billing', 'shipping', 'other')),
    street TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    formatted TEXT,
    is_primary BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_primary ON user_addresses(user_id, is_primary) WHERE is_primary = TRUE;

-- =========================================
-- USER EMERGENCY CONTACTS
-- =========================================
CREATE TABLE IF NOT EXISTS user_emergency_contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    is_primary BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_emergency_contacts_user_id ON user_emergency_contacts(user_id);

-- =========================================
-- USER PREFERRED CONTACT METHOD
-- =========================================
-- Add preferred_contact_method column to users table
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- If column exists, this will fail - migration system should handle it
-- For PostgreSQL: ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT DEFAULT 'email';
-- For SQLite: ALTER TABLE users ADD COLUMN preferred_contact_method TEXT DEFAULT 'email';
-- Constraint enforced in application layer
ALTER TABLE users ADD COLUMN preferred_contact_method TEXT DEFAULT 'email';

