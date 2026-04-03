-- 741: KB Collections, Tags, Surface Bindings, Versions, Sources
-- DDL-only extract from 20260331_p26b (skips backfill that assumes UUID categories)

CREATE TABLE IF NOT EXISTS kb_collections (
  id TEXT PRIMARY KEY,
  slug VARCHAR(200) NOT NULL UNIQUE,
  parent_collection_id TEXT REFERENCES kb_collections(id) ON DELETE SET NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  owner_user_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_collection_translations (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  title VARCHAR(500) NOT NULL,
  description TEXT,
  UNIQUE(collection_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_collections_parent ON kb_collections(parent_collection_id);
CREATE INDEX IF NOT EXISTS idx_kb_collections_slug ON kb_collections(slug);
CREATE INDEX IF NOT EXISTS idx_kb_collection_translations_coll ON kb_collection_translations(collection_id, language);

CREATE TABLE IF NOT EXISTS kb_tags (
  id TEXT PRIMARY KEY,
  slug VARCHAR(200) NOT NULL UNIQUE,
  kind VARCHAR(30) NOT NULL DEFAULT 'domain',
  synonyms JSONB DEFAULT '[]',
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  redirect_to_tag_id TEXT REFERENCES kb_tags(id) ON DELETE SET NULL,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_tag_translations (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES kb_tags(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  label VARCHAR(200) NOT NULL,
  description TEXT,
  UNIQUE(tag_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_tags_slug ON kb_tags(slug);
CREATE INDEX IF NOT EXISTS idx_kb_tags_kind ON kb_tags(kind);
CREATE INDEX IF NOT EXISTS idx_kb_tag_translations_tag ON kb_tag_translations(tag_id, language);

CREATE TABLE IF NOT EXISTS kb_article_collections (
  article_id TEXT NOT NULL,
  collection_id TEXT NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_collections_coll ON kb_article_collections(collection_id);

CREATE TABLE IF NOT EXISTS kb_article_tags (
  article_id TEXT NOT NULL,
  tag_id TEXT NOT NULL REFERENCES kb_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_tags_tag ON kb_article_tags(tag_id);

CREATE TABLE IF NOT EXISTS kb_surface_bindings (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  surface VARCHAR(50) NOT NULL,
  tool_context VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, surface, tool_context)
);

CREATE INDEX IF NOT EXISTS idx_kb_surface_bindings_article ON kb_surface_bindings(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_surface_bindings_surface ON kb_surface_bindings(surface);

CREATE TABLE IF NOT EXISTS kb_article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  change_type VARCHAR(20) NOT NULL DEFAULT 'update',
  change_note TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, version)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_versions_article ON kb_article_versions(article_id, version DESC);

CREATE TABLE IF NOT EXISTS kb_sources (
  id TEXT PRIMARY KEY,
  kind VARCHAR(30) NOT NULL DEFAULT 'internal',
  title VARCHAR(500),
  uri VARCHAR(2000),
  captured_at TIMESTAMPTZ,
  excerpt TEXT,
  notes TEXT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'internal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_article_sources (
  article_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES kb_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_sources_source ON kb_article_sources(source_id);

ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS canonical_topic_key VARCHAR(200);
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS deprecation_reason TEXT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS replacement_article_id TEXT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS redirect_to_article_id TEXT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS review_cadence_days INT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS callouts JSONB DEFAULT '[]';
