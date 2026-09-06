-- Migration 20260906: migawki raportów Realizacji (zlecenie 1.12-R4, DEC-427)
--
-- KONTEKST (pomiar 06.09.2026, org DBR77):
--   • `report_definitions` (migracja 910) niesie 11 definicji EXECUTION_PACK — katalog
--     „jakie raporty istnieją". Definicje ZOSTAJĄ nietknięte; tłumaczenie idzie po `key`
--     w warstwie prezentacji.
--   • Rejestr runtime-v1 (`report_run`, event-sourced, `reportRun.ts`) jest rejestrem
--     ATESTACJI: trzyma `sources[]` (sourceType/sourceId/version/freshness/confidence),
--     a NIE treść raportu; dodatkowo wymaga DWÓCH aktorów (owner ≠ approver) do
--     opublikowania. Nie da się w nim zapisać migawki z sekcjami, tabelą decyzji po
--     terminie i RAG per inicjatywa — dlatego treść migawki mieszka tutaj.
--   • Ta tabela jest addytywna: nic nie usuwa, nic nie zmienia, `CREATE TABLE IF NOT EXISTS`.
--
-- MODEL: jeden wiersz = jedna zamrożona migawka („co wiedzieliśmy na dzień X") dla jednego
-- audytorium. `payload` trzyma sekcje wyliczone z realnych danych organizacji
-- (/api/tasks, /api/decisions, /api/raid, /api/initiatives, /api/execution-control/delay-signals).

CREATE TABLE IF NOT EXISTS execution_report_snapshots (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  definition_key  TEXT NOT NULL,
  level           TEXT NOT NULL,
  title           TEXT NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  as_of           TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  rag             TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_execution_report_snapshots_org
  ON execution_report_snapshots(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_report_snapshots_definition
  ON execution_report_snapshots(organization_id, definition_key);

-- Dwunasta definicja katalogu: poziom „właściciel inicjatywy". Pomiar wykazał, że wśród
-- 11 definicji z migracji 910 NIE MA definicji dla najniższego poziomu raportowania
-- (C3 planu 1.12 opisuje „Kartę realizacji", ale w bazie jej nie było — najbliższy kod
-- `WorkIntelligenceReport` stoi za flagą i czyta pustą rurę runtime-v1). Bez niej nie da
-- się dać „po jednym raporcie na poziom" (DECYZJA CTO, pytanie 4 z C5).
-- Treść zostaje po angielsku spójnie z 910 — ekran tłumaczy po `key`, nie po treści.
INSERT INTO report_definitions
  (id, organization_id, key, name, kind, audience, cadence, scope, read_mode, sections_json, source_binding, is_system)
VALUES
  ('initiative-card', NULL, 'initiative-card', 'Initiative Delivery Card', 'EXECUTION_PACK',
   'Initiative Owner', 'Weekly', 'One initiative in delivery — owner view', 'live',
   '["Progress and schedule","Milestones","Overdue tasks","Blockers","Decisions I owe"]'::jsonb,
   '{"dataSources":["Tasks","Milestones","RAID","Decisions","Delay signals"],"ragLogic":"GREEN if no overdue tasks and no open blockers; AMBER if overdue tasks >0; RED if blockers >0 or schedule deviation >14 days","followUpActions":["Clear blockers","Close overdue tasks","Confirm milestone dates","Answer pending decisions"],"icon":{"name":"ClipboardCheck","className":"text-emerald-500"},"highlights":[{"label":"Overdue","metric":"overdue","variant":"critIfPos"},{"label":"Tasks","metric":"tasks"}]}'::jsonb,
   TRUE)
ON CONFLICT (id) DO NOTHING;
