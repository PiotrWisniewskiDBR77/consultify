-- =============================================================================
-- Migration: 791_organizations_dunning_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: `organizations` table is missing the dunning/billing-recovery
-- columns read/written by server/src/services/dunningService.ts. Those reads
-- currently throw Postgres 42703 (column does not exist), which the DbPromise
-- wrapper swallows silently — dunning status/suspension flows look "empty"
-- instead of erroring. Purely additive, idempotent.
--
-- NOTE: `organizations` tax columns are NOT added here — a dedicated
-- `billing_tax_settings` table (keyed by organization_id) already exists on
-- parity with the full tax/invoice schema (tax_id, tax_id_type, tax_exempt,
-- billing_name/email/address_*, invoice_prefix, po_number). No org-level
-- `organizations.tax_*` column is referenced anywhere in server/src.
-- =============================================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'current';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dunning_stage INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dunning_started_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspension_scheduled_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_payment_attempt_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_successful_payment_at TIMESTAMPTZ;
