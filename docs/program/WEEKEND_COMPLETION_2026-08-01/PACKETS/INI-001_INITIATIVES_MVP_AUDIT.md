---
doc_id: INI-001-initiatives-mvp-audit
truth_type: audit
status: ACCEPTED_ROUTE_SLICE
owner: codex
product_owner: piotr
priority: P0
depends_on: UI-UX-GATE-0
last_reviewed: 2026-08-01
---

# INI-001 — audyt Initiatives MVP

## Odbiór route/default-view slice 2026-08-01

- `/initiatives` jest jedynym mountem `InitiativesHub`;
- `/portfolio` i `/roadmap` są redirect-only i zachowują query/hash;
- wewnętrzne handoffy emitują `/initiatives`;
- domyślny surface to `list` w widoku `table`, przy zachowaniu Kanban jako opcji;
- nie zmieniono danych, statusów ani Candidate lifecycle.

Pozostałe elementy większego INI-001 — status parity i delegowanie konkurencyjnego
`start-execution` — pozostają otwarte.

## Werdykt

Initiatives jest funkcjonalnym modułem, nie atrapą: ma realny Hub, CRUD, lifecycle,
role i gate'y, Candidate inbox, analizę portfela, timeline oraz handoff do Execution.
Status całości to jednak **CZĘŚCIOWA+**, ponieważ kilka prawdziwych mechanizmów nie
tworzy jeszcze jednego odtwarzalnego SSOT/golden flow.

Najważniejsze rozszczepienia:

1. `/initiatives` i `/portfolio` montują pełny `InitiativesHub`;
2. domyślny Portfolio surface startuje jako Kanban, a nie standardowa List/table;
3. V8 portfolio read ma legacy fallback i cross-check pustego V8 store;
4. centralny lifecycle ma kopię frontendową i dodatkowy `start-execution` write path;
5. role/gates, Analysis/Timeline i Candidate workflow nie mają wspólnego E2E z reopen.

## Macierz funkcji

### Route owner i domyślna List — CZĘŚCIOWA+

- `/initiatives` montuje `InitiativesHub`: `src/routes/AppRoutes.tsx:1977-1990`.
- Sidebar i główny AppView wskazują `/initiatives`:
  `src/components/navigation/Sidebar/menuConfig.ts:94-99`,
  `src/routes/routeConfig.ts:350,688`.
- Pierwszą zakładką jest `list`/Portfolio: `src/components/Initiatives/InitiativesHub.tsx:582-614`.
- V8 read i jawny degraded legacy fallback są realne: `InitiativesHub.tsx:383-464`.
- Luka: `/portfolio` jest drugim pełnym mountem (`AppRoutes.tsx:1998-2011`), a
  `src/views/PortfolioView.tsx:1-16` jest wrapperem, nie redirectem.
- Luka UX: default `viewMode='kanban'`, scope `active`: `InitiativesHub.tsx:229-241`.
  Kanoniczny default MVP powinien być `list/table/active`.
- Active jest projekcją DRAFT→SCHEDULED; All dodaje statusy Execution/Results/terminalne:
  `src/utils/initiativeHelpers.ts:179-210`. To nie może tworzyć drugiego rejestru.
- Ryzyko SSOT: pusty V8 result może zostać zastąpiony legacy rows:
  `InitiativesHub.tsx:420-435`.

Decyzja: `/initiatives` jedynym ownerem; `/portfolio` i `/roadmap` redirect-only z
query/hash; default List/table; Active/All jako filtry jednego zbioru ID.

### Candidates, dedupe i AI — CZĘŚCIOWA+

- Candidates jest osobną zakładką/render branch, więc kandydaci nie trafiają na List:
  `InitiativesHub.tsx:602-606,1450-1453`.
- Realne list/scan/accept/dismiss: `src/components/Initiatives/CandidatesPanel.tsx:77-168`;
  org-scoped router: `server/src/routes/initiativeCandidates.routes.ts:38-163`.
- Accept tworzy DRAFT przez kanoniczny funnel, a Hub honoruje zwrócone `initiativeId`
  i nie tworzy dubla: `server/src/services/initiative/initiativeCandidateService.ts:642-818`,
  `InitiativesHub.tsx:1321-1376`.
- Scan deduplikuje po `(org, source_type, source_id)`; accept ma dodatkowy advisory
  Jaccard tytułów z progiem `0.6`: `initiativeCandidateService.ts:319-405,525-590`.
- Częściowa AI: fallback fit score jest deterministyczną heurystyką `0.40..0.90`, ze
  wskazanym LLM seam: `initiativeCandidateService.ts:145-188`.
- Brak: jawny merge UX (`merge/open existing/create anyway`), durable merge lineage i
  recovery dla fail-soft `accepted + initiativeId=null`.

### Status lifecycle — CZĘŚCIOWA+

- Backendowy SSOT: `server/src/constants/initiativeStatuses.ts:1-180` — statusy, gate'y,
  role i transitions.
- `server/src/services/statusMachine.ts:69-151` reużywa canon i egzekwuje warunki dla
  BLOCKED, DONE, PROMOTED, APPROVED i SCHEDULED.
- Generic update nie pozwala zmieniać statusu: `server/src/controllers/InitiativeController.ts:928-939`.
- Transition handler waliduje role/decyzje/daty/baseline i zapisuje historię:
  `InitiativeController.ts:1376-1411,1553-2030,2115-2242`.
- Luka: frontend utrzymuje własną mapę: `src/services/initiativeLifecycle.ts:1-170`.
- Luka: komentarz SSOT mówi o 11 statusach, enum ma 13 i diagram pomija część stanów.
- Ryzyko bypassu: osobne `POST /:id/start-execution`:
  `server/src/routes/pmo/initiatives.routes.ts:3012-3019`,
  `InitiativeController.ts:3327-3373`.

### Roles i projects — CZĘŚCIOWA+

- V8 filtruje po `project_id` i czyta business owner/execution owner/sponsor:
  `server/src/services/v8/planningPortfolioReadService.ts:157-164,203-247`.
- Effective gate roles łączą jawne role z owner/sponsor i project membership:
  `planningPortfolioReadService.ts:600-665,862-948`.
- N-mode czyta/zapisuje ownera, sponsora, gate roles i RACI:
  `src/components/Initiatives/InitiativeDocumentView.tsx:2527-2754,3257-3281`,
  `src/components/Initiatives/sections/StakeholdersSection.tsx:28-65`.
- Brak jednego widocznego project/cross-project scope we wszystkich zakładkach.
  SSOT wymaga jawnego przełącznika: `docs/product/INITIATIVES_PORTFOLIO_ANALYSIS_V3.md:74-82`.
- Brak przekrojowej capability matrix: project role + initiative role + gate role,
  przypadki pozytywne, negatywne i brak przypisania.

### Portfolio/resources i Roadmap/time/capacity — CZĘŚCIOWA

- Analysis ma Resources, Feasibility, Logic, Timeline i Completeness oraz realny CRUD
  dependencies: `src/components/Initiatives/analysis/PortfolioAnalysisView.tsx:1-27,77-106,250-280`.
- Resource load liczy concurrent active ownership, nie fikcyjne FTE:
  `src/components/Initiatives/analysis/resourceLoadMath.ts:10-84`.
- Timeline czyta waves/dependencies API:
  `src/components/Portfolio/PortfolioTimelineView.tsx:157-182`.
- N-mode ma trwałe budget/FTE/tools/intangibles i timeline/baseline.
- Luka: List, Analysis, Portfolio Health, resources i Timeline korzystają z kilku read
  modeli/lokalnych obliczeń. Brak update→API read-back→reopen potwierdzającego ten sam
  wynik na wszystkich surfaces.
- `PortfolioAiPanel` ma osobne endpointy conflicts/priorities/overlap/nonhuman/schedule/
  apply; wymaga testu propose→accept→audit, bez cichej mutacji.

### Decisions / go-no-go — CZĘŚCIOWA+

- Gate types, transitions i uprawnione role są jawne:
  `server/src/constants/initiativeStatuses.ts:85-175`.
- Backend egzekwuje wymagane decyzje/dane przed PLANNING, SCHEDULED i closure:
  `server/src/controllers/InitiativeController.ts:1553-1939`.
- Istnieją realne CRUD/escalation/readiness testy:
  `tests/integration/initiatives/decisions-crud.test.ts`,
  `tests/integration/initiatives/decision-escalation.test.ts`,
  `tests/integration/initiatives/gate-ai-soft-block.test.ts`.
- Brak jednego prostego profilu MVP i E2E: kto proponuje, kto zatwierdza, jaki Decision
  ID blokuje transition, negatywna rola, audit i reopen.

### Handoff do Execution — CZĘŚCIOWA/BRAK E2E

- Canon mapuje `SCHEDULED→EXECUTING` przez `START` dla PMO:
  `server/src/constants/initiativeStatuses.ts:128-134,168-172`.
- Handler ustawia `execution_started_at`, zapisuje historię i notyfikuje:
  `server/src/controllers/InitiativeController.ts:1996-2030,2115-2248`.
- Execution czyta ten sam initiative record; nie powstaje osobny projekt wykonawczy.
- Brak E2E: APPROVED + Schedule Lock + baseline → SCHEDULED → START decision → EXECUTING
  → ten sam ID na `/execution` → reopen w `/initiatives`.
- Osobny `start-execution` path musi zostać dowiedziony jako równoważny albo wycofany.

## Minimalne pakiety wykonawcze

### INI-001 — canonical List/lifecycle (P0)

- `/initiatives` jedynym mountem; `/portfolio` i `/roadmap` redirect-only z query/hash;
- default `list/table/active`;
- jeden status registry dla filters/chips/Kanban/actions;
- wycofanie albo delegowanie `start-execution` do canonical transition handlera.

Testy: route identity; alias query/hash; default nie otwiera Candidates/Kanban; Active i
All mają te same ID; FE/BE status parity; invalid transition bez mutacji; audit/reopen.

Zakaz: bez zmian Candidate, Analysis, resources i Execution UI.

### INI-002 — Candidate merge/recovery

Trwały accept result, jawny merge/open/create-anyway, source→candidate→initiative lineage,
idempotentny repeat accept oraz fixture dwóch źródeł prowadzących do jednego rekordu.

### INI-003 — project roles/approval profile

Jeden resolver scope i ról, positive/negative capability matrix, owner/sponsor/RACI
read-back oraz prosty profil approval bez ukrytych defaultów.

### INI-004 — Portfolio/resources/Roadmap read model

Jawny project/cross-project scope; update resource/date/dependency widoczny po reopen w
List, Analysis i Timeline; baseline/capacity bez fabricated precision; AI apply z audytem.

### INI-005 — GO/NO-GO i Execution handoff

Decision ID związany z gate/auditem; NO-GO bez zmiany statusu; SCHEDULED→EXECUTING jednym
write path; same-ID Initiatives/Execution reopen E2E.

### INI-006 — dynamic cards (poza krytycznym spine MVP)

Deterministyczna kompozycja registry, brak duplikatów oraz persisted reopen.

## Testy do reużycia

- lifecycle: `tests/integration/initiatives/statusLifecycle.test.ts`,
  `server/src/services/initiative/__tests__/initiativeLifecycleCanon.test.ts`,
  `server/src/services/initiative/__tests__/forbiddenTransitions.test.ts`;
- candidates: `tests/unit/initiative/initiativeCandidateService.test.ts`,
  `tests/unit/initiative/candidateAutoScan.test.ts`;
- funnel/lineage: `tests/e2e/uspojnienie/f1-initiative-funnel.spec.ts`,
  `tests/integration/p11-two-entry-points.test.ts`;
- analysis: `tests/unit/initiative/portfolioAnalysisService.test.ts`,
  `tests/unit/initiatives/resourceLoadMath.test.ts`,
  `tests/unit/initiatives/computeCriticalPath.test.ts`;
- timeline: `tests/components/Initiatives/InitiativeGantt.*.test.tsx`,
  `tests/e2e/initiatives-roadmap.spec.ts`;
- roles/gates: `tests/components/Initiatives/GateReadinessPanel.test.tsx`,
  `tests/integration/initiatives/notifications-gate-role.test.ts`;
- handoff: `tests/acceptance/h16-start-execution.e2e.test.ts`.

Te testy nie zastępują nowych przekrojowych testów route identity, merge recovery,
capability matrix i Initiatives→Execution same-ID reopen.

## Granice audytu

- audyt statyczny; testów nie uruchamiano;
- bez zmian runtime, API, bazy i migracji;
- jedyne zmiany dotyczą dokumentacji programu.
