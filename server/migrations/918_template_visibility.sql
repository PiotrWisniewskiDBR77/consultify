-- Migration 918: Template Library — spójna widoczność 3-poziomowa
-- (System / Organizacja / Prywatny) na 3 tabelach szablonów.
--
-- ⚠️ NIE APLIKOWANA AUTOMATYCZNIE. Ten plik NIE pasuje do wzorca
-- runTablePlatformMigrations (`^(7\d{2}|\d{8})_.*\.sql$`), więc nie zostanie
-- uruchomiona przy boocie serwera. Do ręcznego zastosowania na bazie TROLLEY
-- (staging=demo) przez nadzorcę sesji głównej — patrz skill
-- consultify-promocja-demo.
--
-- Additive + idempotentna (ADD COLUMN IF NOT EXISTS, UPDATE tylko gdzie
-- visibility IS NULL). Nie usuwa i nie nadpisuje żadnej istniejącej kolumny
-- (is_system/organization_id/is_public/created_by zostają nietknięte —
-- kod serwisu (deliverableTemplateService.ts) nadal działa wstecznie zgodnie
-- nawet jeśli ta migracja nie zostanie zastosowana: fallback na starą,
-- 2-poziomową regułę gdy kolumna `visibility` nie istnieje).
--
-- Reguła 3-poziomowa (backfill z istniejących kolumn):
--   'system'       — is_system = true (deck/doc) / created_by IS NULL (table)
--   'organization' — inaczej, gdy organization_id IS NOT NULL (w tym is_public=true
--                    dla report_builder_templates — dziś "widoczny cross-org",
--                    tu spłaszczone do 'organization' żeby nie stracić widoczności
--                    żadnego istniejącego szablonu)
--   'private'      — inaczej (organization_id IS NULL, nie-system) — dziś praktycznie
--                    nie występuje (createDeliverableTemplate zawsze ustawia
--                    organization_id), ale kolumna musi obsłużyć ten przypadek
--                    na przyszłość (np. ręcznie wstawione rekordy).

BEGIN;

-- ── presentation_templates (deck) ──────────────────────────────
ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS visibility TEXT;

UPDATE presentation_templates
   SET visibility = CASE
     WHEN is_system = true THEN 'system'
     WHEN organization_id IS NOT NULL THEN 'organization'
     ELSE 'private'
   END
 WHERE visibility IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'presentation_templates_visibility_check'
  ) THEN
    ALTER TABLE presentation_templates
      ADD CONSTRAINT presentation_templates_visibility_check
      CHECK (visibility IS NULL OR visibility IN ('system', 'organization', 'private'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_presentation_templates_visibility
  ON presentation_templates(visibility);

-- ── report_builder_templates (doc) ─────────────────────────────
ALTER TABLE report_builder_templates
  ADD COLUMN IF NOT EXISTS visibility TEXT;

UPDATE report_builder_templates
   SET visibility = CASE
     WHEN is_system = true THEN 'system'
     WHEN is_public = true THEN 'organization'
     WHEN organization_id IS NOT NULL THEN 'organization'
     ELSE 'private'
   END
 WHERE visibility IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_builder_templates_visibility_check'
  ) THEN
    ALTER TABLE report_builder_templates
      ADD CONSTRAINT report_builder_templates_visibility_check
      CHECK (visibility IS NULL OR visibility IN ('system', 'organization', 'private'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_report_builder_templates_visibility
  ON report_builder_templates(visibility);

-- ── tp_base_templates (table) ──────────────────────────────────
ALTER TABLE tp_base_templates
  ADD COLUMN IF NOT EXISTS visibility TEXT;

UPDATE tp_base_templates
   SET visibility = CASE
     WHEN created_by IS NULL THEN 'system'
     WHEN organization_id IS NOT NULL THEN 'organization'
     ELSE 'private'
   END
 WHERE visibility IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tp_base_templates_visibility_check'
  ) THEN
    ALTER TABLE tp_base_templates
      ADD CONSTRAINT tp_base_templates_visibility_check
      CHECK (visibility IS NULL OR visibility IN ('system', 'organization', 'private'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tp_base_templates_visibility
  ON tp_base_templates(visibility);

COMMIT;
