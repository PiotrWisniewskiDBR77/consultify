-- M18 Document Studio — wave5 layer-2 persistence: 5 REMAINING REGISTRY LAYERS.
-- Replaces the in-memory Map stores in:
--   documentContentBlockRegistryDao.ts   (blockStore   + auditStore)
--   documentBrandVoiceRegistryDao.ts      (profileStore + auditStore)
--   documentAudienceProfileRegistryDao.ts (profileStore + auditStore)
--   documentSourcePackRegistryDao.ts      (packStore    + auditStore)
--   documentShareLinkRegistryDao.ts       (linkStore    + auditStore)
-- with real Postgres tables, so the data survives a deploy/restart.
--
-- Reference pattern: 780_document_studio_approvals_persistence.sql.
-- Storage shape: scalar key columns for WHERE/ordering + payload_json JSONB
-- holding the canonical record (incl. nested arrays/items), so the swap is
-- mechanical and the DAO signatures stay unchanged.
--
-- Scoping note: content-block / brand-voice / audience / source-pack layers
-- are ORG-SCOPED (no artifact_id). Source-pack `items[]` live inside the pack
-- payload (the DAO has a single pack store, never a standalone item query) so
-- they need no separate table. Share-link is ARTIFACT-SCOPED and carries
-- token / token_hash secondary-index columns.

-- ── Content Block Library (Epic E10, Slice 10.2) ────────────────────────────
CREATE TABLE IF NOT EXISTS document_content_blocks (
  content_block_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  status TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dcblk_org ON document_content_blocks(organization_id);

CREATE TABLE IF NOT EXISTS document_content_block_audit (
  audit_id TEXT PRIMARY KEY,
  content_block_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action TEXT,
  actor_id TEXT,
  occurred_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dcblka_block ON document_content_block_audit(content_block_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_dcblka_org ON document_content_block_audit(organization_id);

-- ── Brand Voice Profiles (Epic E7, Slice 7.1) ───────────────────────────────
CREATE TABLE IF NOT EXISTS document_brand_voice_profiles (
  profile_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  status TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dbvp_org ON document_brand_voice_profiles(organization_id);

CREATE TABLE IF NOT EXISTS document_brand_voice_audit (
  audit_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action TEXT,
  actor_id TEXT,
  occurred_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dbva_profile ON document_brand_voice_audit(profile_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_dbva_org ON document_brand_voice_audit(organization_id);

-- ── Audience Profiles (Epic E9, Slice 9.2) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS document_audience_profiles (
  profile_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  status TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_daud_org ON document_audience_profiles(organization_id);

CREATE TABLE IF NOT EXISTS document_audience_audit (
  audit_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action TEXT,
  actor_id TEXT,
  occurred_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dauda_profile ON document_audience_audit(profile_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_dauda_org ON document_audience_audit(organization_id);

-- ── Source Packs (Epic E4, Slice 4.1) ───────────────────────────────────────
-- `items[]` are stored inside payload_json (single-store DAO; no standalone
-- item query exists), matching the existing DAO surface.
CREATE TABLE IF NOT EXISTS document_source_packs (
  pack_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  status TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dsp_org ON document_source_packs(organization_id);

CREATE TABLE IF NOT EXISTS document_source_pack_audit (
  audit_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action TEXT,
  actor_id TEXT,
  occurred_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dspa_pack ON document_source_pack_audit(pack_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_dspa_org ON document_source_pack_audit(organization_id);

-- ── Share Links (Epic E13) ───────────────────────────────────────────────────
-- Artifact-scoped + token/token_hash secondary index columns for the
-- token-based resolve paths (loadShareLinkByToken / loadShareLinkByTokenHash).
CREATE TABLE IF NOT EXISTS document_share_links (
  share_link_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  token TEXT,
  token_hash TEXT,
  status TEXT,
  created_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dsl_artifact ON document_share_links(artifact_id);
CREATE INDEX IF NOT EXISTS idx_dsl_org ON document_share_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_dsl_token ON document_share_links(token);
CREATE INDEX IF NOT EXISTS idx_dsl_token_hash ON document_share_links(token_hash);

CREATE TABLE IF NOT EXISTS document_share_link_audit (
  audit_id TEXT PRIMARY KEY,
  share_link_id TEXT NOT NULL,
  artifact_id TEXT,
  organization_id TEXT NOT NULL,
  action TEXT,
  actor_id TEXT,
  occurred_at TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_dsla_link ON document_share_link_audit(share_link_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_dsla_org ON document_share_link_audit(organization_id);
