-- P7K część A (OKR) — pola raportu OKR wymagane przez SSOT właściciela.
--
-- ŹRÓDŁO WYMAGANIA
--   docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md §3 („Kolumny raportu
--   OKR: TEMAT · CEL … · ZESPÓŁ … · TERMIN …”), potwierdzone w
--   docs/program/grafika/WYNIKI_ZALOZENIA_GRAFICZNE_20260905.md §3
--   („Podgląd: opis i cel raportu (z załącznika: »Description«, »Goal«)”).
--   Mapowanie „jest / brak” zrobione PRZED kodem:
--   evidence/p7k-wyniki/KROK_0_MAPOWANIE_SSOT_SCHEMA_DTO.md, tabela „OKR —
--   raport, cel i rezultat”: cztery pozycje mają wprost status „brak”
--   (opis i cel raportu, temat, zespół, termin per rezultat).
--
-- DLACZEGO NOWE KOLUMNY, A NIE WYPROWADZENIE Z ISTNIEJĄCYCH
--   · TEMAT nie jest `description` celu (opis to zdanie „dlaczego teraz”,
--     temat to nagłówek grupy w raporcie — grupowanie po opisie dałoby
--     jedną grupę na cel, czyli zero grupowania).
--   · ZESPÓŁ nie jest `scope_id` zestawu (zestaw ma JEDEN zakres, a rezultaty
--     w jednym zestawie należą do różnych zespołów — dokładnie to pokazuje
--     wzorzec właściciela „OKR Planning (Q4)”).
--   · TERMIN rezultatu nie jest końcem cyklu (cykl jest wspólny dla całego
--     zestawu; wzorzec właściciela ma kolumnę Deadline PER rezultat).
--   Wyprowadzanie ich z powyższych byłoby fabrykowaniem danych, których
--   system nie ma — dlatego kolumny są NULLable i UI pokazuje „—”, dopóki
--   ktoś ich nie wypełni.
--
-- ADDYTYWNOŚĆ I KOLEJNOŚĆ NA ŚWIEŻEJ BAZIE
--   Wyłącznie `ADD COLUMN IF NOT EXISTS` na trzech tabelach założonych przez
--   `20260823_rvn_okr_set.sql` i `20260824_rvn_okr_objective_key_result.sql`.
--   Obie sortują się alfabetycznie PRZED tym plikiem, więc odtworzenie bazy
--   od zera nie wywraca się na braku tabeli (lekcja
--   „Migracja przyrostowa nie jest dowodem”). Zero backfillu, zero zmian
--   istniejących wierszy, zero NOT NULL — cofnięcie = DROP COLUMN.

BEGIN;

-- Nagłówek raportu OKR (poziom 1 podgląd + poziom 2 nagłówek).
ALTER TABLE okr_vnext_sets
  ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE okr_vnext_sets
  ADD COLUMN IF NOT EXISTS report_goal TEXT;

COMMENT ON COLUMN okr_vnext_sets.description IS
  'P7K: opis raportu OKR (pole „Description” ze wzorca właściciela). NULL = brak, UI pokazuje „—”.';
COMMENT ON COLUMN okr_vnext_sets.report_goal IS
  'P7K: cel raportu OKR (pole „Goal” ze wzorca właściciela). NULL = brak, UI pokazuje „—”.';

-- Temat celu — oś grupowania tabeli poziomu 2 (TEMAT → CEL).
ALTER TABLE okr_vnext_objectives
  ADD COLUMN IF NOT EXISTS theme TEXT;

COMMENT ON COLUMN okr_vnext_objectives.theme IS
  'P7K: temat celu (kolumna „Theme” ze wzorca właściciela) — nagłówek grupy w raporcie OKR. NULL = cel bez tematu.';

-- Zespół i termin kluczowego rezultatu — kolumny wiersza raportu.
ALTER TABLE okr_vnext_key_results
  ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE okr_vnext_key_results
  ADD COLUMN IF NOT EXISTS deadline DATE;

COMMENT ON COLUMN okr_vnext_key_results.team_name IS
  'P7K: zespół odpowiedzialny za rezultat (kolumna „Team”). Świadomie TEXT, nie FK — organizacja nie ma dziś rejestru zespołów, a udawanie relacji byłoby gorsze niż nazwa.';
COMMENT ON COLUMN okr_vnext_key_results.deadline IS
  'P7K: termin kluczowego rezultatu (kolumna „Deadline”). NULL = brak terminu; koniec cyklu NIE jest tu podstawiany.';

COMMIT;
