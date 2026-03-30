-- Migration: 20260330_p25b_kb_next_action_and_primers.sql
-- Purpose: Add KB article next-action routing + seed contextual Help primers (P25-B)
-- Date: 2026-03-30
-- Notes:
-- - `next_action` is runtime-only metadata for Help: it routes user back to the correct surface.
-- - Seed articles are minimal primers for Tools / Interview / Outputs + one EN-only for fallback proof.

-- 1) Schema: next_action JSON blob (nullable)
ALTER TABLE kb_articles ADD COLUMN next_action TEXT;

-- 2) Seed: Tools primer
INSERT OR IGNORE INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
  related_modules, target_audience, next_action
) VALUES (
  'kb-art-p25b-tools-primer',
  'kb-cat-tools-features',
  'p25b-tools-primer',
  'published',
  1,
  1,
  3,
  '["discovery-tools","tools"]',
  '["all"]',
  '{"route":"/discovery-tools"}'
);

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
  (
    'kb-art-trans-p25b-tools-en',
    'kb-art-p25b-tools-primer',
    'en',
    'Tools — start here (P25-B)',
    'P25-B primer: contextual help for the Tools surface (search → article → next action).',
    '# Tools — start here

This is the Tools primer used by the in-app Help runtime.

## What you can do here
- Search help articles
- Open an article
- Use **Next action** to return to the correct surface

## Next action
Use the button at the top of this article to go back to Tools.'
  ),
  (
    'kb-art-trans-p25b-tools-pl',
    'kb-art-p25b-tools-primer',
    'pl',
    'Tools — zacznij tutaj (P25-B)',
    'Primer P25-B: pomoc kontekstowa dla Tools (search → artykuł → next action).',
    '# Tools — zacznij tutaj

To jest primer dla runtime Help używany w P25-B.

## Co możesz zrobić
- Wyszukać artykuły
- Otworzyć artykuł
- Użyć **Next action**, aby wrócić do właściwej powierzchni

## Następny krok
Użyj przycisku u góry artykułu, aby wrócić do Tools.'
  );

-- 3) Seed: Interview primer
INSERT OR IGNORE INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
  related_modules, target_audience, next_action
) VALUES (
  'kb-art-p25b-interview-primer',
  'kb-cat-quick-guides',
  'p25b-interview-primer',
  'published',
  1,
  1,
  3,
  '["interview"]',
  '["all"]',
  '{"route":"/interview"}'
);

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
  (
    'kb-art-trans-p25b-interview-en',
    'kb-art-p25b-interview-primer',
    'en',
    'Interview — start here (P25-B)',
    'P25-B primer: contextual help for Interview (search → article → next action).',
    '# Interview — start here

Use Help to search for guidance and then continue work using **Next action**.'
  ),
  (
    'kb-art-trans-p25b-interview-pl',
    'kb-art-p25b-interview-primer',
    'pl',
    'Interview — zacznij tutaj (P25-B)',
    'Primer P25-B: pomoc kontekstowa dla Interview (search → artykuł → next action).',
    '# Interview — zacznij tutaj

Użyj Help, aby znaleźć wskazówki, a potem kontynuuj pracę przez **Next action**.'
  );

-- 4) Seed: Outputs primer
INSERT OR IGNORE INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
  related_modules, target_audience, next_action
) VALUES (
  'kb-art-p25b-outputs-primer',
  'kb-cat-analytics',
  'p25b-outputs-primer',
  'published',
  1,
  1,
  3,
  '["outputs","results"]',
  '["all"]',
  '{"route":"/presentations"}'
);

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
  (
    'kb-art-trans-p25b-outputs-en',
    'kb-art-p25b-outputs-primer',
    'en',
    'Outputs — start here (P25-B)',
    'P25-B primer: contextual help for Results/Outputs (search → article → next action).',
    '# Outputs — start here

Use Help to search for an article and continue with **Next action**.'
  ),
  (
    'kb-art-trans-p25b-outputs-pl',
    'kb-art-p25b-outputs-primer',
    'pl',
    'Outputs — zacznij tutaj (P25-B)',
    'Primer P25-B: pomoc kontekstowa dla Results/Outputs (search → artykuł → next action).',
    '# Outputs — zacznij tutaj

Użyj Help, aby wyszukać artykuł, a potem kontynuuj przez **Next action**.'
  );

-- 5) Seed: EN-only article for explicit PL degraded + EN fallback proof
INSERT OR IGNORE INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, reading_time_minutes,
  related_modules, target_audience, next_action
) VALUES (
  'kb-art-p25b-en-only',
  'kb-cat-tools-features',
  'p25b-en-only',
  'published',
  0,
  1,
  2,
  '["discovery-tools","tools"]',
  '["all"]',
  '{"route":"/discovery-tools"}'
);

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
  (
    'kb-art-trans-p25b-en-only-en',
    'kb-art-p25b-en-only',
    'en',
    'EN-only article (P25-B fallback proof)',
    'This article intentionally has no PL translation to prove explicit degraded + EN fallback.',
    '# EN-only article (P25-B fallback proof)

If you are in PL locale, the Help runtime should show an explicit banner and display this content in EN.'
  );

