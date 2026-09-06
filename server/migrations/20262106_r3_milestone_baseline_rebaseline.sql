-- R3 (plan 1.12 Realizacja, §C4) — KAMIENIE MILOWE I BASELINE.
--
-- POMIAR, który wymusił tę migrację (06.09, baza stanowiska, org DBR77):
--   · `initiative_milestones` ISTNIEJE i ma 16 rekordów, ale tylko DWIE daty:
--     `target_date` (aktualna) i `actual_date` (fakt). TRZECIEJ — planowanej
--     ZAMROŻONEJ — nie ma nigdzie, więc każde przesunięcie terminu kasowało
--     opóźnienie bez śladu.
--   · `initiative_schedule_baselines` istnieje, ale ma 0 rekordów, a
--     `initiatives.baseline_version` = 0 na WSZYSTKICH inicjatywach — czyli
--     mechanizm zamrażania planu nigdy nie ruszył. Nie da się na nim oprzeć
--     kolumny „Odchylenie (dni)", bo dla całego portfela zwróciłby NULL.
--   · kolumna „Odchylenie (dni)" liczyła `dziś − planowany koniec`, czyli dni
--     POZOSTAŁE do końca AKTUALNEGO planu (stąd −55 / −90 obok RAG „Na czas").
--
-- Ta migracja dokłada baseline JAKO WŁASNE KOLUMNY (nie snapshot JSON), bo
-- kolumna tabeli musi go czytać jednym SELECT-em razem z wierszem inicjatywy.
-- Wszystko addytywne: żadna zastana kolumna ani migracja nie jest ruszana.

-- ── 1. Kamień milowy: trzecia data (planowana ZAMROŻONA) ──────────────────
ALTER TABLE initiative_milestones ADD COLUMN IF NOT EXISTS baseline_date DATE;
ALTER TABLE initiative_milestones ADD COLUMN IF NOT EXISTS baseline_version INTEGER DEFAULT 1;
ALTER TABLE initiative_milestones ADD COLUMN IF NOT EXISTS baseline_set_at TIMESTAMPTZ;
-- Licznik PRZESUNIĘĆ daty (nie liczba re-baseline'ów): reguła brzmi „pierwsze
-- przesunięcie wolno wprost, drugie i każde kolejne przez decyzję".
ALTER TABLE initiative_milestones ADD COLUMN IF NOT EXISTS schedule_shift_count INTEGER DEFAULT 0;

-- ── 2. Inicjatywa: baseline startu i końca ────────────────────────────────
-- `planned_start_date`/`planned_end_date` są tu TEXT (ISO) — baseline trzyma
-- ten sam typ, żeby porównanie nie przechodziło przez rzutowanie.
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS baseline_start_date TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS baseline_end_date TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS baseline_set_at TIMESTAMPTZ;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS schedule_shift_count INTEGER DEFAULT 0;

-- ── 3. Ślad decyzji „re-baseline" (z zatwierdzającym) ─────────────────────
-- Bez tej tabeli „decyzja z zatwierdzającym" byłaby słowem w interfejsie.
-- Każde przesunięcie od DRUGIEGO wzwyż zostawia tu wiersz albo nie dochodzi
-- do skutku (serwer odmawia kodem REBASELINE_DECISION_REQUIRED).
CREATE TABLE IF NOT EXISTS initiative_rebaseline_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    -- NULL = przesunięcie na poziomie inicjatywy; wypełnione = kamień milowy.
    milestone_id TEXT,
    shift_index INTEGER NOT NULL,
    previous_date TEXT,
    new_date TEXT,
    previous_baseline_date TEXT,
    new_baseline_date TEXT,
    baseline_reset INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    decision_id TEXT,
    approved_by TEXT NOT NULL,
    requested_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rebaseline_log_org
    ON initiative_rebaseline_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_rebaseline_log_initiative
    ON initiative_rebaseline_log(initiative_id);
CREATE INDEX IF NOT EXISTS idx_rebaseline_log_milestone
    ON initiative_rebaseline_log(milestone_id);

-- ── 4. Zamrożenie planu ZASTANEGO jako baseline v1 ────────────────────────
-- Bez tego kolumna „Odchylenie (dni)" pokazałaby „—" dla całego portfela
-- (baseline pusty), czyli zamieniłaby złą liczbę na brak liczby. Zamrażamy
-- DZISIEJSZY plan jako pierwsze zobowiązanie — od tego momentu każde
-- przesunięcie daty jest widoczne jako dodatnie odchylenie.
UPDATE initiative_milestones
   SET baseline_date = target_date,
       baseline_set_at = COALESCE(baseline_set_at, CURRENT_TIMESTAMP)
 WHERE baseline_date IS NULL AND target_date IS NOT NULL;

UPDATE initiatives
   SET baseline_start_date = planned_start_date,
       baseline_end_date = planned_end_date,
       baseline_set_at = COALESCE(baseline_set_at, CURRENT_TIMESTAMP)
 WHERE baseline_end_date IS NULL AND planned_end_date IS NOT NULL;
