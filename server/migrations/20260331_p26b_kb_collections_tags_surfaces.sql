-- P26-B: Knowledge Base — Collections, Tags, Surface Bindings, Versions, Sources
-- Extends existing kb_articles/kb_categories with full P26 canon (§2.3.1)

-- ============================================================
-- 1. Collections (IA spine — replaces flat categories as primary browse)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(200) NOT NULL UNIQUE,
  parent_collection_id UUID REFERENCES kb_collections(id) ON DELETE SET NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'in-app', 'internal')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  owner_user_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_collection_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  title VARCHAR(500) NOT NULL,
  description TEXT,
  UNIQUE(collection_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_collections_parent ON kb_collections(parent_collection_id);
CREATE INDEX IF NOT EXISTS idx_kb_collections_slug ON kb_collections(slug);
CREATE INDEX IF NOT EXISTS idx_kb_collection_translations_coll ON kb_collection_translations(collection_id, language);

-- ============================================================
-- 2. Tags (cross-cutting facets for filtering and discovery)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(200) NOT NULL UNIQUE,
  kind VARCHAR(30) NOT NULL DEFAULT 'domain' CHECK (kind IN ('domain', 'tool', 'concept', 'stage', 'audience')),
  synonyms JSONB DEFAULT '[]',
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'in-app', 'internal')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  redirect_to_tag_id UUID REFERENCES kb_tags(id) ON DELETE SET NULL,
  owner_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_tag_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES kb_tags(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  label VARCHAR(200) NOT NULL,
  description TEXT,
  UNIQUE(tag_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_tags_slug ON kb_tags(slug);
CREATE INDEX IF NOT EXISTS idx_kb_tags_kind ON kb_tags(kind);
CREATE INDEX IF NOT EXISTS idx_kb_tag_translations_tag ON kb_tag_translations(tag_id, language);

-- ============================================================
-- 3. Article ↔ Collection junction
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_article_collections (
  article_id UUID NOT NULL,
  collection_id UUID NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_collections_coll ON kb_article_collections(collection_id);

-- ============================================================
-- 4. Article ↔ Tag junction
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_article_tags (
  article_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES kb_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_tags_tag ON kb_article_tags(tag_id);

-- ============================================================
-- 5. Surface Bindings (where content appears)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_surface_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  surface VARCHAR(50) NOT NULL CHECK (surface IN ('lp', 'help', 'right_panel', 'ai_recommendations', 'public_docs')),
  tool_context VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, surface, tool_context)
);

CREATE INDEX IF NOT EXISTS idx_kb_surface_bindings_article ON kb_surface_bindings(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_surface_bindings_surface ON kb_surface_bindings(surface);

-- ============================================================
-- 6. Article Versions (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  version INT NOT NULL DEFAULT 1,
  change_type VARCHAR(20) NOT NULL DEFAULT 'update' CHECK (change_type IN ('typo', 'clarify', 'update', 'breaking')),
  change_note TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, version)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_versions_article ON kb_article_versions(article_id, version DESC);

-- ============================================================
-- 7. Sources (evidence pointers)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(30) NOT NULL DEFAULT 'internal' CHECK (kind IN ('internal', 'benchmark', 'customer_input', 'release_note', 'external')),
  title VARCHAR(500),
  uri VARCHAR(2000),
  captured_at TIMESTAMPTZ,
  excerpt TEXT,
  notes TEXT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_article_sources (
  article_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES kb_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_sources_source ON kb_article_sources(source_id);

-- ============================================================
-- 8. Extend kb_articles with P26 canon fields
-- ============================================================
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS canonical_topic_key VARCHAR(200);
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS deprecation_reason TEXT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS replacement_article_id UUID;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS redirect_to_article_id UUID;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS review_cadence_days INT;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS related_article_ids JSONB DEFAULT '[]';
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS callouts JSONB DEFAULT '[]';

-- ============================================================
-- 9. Backfill: migrate existing categories → collections
-- ============================================================
INSERT INTO kb_collections (id, slug, visibility, featured, sort_order, created_at)
SELECT c.id, c.slug,
       CASE WHEN c.is_public THEN 'public' ELSE 'in-app' END,
       FALSE, c.sort_order, c.created_at
FROM kb_categories c
WHERE c.is_active = TRUE
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_collection_translations (collection_id, language, title, description)
SELECT ct.category_id, ct.language, ct.name, ct.description
FROM kb_category_translations ct
WHERE ct.category_id IN (SELECT id FROM kb_collections)
ON CONFLICT (collection_id, language) DO NOTHING;

-- Link existing articles to their category-as-collection
INSERT INTO kb_article_collections (article_id, collection_id, sort_order)
SELECT a.id, a.category_id, 0
FROM kb_articles a
WHERE a.category_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM kb_collections c WHERE c.id = a.category_id)
ON CONFLICT (article_id, collection_id) DO NOTHING;

-- Default surface bindings for existing published articles
INSERT INTO kb_surface_bindings (article_id, surface)
SELECT a.id, 'public_docs'
FROM kb_articles a
WHERE a.status = 'published' AND a.is_public = TRUE
ON CONFLICT (article_id, surface, tool_context) DO NOTHING;

INSERT INTO kb_surface_bindings (article_id, surface)
SELECT a.id, 'help'
FROM kb_articles a
WHERE a.status = 'published'
ON CONFLICT (article_id, surface, tool_context) DO NOTHING;
