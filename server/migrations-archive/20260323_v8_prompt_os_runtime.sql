-- V8 Prompt OS Runtime Discipline — core governance tables
-- WP-W2-AI-03: Prompt OS runtime discipline primitives
--
-- Decisions implemented:
--   W2-8  — eval thresholds per purpose family
--   W2-9  — hard/soft gate per preset
--   W2-10 — eval depth tiering by change type
--   W2-11 — canary architecture (org/purpose/preset targeting)
--   W2-12 — coordinated rollback at bundle level

-- ==========================================
-- 1. Prompt Presets
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_prompt_presets (
  preset_id              TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  name                   TEXT NOT NULL,
  purpose_family         TEXT NOT NULL
                         CHECK (purpose_family IN (
                           'conversational', 'governed_proposal',
                           'retrieval_grounded', 'artifact_generation',
                           'background_automation'
                         )),
  model_ref              TEXT NOT NULL,
  prompt_block_refs      TEXT NOT NULL DEFAULT '[]',
  policy_ref             TEXT,
  gate_type              TEXT NOT NULL DEFAULT 'hard'
                         CHECK (gate_type IN ('hard', 'soft')),
  eval_thresholds        TEXT NOT NULL DEFAULT '{}',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_prompt_presets_org
  ON v8_prompt_presets(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_prompt_presets_purpose
  ON v8_prompt_presets(organization_id, purpose_family);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_prompt_presets_org_name
  ON v8_prompt_presets(organization_id, name);

-- ==========================================
-- 2. Release Bundles
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_release_bundles (
  bundle_id              TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  version                TEXT NOT NULL,
  preset_id              TEXT NOT NULL,
  prompt_version         TEXT NOT NULL,
  model_version          TEXT NOT NULL,
  policy_version         TEXT NOT NULL,
  runtime_config_version TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN (
                           'draft', 'staging', 'canary', 'active', 'rolled_back'
                         )),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at           TEXT,
  rolled_back_at         TEXT,
  FOREIGN KEY (preset_id) REFERENCES v8_prompt_presets(preset_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_release_bundles_org
  ON v8_release_bundles(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_release_bundles_preset
  ON v8_release_bundles(preset_id);
CREATE INDEX IF NOT EXISTS idx_v8_release_bundles_status
  ON v8_release_bundles(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_v8_release_bundles_preset_active
  ON v8_release_bundles(preset_id, status)
  WHERE status = 'active';

-- ==========================================
-- 3. Eval Gates
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_eval_gates (
  gate_id                TEXT PRIMARY KEY,
  bundle_id              TEXT NOT NULL,
  gate_type              TEXT NOT NULL
                         CHECK (gate_type IN ('hard', 'soft')),
  purpose_family         TEXT NOT NULL
                         CHECK (purpose_family IN (
                           'conversational', 'governed_proposal',
                           'retrieval_grounded', 'artifact_generation',
                           'background_automation'
                         )),
  change_type            TEXT NOT NULL
                         CHECK (change_type IN (
                           'minor_wording', 'block_edit',
                           'routing_policy_change', 'base_rewrite'
                         )),
  thresholds             TEXT NOT NULL DEFAULT '{}',
  result                 TEXT NOT NULL
                         CHECK (result IN ('passed', 'failed', 'warning')),
  evaluated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bundle_id) REFERENCES v8_release_bundles(bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_eval_gates_bundle
  ON v8_eval_gates(bundle_id);
CREATE INDEX IF NOT EXISTS idx_v8_eval_gates_result
  ON v8_eval_gates(bundle_id, result);

-- ==========================================
-- 4. Canary Configs
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_canary_configs (
  config_id              TEXT PRIMARY KEY,
  bundle_id              TEXT NOT NULL,
  org_scoped             INTEGER NOT NULL DEFAULT 0,
  purpose_family_scoped  INTEGER NOT NULL DEFAULT 0,
  preset_scoped          INTEGER NOT NULL DEFAULT 0,
  rollback_enabled       INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bundle_id) REFERENCES v8_release_bundles(bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_canary_configs_bundle
  ON v8_canary_configs(bundle_id);

-- ==========================================
-- 5. Rollback Records
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_rollback_records (
  rollback_id            TEXT PRIMARY KEY,
  bundle_id              TEXT NOT NULL,
  reason                 TEXT NOT NULL,
  rolled_back_by         TEXT NOT NULL,
  rolled_back_at         TEXT NOT NULL DEFAULT (datetime('now')),
  previous_bundle_id     TEXT,
  FOREIGN KEY (bundle_id) REFERENCES v8_release_bundles(bundle_id),
  FOREIGN KEY (previous_bundle_id) REFERENCES v8_release_bundles(bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_rollback_records_bundle
  ON v8_rollback_records(bundle_id);
CREATE INDEX IF NOT EXISTS idx_v8_rollback_records_time
  ON v8_rollback_records(rolled_back_at);
