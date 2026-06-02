-- Migration 611: Organization Media Library
-- Stores uploaded images with AI-generated tags for smart image routing.

CREATE TABLE IF NOT EXISTS organization_media (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  
  -- File metadata
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  file_size INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  
  -- Storage
  storage_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- AI-generated tags and metadata
  ai_tags TEXT DEFAULT '[]',           -- JSON array of tags: ["team", "office", "meeting"]
  ai_description TEXT,                 -- AI-generated description
  ai_dominant_colors TEXT DEFAULT '[]', -- JSON array of hex colors
  ai_category TEXT,                    -- 'photo', 'illustration', 'chart', 'logo', 'icon'
  
  -- User-provided metadata
  user_tags TEXT DEFAULT '[]',
  title TEXT,
  alt_text TEXT,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  
  -- Lifecycle
  is_archived INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_media_org ON organization_media(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_media_category ON organization_media(organization_id, ai_category);
CREATE INDEX IF NOT EXISTS idx_org_media_usage ON organization_media(organization_id, usage_count DESC);
