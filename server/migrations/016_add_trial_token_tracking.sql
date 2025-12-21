-- Migration: Add trial_tokens_used to organizations
-- Used for hard limit enforcement in Trial Phase C (10k tokens limit)

ALTER TABLE organizations ADD COLUMN trial_tokens_used INTEGER DEFAULT 0;
