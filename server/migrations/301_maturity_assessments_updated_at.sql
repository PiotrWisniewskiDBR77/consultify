-- Migration: 301_maturity_assessments_updated_at.sql
-- Purpose: Ensure updated_at exists for SQLite and Postgres

ALTER TABLE maturity_assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
UPDATE maturity_assessments SET updated_at = COALESCE(updated_at, created_at);
