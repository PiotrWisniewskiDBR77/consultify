-- ============================================================================
-- 20260624_initiative_column_dedup.sql
-- Uspójnienie F5.4 — konsolidacja zduplikowanych kolumn tabeli `initiatives`
-- ----------------------------------------------------------------------------
-- SoT: docs/initiatives/INITIATIVE_DATA_MODEL_SOT.md (kanon zatwierdzony F5.3)
--
-- CEL: bezpieczny, idempotentny backfill konsolidujący semantyczne duplikaty
--      do kolumny kanonicznej, w trybie READ-COMPAT (okres przejściowy).
--      W tym oknie OBA pola (kanon i deprecated) niosą tę samą wartość, więc
--      stary kod czytający kolumnę deprecated nie zobaczy NULL.
--
-- ZAKRES (wg SoT §5, §7):
--   axis        (kanon)  <->  drd_axis      (deprecated)
--   area        (kanon)  <->  drd_area      (deprecated)
--   expected_roi(kanon)  <->  estimated_roi (deprecated)
--
-- CZEGO TA MIGRACJA NIE ROBI:
--   * NIE robi DROP COLUMN. Drop kolumn deprecated = OSOBNA migracja F5.4,
--     dozwolona dopiero po grep-potwierdzeniu 0 czytelników w kodzie/SQL.
--   * NIE zmienia constraintów ani typów.
--
-- BEZPIECZEŃSTWO:
--   * Każdy blok strażowany IF EXISTS na obu kolumnach — kolumny deprecated
--     mogły nie powstać na każdym środowisku (dołożone późniejszą migracją).
--   * COALESCE wypełnia tylko NULL-e — istniejące wartości kanonu nietknięte.
--   * Idempotentne: ponowne uruchomienie nie zmienia już skonsolidowanych wierszy.
--   * Transakcyjne (BEGIN/COMMIT) — albo cała konsolidacja, albo nic.
--   * STAGING-FIRST: uruchom i zweryfikuj na staging (caboose) przed prod.
--
-- WERYFIKACJA OBECNOŚCI KOLUMN (grep server/migrations, 2026-06-24):
--   drd_axis      — ISTNIEJE (20260303_schema_alignment.sql:326 ADD COLUMN)
--   drd_area      — ISTNIEJE (20260303_schema_alignment.sql:333 ADD COLUMN)
--   estimated_roi — ISTNIEJE (011_initiative_generator.sql.sql:31,
--                             20260603_initiative_generator_catchup.sql:35 ADD COLUMN)
--   -> wszystkie trzy backfillowane poniżej (strażowane na wypadek braku na env).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. AXIS  (kanon: axis  <-  drd_axis)   — SoT §7
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'axis'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'drd_axis'
    ) THEN
        -- kanon <- deprecated
        UPDATE initiatives
           SET axis = COALESCE(axis, drd_axis)
         WHERE axis IS NULL AND drd_axis IS NOT NULL;
        -- lustro deprecated <- kanon (read-compat na czas okresu przejściowego)
        UPDATE initiatives
           SET drd_axis = COALESCE(drd_axis, axis)
         WHERE drd_axis IS NULL AND axis IS NOT NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. AREA  (kanon: area  <-  drd_area)   — SoT §7
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'area'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'drd_area'
    ) THEN
        UPDATE initiatives
           SET area = COALESCE(area, drd_area)
         WHERE area IS NULL AND drd_area IS NOT NULL;
        UPDATE initiatives
           SET drd_area = COALESCE(drd_area, area)
         WHERE drd_area IS NULL AND area IS NOT NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. ROI  (kanon: expected_roi  <-  estimated_roi)   — SoT §5
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    expected_roi_type TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'expected_roi'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'estimated_roi'
    ) THEN
        SELECT data_type INTO expected_roi_type
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'initiatives'
           AND column_name = 'expected_roi';
        -- Strict-schema repair (2026-08): `expected_roi` was later changed
        -- TEXT by 903_expected_roi_to_text.sql (an earlier, plain-numbered
        -- migration this file's own header did not anticipate — it was
        -- written when both columns were still numeric); `estimated_roi`
        -- stayed REAL/numeric. A bare COALESCE(expected_roi, estimated_roi)
        -- can't match text with real. real->text is always safe (explicit
        -- cast below). text->real is only safe for numeric-looking values,
        -- so the mirror direction is scoped to rows where expected_roi is
        -- actually numeric, leaving free-text values in expected_roi alone
        -- (no behavior change for those rows; they simply don't mirror back
        -- into the deprecated numeric column, same as before this file
        -- could run at all).
        IF expected_roi_type IN ('text', 'character varying', 'character') THEN
            UPDATE initiatives
               SET expected_roi = COALESCE(expected_roi, estimated_roi::text)
             WHERE expected_roi IS NULL AND estimated_roi IS NOT NULL;
            UPDATE initiatives
               SET estimated_roi = COALESCE(estimated_roi, expected_roi::real)
             WHERE estimated_roi IS NULL
               AND expected_roi IS NOT NULL
               AND expected_roi ~ '^-?[0-9]+(\.[0-9]+)?$';
        ELSE
            UPDATE initiatives
               SET expected_roi = COALESCE(expected_roi, estimated_roi)
             WHERE expected_roi IS NULL AND estimated_roi IS NOT NULL;
            UPDATE initiatives
               SET estimated_roi = COALESCE(estimated_roi, expected_roi)
             WHERE estimated_roi IS NULL AND expected_roi IS NOT NULL;
        END IF;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- NASTĘPNY KROK (NIE w tej migracji):
--   F5.4-drop — ALTER TABLE initiatives DROP COLUMN drd_axis, drd_area,
--   estimated_roi — dopuszczalny dopiero po:
--     (a) przełączeniu wszystkich SELECT/INSERT/UPDATE na kanon (lejek F1.x),
--     (b) grep server/ + scripts/ + tests/ = 0 czytelników kolumn deprecated,
--     (c) zweryfikowanym backfillu na staging i prod.
-- ============================================================================
