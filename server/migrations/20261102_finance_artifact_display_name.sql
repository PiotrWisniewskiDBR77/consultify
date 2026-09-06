-- ---------------------------------------------------------------------------
-- Finanse — NAZWA WYŚWIETLANA artefaktu kanonicznego (addytywna, jedna kolumna).
--
-- ★ POWÓD (audyt FIN 2026-09-06, evidence/audyt-mvp-20260906/FIN/RAPORT_FIN.md
-- defekt #3, zrzuty 03e-canonical-direct.png i 06-analiza-karta.png): nagłówek
-- karty pakietu pokazywał "seed:finance-cdprojekt-2025:cc9db573-…:GRUPA_KAPITALOWA_CD_PROJEKT",
-- a karta analizy "derived-analysis:script:4db71c39-…". To jest `natural_key` —
-- klucz idempotencji seedów i backfillu, a NIE nazwa dla człowieka. Do dziś kod
-- używał go w podwójnej roli (klucz + tytuł), więc każdy artefakt założony
-- deterministycznie musiał pokazywać ciąg maszynowy.
--
-- Ta migracja rozdziela te dwie role: `natural_key` zostaje kluczem (unikalnym,
-- stabilnym, nietykalnym), `display_name` niesie nazwę, którą widzi właściciel.
-- NULL = "brak własnej nazwy" → warstwa prezentacji cofa się do dotychczasowego
-- zachowania (natural_key, o ile nie jest techniczny), więc migracja jest w 100%
-- wstecznie zgodna i nie wymaga backfillu.
--
-- Addytywna: jedna kolumna nullable, zero DROP, zero zmian istniejących wierszy.
-- ---------------------------------------------------------------------------

ALTER TABLE finance_artifacts
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN finance_artifacts.display_name IS
  'Nazwa artefaktu widoczna dla użytkownika. NULL = brak własnej nazwy (prezentacja cofa się do natural_key, jeśli nie jest techniczny). natural_key pozostaje kluczem idempotencji, nie tytułem.';
