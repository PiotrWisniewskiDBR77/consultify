-- EXE-MVP-SPINE-001: decision A authority contract.
-- execution_case_links owns cross-model identity; Runtime-v1 owns work writes;
-- Case Workspace owns governance. Legacy readers remain valid.

ALTER TABLE execution_case_links
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0 CHECK (reopen_count >= 0);

CREATE TABLE IF NOT EXISTS execution_link_reopen_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  execution_link_id UUID NOT NULL REFERENCES execution_case_links(link_id),
  expected_version INTEGER NOT NULL CHECK (expected_version > 0),
  resulting_version INTEGER NOT NULL CHECK (resulting_version > 0),
  reopened_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, idempotency_key)
);

ALTER TABLE execution_link_reopen_receipts ADD COLUMN IF NOT EXISTS request_digest TEXT;
UPDATE execution_link_reopen_receipts SET request_digest='LEGACY_UNVERIFIABLE' WHERE request_digest IS NULL;
ALTER TABLE execution_link_reopen_receipts ALTER COLUMN request_digest SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_execution_link_reopen_receipts_link
  ON execution_link_reopen_receipts(organization_id, execution_link_id, created_at DESC);

CREATE TABLE IF NOT EXISTS execution_identity_aliases (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  execution_link_id UUID NOT NULL REFERENCES execution_case_links(link_id),
  legacy_initiative_id TEXT NOT NULL REFERENCES initiatives(id),
  legacy_case_id TEXT NOT NULL REFERENCES case_core(case_id),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, legacy_initiative_id, legacy_case_id),
  UNIQUE (organization_id, execution_link_id)
);

COMMENT ON TABLE execution_case_links IS
  'Canonical cross-model execution identity. Runtime-v1 is work writer; Case Workspace is governance/state authority; legacy PMO/V8 are adapters/read-only where a Runtime-v1 identity exists.';
