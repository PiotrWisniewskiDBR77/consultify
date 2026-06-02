-- Ported from: 20260409_p26_kb_hero_asset_refs.sql
-- 744: Add hero_asset_refs to kb_articles (P26 §2.3.1)
-- Stores structured hero content: [{type: 'image'|'video'|'embed', url, alt?, caption?, poster?}]
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS hero_asset_refs TEXT DEFAULT '[]';

-- Backfill: create hero refs from existing thumbnail + video columns
UPDATE kb_articles
SET hero_asset_refs = '[' ||
  CASE WHEN thumbnail_url IS NOT NULL
    THEN '{"type":"image","url":"' || REPLACE(thumbnail_url, '"', '\"') || '"}'
    ELSE '' END ||
  CASE WHEN thumbnail_url IS NOT NULL AND video_url IS NOT NULL THEN ',' ELSE '' END ||
  CASE WHEN video_url IS NOT NULL
    THEN '{"type":"video","url":"' || REPLACE(video_url, '"', '\"') || '"' ||
         CASE WHEN video_teaser_url IS NOT NULL
           THEN ',"poster":"' || REPLACE(video_teaser_url, '"', '\"') || '"'
           ELSE '' END ||
         '}'
    ELSE '' END ||
  ']'
WHERE (thumbnail_url IS NOT NULL OR video_url IS NOT NULL)
  AND (hero_asset_refs IS NULL OR hero_asset_refs = '[]');
