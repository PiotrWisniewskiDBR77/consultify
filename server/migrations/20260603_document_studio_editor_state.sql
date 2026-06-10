-- Migration 20260603: Consultify Document Studio — Editor State Persistence
--
-- Module 10 (Dokumenty / Document Studio) hardening.
--
-- Backs the three in-process Maps in
-- `server/src/services/documentStudio/documentStudioService.ts`
-- (`proposalStore`, `auditStore`, `schemaOverlayStore`) with durable
-- Postgres tables via `documentEditorStateRegistryDao.ts`.
--
-- Before this migration any editor proposal, audit ledger entry, or
-- schema overlay (produced by a rollback or content-block insert) was
-- lost on server restart. The DAO is a write-through layer behind the
-- still-synchronous in-process cache, so the public service API is
-- unchanged and the existing green test baseline is preserved.
--
-- Design contract (mirrors `769_document_studio_templates.sql`):
--   - The service keeps an in-process cache (preserves the synchronous
--     public API). Reads hydrate the cache from these tables lazily on
--     first access per (organization, artifact). Writes update the cache
--     synchronously and persist asynchronously (best-effort).
--   - Schema-tolerant: missing-table errors fall back to the in-process
--     Map (see the DAO's try/catch envelope). The migration is additive
--     and idempotent.
--
-- Tenant safety: every table carries `organization_id`; the DAO queries
-- it in every WHERE clause so cross-tenant reads are deny-by-default.

-- ============================================================
-- EDITOR PROPOSALS
-- ============================================================
-- One row per editor proposal (local / section / global / methodology /
-- source / transformative). `proposal_json` carries the full
-- `DocumentEditorProposal` payload so new optional fields (E15.4.edit
-- structured changes, version links) persist without a schema change.

CREATE TABLE IF NOT EXISTS document_studio_editor_proposals (
  proposal_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  proposal_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_doc_studio_editor_proposals_artifact
  ON document_studio_editor_proposals(artifact_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_studio_editor_proposals_org_status
  ON document_studio_editor_proposals(organization_id, status);

-- ============================================================
-- AUDIT LEDGER
-- ============================================================
-- The per-artifact audit trail (proposal lifecycle, QA decisions,
-- status changes, snapshots, rollbacks, content-block inserts, etc.).
-- `details` is the optional structured payload. Keyed by `audit_id` so
-- the DAO can upsert idempotently on retries.

CREATE TABLE IF NOT EXISTS document_studio_editor_audit (
  audit_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  proposal_id TEXT,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_doc_studio_editor_audit_artifact
  ON document_studio_editor_audit(artifact_id, organization_id, occurred_at ASC);

-- ============================================================
-- SCHEMA OVERLAY
-- ============================================================
-- The live post-rollback / post-content-block-insert schema that
-- `getDocumentArtifact` consults before falling back to wave5. One row
-- per (artifact, organization). `schema_json` is the full
-- `DocumentSchema`.

CREATE TABLE IF NOT EXISTS document_studio_schema_overlay (
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (artifact_id, organization_id)
);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE document_studio_editor_proposals IS
  'Consultify Document Studio editor proposals. Owned by '
  'documentStudioService.ts via documentEditorStateRegistryDao.ts. '
  'Replaces the in-process proposalStore Map so proposals survive a '
  'server restart.';

COMMENT ON TABLE document_studio_editor_audit IS
  'Consultify Document Studio per-artifact audit ledger. Replaces the '
  'in-process auditStore Map.';

COMMENT ON TABLE document_studio_schema_overlay IS
  'Consultify Document Studio live schema overlay (post-rollback / '
  'post-content-block-insert). Replaces the in-process '
  'schemaOverlayStore Map.';
