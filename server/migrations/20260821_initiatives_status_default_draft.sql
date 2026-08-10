-- ============================================================================
-- Migration: 20260821_initiatives_status_default_draft.sql
-- CLOSEOUT-CO2 — usunięcie sprzeczności `initiatives.status`:
--   kolumna miała DEFAULT 'step3', a CHECK `initiatives_status_check` tej
--   wartości NIE dopuszcza. Skutek: KAŻDY `INSERT INTO initiatives (...)`
--   bez jawnego `status` kończył się naruszeniem constraintu.
-- ----------------------------------------------------------------------------
-- DIAGNOZA (fakty, nie domysły):
--
--   Źródło DEFAULT-u ('step3'):
--     * server/migrations/000_z_core_baseline.sql:226  (CREATE TABLE)
--     * server/migrations/000_z_core_baseline.sql:264  (ADD COLUMN IF NOT EXISTS)
--     * server/migrations/000_initdb_core_tables.sql:481 — NIE dotyczy Postgresa:
--       runner (`server/scripts/migrate.postgres.ts`, `isSqliteOnlyMigration`)
--       wyklucza wszystkie pliki `000_initdb_*`.
--     * server/src/database/PostgresDatabase.ts:2526 — runtime DDL initDb().
--
--   Źródło CHECK-a (13 wartości kanonicznych, bez 'step3'):
--     * server/migrations/20260624_initiative_status_normalize.sql (krok 3)
--     * server/migrations/20260802_mvp_core_schema_parity.sql
--
-- ----------------------------------------------------------------------------
-- WYBÓR NAPRAWY: (a) DEFAULT → 'DRAFT'.  NIE (b) rozszerzanie CHECK o 'step3'.
--
-- 'step3' jest SIEROTĄ, nie realnym statusem inicjatywy — dowód z kodu:
--
--   1. SSOT enumu `InitiativeStatus`
--      (server/src/constants/initiativeStatuses.ts) wymienia 13 wartości
--      UPPERCASE; 'step3' NIE występuje. Udokumentowany stan wejściowy cyklu
--      życia to DRAFT ("DRAFT → REVIEW → PROMOTED → ... → TRACKING").
--
--   2. Jedyny produkcyjny zapis inicjatywy —
--      server/src/services/initiative/InitiativeDefinitionService.ts:168 —
--      brzmi `push('status', data.status || 'DRAFT')` z komentarzem
--      "Uspójnienie F1.11 — 'step3' (legacy, nieprawidłowy) → DRAFT".
--      Aplikacja NIGDY nie polega na DEFAULT-cie kolumny i nigdy nie zapisuje
--      'step3'.
--
--   3. Migracja 20260624 nazywa 'step3' wprost "znanym śmieciowym" statusem
--      i backfilluje go do 'DRAFT' (krok 1), po czym zakłada CHECK.
--      20260802_mvp_core_schema_parity.sql mapuje każdą niekanoniczną wartość
--      → 'DRAFT'. Intencja produktu jest więc już dwukrotnie zapisana w
--      migracjach; brakowało wyłącznie poprawienia samego DEFAULT-u.
--
--   4. Pozostałe wystąpienia "step3" w `src/` to `step3Completed` (flagi
--      kreatora sesji) oraz klucze i18n — inna domena, nie status inicjatywy.
--
--   Wniosek: wariant (b) zabetonowałby śmieć w kanonicznym słowniku statusów
--   i rozjechał bazę z enumem SSOT. Wariant (a) przywraca spójność
--   DEFAULT ⊆ CHECK i jest zgodny z tym, co kod i tak robi.
--
-- ----------------------------------------------------------------------------
-- DANE ISTNIEJĄCE — decyzja: PRZEMAPOWAĆ, nie kasować.
--   Wiersze ze statusem 'step3' (dowolna wielkość liter) są przepisywane na
--   'DRAFT'. Uzasadnienie: 'step3' nie niesie ŻADNEJ informacji domenowej —
--   powstawał wyłącznie jako artefakt DEFAULT-u kolumny — a obie wcześniejsze
--   migracje (20260624 krok 1, 20260802) podjęły dokładnie tę samą decyzję.
--   Żaden wiersz nie jest usuwany, żadna inna kolumna nie jest dotykana,
--   statusy spoza 'step3' pozostają nietknięte.
--   W praktyce na bazach, które przeszły 20260624/20260802, ten UPDATE jest
--   no-opem (CHECK już by takich wierszy nie przepuścił); trzymamy go dla baz
--   w stanie pośrednim oraz dla tabel utworzonych runtime'owym DDL initDb().
--
-- IDEMPOTENCJA / BEZPIECZEŃSTWO:
--   - `SET DEFAULT` jest z natury idempotentny (powtórzenie = ten sam stan).
--   - Wszystko pod strażą istnienia tabeli i kolumny (`to_regclass`,
--     `information_schema.columns`) — plik jest no-opem tam, gdzie nie ma
--     czego naprawiać.
--   - Addytywna: zero DROP, zero DELETE, zero zmian typu kolumny.
--   - CHECK-a celowo NIE ruszamy: istnieje już w każdej bazie po
--     20260624/20260802, a zakładanie go tutaj wymagałoby przepisania także
--     innych niekanonicznych statusów — to wykracza poza zakres tej naprawy.
-- ============================================================================

BEGIN;

DO $co2$
BEGIN
  IF to_regclass('public.initiatives') IS NULL THEN
    RAISE NOTICE 'CLOSEOUT-CO2: tabela initiatives nie istnieje — pomijam.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'initiatives'
      AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'CLOSEOUT-CO2: kolumna initiatives.status nie istnieje — pomijam.';
    RETURN;
  END IF;

  -- KROK 1: przemapowanie osieroconej wartości 'step3' -> 'DRAFT'.
  -- Musi wykonać się PRZED zmianą DEFAULT-u, żeby po migracji w tabeli nie
  -- został ani jeden wiersz z wartością niedopuszczaną przez CHECK.
  UPDATE initiatives
  SET status = 'DRAFT'
  WHERE status IS NOT NULL
    AND UPPER(status) = 'STEP3';

  -- KROK 2: właściwa naprawa — DEFAULT zgodny z initiatives_status_check
  -- oraz z enumem InitiativeStatus (server/src/constants/initiativeStatuses.ts).
  ALTER TABLE initiatives ALTER COLUMN status SET DEFAULT 'DRAFT';
END
$co2$;

COMMIT;
