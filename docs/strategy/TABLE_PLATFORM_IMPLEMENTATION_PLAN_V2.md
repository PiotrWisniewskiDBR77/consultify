# Consultify Table Platform — Plan Wdrożenia v2

## Kompletny plan dla 6 agentów pod nadzorem koordynatora

Data: 2026-03-15  
Status: READY FOR EXECUTION  
Bazuje na: WS-A, WS-B, WS-C, WS-D, WS-E, WS-F, WS-G + audyt kodu z 2026-03-15

---

## 1. Stan obecny — podsumowanie audytu

### Co istnieje i działa (fundament ~85%)

| Warstwa | Pliki | Stan |
|---------|-------|------|
| DB Schema | `700_table_platform_foundation.sql`, `701_performance.sql` | 9 tabel, indeksy — OK |
| MetadataService | 253 linii | CRUD bases/tables/fields/views — OK |
| RecordsService | 275 linii | CRUD + batch + filtrowanie — OK |
| ViewQueryEngine | 707 linii | Filtry/sorty/grupy/paginacja — OK |
| RelationService | 346 linii | Link/unlink, count/lookup/rollup — OK |
| ChatToSchemaService | 513 linii | LLM proposal + execute — OK |
| CsvImportService | 495 linii | Parse + infer + import — OK |
| SchemaValidationService | 294 linii | Walidacja nazw/typów/opcji — OK |
| Routes | 916 linii, ~40 endpointów | Pełne API — OK |
| Frontend Bridge | 4 hooki + mappers + API client | Integracja z IdeaTableTool — OK |
| Frontend Components | ChatToSchemaPanel, SchemaProposalCard, LinkedRecordPicker, LinkedRecordDisplay | Istnieją — OK |

### Krytyczne luki (co trzeba zbudować)

| # | Luka | Spec | Wpływ |
|---|------|------|-------|
| G1 | **Walidacja rekordów per typ pola** — RecordsService nie waliduje wartości wg 22 typów z WS-C | WS-C §1 | Dane mogą być niespójne |
| G2 | **Pełny system operatorów filtrów** — ViewQueryEngine nie ma: `startsWith`, `endsWith`, `doesNotContain`, `isAnyOf`, `isNoneOf`, `isBefore`, `isAfter`, `isWithin` | WS-C §3 | Widoki niepełne |
| G3 | **Schema versioning** — brak `schema_version` bump i historii zmian | WS-C §8 | Brak audytu schematu |
| G4 | **Permissions middleware** — PermissionsService istnieje, ale nie jest podłączony do routes | WS-B §5 | Brak kontroli dostępu |
| G5 | **Attachments storage** — brak upload/download, signed URLs, S3 | WS-C §5 | Załączniki nie działają |
| G6 | **Chat-to-Schema pipeline** — brak IntentParser, SchemaGrounder, guardrails, seed data, refinement loop | WS-D §1-14 | Chat uproszczony |
| G7 | **Record delete → relation cleanup** — RecordsService nie woła `RelationService.onRecordDeleted` | WS-C §4 | Osierocone linki |
| G8 | **Auto-recompute** — computed fields nie przeliczają się automatycznie po link/unlink | WS-C §4 | Stale dane |
| G9 | **Data Collection layer** — zero kodu: connector framework, 5 P0 connectorów, mapping, refresh, provenance | WS-E | Brak importu danych |
| G10 | **Distribution module** — zero kodu: artifact contract, event catalog, policy engine, channels | WS-G | Brak dystrybucji |
| G11 | **E2E testy** — zero smoke tests, zero integration tests | WS-A §6 | Brak pewności jakości |
| G12 | **Governed Models** — brak KPI definitions, trust flags, data lineage | WS-E §7 | Brak warstwy analitycznej |
| G13 | **updateBase, deleteBase, updateTable, deleteTable** — brak w MetadataService | WS-B §4 | Niekompletne CRUD |
| G14 | **ErrorHandling** — `handleRouteError` nie używany w routes | WS-B §5 | Niespójne błędy API |

---

## 2. Architektura agentów

```
                    ┌─────────────────────┐
                    │   KOORDYNATOR (Ty)   │
                    │  Nadzór, review,     │
                    │  merge, go/no-go     │
                    └──────────┬──────────┘
                               │
        ┌──────────┬──────────┼──────────┬──────────┬──────────┐
        │          │          │          │          │          │
   ┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐
   │ AGENT 1 ││ AGENT 2 ││ AGENT 3 ││ AGENT 4 ││ AGENT 5 ││ AGENT 6 │
   │ Backend ││ Query & ││ Chat-to ││Frontend ││ Data    ││ Quality │
   │  Core   ││ Views   ││ Schema  ││  & UX   ││Collect. ││& Distrib│
   └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

---

## 3. Przypisanie agentów

### AGENT 1: Backend Core (Metadata + Records + Relations)

**Odpowiedzialność:** Doprowadzenie serwisów backendowych do pełnej zgodności z WS-B i WS-C.

**Zadania w kolejności:**

#### Faza 1 — Krytyczne luki (G1, G3, G4, G7, G8, G13, G14)

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 1.1 | **Pełna walidacja rekordów per typ pola** — dodać `validateRecord(tableId, data)` do SchemaValidationService. Dla każdego z 22 typów: sprawdzić typ wartości, długość, format, dozwolone opcje. Wywołać w `RecordsService.createRecord` i `updateRecord`. | `SchemaValidationService.ts`, `RecordsService.ts` | WS-C §1.2 (wszystkie 22 typy) |
| 1.2 | **Schema versioning** — dodać `tp_schema_versions` table, bump `schema_version` w `tp_bases` przy każdej zmianie schematu, logować `change_summary` JSONB. | Nowa migracja SQL, `MetadataService.ts` | WS-C §8 |
| 1.3 | **Brakujące CRUD** — `updateBase`, `deleteBase`, `updateTable`, `deleteTable`, `deleteField`, `deleteView` w MetadataService + routes. | `MetadataService.ts`, `table-platform.routes.ts` | WS-B §4.1 |
| 1.4 | **Permissions middleware** — podłączyć `requireBaseAccess` / `requireTableAccess` do wszystkich routes. | `table-platform.routes.ts`, `PermissionsService.ts` | WS-B §5 |
| 1.5 | **Record delete → relation cleanup** — w `RecordsService.deleteRecord` wywołać `RelationService.onRecordDeleted`. | `RecordsService.ts` | WS-C §4 |
| 1.6 | **Auto-recompute computed fields** — po `linkRecords`/`unlinkRecords` automatycznie wywołać `recomputeComputedFields`. | `RelationService.ts` | WS-C §4 |
| 1.7 | **ErrorHandling** — zastąpić ręczne try/catch w routes przez `handleRouteError`. | `table-platform.routes.ts` | WS-B §5 |

#### Faza 2 — Attachments (G5)

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 1.8 | **Attachment upload flow** — presigned URL generation (S3-compatible lub local storage), upload confirmation, download URL. | `AttachmentService.ts`, nowe routes | WS-C §5 |
| 1.9 | **Attachment limits** — per file 25MB, per record 100MB, thumbnail generation (opcjonalnie). | `AttachmentService.ts` | WS-C §5 |

#### Faza 3 — Hardening

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 1.10 | **Batch operations** — enforce limit 10, `continueOnError` option, proper transaction. | `RecordsService.ts` | WS-C §7 |
| 1.11 | **Audit retention** — job do archiwizacji eventów starszych niż 90 dni. | `AuditService.ts` | WS-C §6 |
| 1.12 | **Statement timeout** — enforce 30s na query engine. | `ViewQueryEngine.ts` | WS-C §10 |

---

### AGENT 2: View Query Engine + Saved Views

**Odpowiedzialność:** Doprowadzenie ViewQueryEngine do pełnej zgodności z WS-C §3 — wszystkie operatory, typy, paginacja.

**Zadania:**

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 2.1 | **Brakujące operatory tekstowe** — `startsWith`, `endsWith`, `doesNotContain`, `notEquals` | `ViewQueryEngine.ts` | WS-C §3 |
| 2.2 | **Operatory select** — `isAnyOf`, `isNoneOf` dla singleSelect; `isAnyOf` dla multiSelect | `ViewQueryEngine.ts` | WS-C §3 |
| 2.3 | **Operatory daty** — `isBefore`, `isAfter`, `isOnOrBefore`, `isOnOrAfter`, `isWithin` (last N days/weeks/months) | `ViewQueryEngine.ts` | WS-C §3 |
| 2.4 | **Operatory numeryczne** — `gte`, `lte` (oprócz istniejących `gt`, `lt`) | `ViewQueryEngine.ts` | WS-C §3 |
| 2.5 | **Checkbox filter** — `is` (true/false) | `ViewQueryEngine.ts` | WS-C §3 |
| 2.6 | **Null handling** — `NULLS LAST` (ASC), `NULLS FIRST` (DESC), konfigurowalny | `ViewQueryEngine.ts` | WS-C §3 |
| 2.7 | **Group aggregates** — `sum`, `avg`, `count`, `min`, `max` per group | `ViewQueryEngine.ts` | WS-C §3 |
| 2.8 | **Full-text search** — `buildSearchClause` z `tsvector` lub `ILIKE` multi-field | `ViewQueryEngine.ts` | WS-C §3 |
| 2.9 | **View config persistence** — `columnConfig` (widths, order, visibility), `options` (row height, color) | `MetadataService.ts` (views) | WS-B §4.1 |
| 2.10 | **Offset pagination** — oprócz cursor, dodać `page`/`pageSize` z `total` count | `ViewQueryEngine.ts` | WS-C §3 |

---

### AGENT 3: Chat-to-Schema Pipeline (WS-D)

**Odpowiedzialność:** Przebudowa ChatToSchemaService z monolitu na pełny pipeline z WS-D.

**Zadania:**

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 3.1 | **IntentParser** — osobny moduł klasyfikujący 11 intentów z sygnałów NL (regex + LLM fallback). | Nowy: `server/src/services/chatToSchema/intentParser.ts` | WS-D §2 |
| 3.2 | **SchemaGrounder** — buduje kontekst schematu (base/tables/fields) w formacie tekstowym dla LLM. NL-to-field-type mapping (25+ wzorców PL+EN). | Nowy: `server/src/services/chatToSchema/schemaGrounder.ts` | WS-D §4 |
| 3.3 | **ProposalGenerator** — prompt engineering z few-shot examples, schema context injection, structured JSON output. | Nowy: `server/src/services/chatToSchema/proposalGenerator.ts` | WS-D §9 |
| 3.4 | **SchemaValidator (proposal)** — walidacja propozycji: duplicate keys, reserved names, type compatibility, circular relations, limits (100 fields/table, 50 tables/base). | Nowy: `server/src/services/chatToSchema/schemaValidator.ts` | WS-D §7 |
| 3.5 | **MutationExecutor** — topological sort operacji, dependency resolution, atomic transaction, rollback on failure. | Nowy: `server/src/services/chatToSchema/mutationExecutor.ts` | WS-D §8 |
| 3.6 | **Safety guardrails** — limity per proposal (5 tables, 25 fields, 50 records, 30 ops), confidence thresholds, rate limits (30/user/hour). | Wszystkie moduły chatToSchema | WS-D §10 |
| 3.7 | **Seed data generation** — generowanie realistycznych danych (PL/EN locale, domain-aware). | `proposalGenerator.ts` lub osobny moduł | WS-D §11 |
| 3.8 | **Refinement loop** — max 3 refinements per chain, follow-up z poprzednią propozycją. | `ChatToSchemaService.ts` | WS-D §6 |
| 3.9 | **Error recovery** — retry na invalid JSON, validation failure → re-prompt, timeout → retry once. | Wszystkie moduły | WS-D §13 |
| 3.10 | **API endpoints** — `POST /schema/proposals`, `POST /schema/proposals/:id/validate`, `POST /schema/proposals/:id/execute`, `POST /schema/proposals/:id/refine`. | `table-platform.routes.ts` | WS-D Appendix |

---

### AGENT 4: Frontend & UX

**Odpowiedzialność:** Doprowadzenie UI do pełnej funkcjonalności — grid, widoki, relacje, chat, attachments.

**Zadania:**

#### Faza 1 — Grid hardening

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 4.1 | **Pełna integracja filtrów** — FilterPanel musi obsługiwać wszystkie operatory z Agent 2 (per typ pola). | `IdeaTableTool.tsx`, `FilterPanel` | WS-C §3 |
| 4.2 | **Column type rendering** — renderowanie per typ: currency z symbolem, percent z %, checkbox jako toggle, date z formatem, URL jako link, email jako link. | `CellRenderer` w IdeaTableTool | WS-C §1 |
| 4.3 | **Column type editing** — inline editing per typ: date picker, select dropdown, multi-select tags, checkbox toggle, number input z walidacją. | `CellRenderer` / `InlineEditor` | WS-C §1 |
| 4.4 | **Add column dialog** — wybór z 22 typów, konfiguracja opcji (currency code, date format, select options, linked table). | Nowy lub rozszerzony komponent | WS-C §1 |

#### Faza 2 — Linked Records UI

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 4.5 | **LinkedRecordPicker** — server-side search (nie client-side), paginacja wyników. | `LinkedRecordPicker.tsx` | WS-C §4 |
| 4.6 | **Relation display** — chipy z display value, expand to detail, count/lookup/rollup rendering w komórkach. | `LinkedRecordDisplay.tsx`, `CellRenderer` | WS-C §4 |
| 4.7 | **Relation creation UI** — przy dodawaniu kolumny `linkedRecord`: wybór target table, display field, max links. | Add column dialog | WS-C §4 |

#### Faza 3 — Chat-to-Schema UI

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 4.8 | **SchemaProposalCard v2** — color coding (green/amber/red), operation-level checkboxes, confidence badge, impact estimate. | `SchemaProposalCard.tsx` | WS-D §5 |
| 4.9 | **Refinement UI** — inline input "What would you like to change?", max 3 refinements indicator. | `ChatToSchemaPanel.tsx` | WS-D §6 |
| 4.10 | **Progress states** — spinner during generation, "Validating...", progress bar during execution, checkmark/error + Retry. | `ChatToSchemaPanel.tsx` | WS-D §5 |

#### Faza 4 — Views & Attachments

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 4.11 | **Saved views management** — create/rename/delete/reorder views, view config persistence (column widths, visibility, row height). | Views UI | WS-C §3 |
| 4.12 | **Attachment UI** — upload button w komórce, preview thumbnails, download link, drag & drop. | Nowy komponent | WS-C §5 |
| 4.13 | **CSV import UI** — column mapping dialog, type inference preview, progress bar, error report. | Nowy lub rozszerzony | WS-C §9 |

---

### AGENT 5: Data Collection & Ingestion (WS-E)

**Odpowiedzialność:** Budowa warstwy zbierania danych — od zera, zgodnie z WS-E.

**Zadania:**

#### Faza 1 — Framework

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 5.1 | **Connector framework** — abstrakcja `IConnector` z `connect`, `fetchSchema`, `fetchRecords`, `testConnection`. | Nowy: `server/src/services/dataCollection/connectorFramework.ts` | WS-E §2 |
| 5.2 | **Schema mapping engine** — `ISchemaMapper` z `autoMap`, `manualMap`, `validateMapping`, `transformRecord`. | Nowy: `server/src/services/dataCollection/schemaMappingEngine.ts` | WS-E §4 |
| 5.3 | **Connector run log** — `tp_connector_runs` table, status tracking, error logging. | Nowa migracja SQL | WS-E §11 |
| 5.4 | **Provenance model** — `tp_record_provenance` table, source tracking per record. | Nowa migracja SQL | WS-E §6 |

#### Faza 2 — P0 Connectors

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 5.5 | **CSV/XLSX connector** — rozszerzenie istniejącego CsvImportService o XLSX (via `xlsx` library), mapping UI. | `CsvImportService.ts` + nowy XLSX parser | WS-E §3.1 |
| 5.6 | **Google Sheets connector** — OAuth2, read sheets, auto-map columns, scheduled refresh. | Nowy: `connectors/googleSheets.ts` | WS-E §3.2 |
| 5.7 | **Airtable connector** — PAT auth, read bases/tables/records, field type mapping. | Nowy: `connectors/airtable.ts` | WS-E §3.3 |
| 5.8 | **PostgreSQL connector** — connection string, read tables/views, query execution. | Nowy: `connectors/postgres.ts` | WS-E §3.4 |
| 5.9 | **Jira connector** — OAuth2/PAT, read projects/issues, field mapping. | Nowy: `connectors/jira.ts` | WS-E §3.5 |

#### Faza 3 — Scheduling & Governed Models

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 5.10 | **Refresh scheduling** — cron-based refresh, `tp_connector_schedules` table, run queue. | Nowy: `server/src/services/dataCollection/refreshScheduler.ts` | WS-E §5 |
| 5.11 | **Governed model layer** — KPI definitions, trust flags, data lineage, `tp_governed_models` table. | Nowy: `server/src/services/dataCollection/governedModels.ts` | WS-E §7 |
| 5.12 | **Reconciliation engine** — diff detection, conflict resolution, merge strategies. | Nowy: `server/src/services/dataCollection/reconciliation.ts` | WS-E §8 |

#### Faza 4 — Frontend

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 5.13 | **Data source picker UI** — wybór źródła, konfiguracja połączenia, test connection. | Nowy komponent | WS-E §2 |
| 5.14 | **Schema mapping UI** — drag & drop mapping, type inference, preview. | Nowy komponent | WS-E §4 |
| 5.15 | **Refresh dashboard** — status connectorów, last run, next run, errors. | Nowy komponent | WS-E §5 |

---

### AGENT 6: Quality, Distribution & Hardening

**Odpowiedzialność:** Testy, dystrybucja artefaktów (WS-G), observability, pilot readiness.

**Zadania:**

#### Faza 1 — E2E Tests (G11)

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 6.1 | **API smoke tests** — test każdego endpointu: create base → table → fields → records → query → update → delete. | Nowy: `server/tests/table-platform/` | WS-A §6 |
| 6.2 | **Chat-to-Schema E2E** — test: prompt → proposal → validate → execute → verify schema. | Nowy test | WS-D |
| 6.3 | **Relations E2E** — test: create 2 tables → link → count/lookup/rollup → delete → cleanup. | Nowy test | WS-C §4 |
| 6.4 | **CSV import E2E** — test: upload CSV → infer types → import → verify records. | Nowy test | WS-C §9 |
| 6.5 | **Frontend E2E** — Playwright: login → create idea → open table → add column → add row → edit → save. | Nowy: `tests/e2e/table-platform.spec.ts` | WS-A §6 |

#### Faza 2 — Distribution Module (WS-G)

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 6.6 | **Canonical artifact contract** — `IArtifact` interface, `ArtifactRegistry`. | Nowy: `server/src/services/distribution/` | WS-G §2 |
| 6.7 | **Business event catalog** — event types, emitters, subscribers. | Nowy: `server/src/services/distribution/eventCatalog.ts` | WS-G §3 |
| 6.8 | **Distribution planner** — rule engine: "when X happens, send Y to Z via channel W". | Nowy: `server/src/services/distribution/planner.ts` | WS-G §4 |
| 6.9 | **Policy engine** — approval rules, rate limits, quiet hours. | Nowy: `server/src/services/distribution/policyEngine.ts` | WS-G §5 |
| 6.10 | **Delivery engine** — channel adapters: email, Slack, Teams, in-app. | Nowy: `server/src/services/distribution/deliveryEngine.ts` | WS-G §7 |
| 6.11 | **Audit & tracking** — delivery status, open/click tracking, retry queue. | Nowy: `server/src/services/distribution/auditTracking.ts` | WS-G §8 |

#### Faza 3 — Observability & Pilot

| # | Zadanie | Pliki | Spec |
|---|---------|-------|------|
| 6.12 | **Performance benchmarks** — p95 latency tests per endpoint, load test 50 concurrent users. | Nowy test suite | WS-C §10 |
| 6.13 | **Metrics dashboard** — proposal funnel, latency, error budget, cost per org. | Logging + dashboard config | WS-D §14 |
| 6.14 | **Support playbook update** — aktualizacja `TABLE_PLATFORM_SUPPORT_PLAYBOOK.md` z nowymi scenariuszami. | `docs/strategy/` | WS-A |
| 6.15 | **Pilot release notes update** — aktualizacja `TABLE_PLATFORM_PILOT_RELEASE_NOTES.md`. | `docs/strategy/` | WS-A |

---

## 4. Harmonogram — 4 fazy po ~2 tygodnie

### Faza I: Core Hardening (Tydzień 1-2)

| Agent | Zadania | Zależności |
|-------|---------|-----------|
| Agent 1 | 1.1–1.7 (walidacja, versioning, CRUD, permissions, relations) | Brak |
| Agent 2 | 2.1–2.6 (operatory filtrów, null handling) | Brak |
| Agent 3 | 3.1–3.3 (IntentParser, SchemaGrounder, ProposalGenerator) | Brak |
| Agent 4 | 4.1–4.3 (filtry UI, column rendering, inline editing) | Agent 2 (operatory) |
| Agent 5 | 5.1–5.4 (framework, mapping, run log, provenance) | Agent 1 (MetadataService) |
| Agent 6 | 6.1–6.4 (API smoke tests) | Agent 1 + Agent 2 |

**Gate I:** Wszystkie 22 typy pól walidowane, pełne operatory filtrów, permissions na routes, API testy przechodzą.

### Faza II: Relations + Chat Pipeline (Tydzień 3-4)

| Agent | Zadania | Zależności |
|-------|---------|-----------|
| Agent 1 | 1.8–1.9 (attachments storage) | Faza I |
| Agent 2 | 2.7–2.10 (group aggregates, search, offset pagination) | Faza I |
| Agent 3 | 3.4–3.7 (validator, executor, guardrails, seed data) | 3.1–3.3 |
| Agent 4 | 4.5–4.7 (linked records UI, relation creation) | Agent 1 (relations) |
| Agent 5 | 5.5–5.7 (CSV/XLSX, Google Sheets, Airtable connectors) | 5.1–5.4 |
| Agent 6 | 6.5 (Frontend E2E) + 6.6–6.8 (distribution: artifact, events, planner) | Faza I |

**Gate II:** Linked records E2E działa, Chat-to-Schema pipeline kompletny, 3 connectors gotowe.

### Faza III: Full Experience (Tydzień 5-6)

| Agent | Zadania | Zależności |
|-------|---------|-----------|
| Agent 1 | 1.10–1.12 (batch hardening, audit retention, timeout) | Faza II |
| Agent 2 | Review + performance tuning | Faza II |
| Agent 3 | 3.8–3.10 (refinement, error recovery, API endpoints) | 3.4–3.7 |
| Agent 4 | 4.8–4.13 (Chat UI v2, views management, attachments UI, CSV UI) | Agent 3 + Agent 1 |
| Agent 5 | 5.8–5.12 (Postgres, Jira connectors, scheduling, governed models) | 5.5–5.7 |
| Agent 6 | 6.9–6.11 (distribution: policy, delivery, audit) | 6.6–6.8 |

**Gate III:** Pełny Chat-to-Schema E2E, 5 connectors, distribution module v1, attachments działają.

### Faza IV: Stabilization & Pilot (Tydzień 7-8)

| Agent | Zadania | Zależności |
|-------|---------|-----------|
| Agent 1 | Bug fixes, security review | Faza III |
| Agent 2 | Performance optimization | Faza III |
| Agent 3 | Prompt tuning, edge cases | Faza III |
| Agent 4 | UX polish, error states, loading states | Faza III |
| Agent 5 | 5.13–5.15 (Data source UI, mapping UI, refresh dashboard) | Faza III |
| Agent 6 | 6.12–6.15 (benchmarks, metrics, playbook, release notes) | Faza III |

**Gate IV (GO/NO-GO):**
- [ ] Metadata API pełne (22 typy, versioning, permissions)
- [ ] Records API pełne (walidacja, batch, relations)
- [ ] View Query Engine pełny (wszystkie operatory, paginacja, grupy)
- [ ] Grid UI pełny (rendering, editing, views, attachments)
- [ ] Linked Records E2E (create, display, count/lookup/rollup)
- [ ] Chat-to-Schema pipeline (11 intentów, proposal, approval, execution)
- [ ] Data Collection (5 connectors, mapping, scheduling)
- [ ] Distribution module v1 (artifact contract, planner, 2+ channels)
- [ ] E2E testy przechodzą
- [ ] Performance: p95 < 500ms list records, < 250ms update
- [ ] Zero krytycznych bugów

---

## 5. Metryki sukcesu (z WS-A)

### Produktowe
- Użytkownik tworzy tabelę z czatu w < 2 minuty
- Użytkownik tworzy 5-10 pól bez manualnej konfiguracji technicznej
- Użytkownik zapisuje ≥ 3 widoki
- Użytkownik tworzy relację między 2 tabelami
- Użytkownik importuje dane z CSV/Google Sheets/Airtable

### Techniczne
- p95 list records < 500ms
- p95 update record < 250ms
- p95 Chat-to-Schema proposal < 3s
- Żaden flow nie wymaga ładowania całej tabeli client-side
- Wszystkie mutacje schematu logowane

### Jakościowe
- Zero konfliktów source-of-truth (graph vs records)
- Zero krytycznych blokerów w Chat-to-Schema E2E
- Zero regresji w istniejących modułach (My Work, Finance, Mindmap)

---

## 6. Ryzyka i mitygacje

| Ryzyko | Severity | Mitygacja |
|--------|----------|-----------|
| Scope creep do Airtable parity | CRITICAL | Zamrożony scope MVP w tym dokumencie |
| Dual source of truth | CRITICAL | ADR-002: graph = projection only |
| AI mutation reliability | HIGH | Pipeline z walidacją + approval (WS-D) |
| Performance przy 500k records | HIGH | Indeksy, cursor pagination, statement timeout |
| Connector auth complexity | MEDIUM | OAuth2 library, PAT fallback |
| Distribution module scope | MEDIUM | V1 = email + in-app only |

---

## 7. Zasady pracy agentów

1. **Każdy agent pracuje na swoim zakresie** — nie modyfikuje plików innych agentów bez uzgodnienia z koordynatorem.
2. **Każda faza kończy się gate review** — koordynator weryfikuje deliverables przed przejściem do następnej fazy.
3. **Testy przed merge** — Agent 6 weryfikuje każdy deliverable testami.
4. **Spec jest prawdą** — WS-A do WS-G to źródło prawdy. Jeśli kod odbiega od spec, spec wygrywa.
5. **Nie wymyślaj nowych standardów** — zgodnie z `.cursorrules`, wszystkie komponenty UI muszą być zgodne z `docs/ui-standards/`.
6. **Feature flags** — wszystkie nowe capability za flagami, domyślnie wyłączone do momentu gate review.
7. **Bez placeholder testów** — każdy test musi testować prawdziwy kod (`.cursorrules`).

---

## 8. Pliki kluczowe per agent

### Agent 1 (Backend Core)
```
server/src/services/tablePlatform/MetadataService.ts
server/src/services/tablePlatform/RecordsService.ts
server/src/services/tablePlatform/SchemaValidationService.ts
server/src/services/tablePlatform/RelationService.ts
server/src/services/tablePlatform/AttachmentService.ts
server/src/services/tablePlatform/AuditService.ts
server/src/services/tablePlatform/PermissionsService.ts
server/src/services/tablePlatform/ErrorHandling.ts
server/src/routes/table-platform.routes.ts
server/migrations/702_*.sql (nowe migracje)
```

### Agent 2 (Query & Views)
```
server/src/services/tablePlatform/ViewQueryEngine.ts
server/src/services/tablePlatform/MetadataService.ts (views only)
```

### Agent 3 (Chat-to-Schema)
```
server/src/services/chatToSchema/ (nowy katalog)
  intentParser.ts
  schemaGrounder.ts
  proposalGenerator.ts
  schemaValidator.ts
  mutationExecutor.ts
server/src/services/tablePlatform/ChatToSchemaService.ts (refactor)
```

### Agent 4 (Frontend & UX)
```
src/components/MyWork/IdeaTableTool.tsx
src/components/MyWork/table/ChatToSchemaPanel.tsx
src/components/MyWork/table/SchemaProposalCard.tsx
src/components/MyWork/table/LinkedRecordPicker.tsx
src/components/MyWork/table/LinkedRecordDisplay.tsx
src/components/MyWork/table/useTablePlatformBridge.ts
src/components/MyWork/table/useTablePlatformIntegration.ts
src/services/api/tablePlatform.api.ts
src/types/tablePlatform.ts
```

### Agent 5 (Data Collection)
```
server/src/services/dataCollection/ (nowy katalog)
  connectorFramework.ts
  schemaMappingEngine.ts
  refreshScheduler.ts
  governedModels.ts
  reconciliation.ts
  connectors/
    csvXlsx.ts
    googleSheets.ts
    airtable.ts
    postgres.ts
    jira.ts
server/migrations/703_data_collection.sql
src/components/MyWork/table/DataSourcePicker.tsx (nowy)
src/components/MyWork/table/SchemaMappingUI.tsx (nowy)
```

### Agent 6 (Quality & Distribution)
```
server/tests/table-platform/ (nowy katalog)
server/src/services/distribution/ (nowy katalog)
  artifactContract.ts
  eventCatalog.ts
  planner.ts
  policyEngine.ts
  deliveryEngine.ts
  auditTracking.ts
tests/e2e/table-platform.spec.ts (nowy)
docs/strategy/TABLE_PLATFORM_SUPPORT_PLAYBOOK.md
docs/strategy/TABLE_PLATFORM_PILOT_RELEASE_NOTES.md
```

---

## 9. Łączna skala pracy

| Metryka | Szacunek |
|---------|----------|
| Nowe pliki | ~40-50 |
| Zmodyfikowane pliki | ~15-20 |
| Nowe linie kodu (szacunek) | ~15,000-20,000 |
| Nowe migracje SQL | 3-4 |
| Nowe testy | ~30-40 test cases |
| Nowe komponenty UI | ~8-10 |
| Czas (z 6 agentami równolegle) | ~8 tygodni |

---

## 10. Kolejność startowa

```
Faza I start → Agent 1, 2, 3, 5 startują równolegle
                Agent 4 czeka na Agent 2 (operatory)
                Agent 6 czeka na Agent 1+2 (API do testowania)

Faza I gate → Koordynator review → GO/NO-GO

Faza II start → Wszyscy 6 agentów równolegle

... (powtórz dla Fazy III i IV)
```

**Koordynator (Ty) na każdym etapie:**
1. Wydaje zadania agentom (z tego dokumentu)
2. Monitoruje postęp
3. Robi code review na gate'ach
4. Rozwiązuje konflikty między agentami
5. Podejmuje decyzje architektoniczne
6. Raportuje status
