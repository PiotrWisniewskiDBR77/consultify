-- M18 Document Studio — wave5 layer-2 persistence: APPROVALS (Epic E10).
-- Replaces the in-memory Map stores in documentApprovalRegistryDao.ts
-- (approvalStore + auditStore) with real Postgres tables, so approval
-- decisions/audit survive a deploy/restart.
-- Reference pattern: 776_document_studio_wave5_persistence.sql.
-- Storage shape: scalar key columns for WHERE/ordering + payload_json JSONB
-- holding the canonical DocumentApprovalRequest / DocumentApprovalAuditEntry
-- (incl. nested participants[]/decisions[]/details), so the swap is mechanical.

CREATE TABLE IF NOT EXISTS document_approvals (
  approval_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  status TEXT,
  requested_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_dappr_artifact ON document_approvals(artifact_id);
CREATE INDEX IF NOT EXISTS idx_dappr_org ON document_approvals(organization_id);

CREATE TABLE IF NOT EXISTS document_approval_audit (
  audit_id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  artifact_id TEXT,
  organization_id TEXT NOT NULL,
  action TEXT,
  actor_id TEXT,
  occurred_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_dappra_approval ON document_approval_audit(approval_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_dappra_org ON document_approval_audit(organization_id);
