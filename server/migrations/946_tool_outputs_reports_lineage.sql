-- 946_tool_outputs_reports_lineage.sql
--
-- Domyka lukę L3/L8 domeny Tools: Output narzędzia nie miał pierwszorzędnej
-- trwałości (żył jako kolumna `tool_sessions.output_json`), a Report/Presentation
-- nie istniały wcale — runtime dowoził wyłącznie `initiative`
-- (src/config/consultingToolsStandard.ts:35).
--
-- Zgodność z SHARED_CONTRACT_MANIFEST §8 (zasady migracji):
--   * WYŁĄCZNIE addytywne: CREATE TABLE/INDEX IF NOT EXISTS. Zero DROP,
--     zero ALTER istniejących kolumn, zero DELETE.
--   * Każda tabela org-scoped (organization_id NOT NULL).
--   * Plik leży BEZPOŚREDNIO w server/migrations/ — runner
--     server/scripts/migrate.postgres.ts jest NIEREKURENCYJNY, więc cokolwiek
--     w podkatalogu (np. never-ran/) nigdy by się nie uruchomiło.
--   * NIE uruchamiamy tej migracji na żywej bazie w tej fali.
--
-- Model niezmienności odwzorowuje maszynę stanów kernela: zatwierdzony Output
-- nigdy nie jest edytowany w miejscu. Poprawka = NOWA rewizja
-- (frozen -> active tworzy nową wersję), a poprzednia zostaje jako dowód.

-- ---------------------------------------------------------------------------
-- 1. TOOL OUTPUT — niezmienny snapshot zatwierdzonej wersji sesji
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_outputs (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  project_id          TEXT,

  -- lineage do źródła
  tool_session_id     TEXT NOT NULL,
  tool_type           TEXT NOT NULL,
  -- wersja packa przypięta w chwili zatwierdzenia; bez tego historia
  -- przestaje być odtwarzalna po podbiciu wersji metody
  method_pack_version TEXT NOT NULL,

  -- wersjonowanie: kolejne rewizje tego samego Outputu
  version             INTEGER NOT NULL DEFAULT 1,
  supersedes_id       TEXT,

  title               TEXT NOT NULL,

  -- niezmienny ładunek: napięcia/ruchy/pozycje + konkluzje K1-K4 (W2)
  payload_json        JSONB NOT NULL,
  -- hash treści liczony po sortowaniu W PAMIĘCI (nie ORDER BY w SQL) —
  -- repo ma udokumentowany przypadek 6-7 różnych hashy z 10 przebiegów
  content_hash        TEXT NOT NULL,

  -- status: draft -> in_review -> approved -> superseded
  status              TEXT NOT NULL DEFAULT 'draft',

  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  -- po zatwierdzeniu rekord jest tylko do odczytu; reopen tworzy nową rewizję
  frozen_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tool_outputs_org
  ON tool_outputs (organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_outputs_session
  ON tool_outputs (tool_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_outputs_status
  ON tool_outputs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tool_outputs_supersedes
  ON tool_outputs (supersedes_id);

-- ---------------------------------------------------------------------------
-- 2. APPROVAL TRAIL — append-only ślad decyzji (submit / approve / send back)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_output_approvals (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  tool_output_id      TEXT NOT NULL,

  -- submitted | approved | sent_back | reopened
  action              TEXT NOT NULL,
  -- human | teresa | system — actorKind z kontraktu kernela.
  -- Teresa NIGDY nie zatwierdza (TERESA_FORBIDDEN_EFFECTS); zapisujemy to,
  -- żeby naruszenie było wykrywalne w danych, nie tylko w kodzie.
  actor_kind          TEXT NOT NULL DEFAULT 'human',
  actor_user_id       TEXT,
  comment             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_output_approvals_output
  ON tool_output_approvals (tool_output_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_output_approvals_org
  ON tool_output_approvals (organization_id);

-- ---------------------------------------------------------------------------
-- 3. REPORT / PRESENTATION — deterministyczny render zatwierdzonych Outputów
--    Nigdy zrzut ekranu: przechowujemy WEJŚCIE renderera, nie obrazek.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_reports (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  project_id          TEXT,

  -- report | presentation — ten sam Artifact, dwa deterministyczne renderery
  kind                TEXT NOT NULL,
  title               TEXT NOT NULL,

  -- wersja renderera; ten sam Output + ta sama wersja = ten sam dokument
  renderer_version    TEXT NOT NULL,
  -- executive-paper (light) | executive-night (dark)
  theme               TEXT NOT NULL DEFAULT 'executive-paper',

  payload_json        JSONB NOT NULL,
  content_hash        TEXT NOT NULL,

  status              TEXT NOT NULL DEFAULT 'draft',
  -- retry generowanych części: liczba prób i ostatni błąd
  generation_attempts INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,

  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_reports_org
  ON tool_reports (organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_reports_kind
  ON tool_reports (organization_id, kind);

-- ---------------------------------------------------------------------------
-- 4. LINEAGE Report/Presentation -> Output (raport może scalać WIELE Outputów)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_report_sources (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  tool_report_id      TEXT NOT NULL,
  tool_output_id      TEXT NOT NULL,
  -- kolejność sekcji w dokumencie
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_report_sources_report
  ON tool_report_sources (tool_report_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tool_report_sources_output
  ON tool_report_sources (tool_output_id);

-- ---------------------------------------------------------------------------
-- 5. INITIATIVE PROPOSAL -> Output (wskazanie wniosku źródłowego)
--    Uzupełnia istniejące tool_initiative_links o wskazanie KTÓREGO wniosku
--    dotyczy propozycja, czego dotąd nie dało się prześledzić.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_output_initiative_proposals (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  tool_output_id      TEXT NOT NULL,

  -- id wniosku/ruchu wewnątrz payload_json Outputu — to jest traceability
  source_conclusion_id TEXT NOT NULL,
  proposed_title      TEXT NOT NULL,
  rationale           TEXT,

  -- proposed | accepted | rejected; człowiek zatwierdza przekazanie
  status              TEXT NOT NULL DEFAULT 'proposed',
  -- wypełniane dopiero po akceptacji człowieka
  initiative_id       TEXT,

  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by          TEXT,
  decided_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tool_output_initiative_output
  ON tool_output_initiative_proposals (tool_output_id);
CREATE INDEX IF NOT EXISTS idx_tool_output_initiative_org
  ON tool_output_initiative_proposals (organization_id, status);

-- ---------------------------------------------------------------------------
-- 6. EVENTY domeny Tools — append-only, z zamkniętej listy kernela (18 typów)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_session_events (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  tool_session_id     TEXT NOT NULL,

  -- MethodEventType — walidowane w kodzie przez isMethodEventType()
  event_type          TEXT NOT NULL,
  unit_id             TEXT,
  level               INTEGER,

  actor_kind          TEXT NOT NULL,
  actor_user_id       TEXT,
  method_pack_version TEXT NOT NULL,

  payload_json        JSONB,
  -- korekta = NOWY event wskazujący poprzedni; nigdy UPDATE ani DELETE
  supersedes_id       TEXT,
  -- ten sam klucz w tej samej sesji = ten sam wynik i ZERO drugiego wiersza
  idempotency_key     TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_session_events_session
  ON tool_session_events (tool_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_session_events_org
  ON tool_session_events (organization_id);

-- Idempotencja jest KONTRAKTEM, nie optymalizacją (manifest §4.4).
-- Indeks częściowy: NULL nie koliduje w UNIQUE, więc eventy bez klucza
-- nie blokują się nawzajem.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tool_session_events_idempotency
  ON tool_session_events (tool_session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
