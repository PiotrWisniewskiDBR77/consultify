-- V4-ORG-05: Unified Knowledge Graph schema
-- Upgrades existing knowledge_graph_entities/relations with provenance,
-- adds governance columns (V4-ORG-07, V4-ORG-08), and freshness tracking (V4-ORG-09).
-- Bridges LinkGraph (artifact refs) with KG (extracted entities) into one queryable model.

-- ============================================================
-- 1) Upgrade knowledge_graph_entities with provenance + governance
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_graph_entities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  properties_json TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_graph_relations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_entity_id TEXT NOT NULL REFERENCES knowledge_graph_entities(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES knowledge_graph_entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  properties_json TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS source_artifact_type TEXT;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS source_artifact_id TEXT;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS confidence REAL DEFAULT 0.7;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS extraction_method TEXT DEFAULT 'pattern';
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS pii_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS redacted BOOLEAN DEFAULT FALSE;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS merged_into_id TEXT;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS canonical_name TEXT;
ALTER TABLE knowledge_graph_entities ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_kg_entities_source_artifact
  ON knowledge_graph_entities(organization_id, source_artifact_type, source_artifact_id);
CREATE INDEX IF NOT EXISTS idx_kg_entities_type
  ON knowledge_graph_entities(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_confidence
  ON knowledge_graph_entities(organization_id, confidence);
CREATE INDEX IF NOT EXISTS idx_kg_entities_canonical
  ON knowledge_graph_entities(organization_id, canonical_name);

-- ============================================================
-- 2) Upgrade knowledge_graph_relations with provenance + governance
-- ============================================================

ALTER TABLE knowledge_graph_relations ADD COLUMN IF NOT EXISTS source_artifact_type TEXT;
ALTER TABLE knowledge_graph_relations ADD COLUMN IF NOT EXISTS source_artifact_id TEXT;
ALTER TABLE knowledge_graph_relations ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE knowledge_graph_relations ADD COLUMN IF NOT EXISTS extraction_method TEXT DEFAULT 'pattern';
ALTER TABLE knowledge_graph_relations ADD COLUMN IF NOT EXISTS weight REAL DEFAULT 1.0;
ALTER TABLE knowledge_graph_relations ADD COLUMN IF NOT EXISTS valid_from TEXT;
ALTER TABLE knowledge_graph_relations ADD COLUMN IF NOT EXISTS valid_until TEXT;

CREATE INDEX IF NOT EXISTS idx_kg_relations_source_entity
  ON knowledge_graph_relations(organization_id, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_target_entity
  ON knowledge_graph_relations(organization_id, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_type
  ON knowledge_graph_relations(organization_id, relation_type);

-- ============================================================
-- 3) KG audit log (V4-ORG-08: read/export audit)
-- ============================================================

CREATE TABLE IF NOT EXISTS kg_audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  query_text TEXT,
  result_count INTEGER,
  metadata TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kg_audit_org
  ON kg_audit_log(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kg_audit_actor
  ON kg_audit_log(organization_id, actor_id);

-- ============================================================
-- 4) KG freshness tracking (V4-ORG-09)
-- ============================================================

CREATE TABLE IF NOT EXISTS kg_rebuild_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  entities_processed INTEGER DEFAULT 0,
  relations_processed INTEGER DEFAULT 0,
  duplicates_merged INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kg_rebuild_org
  ON kg_rebuild_jobs(organization_id, status);
