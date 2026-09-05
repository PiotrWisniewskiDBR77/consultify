-- P7K / Wyniki → KPI: elementy KONTRAKTU MIERNIKA i nagłówka raportu, których
-- schemat nie miał (SSOT `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md`
-- §2, mapowanie `evidence/p7k-wyniki/KROK_0_MAPOWANIE_SSOT_SCHEMA_DTO.md`).
--
-- Dlaczego to jest potrzebne: raport KPI właściciela („Plant Balanced
-- Scorecard") ma per miernik OBSZAR, WŁAŚCICIELA NADRZĘDNEGO (MD), TYP
-- (rozliczeniowy / informacyjny), BENCHMARK i DOPUSZCZALNY LIMIT [%], a per
-- okres parę CEL / Rezultat. Dziś w schemacie jest wyłącznie Rezultat
-- (`rvn_kpi_measurements.actual_value`); CEL istnieje jako roczna wartość
-- WERSJI DEFINICJI (`target_value`), a nie jako cel konkretnego miesiąca.
-- Progi `warning_*`/`critical_*` są wartościami ABSOLUTNYMI i NIE są
-- procentowym limitem z arkusza — dlatego limit dostaje własną kolumnę,
-- zamiast być z nich przeliczany.
--
-- Seed realnych danych DBR77 (`server/scripts/seed-wyniki-dbr77.ts`, raport
-- `evidence/seed-wyniki-dbr77/RAPORT.md`) położył te elementy tymczasowo
-- w istniejących kolumnach JSONB — `rvn_kpi_scorecard_items.display_config`
-- (`obszar`, `wlascicielNadrzedny`, `typWskaznika`, `benchmark`,
-- `dopuszczalnyLimitPct`) i `rvn_kpi_measurements.evidence_refs[0]`
-- (`{"kind":"seed_period_target","targetValue":…}`). Ta migracja NIE rusza
-- tamtych danych i niczego nie przepisuje: warstwa odczytu bierze najpierw
-- kolumnę, a gdy jest pusta — spada do zapisu seeda (patrz
-- `kpiScorecardRepository.ts`, `resolveItemContract` / matryca okresów).
-- Powód: baza demo/staging jest WSPÓŁDZIELONA i jest twarzą produktu —
-- masowy UPDATE na cudzych wierszach nie jest tu operacją odwracalną.
--
-- Prefiks daty (`2026112x`), NIE numer trzycyfrowy: `compareMigrationFilenames`
-- (`server/src/services/tablePlatform/migrationRunner.ts:228`) sortuje NAJPIERW
-- po DŁUGOŚCI prefiksu, więc plik `964_…` wykonałby się PRZED
-- `20260812_rvn_kpi_scorecards.sql` i na bazie od zera wywrócił się na
-- nieistniejącej tabeli. To jest ta sama pułapka, którą opisuje
-- „migracja przyrostowa nie jest dowodem".
--
-- W CAŁOŚCI ADDYTYWNA: same `ADD COLUMN IF NOT EXISTS` na kolumnach NULLABLE,
-- zero DROP, zero UPDATE, zero zmiany typu. Odtworzenie bazy od zera po tej
-- migracji daje ten sam schemat co przyrost na bazie istniejącej.

-- ── Kontrakt miernika na POZYCJI RAPORTU ────────────────────────────────────
-- Świadomie na pozycji raportu (`rvn_kpi_scorecard_items`), nie na definicji
-- KPI: obszar i właściciel nadrzędny to podział TEGO raportu (ten sam miernik
-- może w raporcie zakładu siedzieć w obszarze „SPRZEDAŻ", a w raporcie
-- jakości w innym), a benchmark i limit są parametrem rozliczenia w tym
-- raporcie. Jedna tożsamość miernika (SSOT §0) zostaje nienaruszona.
ALTER TABLE rvn_kpi_scorecard_items
  ADD COLUMN IF NOT EXISTS area_name TEXT,
  ADD COLUMN IF NOT EXISTS superior_owner_name TEXT,
  ADD COLUMN IF NOT EXISTS indicator_type TEXT,
  ADD COLUMN IF NOT EXISTS benchmark_value NUMERIC,
  ADD COLUMN IF NOT EXISTS limit_percent NUMERIC;

-- Enum ograniczony do wartości SSOT („typ (rozliczeniowy / informacyjny)").
-- NULL zostaje dozwolony — miernik bez zadeklarowanego typu ma w UI „—",
-- nigdy zgadniętą wartość.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rvn_kpi_scorecard_items_indicator_type_chk'
  ) THEN
    ALTER TABLE rvn_kpi_scorecard_items
      ADD CONSTRAINT rvn_kpi_scorecard_items_indicator_type_chk
      CHECK (indicator_type IS NULL OR indicator_type IN ('settlement', 'informational'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rvn_kpi_scorecard_items_limit_percent_chk'
  ) THEN
    ALTER TABLE rvn_kpi_scorecard_items
      ADD CONSTRAINT rvn_kpi_scorecard_items_limit_percent_chk
      CHECK (limit_percent IS NULL OR limit_percent >= 0);
  END IF;
END
$$;

COMMENT ON COLUMN rvn_kpi_scorecard_items.area_name IS
  'Obszar raportu (SSOT §2). Zapis seeda w display_config->>''obszar'' jest fallbackiem odczytu.';
COMMENT ON COLUMN rvn_kpi_scorecard_items.superior_owner_name IS
  'Właściciel nadrzędny (MD) obszaru. NIE wyprowadzany z owner_user_id miernika.';
COMMENT ON COLUMN rvn_kpi_scorecard_items.indicator_type IS
  'settlement = rozliczeniowy, informational = informacyjny (SSOT §2).';
COMMENT ON COLUMN rvn_kpi_scorecard_items.limit_percent IS
  'Dopuszczalny limit [%] z arkusza. NIE jest tym samym co absolutne progi warning_*/critical_* wersji definicji.';

-- ── Nagłówek raportu ────────────────────────────────────────────────────────
-- „nagłówek (zakład, rok, edycja, data rewizji, przygotował)" — zakład jest
-- w `scope_type`/`scope_id`, rok wynika z okresu; edycja, rewizja i osoba
-- przygotowująca nie miały gdzie mieszkać. `prepared_by_user_id` jest ODRĘBNE
-- od `owner_user_id`: właściciel raportu odpowiada za niego dalej, raport za
-- dany rok mógł przygotować kto inny; puste = spada do właściciela.
ALTER TABLE rvn_kpi_scorecards
  ADD COLUMN IF NOT EXISTS edition_label TEXT,
  ADD COLUMN IF NOT EXISTS revision_date DATE,
  ADD COLUMN IF NOT EXISTS prepared_by_user_id TEXT;

-- ── CEL okresu obok Rezultatu okresu ────────────────────────────────────────
-- Para CEL / Rezultat w jednej komórce okresu (SSOT §6) wymaga celu przypiętego
-- do TEGO SAMEGO okresu co wynik. `rvn_kpi_measurements` jest append-only
-- (REVOKE UPDATE, DELETE … FROM PUBLIC w 20260810_rvn_kpi_core.sql), więc cel
-- okresu jest zapisywany razem z pomiarem i tak samo niezmienny — korekta
-- pomiaru tworzy nowy wiersz z własnym celem, zamiast nadpisywać stary.
ALTER TABLE rvn_kpi_measurements
  ADD COLUMN IF NOT EXISTS period_target_value NUMERIC;

COMMENT ON COLUMN rvn_kpi_measurements.period_target_value IS
  'CEL dla TEGO okresu (SSOT §2). Fallback odczytu: evidence_refs[0] z kind=seed_period_target.';
