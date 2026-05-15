-- 744: Fix KB image refs — ensure .png → .webp migration is applied
-- Duplicate of 743 in case it was skipped or ran before the import overwrote values

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kb_articles'
      AND column_name = 'thumbnail_url'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'kb_articles'
        AND column_name = 'updated_at'
    ) THEN
      UPDATE kb_articles
      SET thumbnail_url = REPLACE(thumbnail_url, '.png', '.webp'),
          updated_at = CURRENT_TIMESTAMP
      WHERE thumbnail_url LIKE '%.png';
    ELSE
      UPDATE kb_articles
      SET thumbnail_url = REPLACE(thumbnail_url, '.png', '.webp')
      WHERE thumbnail_url LIKE '%.png';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kb_article_translations'
      AND column_name = 'content'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'kb_article_translations'
        AND column_name = 'updated_at'
    ) THEN
      UPDATE kb_article_translations
      SET content = REPLACE(REPLACE(content, '.png)', '.webp)'), '.png"', '.webp"'),
          updated_at = CURRENT_TIMESTAMP
      WHERE content LIKE '%.png)%'
         OR content LIKE '%.png"%';
    ELSE
      UPDATE kb_article_translations
      SET content = REPLACE(REPLACE(content, '.png)', '.webp)'), '.png"', '.webp"')
      WHERE content LIKE '%.png)%'
         OR content LIKE '%.png"%';
    END IF;
  END IF;
END $$;
