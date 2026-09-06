-- Naprawa CHECK `v8_artifact_origin_links_origin_runtime_check` po tym, jak
-- `20260412_seed_business_templates.sql` ZAWEZI go z powrotem do 7 wartosci.
--
-- ============================ DLACZEGO TEN PLIK ISTNIEJE ====================
-- W repo dzialaja DWA runnery migracji o ROZNYCH zbiorach plikow:
--
--   1) STRICT / manualny  — `server/scripts/migrate.postgres.ts`
--      (ksiega `schema_migrations`). Jego polityka
--      `isSqliteOnlyMigration()` / `isExecutableMigration()`
--      (server/src/services/releaseGate/migrationExecutionPolicy.ts:43)
--      WYKLUCZA na stale kazdy plik, ktorego nazwa zawiera `seed`/`mock`/`demo`.
--      => `20260412_seed_business_templates.sql` NIGDY tam nie leci.
--
--   2) RUNTIME / bootowy  — `server/src/services/tablePlatform/migrationRunner.ts`
--      (ksiega `tp_migration_history`), uruchamiany przy KAZDYM starcie serwera
--      przez `establishDatabaseReadiness`. Jego predykat to
--      `MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/` — BEZ wyjatku na `seed`.
--      => `20260412_seed_business_templates.sql` leci TUTAJ.
--
-- Skutek na SWIEZEJ bazie (deploy = najpierw strict, potem boot serwera):
--   * strict konczy lancuch z CHECK = 9 wartosci (ostatnia definicja pochodzi
--     z `20260808_assessment_report_origin_runtime.sql`),
--   * boot reconciluje ksiege TP ze `schema_migrations` i dokłada 10 plikow,
--     ktorych strict nie zna — w tym `20260412_...`, ktory robi
--     DROP CONSTRAINT + ADD CONSTRAINT z ZAWEZONA lista 7 wartosci,
--   * baza konczy start bez `document_template` i bez `assessment_report`,
--     mimo ze runtime je zapisuje:
--       - server/src/routes/document-studio.routes.ts:1423 (document_template)
--       - server/src/services/assessment/AssessmentWorkbenchService.ts:1322
--         (assessment_report)
--
-- ============================ DLACZEGO NAZWA ZAWIERA `seed` =================
-- To jest CELOWE, nie przypadek. Plik musi wykonac sie PO `20260412_...`
-- w tym runnerze, ktory `20260412_...` faktycznie odpala (TP/bootowy).
-- Gdyby nazwa NIE zawierala `seed`, strict wykonalby ten plik, wpisal go do
-- `schema_migrations`, a `reconcileTablePlatformLedgerFromCanonical()`
-- oznaczylby go w `tp_migration_history` jako juz zastosowany — wiec podczas
-- bootu runner TP by go POMINAL i `20260412_...` (sortowany wczesniej:
-- `compareMigrationFilenames` porownuje prefiksy '20260412' < '20262105')
-- zawezilby CHECK jako ostatni. Naprawa nie zadzialalaby.
-- Z `seed` w nazwie plik jest niewidoczny dla stricta (i dla bramki
-- `evaluateSqlChain`, ktora liczy "pending" tym samym predykatem), zostaje
-- w TP jako pending i wykonuje sie PO `20260412_...`. Zmierzone, nie zalozone.
--
-- Prefiks daty >= 20262105: najpozniejsza data w `server/migrations` to
-- `20262104_execution_report_snapshots.sql`; wczesniejsza data wstawilaby plik
-- w srodek lancucha stricta.
--
-- ============================ CO TEN PLIK ROBI =============================
-- Przywraca dokladnie zbior 9 wartosci z `20260808_assessment_report_origin_runtime.sql`
-- (kanoniczna, najpozniejsza definicja na sciezce strict). `work_canvas`
-- CELOWO nie wraca: `20260808` usunal go swiadomie, a walidator odrzuca
-- originRuntime='work_canvas' (server/src/routes/work-canvas.routes.ts:4557).
--
-- ADDYTYWNA i IDEMPOTENTNA: DROP IF EXISTS + ADD, bezpieczna na bazie, gdzie
-- CHECK jest juz poprawny, i na bazie bez tabeli (guard ponizej).
-- ZASTANE MIGRACJE NIETKNIETE.

DO $$
BEGIN
  IF to_regclass('public.v8_artifact_origin_links') IS NULL THEN
    RAISE NOTICE '[20262105] v8_artifact_origin_links nie istnieje — pomijam';
    RETURN;
  END IF;

  ALTER TABLE v8_artifact_origin_links
    DROP CONSTRAINT IF EXISTS v8_artifact_origin_links_origin_runtime_check;

  ALTER TABLE v8_artifact_origin_links
    ADD CONSTRAINT v8_artifact_origin_links_origin_runtime_check
    CHECK (
      origin_runtime IN (
        'report',
        'presentation',
        'sheet',
        'native_artifact',
        'assessment_report',
        'report_template',
        'presentation_template',
        'sheet_template',
        'document_template'
      )
    );
END $$;
