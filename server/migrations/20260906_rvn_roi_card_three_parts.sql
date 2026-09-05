-- ROI (P7K C) — karta analizy w TRZECH częściach: Założenia → Wyliczenia → Realizacja.
--
-- Źródło prawdy: docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md §4 oraz
-- docs/program/grafika/ROI_METODYKA_WLASCICIELA_20260905.md. Braki zmierzone i
-- wypisane w evidence/p7k-wyniki/KROK_0_MAPOWANIE_SSOT_SCHEMA_DTO.md (sekcja ROI,
-- kolumna „brak"). Ta migracja dokłada WYŁĄCZNIE te braki — jest addytywna:
-- żadnego DROP, żadnego ALTER istniejącej kolumny, żadnej zmiany CHECK-a, który
-- już działa. Każda nowa kolumna jest NULLABLE, więc istniejące wiersze pozostają
-- poprawne, a UI pokazuje dla nich „—", nigdy 0 (SSOT §6).
--
-- Dlaczego pola, a nie wyprowadzanie z tekstu: dziś rekomendacja GO / CONDITIONAL GO
-- / NO-GO żyje wyłącznie jako zdanie w `rvn_roi_calculation_policy.notes` (patrz
-- server/scripts/seed-wyniki-dbr77.ts, `policyNotes`). Czytanie decyzji inwestycyjnej
-- z notatki tekstowej to zgadywanie; SSOT wymaga jej jako wartości.

-- ==========================================
-- 1. rvn_roi_cases — przedmiot, wariant, rekomendacja, problem, zakres
-- ==========================================

-- PRZEDMIOT analizy (kolumna L1 „PRZEDMIOT"): maszyna / robotyzacja / IT /
-- magazyn / linia / digitalizacja (ROI_METODYKA §1). Wolny tekst z listą
-- podpowiedzi po stronie UI, bez CHECK-a — właściciel wymienił przykłady, nie
-- zamknięty słownik, a zamknięcie go tutaj zablokowałoby siódmy przypadek.
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS subject_type TEXT NULL;

-- WARIANT inwestycyjny 0/1/2/3 (ROI_METODYKA §36: Option 0 do nothing /
-- 1 minimalna modernizacja / 2 pełna automatyzacja / 3 outsourcing-leasing-RaaS).
-- ŚWIADOMIE osobno od `rvn_roi_scenarios` (conservative/base/upside) — KROK 0
-- mapowania: „nie mieszać wariantu inwestycyjnego ze scenariuszem ryzyka".
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS option_variant SMALLINT NULL
  CONSTRAINT rvn_roi_cases_option_variant_range CHECK (option_variant IS NULL OR option_variant BETWEEN 0 AND 3);
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS option_variant_label TEXT NULL;

-- REKOMENDACJA decyzji inwestycyjnej (SSOT §4 pkt 2, ROI_METODYKA §42 XIII).
-- Osobna od `rvn_roi_post_investment_reviews.recommendation`, która dotyczy
-- przeglądu PO wdrożeniu — to dwie różne decyzje w dwóch momentach czasu.
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS investment_recommendation TEXT NULL
  CONSTRAINT rvn_roi_cases_investment_recommendation_check
  CHECK (investment_recommendation IS NULL OR investment_recommendation IN ('go','conditional_go','no_go'));
-- Warunek przy CONDITIONAL GO („warunek: potwierdzony wolumen 2 zmian…").
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS recommendation_condition TEXT NULL;

-- ZAŁOŻENIA narracyjne, których dziś nie da się odczytać znikąd (KROK 0:
-- „tytuł + baseline notes nie tworzą pełnego kontraktu").
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS problem_statement TEXT NULL;
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS scope_summary TEXT NULL;
-- Wariant bazowy (BAU) jako NAZWA wariantu odniesienia — `rvn_roi_baselines`
-- ma liczby BAU, nie ma nazwy Option 0 (KROK 0: „dodać nazwę/opis Option 0").
ALTER TABLE rvn_roi_cases ADD COLUMN IF NOT EXISTS bau_option_label TEXT NULL;

-- ==========================================
-- 2. rvn_roi_benefit_lines — klasa korzyści Hard/Avoided/Soft/Strategic
-- ==========================================
-- ROI_METODYKA §33-35. `is_financial` NIE rozróżnia czterech klas (KROK 0);
-- Soft i Strategic są raportowane, a nie monetyzowane, więc klasa musi być
-- własnym polem, a nie wnioskiem z tego, czy kwota jest wypełniona.
ALTER TABLE rvn_roi_benefit_lines ADD COLUMN IF NOT EXISTS benefit_class TEXT NULL
  CONSTRAINT rvn_roi_benefit_lines_benefit_class_check
  CHECK (benefit_class IS NULL OR benefit_class IN ('hard','avoided','soft','strategic'));

-- Łańcuch KPI → pieniądze (ROI_METODYKA §32): jedno zdanie wyprowadzenia
-- korzyści z KPI. Bez niego sekcja „Założenia" musiałaby je zmyślić.
ALTER TABLE rvn_roi_benefit_lines ADD COLUMN IF NOT EXISTS kpi_chain_note TEXT NULL;

-- ==========================================
-- 3. rvn_roi_post_investment_reviews — kamień milowy 3/6/12 miesięcy
-- ==========================================
-- ROI_METODYKA §44 / SSOT §4 pkt 3. PIR ma dziś `sequence_number`, które mówi
-- „który z kolei", a nie „po ilu miesiącach" — a właściciel pyta o drugie.
ALTER TABLE rvn_roi_post_investment_reviews ADD COLUMN IF NOT EXISTS milestone_months SMALLINT NULL
  CONSTRAINT rvn_roi_pir_milestone_months_check
  CHECK (milestone_months IS NULL OR milestone_months IN (3,6,12));
-- ROI po realizacji — przeliczone wskaźniki przeglądu (SSOT §4 pkt 3
-- „ROI po realizacji"). Nullable: dopóki nie policzone, UI pokazuje „—".
ALTER TABLE rvn_roi_post_investment_reviews ADD COLUMN IF NOT EXISTS realized_roi_pct NUMERIC NULL;
ALTER TABLE rvn_roi_post_investment_reviews ADD COLUMN IF NOT EXISTS realized_npv NUMERIC NULL;
ALTER TABLE rvn_roi_post_investment_reviews ADD COLUMN IF NOT EXISTS realized_payback_periods NUMERIC NULL;

-- ==========================================
-- 4. rvn_roi_assumption_outcomes — „prawdziwość założeń" per założenie
-- ==========================================
-- SSOT §4 pkt 3: „opis prawdziwości założeń". PIR ma dziś `outcome`/`lessons_learned`
-- dla CAŁEGO przeglądu; właściciel prosi o werdykt per założenie
-- („popyt: potwierdzone · redukcja FTE: częściowo · ramp-up: obalone").
CREATE TABLE IF NOT EXISTS rvn_roi_assumption_outcomes (
  outcome_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id  TEXT NOT NULL,
  -- PIR, w ramach którego oceniono założenie. Nullable, bo ocena bywa
  -- zapisana zanim przegląd zostanie formalnie założony.
  pir_id           UUID NULL REFERENCES rvn_roi_post_investment_reviews(pir_id),
  assumption_id    UUID NOT NULL REFERENCES rvn_roi_assumptions(assumption_id),

  verdict          TEXT NOT NULL
                     CHECK (verdict IN ('confirmed','partially_confirmed','refuted')),
  note             TEXT NULL,
  evidence_ref     TEXT NULL,

  row_version      INT NOT NULL DEFAULT 1,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jedno założenie ma jedną ocenę w ramach jednego przeglądu. `pir_id` bywa NULL,
-- a NULL nie jest równy NULL w UNIQUE, więc drugi indeks pilnuje wariantu bez PIR.
CREATE UNIQUE INDEX IF NOT EXISTS rvn_roi_assumption_outcomes_uq
  ON rvn_roi_assumption_outcomes (assumption_id, pir_id)
  WHERE pir_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rvn_roi_assumption_outcomes_uq_nopir
  ON rvn_roi_assumption_outcomes (assumption_id)
  WHERE pir_id IS NULL;
CREATE INDEX IF NOT EXISTS rvn_roi_assumption_outcomes_case_idx
  ON rvn_roi_assumption_outcomes (organization_id, case_id);

-- ==========================================
-- 5. rvn_roi_risks — rejestr ryzyk analizy z mitygacjami
-- ==========================================
-- ROI_METODYKA §30 wymienia osiem rodzin ryzyka „z mitygacjami"; SSOT §4 pkt 1
-- kończy listę Założeń słowem „ryzyka". W schemacie nie ma dziś ŻADNEGO miejsca
-- na ryzyko analizy inwestycyjnej (sprawdzone: `rvn_roi_*` nie ma takiej tabeli),
-- więc sekcja Założeń musiałaby albo je zmyślić, albo świecić pustką.
CREATE TABLE IF NOT EXISTS rvn_roi_risks (
  risk_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id  TEXT NOT NULL,

  -- Rodzina ryzyka wg §30 — CHECK celowo OTWARTY (TEXT bez listy): właściciel
  -- wymienił osiem przykładów, nie zamknięty słownik.
  category         TEXT NOT NULL,
  label            TEXT NOT NULL,
  description      TEXT NULL,
  likelihood       TEXT NULL CHECK (likelihood IS NULL OR likelihood IN ('low','medium','high')),
  impact           TEXT NULL CHECK (impact IS NULL OR impact IN ('low','medium','high')),
  mitigation       TEXT NULL,
  owner_user_id    TEXT NULL,

  deleted_at       TIMESTAMPTZ NULL,
  deleted_by       TEXT NULL,
  row_version      INT NOT NULL DEFAULT 1,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rvn_roi_risks_case_idx
  ON rvn_roi_risks (organization_id, case_id)
  WHERE deleted_at IS NULL;
