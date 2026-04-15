-- V8 Planning/Approval Continuity — WP-W3-LIFECYCLE-02
-- Decisions: W3-4 (WBS depth), W3-5 (material change), W3-6 (cross-initiative deps), W3-7 (decision chains)

-- ==========================================
-- 1. Initiative Decompositions (WBS hierarchy)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_initiative_decompositions (
  decomposition_id    TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  initiative_id       TEXT NOT NULL,
  parent_id           TEXT,
  wbs_level           TEXT NOT NULL
                      CHECK (wbs_level IN (
                        'initiative', 'workstream_phase', 'task', 'subtask'
                      )),
  object_type         TEXT NOT NULL
                      CHECK (object_type IN (
                        'workstream', 'task', 'subtask', 'checklist_item'
                      )),
  object_id           TEXT NOT NULL,
  approval_inherited  INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  metadata            TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (parent_id) REFERENCES v8_initiative_decompositions(decomposition_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_decomp_org
  ON v8_initiative_decompositions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_decomp_initiative
  ON v8_initiative_decompositions(organization_id, initiative_id);
CREATE INDEX IF NOT EXISTS idx_v8_decomp_parent
  ON v8_initiative_decompositions(parent_id)
  WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_decomp_object
  ON v8_initiative_decompositions(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_v8_decomp_wbs
  ON v8_initiative_decompositions(organization_id, initiative_id, wbs_level);

-- ==========================================
-- 2. Cross-Initiative Dependencies
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_cross_initiative_dependencies (
  dependency_id         TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  source_initiative_id  TEXT NOT NULL,
  target_initiative_id  TEXT NOT NULL,
  dependency_type       TEXT NOT NULL
                        CHECK (dependency_type IN (
                          'blocks', 'blocked_by', 'depends_on', 'enables',
                          'shares_resource', 'shares_milestone'
                        )),
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN (
                          'active', 'resolved', 'broken', 'cancelled'
                        )),
  description           TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  metadata              TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_v8_cross_dep_org
  ON v8_cross_initiative_dependencies(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_cross_dep_source
  ON v8_cross_initiative_dependencies(organization_id, source_initiative_id);
CREATE INDEX IF NOT EXISTS idx_v8_cross_dep_target
  ON v8_cross_initiative_dependencies(organization_id, target_initiative_id);
CREATE INDEX IF NOT EXISTS idx_v8_cross_dep_status
  ON v8_cross_initiative_dependencies(organization_id, status);

-- ==========================================
-- 3. Decision Chains
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_decision_chains (
  chain_id        TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id   TEXT NOT NULL,
  chain_type      TEXT NOT NULL
                  CHECK (chain_type IN (
                    'sequential', 'parallel', 'delegated'
                  )),
  decisions       TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN (
                    'open', 'in_progress', 'completed', 'cancelled'
                  )),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  metadata        TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_v8_dec_chain_org
  ON v8_decision_chains(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_dec_chain_initiative
  ON v8_decision_chains(organization_id, initiative_id);
CREATE INDEX IF NOT EXISTS idx_v8_dec_chain_status
  ON v8_decision_chains(organization_id, status);
