-- Virtual Workers control-plane hardening
-- Adds richer worker policy, knowledge-pill governance,
-- conversation intelligence, evaluations and release metadata.

ALTER TABLE virtual_worker_profiles
  ADD COLUMN IF NOT EXISTS memory_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE virtual_worker_profiles
  ADD COLUMN IF NOT EXISTS channel_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE virtual_worker_profiles
  ADD COLUMN IF NOT EXISTS retrieval_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE virtual_worker_profiles
  ADD COLUMN IF NOT EXISTS cta_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE virtual_worker_profiles
  ADD COLUMN IF NOT EXISTS release_notes TEXT;

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS knowledge_pill_id TEXT;

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS usage_mode TEXT NOT NULL DEFAULT 'full_pill';

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS section_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS language_policy TEXT NOT NULL DEFAULT 'prefer_same_language';

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS fallback_policy TEXT NOT NULL DEFAULT 'allow_fallback';

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS hard_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS max_context_chars INTEGER;

ALTER TABLE virtual_worker_knowledge_assignments
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS primary_topic TEXT;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS secondary_topics JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS topic_family TEXT;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS topic_confidence NUMERIC(5,4);

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS intent TEXT;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS products_discussed JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS last_user_message TEXT;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS last_assistant_message TEXT;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS session_memory JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE virtual_worker_conversations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS retrieval_query TEXT;

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS used_pill_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS used_pill_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS answer_confidence NUMERIC(5,4);

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS response_mode TEXT;

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS message_topic TEXT;

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS message_intent TEXT;

ALTER TABLE virtual_worker_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS knowledge_pills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  product_slug TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'draft',
  source_type TEXT NOT NULL DEFAULT 'virtual_worker',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_pills_product_slug ON knowledge_pills(product_slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_pills_status ON knowledge_pills(status);

CREATE TABLE IF NOT EXISTS knowledge_pill_versions (
  id TEXT PRIMARY KEY,
  pill_id TEXT NOT NULL REFERENCES knowledge_pills(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  authored_by TEXT,
  change_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_pill_versions_unique
  ON knowledge_pill_versions(pill_id, version);

CREATE INDEX IF NOT EXISTS idx_knowledge_pill_versions_pill ON knowledge_pill_versions(pill_id);

CREATE TABLE IF NOT EXISTS knowledge_pill_sections (
  id TEXT PRIMARY KEY,
  pill_version_id TEXT NOT NULL REFERENCES knowledge_pill_versions(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_pill_sections_unique
  ON knowledge_pill_sections(pill_version_id, section_key);

CREATE INDEX IF NOT EXISTS idx_knowledge_pill_sections_version
  ON knowledge_pill_sections(pill_version_id);

CREATE TABLE IF NOT EXISTS virtual_worker_evaluations (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES virtual_workers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  dataset_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  results_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(6,3),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_virtual_worker_evals_worker
  ON virtual_worker_evaluations(worker_id);

CREATE INDEX IF NOT EXISTS idx_virtual_worker_evals_status
  ON virtual_worker_evaluations(status);

CREATE TABLE IF NOT EXISTS virtual_worker_releases (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES virtual_workers(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES virtual_worker_profiles(id) ON DELETE SET NULL,
  evaluation_id TEXT REFERENCES virtual_worker_evaluations(id) ON DELETE SET NULL,
  release_type TEXT NOT NULL DEFAULT 'profile',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_virtual_worker_releases_worker
  ON virtual_worker_releases(worker_id);

CREATE INDEX IF NOT EXISTS idx_virtual_worker_releases_status
  ON virtual_worker_releases(status);
