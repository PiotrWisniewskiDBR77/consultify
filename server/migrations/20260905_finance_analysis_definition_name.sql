-- F-P4 (PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md §F-P4 §4 pkt 1,
-- §5 krok 3) — nazwa własna analizy.
--
-- Powód: `finance_analysis_definitions` (20260809_finance_v3_d03_analysis_01_tables.sql) nie ma
-- ŻADNEJ kolumny na nazwę, a jedyne miejsce, gdzie dziś mieszka nazwa artefaktu finansowego, to
-- `finance_artifacts.natural_key` — którego trasa `POST /versions/:id/derived-analysis` używa jako
-- klucza idempotencji (`derived-analysis:<sha256(Idempotency-Key)>`, lineage-navigator.routes.ts).
-- Wpisanie tam nazwy użytkownika zepsułoby wyszukiwanie powtórki (replay) i unikalny indeks
-- `uq_finance_artifacts_org_natural_key`. Dlatego nazwa dostaje własną kolumnę w tabeli definicji.
--
-- Addytywna, wyłącznie NOWY plik migracji (bramka release-gate odrzuca edycję istniejących).
-- Kolumna jest NULLABLE — istniejące wiersze (na stagingu: 0) pozostają poprawne bez backfillu.

BEGIN;

ALTER TABLE finance_analysis_definitions
  ADD COLUMN IF NOT EXISTS analysis_name TEXT;

COMMENT ON COLUMN finance_analysis_definitions.analysis_name IS
  'Nazwa własna analizy nadana przez użytkownika (F-P4). System proponuje, użytkownik zmienia. NULL = nazwa domyślna wyliczana w UI.';

COMMIT;
