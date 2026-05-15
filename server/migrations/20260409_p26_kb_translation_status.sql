-- 750: Add translation_status to kb_article_translations (P26 §2.3.1)
-- Values: native (original language), translated (up-to-date translation),
--         stale (translation exists but source updated since), missing (no translation)

ALTER TABLE kb_article_translations ADD COLUMN IF NOT EXISTS translation_status VARCHAR(20) DEFAULT 'native';
ALTER TABLE kb_article_translations ADD COLUMN IF NOT EXISTS source_version INT;

-- Backfill: treat EN translations as native, PL as translated
UPDATE kb_article_translations SET translation_status = 'native' WHERE language = 'en' AND translation_status IS NULL;
UPDATE kb_article_translations SET translation_status = 'translated' WHERE language = 'pl' AND translation_status IS NULL;

-- For articles that only have EN, mark PL as missing (no row exists — handled by app logic)
-- Stale detection: source_version tracks which article.version this translation was made from
UPDATE kb_article_translations SET source_version = 1 WHERE source_version IS NULL;
