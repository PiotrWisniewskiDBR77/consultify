-- Migration: 510_report_builder_sent_statuses.sql
-- Add columns for SENT_INTERNAL and SENT_EXTERNAL workflow statuses
-- Date: 2026-02-04

-- Add sent_internal tracking columns
ALTER TABLE report_builder_reports ADD COLUMN sent_internal_at TIMESTAMP;
ALTER TABLE report_builder_reports ADD COLUMN sent_internal_by TEXT REFERENCES users(id);

-- Add sent_external tracking columns
ALTER TABLE report_builder_reports ADD COLUMN sent_external_at TIMESTAMP;
ALTER TABLE report_builder_reports ADD COLUMN sent_external_by TEXT REFERENCES users(id);

-- Update the status comment for documentation
-- Status workflow is now:
-- DRAFT -> CONFIGURING -> GENERATING -> GENERATED -> IN_REVIEW -> APPROVED -> SENT_INTERNAL -> SENT_EXTERNAL -> UTILIZED
-- With send-back transition: IN_REVIEW -> DRAFT

-- Create index on new status values for efficient filtering
CREATE INDEX IF NOT EXISTS idx_rb_reports_sent_internal ON report_builder_reports(sent_internal_at);
CREATE INDEX IF NOT EXISTS idx_rb_reports_sent_external ON report_builder_reports(sent_external_at);
