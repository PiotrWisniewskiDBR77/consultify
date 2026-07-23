-- P0-1 (docs/standards/idea-workspace/12_BACKLOG_I_ODBIOR.md) — historia konwersji Idei.
-- SSOT modelu docelowego: docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md §2.3.
--
-- Defekt naprawiany: POST /api/my-work/my-ideas/:id/convert (server/src/routes/my-work.routes.ts,
-- funkcja promote()) nadpisywał my_ideas.promoted_to/promoted_entity_id/stage BEZWARUNKOWO,
-- nawet gdy konwertowano tylko fragment (zaznaczenie/węzeł/gałąź) — druga konwersja kasowała
-- ślad pierwszej, a `stage` przeskakiwał na 'promoted' mimo że reszta Idei zostawała aktywna.
--
-- Ta migracja jest ADDYTYWNA: nowa tabela, zero ALTER na my_ideas, zero DROP, zero NOT NULL
-- na istniejących wierszach. `my_ideas.promoted_to`/`promoted_entity_id`/`stage` zostają
-- nietknięte dla zgodności wstecznej — po tej migracji serwis ustawia je TYLKO przy konwersji
-- całej Idei (scope='workspace'); przy konwersji fragmentu dostaje wpis WYŁĄCZNIE tutaj.
--
-- Użyj TEXT JSON (nie JSONB) — konwencja tego sąsiedztwa (my_idea_maps.nodes_json,
-- 20260312_my_idea_maps.sql) dla kompatybilności SQLite/Postgres w tym repo.

CREATE TABLE IF NOT EXISTS my_idea_conversions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,

  -- Target modułu docelowego — te same wartości co LIVE_CONVERT_TARGETS
  -- (my-work.routes.ts): initiative | task_set | decision | team_chat | report | presentation.
  -- Otwarta lista (bez CHECK) — nowe targety dochodzą bez migracji schematu.
  target TEXT NOT NULL,
  entity_id TEXT,

  -- ActionScope (docs/standards/idea-workspace/01_*, §01 „_RDZEN_STANDARDU_4_ZASADY”) —
  -- w tym backendzie realnie rozróżniane dziś: 'workspace' (cała Idea) vs 'selection'
  -- (zaznaczenie/element/gałąź — wszystko, co przekazuje nodeIds). Otwarta lista,
  -- bez CHECK, żeby przyszłe rozróżnienie single_item/table_row nie wymagało migracji.
  scope TEXT NOT NULL DEFAULT 'workspace',

  -- Węzły źródłowe konwersji fragmentu (puste dla scope='workspace'). TEXT JSON, jak
  -- nodes_json w my_idea_maps — spójna konwencja serializacji grafu w tym module.
  node_ids_json TEXT NOT NULL DEFAULT '[]',

  -- Link zwrotny / kontekst źródła (np. containerType/containerId toolSession) —
  -- best-effort audyt, nie jedyne źródło prawdy (link_graph_edges zostaje główną krawędzią).
  source_link_json TEXT,

  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_my_idea_conversions_idea_id
  ON my_idea_conversions(idea_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_conversions_org_id
  ON my_idea_conversions(organization_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_conversions_target
  ON my_idea_conversions(target);
