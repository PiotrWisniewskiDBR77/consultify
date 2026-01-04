-- Step 129: User Availability & Status
-- Migration: 129_user_availability.sql
-- Creates tables for user availability, status messages, out-of-office periods, and working hours

-- =========================================
-- USER AVAILABILITY
-- =========================================
CREATE TABLE IF NOT EXISTS user_availability (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status_message TEXT,
    working_hours_json TEXT DEFAULT '{}', -- JSON: { monday: { enabled, startTime, endTime, breaks: [] }, ... }
    dnd_hours_json TEXT DEFAULT '{}', -- JSON: { enabled, startTime, endTime, days: [] }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON user_availability(user_id);

-- =========================================
-- USER OUT OF OFFICE PERIODS
-- =========================================
CREATE TABLE IF NOT EXISTS user_out_of_office (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    is_all_day BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_ooo_user_id ON user_out_of_office(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ooo_dates ON user_out_of_office(start_date, end_date);












