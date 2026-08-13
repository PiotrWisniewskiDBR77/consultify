-- Migration: 739_knowledge_base_public_articles.sql
-- Purpose: Create tables for public Knowledge Base articles with translations
-- Date: 2026-01-20
-- Context: Supports in-app help library and landing page preview

-- ============================================
-- KNOWLEDGE CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS kb_categories (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT NOT NULL DEFAULT 'BookOpen',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_categories_slug ON kb_categories(slug);
CREATE INDEX IF NOT EXISTS idx_kb_categories_active ON kb_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_kb_categories_public ON kb_categories(is_public);

-- ============================================
-- KNOWLEDGE ARTICLES
-- ============================================
CREATE TABLE IF NOT EXISTS kb_articles (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES kb_categories(id),
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft',
    is_featured INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER DEFAULT 3,
    thumbnail_url TEXT,
    video_url TEXT,
    video_teaser_url TEXT,
    related_modules TEXT,
    target_audience TEXT,
    related_article_ids TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_public ON kb_articles(is_public);
CREATE INDEX IF NOT EXISTS idx_kb_articles_featured ON kb_articles(is_featured);

-- ============================================
-- KNOWLEDGE CATEGORY TRANSLATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS kb_category_translations (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES kb_categories(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE(category_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_cat_trans_category ON kb_category_translations(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_cat_trans_lang ON kb_category_translations(language);

-- ============================================
-- KNOWLEDGE ARTICLE TRANSLATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS kb_article_translations (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    video_script TEXT,
    UNIQUE(article_id, language)
);

CREATE INDEX IF NOT EXISTS idx_kb_art_trans_article ON kb_article_translations(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_art_trans_lang ON kb_article_translations(language);

-- ============================================
-- ARTICLE VIEW TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS kb_article_views (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
    user_id TEXT,
    session_id TEXT,
    source TEXT DEFAULT 'in_app',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Older Knowledge Base installations already have kb_article_views but predate
-- timestamp tracking. Reconcile the existing table before creating its index.
ALTER TABLE kb_article_views ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_kb_views_article ON kb_article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_views_created ON kb_article_views(created_at);
