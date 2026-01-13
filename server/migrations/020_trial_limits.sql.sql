-- Migration: Trial Limits Counters
-- Adds trial_exports_used and trial_share_links_used to organizations

ALTER TABLE organizations ADD COLUMN trial_exports_used INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN trial_share_links_used INTEGER DEFAULT 0;
