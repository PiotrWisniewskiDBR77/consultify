-- AI Trust & Explainability Layer - Database Migration
-- Extends ai_audit_logs table with explainability columns
-- Migration: 005_ai_explainability.sql

-- Add regulatory_mode column
ALTER TABLE ai_audit_logs ADD COLUMN regulatory_mode INTEGER DEFAULT 0;

-- Add reasoning_summary column
ALTER TABLE ai_audit_logs ADD COLUMN reasoning_summary TEXT;

-- Add data_used_json column (stores JSON object with projectData, projectMemoryCount, externalSources)
ALTER TABLE ai_audit_logs ADD COLUMN data_used_json TEXT;

-- Add constraints_applied_json column (stores JSON array of constraint strings)
ALTER TABLE ai_audit_logs ADD COLUMN constraints_applied_json TEXT;

-- Create index for querying by confidence level
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_confidence ON ai_audit_logs(confidence_level);

-- Create index for querying by AI role
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_ai_role ON ai_audit_logs(ai_role);

-- Create index for querying regulatory mode interactions
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_regulatory ON ai_audit_logs(regulatory_mode);
