-- Migration 725: Add missing columns to organizations table
-- These columns are referenced by createOrganization service but were missing from the live schema.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vat_number TEXT;
