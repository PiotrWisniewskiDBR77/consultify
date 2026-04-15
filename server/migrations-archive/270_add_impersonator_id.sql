-- Migration: 270_add_impersonator_id.sql
-- Purpose: Add impersonator_id column to users table for super admin impersonation feature
-- Created: 2026-01-16
--
-- This column tracks which admin user is impersonating a user (for super admin feature)
-- NULL when not being impersonated

-- Add impersonator_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS impersonator_id TEXT;

-- Add index for faster lookups when filtering by impersonator
CREATE INDEX IF NOT EXISTS idx_users_impersonator_id ON users(impersonator_id);
