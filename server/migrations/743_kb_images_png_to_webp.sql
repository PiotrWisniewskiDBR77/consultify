-- 743: Convert KB image references from .png to .webp
-- All hero/analytical/social images have been converted to WebP for ~96% size reduction

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
