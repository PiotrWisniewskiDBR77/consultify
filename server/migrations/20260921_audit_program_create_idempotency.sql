-- AUD-BVP-001: caller-scoped replay protection for canonical audit-program creation.
ALTER TABLE audit_programs
  ADD COLUMN IF NOT EXISTS create_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_programs_create_idempotency
  ON audit_programs (organization_id, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;
