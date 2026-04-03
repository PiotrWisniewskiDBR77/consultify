-- 744: Fix KB image refs — ensure .png → .webp migration is applied
-- Duplicate of 743 in case it was skipped or ran before the import overwrote values

UPDATE kb_articles
SET thumbnail_url = REPLACE(thumbnail_url, '.png', '.webp'),
    updated_at = CURRENT_TIMESTAMP
WHERE thumbnail_url LIKE '%.png';

UPDATE kb_article_translations
SET content = REPLACE(content, '.png)', '.webp)'),
    updated_at = CURRENT_TIMESTAMP
WHERE content LIKE '%.png)%';

UPDATE kb_article_translations
SET content = REPLACE(content, '.png"', '.webp"'),
    updated_at = CURRENT_TIMESTAMP
WHERE content LIKE '%.png"%';
