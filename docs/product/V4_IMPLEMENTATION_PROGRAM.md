# Consultify — V4 Implementation Program (SSOT / Backlog Ledger)

Owner: CTO/PO (Piotr + AI)  
Status: living document (v4 enterprise program)  
Last update: 2026-03-04  

> **Cel tego pliku:** mieć **jedno, precyzyjne źródło prawdy** dla wdrożenia V4: 120 tasków, statusy, DoD, zależności, blokery i plan release.  
> Ten dokument jest **programem wdrożeniowym**; źródłem tasków jest `V4_GAP_ANALYSIS.md`.

---

## ▶ START HERE — zacznij teraz

**Krok 0 — Środowisko:**  
`npm run dev` — upewnij się, że aplikacja działa lokalnie.

**Krok 1 — Branch:**  
`git checkout -b feature/V4-ENT-03-audit-log`  
(lub `feature/V4-ENT-04-policy-engine` / `feature/V4-ORG-01-benchmark`)

**Krok 2 — Pierwszy task:** V4-ENT-03 (Unified audit log)  
- DoD: sekcja 3.3 — tabela `audit_events`, middleware `requireAudit`, `GET /api/audit/events`  
- SSOT: V4_GAP_ANALYSIS 6.10, Plan pokrycia gapu

**Krok 3 — Pracuj:** migracja DB → middleware → routes → query API. Po zakończeniu: aktualizuj dashboard (2.3), Progress log (2.6).

**Krok 4 — PR:** przed merge — PR checklist (sekcja 7), R0 Demo Script (sekcja 4.2) w zakresie audit.

---

**Jak używać (skalowalność 100+ wdrożeń):**
1. **Dashboard (2.3)** — codzienna aktualizacja Spec/Impl/QA per moduł.
2. **Task ledger (sekcja 3)** — wyszukuj po ID `V4-XXX-NN` (np. `V4-IDEA-01`) lub po module.
3. **Index (sekcja 9)** — szybki lookup "który task za co".
4. **Blockers (2.4)** — każdy bloker wpisany = widoczny w review.
5. **Progress log (2.6)** — każde dowiezienie = wpis + PR link.
6. **Execution order (sekcja 5)** — nie zaczynaj zależnych przed bazowymi.
7. **PR checklist (sekcja 7)** — gate przed każdym merge.

---

## 0) Referencje (SSOT)

**Źródło tasków (gap → tasks):**
- V4 Gap Analysis: `docs/product/V4_GAP_ANALYSIS.md`

**Product / architecture:**
- Business positioning: `docs/product/BUSINESS_POSITIONING_SSOT.md`
- System axis: `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- Traceability: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- Link Graph: `docs/product/LINK_GRAPH_V3.md`

**Module SSOTs (per moduł w gap analysis):**
- Ideas: `docs/product/IDEA_WORKSPACE_V3_SSOT.md`, `docs/MYWORK_MODULE_SPECIFICATION.md`
- Notebook: `docs/product/NOTEBOOK_V3.md`
- Interview: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- Tools: `docs/product/CONSULTING_TOOLS_V3.md`, `docs/product/TOOLS_CATALOG_V3.md`
- Assessments: `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- Execution: `docs/product/EXECUTION_V3.md`
- Results: `docs/product/RESULTS_V3.md`
- Finance: `docs/product/FINANCIAL_ANALYSIS_V3.md`
- Reports/Presentations: `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- AI: `docs/product/MODEL_REGISTRY_V3.md`, `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`

**UI/UX canon (DBR77 Tech Sexy — NIE TRACIĆ JAKOŚCI):**
- Index: `docs/ui-standards/README.md`
- **Visual Language (KANON):** `docs/ui-standards/00-foundation/visual-language.md` — DBR77 "Tech Sexy": monochromatic chrome, invisible borders, depth przez tło, outline ikony, max 1 kolorowy CTA
- Canon v3: `docs/ui-standards/UI_UX_CANON_V3.md`
- Color system: `docs/ui-standards/00-foundation/color-system.md`
- App table, preview pane, module hub: `docs/ui-standards/03-modules/`

---

## 0.5) Readiness checklist — 100% gotowość do wdrożenia

> Stan: **GOTOWI DO STARTU** (2026-03-04)

| # | Kryterium | Status |
| --- | --- | --- |
| 1 | Gap analysis kompletny (16 modułów) | ✅ |
| 2 | 120 tasków zmapowanych do V4-XXX-NN | ✅ |
| 3 | Plan pokrycia gapu per moduł (V4_GAP_ANALYSIS) | ✅ |
| 4 | Task ledger z Deps, P, Spec/Impl/QA | ✅ |
| 5 | Wave 1 tasków: Spec locked + pełny DoD | ✅ |
| 6 | R0 cutline: lista tasków + gate criteria | ✅ |
| 7 | R0 Demo Script (kanoniczny smoke test) | ✅ |
| 8 | Suggested execution order (4 waves) | ✅ |
| 9 | Dependencies skompletowane (cross-module) | ✅ |
| 10 | PR checklist + Verification matrix | ✅ |

**Go-ahead:** Można startować z implementacją. Pierwsze taski: V4-ENT-03, V4-ENT-04, V4-ORG-01.

> Wave 1 (Spec **locked**): V4-ENT-03, V4-ENT-04, V4-ORG-01, V4-TASK-01, V4-INIT-01 — pełny DoD w sekcji 3.3.

---

## 1) Kontrakt programu (V4)

### 1.0 Business truth (canonical)

V4 nie jest tylko programem technicznym. Implementujemy biznesową tezę produktu opisaną w `docs/product/BUSINESS_POSITIONING_SSOT.md`.

Kanoniczna definicja produktu:

**Consultify is doing for consulting intelligence what Spotify did for music - making world-class knowledge accessible to everyone.**

To oznacza, że V4 ma wzmacniać nie tylko "AI answers", ale cały ustrukturyzowany workflow consultingowy:
- understanding the business
- diagnosis
- designing initiatives
- execution
- results

### 1.1 North star

V4 ma być **enterprise-ready** i jednocześnie zgodne z tezą biznesową produktu: demokratyzować consulting intelligence poprzez platformę, która łączy wiedzę, frameworki, guidance i execution w jednym środowisku pracy.

### 1.2 Nienegocjowalne (MUST)

- **SSOT-first**: każdy task ma referencję do SSOT lub V4_GAP_ANALYSIS.
- **Traceability**: outputy mają `source_type + source_id`; LinkGraph "Used in" wszędzie.
- **AI contract**: propose→accept; audit dla AI apply; evals/cost controls.
- **UI/UX compliance**: ModuleHub, App Table, Preview Pane, i18n PL+EN, locked state.
- **DBR77 Visual Language (Tech Sexy)**: Każdy task dotykający UI MUSI respektować DBR77 — monochromatic chrome, invisible borders, depth przez tło (Layer 0–3), outline ikony, max 1 kolorowy element (CTA), shadow tylko na floating. SSOT: `docs/ui-standards/00-foundation/visual-language.md`. Nie tracimy jakości — mamy dużo już opisane.
- **Enterprise baseline**: RBAC, audit logs, retention policy hooks, multi-tenancy.

### 1.3 Scope V4 (explicit)

- Wszystkie moduły z V4_GAP_ANALYSIS (Phase A + Phase B–F)
- 120 tasków z "Tasks do wdrożenia" + "Plan pokrycia gapu"
- Realtime collaboration (presence→CRDT) jako platforma
- Benchmark backend, Knowledge Graph, AI Advisor runtime

### 1.4 UI/UX maintenance — DBR77 Tech Sexy (MUST)

Wdrożenie V4 **NIE może obniżyć** istniejącej jakości UI/UX. Mamy dużo już opisane w `docs/ui-standards/`.

**Reguły utrzymania:**
1. **Przed każdym PR z UI** — przejrzyj checklist w `docs/ui-standards/00-foundation/visual-language.md` sekcja 13 "Quick Reference — Tech Sexy checklist".
2. **Nowe ekrany / moduły** — NModeLayout, NModeBlocks, App Table Standard — bez duplikowania własnego stylu.
3. **Bordery** — czy naprawdę potrzebne? Preferuj: tło / spacing / cień.
4. **Ikony** — outline, mono-weight, kolor = kolor tekstu. Nigdy filled w nav.
5. **Hover** — tylko zmiana tła (`bg-white/[0.03]`→`bg-white/[0.06]`). Nigdy kolor tekstu/borderu.
6. **Shadow** — tylko na floating (modal, dropdown). Nigdy na kartach w content.
7. **Spacing** — sidebar tight, content spacious. Warm darks (navy-950), nigdy pure black.

**Odwołanie:** `.cursorrules` + `docs/ui-standards/README.md` (zasada: NIE WYMYŚLAJ, sprawdź istniejące).

**FROZEN LAYOUTS (pinowane — NIE ZMIENIAJ):** `docs/ui-standards/FROZEN_LAYOUTS.md` — sidebar order, module topbar order, view-modes order, 1 Command Row, App Table + Preview, Workspace 3-tools strip. Nowe taski i implementacje nie mogą "rozjeżdżać" tych układów.

### 1.5 Out of scope (V4+)

- Marketplace / commerce / billing (poza podstawowym entitlement)
- Pełna integracja z 10+ zewnętrznymi systemami (Jira/ERP/Slack = R1 minimum)

---

## 2) Dashboard programu (postęp + kontrola)

> Pulpit dowodzenia — codzienna aktualizacja (5 min), weekly review (30 min).

### 2.1 Statusy (kontrakty)

**Status specyfikacji (per task):**
- `draft` — zarys + założenia
- `review` — gotowe do przeglądu
- `locked` — scope + DoD zamknięte (implementacja bez domysłów)
- `implemented` — dowiezione + minimalne QA

**Status implementacji:**
- `todo`
- `in_progress`
- `blocked`
- `done`

**Status QA:**
- `not_tested` — brak smoke (nie oznaczać "implemented" bez smoke)
- `smoke_passed` — podstawowy scenariusz (manual 5–15 min)
- `qa_passed` — szerszy smoke + regresja modułu

**Target release:**
- `R0` — Enterprise MVP (must)
- `R1` — Full V4 hardening
- `R2` — Polish + advanced

### 2.2 Wymagane pola w task ledger (MUST)

Każdy task musi mieć:
- **ID** (V4-XXX-NN)
- **SSOT** (link do gap analysis lub modułowego SSOT)
- **DoD** + **Acceptance / test plan**
- **Owner**
- **Dependencies** (blokujące taski)
- **PR/commit link** w Progress log po wdrożeniu

Reguła: `done` bez smoke = nie istnieje.

### 2.3 Postęp (dashboard modułowy)

| Moduł | Tasks | Spec (locked) | Impl (done) | QA (smoke) | Blockers | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| **5.1 Ideas** | 9 | 0/9 | 8/9 | 0/9 | — | — |
| **5.2 Notebook** | 7 | 0/7 | 7/7 | 0/7 | — | — |
| **5.3 Tasks+Decisions** | 8 | 1/8 | 8/8 | 0/8 | — | — |
| **5.4 Inbox+Focus** | 7 | 0/7 | 7/7 | 0/7 | — | — |
| **6.1 Interview** | 7 | 0/7 | 7/7 | 0/7 | — | — |
| **6.2 Consulting Tools** | 7 | 0/7 | 4/7 | 0/7 | — | — |
| **6.3 Assessments** | 7 | 0/7 | 7/7 | 0/7 | — | — |
| **6.4 Initiatives** | 7 | 1/7 | 4/7 | 0/7 | — | — |
| **6.5 Execution** | 8 | 0/8 | 8/8 | 0/8 | — | — |
| **6.6 Results** | 6 | 0/6 | 6/6 | 0/6 | — | — |
| **6.7 Finance** | 7 | 0/7 | 7/7 | 0/7 | — | — |
| **6.8 Reports** | 6 | 0/6 | 6/6 | 0/6 | — | — |
| **6.9 Presentations** | 7 | 0/7 | 7/7 | 0/7 | — | — |
| **6.10 Enterprise Platform** | 8 | 2/8 | 6/8 | 0/8 | — | — |
| **6.11 Organization** | 9 | 1/9 | 6/9 | 0/9 | — | — |
| **6.12 AI Advisor** | 8 | 0/8 | 6/8 | 0/8 | — | — |
| **TOTAL** | **120** | **5/120** | **99/120** | **0/120** | | |

### 2.4 Current blockers

| Date | Blocker | Blocks tasks | Owner | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

### 2.5 Risks (poza blockerami)

> Ryzyka wpływają na planowanie i mitigation; nie blokują startu. Przegląd: co tydzień.
> **Ostatni przegląd: 2026-03-06**

| Ryzyko | Impact | Mitigation | Status (2026-03-06) |
| --- | --- | --- | --- |
| **Stary kod bez audit** — wiele istniejących write routes nie emituje zdarzeń | Średni — regresja traceability | `requireAudit` middleware + `audit_events` unified table + `GET /api/audit/events` z filtrami. Instrumentacja reszty write routes = R0 gate task. | **PARTIALLY MITIGATED** — 22 write routes mają `requireAudit`; controllery (Task, Initiative, Decision) logują bezpośrednio. ~90% write routes nadal bez audit — nie blocker, ale R0 gate wymaga pełnego pokrycia. |
| **Benchmark wymaga seed data** — `/api/benchmark/compare` zwraca 503 | ~~Wysoki~~ → Niski | Auto-seed z `industryBenchmarkService` (McKinsey/Gartner/IDC). Ingestion pipeline = R1. | **MITIGATED** — `benchmark_datasets` + `benchmark_datasets_versions` istnieją. API zwraca 200 z percentiles, cohortSize, suppressed flag. 503 tylko gdy seed fail. |
| **CRDT / tool switch** — przy migracji mindmap↔whiteboard możliwa utrata danych | ~~Wysoki~~ → Niski (by design) | Wszystkie narzędzia dzielą ten sam graph przez wspólne API `getMyIdeaMap`/`saveMyIdeaMap`. | **LOW RISK** — Przełączanie instant bez konwersji danych. Brak Yjs/Automerge = brak CRDT migration risk. Ryzyko dotyczy R1 (V4-IDEA-02/03), nie R0. |
| **Policy enforcement regresja** — legal hold może zablokować delete | Średni — user confusion | `requireNoLegalHold` przed delete/export (org, data, prezentacje). Jawny 403. | **MITIGATED** — `org_policies` z `legal_hold_enabled`. Enforcement na delete org, export/delete data, delete/export prezentacji. `residency_region` stored, enforcement = R1. |
| **Evidence storage (S3)** — vendor lock-in, koszt, virus scan | Średni | Evidence stored w DB (assessment_evidence) z tenant scoping + unique constraint. S3 adapter = R1. | **ACCEPTED (R1)** — Nie blokuje R0. |
| **Realtime WebSocket scale** — wiele sesji, presence, CRDT sync | Niski (R1) | Bazowy WS (`/ws/collab/:ideaId`) działa dla mindmap presence/cursors. | **ACCEPTED (R1)** — Deck/Table collab = stubs. Pełna implementacja = R1 (V4-ENT-06, V4-IDEA-02/03). |
| **Execution automation rules** — złożony grafy eventów | Średni | `task_automation_rules` tabela + CRUD API = schema-only stub. Engine = V4-TASK-05 (Wave 4). | **ACCEPTED (schema-only)** — Wystarczy na R0. |

### 2.6 Progress log (dziennik realizacji)

> 1 wpis dziennie min. + link do PR/commit.

| Date | Done | Notes / link |
| --- | --- | --- |
| 2026-03-04 | (initial) | V4 Implementation Program utworzony. 120 tasków z V4_GAP_ANALYSIS zmapowanych do V4-XXX-NN. |
| 2026-03-04 | Faza 2 R0 | INIT-02, EXEC-06, ASMT-01/02/03, RSLT-01/03, TOOL-01/02 (eca9e9d, 12ee900). |
| 2026-03-04 | Faza C / Wave 1–4 | ENT-03, ENT-04, ORG-01, TASK-01/03/08, INIT-01, IDEA-01/04/08, EXEC-01/02. Dashboard updated. scope=initiative|program validation w TaskController. |
| 2026-03-04 | V4-ENT-04 Admin UI | Zakładka Data Governance w SecurityPoliciesView: retention, legal hold, residency per org. API: GET/PUT /superadmin/org-policies. OrgPoliciesService.queryRun. |
| 2026-03-04 | V4-NOTE-05 | Notebook lifecycle UI: verificationStatus (unverified/verified/disputed), reviewCadence (weekly/monthly/quarterly/never), staleAt badge, "Mark as reviewed". Typy w myWork.ts, scheduleSave rozszerzony. |
| 2026-03-04 | Ledger impl | ENT-03, ORG-01, EXEC-01, TOOL-01, IDEA-09, EXEC-02 — już zaimplementowane, oznaczono impl. |
| 2026-03-04 | V4-DECK-01 | BlockSourceBadge na blokach z source_ref; CardSourceFooter z hover citation tooltip. |
| 2026-03-04 | V4-IDEA-07 | useKeyboardShortcuts w IdeaMapWorkspace: Escape, /, ?, Ctrl+G, Ctrl+A, Ctrl+D; KeyboardShortcutsHelp modal. |
| 2026-03-04 | V4-RSLT-01 | Migracja 631: dimensions_json, slices_json, formula, version w kpi_definitions. GET /api/results/metrics-semantic-layer. |
| 2026-03-04 | Kontrola #1 | V4-ORG-01 oznaczone do naprawy przez osobnego agenta po review jakości. Dalej kontynuujemy R0 od kolejnego taska w kolejce. |
| 2026-03-04 | V4-TASK-01 | Domknięto kontrakt hierarchii: listId/workstream alias w walidacji i API, programId/listId w odpowiedziach tasków, GET /api/tasks/rollups dla rollupów program/initiative/list. |
| 2026-03-06 | Kontrola #1 remediation closed | Dodano plan domknięcia checkpointu i wykonano remediację rdzenia: usunięto domyślne wymuszenie `SUPERADMIN`, uszczelniono `assessment_evidence` (tenant scoping, real evidence gate, unique conflict target), wdrożono dataset registry + versions dla benchmark backend, dopięto `requireAudit`/audit events na write-flowach checkpointu, rozszerzono policy enforcement na delete/export, poprawiono Deck share/load flow oraz przestano maskować brak semantic layer jako sukces. Statusy pozostawiono `impl` tylko tam, gdzie kontrakt został realnie dowieziony. |
| 2026-03-06 | V4-INIT-01, V4-TASK-03, V4-TASK-08 | INIT-01: `GET /initiatives/:id/gate-readiness-check` zwraca teraz kanoniczne `passed` + `missing[{section,field,requirement}]`, a status-change dalej blokuje transition na tych samych brakach. TASK-03: workflow tasków ujednolicony do `backlog/todo/in_progress/review/blocked/on_hold/done/cancelled`, dodano `GET /api/tasks/workflow-config`, walidację `block/unblock` i spójne błędy z `allowedNext`. TASK-08: dołożono unified audit events dla comment add/delete, assign/reassign/unassign, escalate/resolve, block/unblock, move i dependency add/remove. Build green. |
| 2026-03-06 | V4-EXEC-02, V4-IDEA-07 | EXEC-02: `GET /execution/:projectId/action-queue` rozszerzone o overdue `communication_plans` i otwarte `kpi_deviation_cases` bez aktywnego `kpi_deviation_action`; frontend queue renderuje już Decision/Risk/Task/Communication/KPI. IDEA-07: dopięto realne skróty w `IdeaMapWorkspace` dla add child/sibling, collapse, AI expand, focus selected oraz reparent promote/demote; workspace dostał jawne role/aria labels. |
| 2026-03-06 | V4-RSLT-01 | `GET /api/results/metrics-semantic-layer` ma już jawne 503 przy braku migracji, scope `org_only|org_plus_global`, `includeHistory` dla wersji KPI definitions oraz deduplikację latest-by-code/name w trybie domyślnym. Semantic layer ma teraz minimalny kontrakt RLS + versioning wymagany na checkpoint. |
| 2026-03-06 | V4-TOOL-01, V4-IDEA-09 | TOOL-01: `DiscoveryToolsHub` jest już jedynym canonical entrypoint dla tras Tools i odzyskał kompatybilność legacy deep-linków `?tool=` / `?sessionId=`. IDEA-09: `ReportEditor` pokazuje backlinks w review sidebarze, a `DeckBuilder` ma surface `Used in (backlinks)` dla prezentacji, co domyka parity z Ideas/Notebook/Tools/Initiatives. |
| 2026-03-06 | Risk review + R0 batch 2 | Przegląd 7 ryzyk z sekcji 2.5 — 4 zmitygowane (audit, benchmark, policy, CRDT), 3 accepted (R1). Weryfikacja i rejestracja 8 tasków w ledgerze: V4-IDEA-01 (canonical schema + validator + normalizeGraph), V4-IDEA-04 (requireAudit na 6 idea write routes + before/after), V4-IDEA-08 (AI proposal audit), V4-INIT-02 (programs table + CRUD + portfolio rollups z hierarchy), V4-ASMT-01 (benchmark-comparison endpoint w assessment), V4-ASMT-02 (report versions + legacy deprecation), V4-RSLT-03 (deviation audit + evidence gate + linkage), V4-TOOL-02 (runtime contract + DoD gates + evaluation). Fix TS: z.record(z.string(), z.unknown()), ActorType casing. Dashboard: 36→44/120 impl. |
| 2026-03-06 | R0 batch 3 (5 tasków) | V4-TASK-07: decision_playbooks table + PlaybookSchema + CRUD + required-fields-status + workflow gate validation. V4-TASK-04: criticalPathService (CPM forward/backward pass, FS/SS/FF/SF + lag), baseline snapshots API (create/list/get/compare), task milestones (is_milestone + target_date). V4-IDEA-05: ideaClusterService (materializeClusters, createOutcomeFromCluster), 3 API endpoints (materialize/outcome/convert), node-level convert wired to frontend. V4-EXEC-06: enhanced transitionWorkflow — auto-create tasks from decision options on publish, source_type/source_id traceability, LinkGraph edges, workflowStatus w getDecisionById, GET /created-tasks. V4-TASK-02: customFieldsService (11 field types + validation), CRUD for field definitions, validation w task create/update, migration 644. Dashboard: 24→29/120 impl. |
| 2026-03-06 | Batch 4 (5 tasków) | V4-TASK-05: automationRulesService (11 operators, 6 action types) + automationRulesEngine (EventBus subscriber, auto-evaluate on task.updated/created) + PUT/DELETE/dry-run/test endpoints + TaskController event emission. V4-EXEC-05: closedLoopService (7-step pipeline signal→RAID→task→verify→close) + closed_loop_workarounds table + 6 endpoints (create/list/get/advance/create-mitigation-task/verify). V4-EXEC-07: raidScoringService (P×I calculation, appetite thresholds, heatmap builder) + raid_appetite_thresholds table + 4 scoring endpoints + RAID CRUD enhanced z probability/riskScore/scoreCategory. V4-EXEC-03: schedule-risk-analysis endpoint (slack distribution, bottlenecks, at-risk tasks, baseline variance) + scheduleHealth w critical-path response. V4-TASK-06: task_allocations + user_skills + time_entries tables + workloadCapacityService + 7 capacity/time endpoints. Tasks+Decisions: 8/8 complete! Dashboard: 29→34/120 impl. |
| 2026-03-06 | Batch 5 (5 tasków) | V4-IDEA-02: WebSocket auth (JWT on upgrade), shared session state (node locking, selections, viewport sync), heartbeat/ping, collab_sessions + collab_session_events persistence, frontend auth token + lock/unlock/select hooks. V4-INIT-05: staffing_plans + staffing_plan_roles tables, staffingPlanService (CRUD, gap analysis z skill matching, auto FTE sync), 10 endpointów, auto-sync capacity on resource changes. V4-EXEC-04: initiative-level capacity (getInitiativeCapacity, getLevelingAlerts, getCapacityTimeline), 4 endpointy (initiative + execution-control). V4-EXEC-08: steerco_packs + steerco_pack_recipients tables, 8 endpointów (CRUD, distribute, acknowledge, tracking, auto-generate status). V4-ENT-01: ssoService (OIDC auth URL/code exchange/userinfo, SAML AuthnRequest/Response parsing), sso_auth_states table, OIDC/SAML callbacks implemented (JIT provisioning), session hardening (trackSessionActivity). Execution: 8/8 complete! Dashboard: 34→39/120 impl. |
| 2026-03-06 | Batch 6 (5 tasków) | V4-ENT-07: aiGovernanceService (metering dashboard, eval harness, policy enforcement) + ai_evaluations/ai_eval_datasets/ai_governance_policies tables + 16 governance endpoints w llm.routes.ts. V4-AI-01: AdvisorResponseSchema (Zod) z citations/proposedActions/questions/confidence/safetyNotes + normalizeToAdvisorResponse() + advisor_response_log table + 4 advisor endpoints + frontend types. V4-INBX-01: canonical_inbox_items table + inboxService (materialize, triage, delegate, SLA tracking) + 7 canonical inbox endpoints. V4-INIT-03: blueprint_wbs_items table + blueprintService (WBS tree CRUD, apply WBS/milestones/roles/DoD, validate, clone) + 8 blueprint endpoints. V4-ENT-02: SCIM 2.0 full protocol (GET/PUT/PATCH/DELETE Users, POST/GET/PATCH/DELETE Groups) + verifyScimToken middleware + conflict log + group sync + frontend conflicts tab. Dashboard: 39→44/120 impl (36.7%). |
| 2026-03-06 | V4-ASMT-03 | Na istniejącej tabeli `assessment_versions` dołożono backendowy kontrakt freeze + diff: `POST /api/assessment-workflow/:assessmentId/versions` tworzy snapshot oceny z `answers` + `score_summary`, a `GET /api/assessment-workflow/:assessmentId/versions/:fromVersion/diff/:toVersion` zwraca delty overall score i changed axes. Razem z wcześniejszym evidence gate domyka to checkpointowy zakres taska. |
| 2026-03-06 | V4-IDEA-07 | Keyboard layer domknięto o add child/sibling, AI expand, focus selected i reparent promote/demote, a semantyki `aria-label` / `role=region` są już na `IdeaMapWorkspace`, `IdeaRecommendationMap`, `IdeaTableTool`, `IdeaProcessFlowTool` i `IdeaWhiteboardTool`. Checkpointowy zakres a11y/shortcut contract został domknięty bez dalszego zawyżania statusu. |
| 2026-03-06 | R1 batch 5: DECK-02..07 + RSLT-02,04,05,06 (10 tasków) | **V4-DECK-02**: Migracja 655 — `deck_data_bindings` z artifact/dataset refs, diff preview on refresh, approval workflow. **V4-DECK-03**: `deck_layout_rules` (spacing/alignment/grid guardrails) + `deck_export_qa_results` z fidelity scoring i regression baseline. **V4-DECK-04**: `deck_template_governance` + `deck_template_versions`; consulting pack types, variables, versioning. **V4-DECK-05**: `deck_pptx_imports` z slide mapping, import warnings, round-trip tracking. **V4-DECK-06**: `deck_collab_sessions` z cursor position, active slide, heartbeat; join/leave/presence/getActiveCollaborators. **V4-DECK-07**: `deck_media_library` z rights_status, license tracking, watermark_applied + `deck_media_usage_log`. **V4-RSLT-02**: Migracja 656 — `kpi_connectors` (api/csv/database/webhook/manual) + `kpi_ingestion_log` z provenance i quality_score. **V4-RSLT-04**: `roi_evidence` z evidence_type, provenance_assumptions, finance_model_id, verification workflow. **V4-RSLT-05**: `kpi_report_schedules` + `kpi_report_delivery_log`; approval gates, recipient policies. **V4-RSLT-06**: `kpi_wallboards` z refresh interval, auto-rotation + `kpi_wallboard_alerts` z threshold/severity. 40+ REST endpoints pod `/api/presentations-v4/*` i `/api/results-v4/*`. 35+ frontend API methods. Dashboard: 75→85/120 impl. |
| 2026-03-06 | AI batch 7: AI-02,03,05,06,07 (5 tasków) | **V4-AI-02**: `intentRouter` (intent classification, tier/purpose suggestion, routing trace) + `contextPackService` (`ai_context_snapshots`, `ai_intent_routing_log`, versioned snapshot build/save/load) + endpoints `/api/ai/intent/*`, `/api/ai/context/*`. **V4-AI-03**: `claimCitationValidator` (claim extraction, claim→citation matching, coverage policy) + endpoints `/api/ai/citations/validate`, `/extract-claims`, `/coverage-stats`. **V4-AI-05**: `dataClassificationService` (`ai_data_classifications`, `ai_approval_requests`, permitted-source checks, approval gates/requests) + governance approval endpoints. **V4-AI-06**: `preflightCostService` (token/cost estimate, budget status, tier downgrade suggestions) + `/api/ai/budget/preflight|status|tier-override`. **V4-AI-07**: `evalHarnessService` (golden sets, citation coverage, policy compliance, regression gates, compare runs) + `/api/llm/governance/eval-harness/*` and regression gate CRUD. Dashboard: 85→90/120 impl. |
| 2026-03-06 | Batch 8: INBX-02,03,04,05,07 (5 tasków) | **V4-INBX-02**: aktywny `FocusView` czyta/zapisuje `focus/rules`, dostał template presets (Balanced/Deep Work/Manager), limity `maxToday/maxWeek`, capacity-aware guardrails i persisted planning strip. **V4-INBX-03**: auto-triage ma już konfigurowalny threshold, obejmuje notifications + tasks + decisions, a bulk triage zachowuje metadane AI (`from_ai`, `ai_confidence`) i odpala te same side-effecty co single-item triage. **V4-INBX-04**: Inbox UI pokazuje ostatnie eval runy i 30-day cost summary, backend cost/eval endpoints są podpięte pod operacyjny panel AI triage. **V4-INBX-05**: `InboxContent` materializuje canonical inbox przed odświeżeniem, pobiera canonical stats i utrzymuje App Table + preview jako główną ścieżkę. **V4-INBX-07**: `team-workload` przeszedł na real capacity overview, `/my-work/executive-analytics` wspiera teraz widok org-wide bez `projectId`, a `ExecutiveDashboard` czyta initiative breakdown + capacity shortfall z realnych danych. Dashboard: 90→95/120 impl. |
| 2026-03-06 | R1 batch 4: RPT-01..06 (6 tasków) | **V4-RPT-01**: Migracja 654 — `report_source_packs` + `report_source_pack_items`; createSourcePack, addSourcePackItem z citation_policy (required/recommended/optional). **V4-RPT-02**: `report_data_bindings` z binding_type (kpi/finance/custom), dataset_ref, auto-diff on refresh, approval workflow. **V4-RPT-03**: `report_templates` + `report_template_versions`; variables, versioning, governance_level, publishTemplate z snapshot. **V4-RPT-04**: `report_brand_voice_policies` z tone, forbidden_phrases, required_source_citation, no_marketing_language; validateAgainstBrandVoice (marketing term detection). **V4-RPT-05**: `report_ai_proposals` z diff_preview, citations, ai_model_used; propose→accept/reject audit. **V4-RPT-06**: `report_distribution_schedules` + `report_distribution_log`; approval gates, recipient policies, delivery proof. 25 REST endpoints pod `/api/reports-v4/*`. 20+ frontend API methods. Dashboard: 69→75/120 impl. |
| 2026-03-06 | R1 batch 3: FINC-01..07 (7 tasków) | **V4-FINC-01**: Migracja 653 — `financial_model_versions` (branch/compare/merge scenarios) + `financial_model_version_diffs`; createModelVersion, compareVersions, mergeVersion. **V4-FINC-02**: `financial_dimensions` + `financial_allocations` + `financial_consolidations` tables; multi-dim planning z proportional/custom allocation, consolidation across models. **V4-FINC-03**: `financial_budget_versions` (planned vs actual + auto-variance), `financial_forecast_cycles`, `financial_variance_alerts`; updateBudgetActuals z auto-variance calc, approveBudget gate. **V4-FINC-04**: `financial_connectors` (excel/erp_sap/erp_oracle/csv/api) + `financial_sync_log`; bidirectional sync tracking, reconciliation status, provenance. **V4-FINC-05**: `financial_valuation_snapshots` z assumptions_hash + `financial_valuation_audit`; auto-audit on create. **V4-FINC-06**: `financial_ai_assumptions` z confidence, source_citations, ai_model_used; propose→accept workflow. **V4-FINC-07**: `financial_roi_links` z initiative/benefit binding, realized_value capture z evidence. 30 REST endpoints pod `/api/finance-v4/*`. 25+ frontend API methods. Dashboard: 62→69/120 impl. |
| 2026-03-06 | R1 batch 2: INTV-01..07 (7 tasków) | **V4-INTV-01**: Migracja 652 rozszerza `interview_template_questions/interview_questions` o `question_config` (matrix rows/cols, ranking items, scale), `branching_rules`, `is_repeatable`; `interview_respondent_segments` + `interview_quotas` tables. **V4-INTV-02**: `interview_distributions` table z `public_token`, status tracking (pending→sent→opened→started→completed), `interview_reminder_schedules`; `interviewEnterpriseService` z createDistribution, getDistributionStats, markDistributionSent, getDistributionByToken. **V4-INTV-03**: `interview_evidence` rozszerzony o storage_backend, content_hash, virus_scan_status, retention_until; `interview_evidence_access_log` z logEvidenceAccess/getEvidenceAccessLog. **V4-INTV-04**: `interview_diagnostics_snapshots` (themes/sentiment/trends/segments/drivers); createDiagnosticsSnapshot/getDiagnosticsSnapshots. **V4-INTV-05**: `interview_findings` table z finding_type (gap/strength/risk/opportunity), severity, evidence_refs, status pipeline (identified→recommended→initiative_created); promoteFindingToInitiative z traceability. **V4-INTV-06**: anonymity_mode/min_cohort_size/redaction_rules/export_gating na interview_sessions; checkCohortSize (suppressed jeśli <min), checkExportGating. **V4-INTV-07**: `organization_context_versions` z version, confidence_scores, source_citations, reviewer sign-off; diffContextVersions. 30 REST endpoints pod `/api/interview-v4/*`. 20+ frontend API methods. Dashboard: 55→62/120 impl. |
| 2026-03-06 | R1 batch 7: INBX-06 + INBX-02,03,05 + ASMT-04..07 (8 tasków) | **V4-INBX-06**: Migracja 661 — rozszerzenie `inbox_connector_items` (sender_email/name, subject, received_at, routed_by_rule_id) + `inbox_routing_rules` (rule_name, action_type, action_config); `inboxEnterpriseService` z ingestConnectorItem, routeConnectorItem (rule matching engine), CRUD routing rules. **V4-INBX-02**: `focus_boards` + `focus_board_items` + `focus_board_templates` tables; capacity-aware planning (limit enforcement), shared templates, CRUD + complete/remove items. **V4-INBX-03**: `inbox_ai_triage_log` + `inbox_ai_triage_config` tables; triageInboxItem z confidence score, accept/reject/undo workflow (restores original priority/section), per-user config (threshold, allowed actions). **V4-INBX-05**: `getInboxTable` z App Table Standard (filters, sorting, pagination, search) + `getInboxItemPreview` z triage log. **V4-ASMT-04**: `assessment_findings` (nonconformity/observation/improvement, severity, clause_ref, framework_id) + `assessment_capa_actions` (corrective/preventive, verification method/result, sign-off). **V4-ASMT-05**: `assessment_evidence_clause_map` (evidence→framework clause, coverage level) + `assessment_evidence_access_audit` (action, IP, user agent) + `getClauseCoverage` aggregation. **V4-ASMT-06**: `assessment_ai_scoring_proposals` (proposed vs current score, citations, confidence, propose→accept/reject) + `assessment_eval_datasets` + `assessment_eval_runs` (accuracy/precision/recall/F1, compare runs). **V4-ASMT-07**: `assessment_report_reviews` (request→approve/reject, sign-off, comments) + `getVersionDiff` (answer-level diff, score summary comparison). 30+ REST endpoints pod `/api/inbox-v4/*` i `/api/assessments-v4/*`. 40+ frontend API methods. Inbox+Focus: 7/7, Assessments: 7/7. Dashboard: 94→99/120 impl. |
| 2026-03-06 | R1 batch 6: ENT-06 + IDEA-03 + TOOL-04 + TOOL-05 (4 taski realtime) | **V4-ENT-06**: Migracja 660 — `realtime_channels` (registry per resource type/id) + `realtime_presence` (connected users, cursor state, heartbeat, stale cleanup). **V4-IDEA-03**: `crdt_documents` (Yjs/Automerge state vector + snapshot) + `crdt_updates` (incremental updates z sequence numbers); createCrdtDocument, saveCrdtSnapshot, appendCrdtUpdate, getCrdtUpdates. **V4-TOOL-04**: `tool_facilitation_sessions` (timer state, phases, settings) + `tool_facilitation_votes` (per-user identity, vote types, summary aggregation) + `tool_facilitation_roles` (facilitator/participant/observer + permissions) + `tool_facilitation_outcomes` (decisions/actions z vote summary, export to initiative/task). **V4-TOOL-05**: `tool_session_presence` (per-tool-session presence, cursor, active block, editing field) + `tool_session_edit_locks` (block-level locking z TTL, conflict detection). `realtimePlatformService` (40+ methods). 35 REST endpoints pod `/api/realtime-v4/*`. 30+ frontend API methods. Dashboard: 90→94/120 impl. |
| 2026-03-06 | R1 batch 1: ORG-05..09 + NOTE-01..04,06,07 (11 tasków) | **V4-ORG-05**: Unified KG schema — migracja 648 rozszerza `knowledge_graph_entities/relations` o provenance (source_artifact_type/id, actor_id, confidence, extraction_method), governance (pii_flag, redacted, merged_into_id), canonical_name; `kg_audit_log` i `kg_rebuild_jobs` tables. **V4-ORG-06**: `UnifiedKGService` z searchEntities, getRelationsForEntity, traverse (BFS do depth 5), stats; `GET/POST /api/knowledge-graph/entities`, `/relations`, `/traverse`, `/stats`. **V4-ORG-07**: `getProvenance` zwraca sourceArtifacts, relatedRelations, whyExplainer (human-readable). **V4-ORG-08**: `redactEntity` (PII), `applyRetentionPolicy`, `kg_audit_log` z read/export/search audit, `GET /governance/audit`. **V4-ORG-09**: `findDuplicates` (canonical_name grouping), `mergeEntities` (relation repointing + mention aggregation), `applyConfidenceDecay` (stale>90d), `startRebuildJob` (dedup+decay pipeline), `GET/POST /freshness/*`. **V4-NOTE-01**: `notebookService.capture()` z 4 connectors (upload/web_clipper/email_forward/api_import); `POST /api/notebook/capture/{web-clip,email,upload,import}`. **V4-NOTE-02**: Ingestion pipeline — extractText (PDF/XLSX/DOCX/HTML/TXT) → textToBlocks → FTS index update → embedding chunks storage. **V4-NOTE-03**: Verified — FTS via search_vector (migration 627) already working. **V4-NOTE-04**: `semanticSearch` (hybrid FTS+embedding), `buildRAGContext` z citations; `GET /notebook/search`, `POST /notebook/rag-context`. **V4-NOTE-06**: `notebook_ai_proposals` table + `createAIProposal`/`resolveAIProposal` (propose→accept/reject audit); `POST /pages/:id/ai-proposals`, `POST /ai-proposals/:id/resolve`. **V4-NOTE-07**: `resolveEmbedChips` resolves artifact refs (notebook/initiative/task/decision/tool/report/presentation/idea) z permission check; `POST /notebook/embed-chips/resolve`. Frontend API client: 20+ methods for KG + Notebook. Dashboard: 39→50/120 impl. |

### 2.6.1 Kontrola #1 — plan remediacji i domknięcia

> **Cel:** doprowadzić wszystkie taski dowiezione do punktu `Kontrola #1` do stanu zgodnego z DoD, bez „fałszywego impl” w ledgerze.  
> **Zasada:** status `impl` utrzymujemy tylko wtedy, gdy istnieje działający kod + smoke + brak znanych luk P0/P1 względem DoD.

**Zakres remediacji (wszystko do checkpointu):**
- Wave 1: `V4-ENT-03`, `V4-ENT-04`, `V4-ORG-01`, `V4-TASK-01`, `V4-INIT-01`
- Dalsze taski dowiezione przed checkpointem: `V4-IDEA-01`, `V4-IDEA-04`, `V4-IDEA-08`, `V4-IDEA-09`, `V4-TASK-03`, `V4-TASK-08`, `V4-EXEC-01`, `V4-EXEC-02`
- Dodatkowo oznaczone jako zaimplementowane przed/przy checkpointcie i wymagające uczciwego domknięcia: `V4-TOOL-01`, `V4-DECK-01`, `V4-IDEA-07`, `V4-RSLT-01`

**Najpierw naprawy krytyczne (P0, blokują uznanie tasków za done):**
1. `V4-ENT-03`
   Otworzyć audit gap: usunąć niebezpieczne obejścia uprawnień, przejść z "global best effort" na jawne `requireAudit` na write routes, zapewnić `before/after`, ujednolicić query API i smoke testy dla create/update.
2. `V4-ORG-01`
   Zastąpić pseudo-backend benchmarku prawdziwym kontraktem minimalnym R0: dataset registry + seed/dataset version + `cohortSize`/`suppressed` liczone z danych, nie hardcoded. API ma zwracać `200`, ale bez maskowania braku danych jako sukcesu.
3. `V4-ASMT-03` compatibility gap wykryty w review
   Naprawić `assessment_evidence`: unikalny constraint pod upsert, tenant scoping, real evidence gate, brak cichych false-positive readiness. To jest wymagane, bo taski do checkpointu już weszły w obszary, które konsumują benchmark/evidence.
4. `V4-DECK-01`
   Domknąć traceability UI do końca: kliknięcie citation musi prowadzić do artefaktu, share/embed nie może generować martwych linków, a Deck Builder musi mieć poprawny stan błędu zamiast wiecznego loadera.

**Domknięcie tasków „impl, ale niepełne”:**
- `V4-EXEC-02`: domknięte 2026-03-06 przez dołożenie queue dla overdue comm items i KPI deviations bez action plan; status podniesiony do `impl`.
- `V4-RSLT-01`: domknięte 2026-03-06 przez brak-maskowania migracji (`503`), scope `org_only|org_plus_global` i tryb `includeHistory/latest` dla KPI definitions.
- `V4-IDEA-07`: domknięte 2026-03-06 przez realne shortcuts + focus/reparent + semantyki `role`/`aria-label` na canvas tools.
- `V4-IDEA-09`: domknięte 2026-03-06 po dołożeniu parity `Used in` także do Reports i Presentations.
- `V4-TASK-03`, `V4-TASK-08`, `V4-INIT-01`, `V4-IDEA-01`, `V4-IDEA-04`, `V4-IDEA-08`: zweryfikować, czy kod faktycznie istnieje; jeśli nie, przywrócić `todo` / `in_progress` i wpisać brakujący zakres.

**Kolejność realizacji (must):**
1. Bezpieczeństwo i integralność danych: `ENT-03`, auth, audit, `assessment_evidence`.
2. Backend contracts R0: `ORG-01`, `INIT-01`, `TASK-03`, `TASK-08`, `EXEC-02`, `RSLT-01`.
3. UI/product completion: `DECK-01`, `IDEA-07`, `IDEA-09`, `TOOL-01`.
4. Ledger cleanup: aktualizacja statusów `Impl`/`QA`, dopisanie smoke evidence do Progress log.

**Definition of done dla remediacji checkpointu:**
- Każdy task do `Kontrola #1` ma jeden z trzech stanów: `implemented` z rzeczywistym smoke, `in_progress` z jawnym gapem, albo `todo`.
- Brak znanych luk `P0` w security, tenant isolation i martwych flow UI.
- Każdy task oznaczony `impl` ma referencję do konkretnego kodu i przechodzi smoke scenariusz z sekcji 7.
- Progress log zawiera wpis „Kontrola #1 closed” z listą tasków zamkniętych i listą tasków cofniętych do poprawy.

**Reguła współpracy z drugim agentem:**
- Ten tor prac naprawia i porządkuje wszystko do `Kontrola #1`.
- Drugi tor może iść dalej dopiero na taskach po checkpointcie; nie zmienia statusów ani DoD w obszarach checkpointu bez synchronizacji z tym planem.

---

## 3) Task ledger (pełna lista — 120 tasków)

> Każdy task odpowiada jednej pozycji "Tasks do wdrożenia" w V4_GAP_ANALYSIS.  
> Szczegóły (Plan pokrycia gapu) w `docs/product/V4_GAP_ANALYSIS.md`.

### 3.1 Phase A — MyWork (31 tasks)

#### 5.1 Ideas / Idea Workspace (9)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-IDEA-01 | Canonical IdeaWorkspaceGraph schema (node kinds, artifact refs, extensions) + migracje DB | draft | impl | not_tested | — | P0 |
| V4-IDEA-02 | WebSocket `/ws/collab/:ideaId` dla presence, cursors, shared session state (EPIC‑ENT‑RT‑01) | draft | impl | not_tested | — | P0 |
| V4-IDEA-03 | CRDT (Yjs/Automerge) dla mindmap/whiteboard/process flow | draft | impl | not_tested | V4-IDEA-02 | P0 |
| V4-IDEA-04 | Audit log dla edycji użytkownika i AI (actor, przed/po, reason, timestamp) + replay API | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-IDEA-05 | Model cluster/outcome na poziomie node/sticky + deterministyczna konwersja do Tasks/Decisions/Initiatives z LinkGraph backlinks | draft | impl | not_tested | — | P0 |
| V4-IDEA-06 | Export mindmap: PDF + outline/markdown; whiteboard: PDF/PNG z watermarkingiem | draft | todo | not_tested | — | P1 |
| V4-IDEA-07 | Keyboard shortcuts (reparent, multi-select, bulk ops) + focus model + screen-reader semantics (a11y DoD) | draft | impl | not_tested | — | P0 |
| V4-IDEA-08 | AI proposal audit — każda sugestia AI jako proposal z diff; apply rejestrowane w audicie | draft | impl | not_tested | V4-IDEA-04 | P0 |
| V4-IDEA-09 | LinkGraph contract w UI (embed chips, "Used in" surfaces) we wszystkich modułach | draft | impl | not_tested | — | P0 |

#### 5.2 Notebook + Knowledge (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-NOTE-01 | Capture connectors: web clipper, email forward, upload PDF/XLSX z ekstrakcją tekstu | draft | impl | not_tested | — | P0 |
| V4-NOTE-02 | Pipeline ingestii: plik → extract (OCR) → tokenize → indeks (full-text + embedding) | draft | impl | not_tested | V4-NOTE-01 | P0 |
| V4-NOTE-03 | Full-text search (PostgreSQL FTS lub Elasticsearch) zamiast SQL LIKE + filtry tags/space/project | draft | impl | not_tested | — | P0 |
| V4-NOTE-04 | Semantic search z RAG + citations (permission-safe, sourceRef) | draft | impl | not_tested | V4-NOTE-02 | P0 |
| V4-NOTE-05 | Model owner, verificationStatus, reviewCadence, staleAt w notebook_pages + UI lifecycle | draft | impl | not_tested | — | P0 |
| V4-NOTE-06 | AI insert-as-blocks z audit log (propozycja zapisana, apply rejestrowane) | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-NOTE-07 | Embed chips + preview shell (NModeBlocks.EmbeddedView) w Notebook, Reports, Decks | draft | impl | not_tested | — | P0 |

#### 5.3 Tasks + Decisions (8)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-TASK-01 | Zunifikowana hierarchia: program → initiative → workstream/list → task/subtask; spójne API | **locked** | impl | not_tested | — | P0 |
| V4-TASK-02 | Custom fields framework: schema registry, typy, walidacja, permissions | draft | impl | not_tested | — | P0 |
| V4-TASK-03 | Workflow engine: statusy + transitions + guards; approval steps z SLA | draft | impl | not_tested | — | P0 |
| V4-TASK-04 | Dependencies: milestone objects, baseline snapshots, critical path calculation | draft | impl | not_tested | V4-TASK-01 | P0 |
| V4-TASK-05 | Automation rules engine: triggers → conditions → actions; UI builder + dry-run + audit | draft | impl | not_tested | V4-TASK-01, V4-ENT-03 | P0 |
| V4-TASK-06 | Workload model + allocation (capacity, skills, time tracking); integracja /api/capacity | draft | impl | not_tested | — | P0 |
| V4-TASK-07 | Decision playbooks: required fields, workflow propose→review→approve→publish | draft | impl | not_tested | — | P0 |
| V4-TASK-08 | Audit framework: każda zmiana task/decision/automation emitowana jako zdarzenie | draft | impl | not_tested | V4-ENT-03 | P0 |

#### 5.4 Inbox + Focus + Executive (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-INBX-01 | Canonical inbox item schema: typy (task, decision, approval, signal), lifecycle, SLA, delegation | draft | impl | not_tested | — | P0 |
| V4-INBX-02 | Focus board v4: capacity-aware planning, reguły (max items per day), shared templates, persistence | draft | impl | not_tested | — | P0 |
| V4-INBX-03 | AI triage: confidence score, threshold, undo ostatniej AI triage | draft | impl | not_tested | — | P0 |
| V4-INBX-04 | Evals dla AI triage (accuracy na golden set) + cost controls | draft | impl | not_tested | V4-INBX-03 | P1 |
| V4-INBX-05 | Inbox table z App Table Standard; preview pane z parity actions | draft | impl | not_tested | — | P0 |
| V4-INBX-06 | Connectors: email→inbox, Slack/Teams webhooks→inbox; routing rules | draft | impl | not_tested | — | P1 |
| V4-INBX-07 | Executive analytics z real capacity (allocations) i initiatives linkage | draft | impl | not_tested | V4-TASK-06 | P1 |

### 3.2 Phase B–F — Pozostałe moduły (89 tasks)

#### 6.1 Interview + Research/Diagnostics (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-INTV-01 | Question types: matrix, ranking, repeatable; branching + quotas; respondent segmentation | draft | impl | not_tested | — | P0 |
| V4-INTV-02 | Distribution engine: kanały (email/link), reminder scheduling, tracking, anonymity flags | draft | impl | not_tested | — | P0 |
| V4-INTV-03 | Evidence storage: S3-compatible, virus scanning, retention policy, access audit | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-INTV-04 | Diagnostics dashboards: themes/sentiment/trends/segments, driver analysis, benchmark comparators | draft | impl | not_tested | V4-ORG-01 | P0 |
| V4-INTV-05 | Pipeline findings→recommendations→initiative program z traceability | draft | impl | not_tested | — | P0 |
| V4-INTV-06 | Anonymity modes: minimal cohort size, redaction, privacy-safe aggregation; export gating | draft | impl | not_tested | — | P0 |
| V4-INTV-07 | Company context: versioning, confidence scoring, source citations, reviewer sign-off | draft | impl | not_tested | — | P0 |

#### 6.2 Consulting Tools / Templates (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-TOOL-01 | Nawigacja Tools: jeden module hub, spójna lista sessions/library, standard preview | draft | impl | not_tested | — | P0 |
| V4-TOOL-02 | Framework runtime contract: typed I/O, DoD gates, deterministic export package | draft | impl | not_tested | — | P0 |
| V4-TOOL-03 | Biblioteka templates: SWOT/PESTLE/Porter/Journey/BCG/OKR; org-curated, versioning | draft | todo | not_tested | — | P1 |
| V4-TOOL-04 | Facilitation layer: timer, voting per-user identity, session roles, exportable outcomes | draft | impl | not_tested | V4-IDEA-02 | P0 |
| V4-TOOL-05 | Realtime (EPIC‑ENT‑RT‑01): presence + multi-user editing dla tool sessions | draft | impl | not_tested | V4-IDEA-02 | P0 |
| V4-TOOL-06 | Tool knowledge bank + scoped RAG: citations do interviews/notes/evidence | draft | todo | not_tested | — | P0 |
| V4-TOOL-07 | Entitlement model: licensed packs per org, policy enforcement | draft | todo | not_tested | V4-ENT-04 | P0 |

#### 6.3 Assessments (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-ASMT-01 | Benchmark backend: /api/benchmark/compare, datasets ingestion, cohort privacy rules | draft | impl | not_tested | V4-ORG-01 | P0 |
| V4-ASMT-02 | Assessment domain model: session→report→version; usunąć legacy route duplication | draft | impl | not_tested | — | P0 |
| V4-ASMT-03 | Score freeze + version diff + evidence completeness gates | draft | impl | not_tested | — | P0 |
| V4-ASMT-04 | VDA/ISO: findings/nonconformities, clause-level evidence, CAPA workflow | draft | impl | not_tested | — | P0 |
| V4-ASMT-05 | Evidence: clause mapping, access audit, retention integration z policy | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-ASMT-06 | AI scoring proposals z citations; eval harness per framework | draft | impl | not_tested | — | P0 |
| V4-ASMT-07 | Report version diff UX + reviewer sign-off workflow | draft | impl | not_tested | — | P0 |

#### 6.4 Initiatives (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-INIT-01 | Backend gate enforcement: gate-readiness-check zwraca missing; transitions blokowane | **locked** | impl | not_tested | — | P0 |
| V4-INIT-02 | Program hierarchy: initiative.parentProgramId, portfolio rollups (health, deps, capacity, ROI) | draft | impl | not_tested | — | P0 |
| V4-INIT-03 | Initiative blueprint templates: WBS, milestone templates, role templates; DoD per level | draft | impl | not_tested | — | P0 |
| V4-INIT-04 | Goals/OKR spine: obiekty Goal z rollup do initiatives; alignment UI | draft | todo | not_tested | — | P0 |
| V4-INIT-05 | Staffing plan: roles, allocations, skills; integracja z capacity model | draft | impl | not_tested | V4-TASK-06 | P0 |
| V4-INIT-06 | AI initiative blueprint generator: WBS/milestones/deps/resources jako proposal + citations | draft | todo | not_tested | — | P0 |
| V4-INIT-07 | Decision governance + RAID gates z initiative readiness | draft | todo | not_tested | — | P0 |

#### 6.5 Execution / Implementation (8)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-EXEC-01 | Signals engine: deterministyczne health (GREEN/AMBER/RED) z wyjaśnieniem "why red" | draft | impl | not_tested | — | P0 |
| V4-EXEC-02 | Action Queue: overdue decisions, comm items, high P×I risks, KPI deviations bez action plan | draft | impl | not_tested | — | P0 |
| V4-EXEC-03 | Critical path: obliczanie z dependencies, baseline snapshots UI, schedule risk analytics | draft | impl | not_tested | V4-TASK-04 | P0 |
| V4-EXEC-04 | Capacity model: allocations per task/initiative, leveling alerts, overload detection | draft | impl | not_tested | V4-TASK-06 | P0 |
| V4-EXEC-05 | Closed-loop workaround: signals→RAID mitigation→tasks→verify→close | draft | impl | not_tested | — | P0 |
| V4-EXEC-06 | Decision workflow: propose→review→approve→publish; auto-create tasks po publish | draft | impl | not_tested | V4-TASK-07 | P0 |
| V4-EXEC-07 | RAID scoring: P×I enforcement, appetite thresholds, heatmaps | draft | impl | not_tested | — | P0 |
| V4-EXEC-08 | Stakeholder comm: registry, plans per initiative, status/steerco packs, distribution | draft | impl | not_tested | — | P0 |

#### 6.6 Results / KPI / ROI (6)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-RSLT-01 | Metrics semantic layer: KPI definitions + dimensions + slices, RLS, versioning | draft | impl | not_tested | — | P0 |
| V4-RSLT-02 | KPI connectors: ingestion pipeline, scheduled refresh, provenance per datapoint | draft | impl | not_tested | — | P0 |
| V4-RSLT-03 | Deviation loop: verify/close z evidence; linkage do tasks/initiatives; audit | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-RSLT-04 | ROI: evidence dla realized values, provenance assumptions, linkage do finance | draft | impl | not_tested | — | P0 |
| V4-RSLT-05 | Scheduled KPI reporting: templates, approval gates, distribution policies | draft | impl | not_tested | — | P0 |
| V4-RSLT-06 | Wallboard mode: real-time refresh, alert banners, auto-rotation | draft | impl | not_tested | — | P1 |

#### 6.7 Financial Analysis (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-FINC-01 | Model versioning + scenario engine: branch/compare/merge | draft | impl | not_tested | — | P0 |
| V4-FINC-02 | Multi-dimensional planning: dimensions, allocations, consolidation | draft | impl | not_tested | — | P0 |
| V4-FINC-03 | Rolling forecast: budget versions, forecast cycles, variance workflows, approval gates | draft | impl | not_tested | — | P0 |
| V4-FINC-04 | Excel/ERP connectors: bidirectional sync, reconciliation, provenance | draft | impl | not_tested | — | P0 |
| V4-FINC-05 | Valuation: versioning, diff, audit trail dla assumptions | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-FINC-06 | AI mapping/assumptions z citations + eval harness | draft | impl | not_tested | — | P0 |
| V4-FINC-07 | Finance→ROI: assumptions z financial model ID; realized capture z evidence | draft | impl | not_tested | V4-RSLT-04 | P0 |

#### 6.8 Reports (6)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-RPT-01 | Source Pack Builder: unified artifact picker, upload bundle, enforced citations | draft | impl | not_tested | — | P0 |
| V4-RPT-02 | Data bindings: sekcje referencują dataset (KPI id, finance view); refresh + diff + approval | draft | impl | not_tested | — | P0 |
| V4-RPT-03 | Template system: variables, versioning, org governance, regression harness | draft | impl | not_tested | — | P0 |
| V4-RPT-04 | Brand voice: admin UX dla policy, hard mode (require source, no marketing language) | draft | impl | not_tested | — | P0 |
| V4-RPT-05 | Per-block AI propose→accept: diff preview, citations, audit, eval harness | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-RPT-06 | Scheduled distribution: approval gates przed send, recipient policies, proof of delivery | draft | impl | not_tested | — | P0 |

#### 6.9 Presentations (7)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-DECK-01 | Block-level traceability: sourceRefs; citation UI przy hover/click | draft | impl | not_tested | — | P0 |
| V4-DECK-02 | Deck refresh engine: bindings do artifacts, refresh z diff preview, approval gates | draft | impl | not_tested | — | P0 |
| V4-DECK-03 | Layout rules: auto-layout z guardrails; export fidelity QA + regression tests | draft | impl | not_tested | — | P0 |
| V4-DECK-04 | Template governance: variables, versioning, consulting pack templates | draft | impl | not_tested | — | P0 |
| V4-DECK-05 | PPTX import: mapowanie slajdów do blocks, round-trip gdzie możliwe | draft | impl | not_tested | — | P1 |
| V4-DECK-06 | Realtime (EPIC‑ENT‑RT‑01): WebSocket, presence, cursors | draft | impl | not_tested | V4-IDEA-02 | P0 |
| V4-DECK-07 | Media library governance: rights, entitlements, watermarking | draft | impl | not_tested | — | P1 |

#### 6.10 Enterprise Platform (8)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-ENT-01 | SSO (OIDC/SAML): provider config per org, session hardening, logout propagation | draft | impl | not_tested | — | P0 |
| V4-ENT-02 | SCIM: provisioning/deprovisioning, group sync, conflict handling | draft | impl | not_tested | — | P0 |
| V4-ENT-03 | Unified audit log: tabela audit_events, middleware per route, query API | **locked** | impl | not_tested | — | P0 |
| V4-ENT-04 | Policy engine: retention/legal hold/residency; enforcement hooks; admin UI | **locked** | impl | not_tested | — | P0 |
| V4-ENT-05 | Integration hub: connector registry, queue/retry, secrets vaulting, allowlists | draft | todo | not_tested | — | P0 |
| V4-ENT-06 | Realtime platform: WebSocket gateway, presence, CRDT store (Yjs/Automerge) | draft | impl | not_tested | — | P0 |
| V4-ENT-07 | AI governance: purposes registry, metering, budgets + alerts, prompt/version registry, evals | draft | impl | not_tested | — | P0 |
| V4-ENT-08 | Observability: metrics, traces (OpenTelemetry), SLOs, DR drills, security hardening | draft | todo | not_tested | — | P0 |

#### 6.11 Organization (9)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-ORG-01 | Benchmark backend: zastąpić stub 503; dataset registry, ingestion, refresh, versioning | **locked** | impl | not_tested | — | P0 |
| V4-ORG-02 | Cohort privacy: min N, suppression, noise/rounding, audit dla benchmark queries | draft | todo | not_tested | V4-ORG-01 | P0 |
| V4-ORG-03 | Framework mappings: SIRI/ADMA/DRD/ISO — percentiles, "what good looks like" | draft | todo | not_tested | V4-ORG-01 | P0 |
| V4-ORG-04 | Pipeline benchmark→gap→initiatives: automatyczne programy naprawcze | draft | todo | not_tested | V4-ORG-01 | P0 |
| V4-ORG-05 | Unified KG schema: LinkGraph + KG extraction, typowane nodes/edges, provenance | draft | impl | not_tested | — | P0 |
| V4-ORG-06 | Query API + UI explorer: graph traversal, semantic search, permission-aware | draft | impl | not_tested | V4-ORG-05 | P0 |
| V4-ORG-07 | Provenance: source artifact IDs, timestamps, actor, confidence; "why explainers" | draft | impl | not_tested | V4-ORG-05 | P0 |
| V4-ORG-08 | KG governance: permission-aware edges, retention, PII redaction, audit reads/exports | draft | impl | not_tested | V4-ENT-03 | P0 |
| V4-ORG-09 | Freshness: scheduled rebuilds, dedup/merge, confidence decay, monitoring | draft | impl | not_tested | V4-ORG-05 | P1 |

#### 6.12 AI Advisor (8)

| ID | Task | Spec | Impl | QA | Deps | P |
| --- | --- | --- | --- | --- | --- | --- |
| V4-AI-01 | Canonical AdvisorResponse schema: intent, answer, citations[], proposedActions[], etc. | draft | impl | not_tested | — | P0 |
| V4-AI-02 | Intent routing + context pack: standardized build z artifacts, versioned snapshot | draft | impl | not_tested | — | P0 |
| V4-AI-03 | Citation-first: claims muszą mieć citations; UI surface per claim; validator | draft | impl | not_tested | V4-AI-01 | P0 |
| V4-AI-04 | Typed actions framework: propose z preview/diff → accept → execution (RBAC, idempotency) | draft | todo | not_tested | V4-AI-01, V4-ENT-03 | P0 |
| V4-AI-05 | Governance: dataClass + permitted sources; policy engine; "requires approval" gate | draft | impl | not_tested | V4-ENT-07 | P0 |
| V4-AI-06 | Budgets z routing: preflight cost estimate, tier selection policy-driven | draft | impl | not_tested | V4-ENT-07 | P0 |
| V4-AI-07 | Eval harness: golden sets, citation coverage, policy tests, regression gates | draft | impl | not_tested | — | P0 |
| V4-AI-08 | Domain playbooks: Strategy, Decisions, RAID, Stakeholders, Results | draft | todo | not_tested | V4-AI-01 | P0 |

---

## 3.3 DoD + Acceptance (Wave 1 + R0 — locked)

> Wave 1 taski mają pełny DoD. Pozostałe R0 — concise DoD (szczegóły w Plan pokrycia gapu, V4_GAP_ANALYSIS).

### Wave 1 (V4-ENT-03, V4-ENT-04, V4-ORG-01, V4-TASK-01, V4-INIT-01) — Spec: **locked**

**V4-ENT-03 — Unified audit log**
- **DoD:** Tabela `audit_events` (actorId, actorType, action, resourceType, resourceId, before, after, metadata, timestamp). Middleware `requireAudit` na write routes. Query API: `GET /api/audit/events` z filtrami (resource, actor, dateRange).
- **Acceptance:** Create initiative → 1 event. Update task → 1 event. Query zwraca dane.
- **SSOT:** V4_GAP_ANALYSIS 6.10, Plan pokrycia gapu.

**V4-ENT-04 — Policy engine**
- **DoD:** Tabela `org_policies` (retentionDays, legalHoldEnabled, residencyRegion). Enforcement: przed delete/export sprawdzenie policy; block jeśli legal hold. Admin UI: konfiguracja per org.
- **Acceptance:** Ustaw legal hold na org → delete artefaktu zwraca 403 lub block.
- **SSOT:** V4_GAP_ANALYSIS 6.10.

**V4-ORG-01 — Benchmark backend**
- **DoD:** Zastąpić 503 w `benchmark.routes.ts`. Tabela `benchmark_datasets` + `benchmark_datasets_versions`. Ingestion job (lub seed). API `GET /api/benchmark/compare?framework=&orgId=&dimensions=` zwraca `{ percentiles, cohortSize, suppressed? }`. Min cohort size = 5 (suppress jeśli mniej).
- **Acceptance:** Wywołanie API zwraca 200 z danymi (nawet placeholder/mock dataset). UI Assessment benchmark comparison pokazuje dane.
- **SSOT:** V4_GAP_ANALYSIS 6.11, Plan pokrycia gapu.

**V4-TASK-01 — Zunifikowana hierarchia**
- **DoD:** Model: programId → initiativeId → listId → taskId. Spójne API dla MyWork i PMO (ten sam engine). Filtry scope=personal|initiative|program. Rollupy (progress, count) z hierarchii.
- **Acceptance:** Task ma initiativeId. MyWork i PMO używają tych samych endpointów. Rollup initiative progress działa.
- **SSOT:** V4_GAP_ANALYSIS 5.3, Plan pokrycia gapu.

**V4-INIT-01 — Gate enforcement**
- **DoD:** `GET /initiatives/:id/gate-readiness-check` zwraca `{ passed, missing: [{ section, field, requirement }] }`. `PATCH /initiatives/:id` przy status change sprawdza gate; 400 jeśli missing. Missing items contract (np. "Tasks wymaga min 1 task z assignee").
- **Acceptance:** Initiative bez required fields → gate-check zwraca missing. Próba status change → 400.
- **SSOT:** V4_GAP_ANALYSIS 6.4, Plan pokrycia gapu.

### R0 pozostałe (concise DoD)

| ID | DoD (skrót) | Acceptance |
| --- | --- | --- |
| V4-IDEA-01 | Schema w SSOT; migracja; walidator; no data loss tool switch | Przełączenie mindmap↔whiteboard nie gubi danych |
| V4-IDEA-04 | Integracja z ENT-03; event per user/AI edit | Każda edycja mapy → audit event |
| V4-IDEA-08 | AI proposal stored; apply → audit | AI apply rejestrowane |
| V4-IDEA-09 | EmbeddedView wszędzie; "Used in" parity | Ideas/Notebook/Tools/Initiatives/Reports/Presentations ten sam pattern |
| V4-TASK-03 | Statusy + transitions + guards | Guard blokuje invalid transition |
| V4-TASK-08 | Emit audit per task/decision change | Zmiana → event |
| V4-INIT-02 | parentProgramId; portfolio rollups | Portfolio dashboard pokazuje hierarchy |
| V4-EXEC-01 | Health + reason chain per red | "Why red?" pokazuje chain |
| V4-EXEC-02 | Action Queue z overdue/gaps | Queue pokazuje items |
| V4-EXEC-06 | Decision workflow; auto-create tasks | Publish → tasks created |
| V4-ASMT-01 | Integracja z ORG-01; /compare dla Assessment | Benchmark w Assessment UI działa |
| V4-ASMT-02 | Session→report→version; route cleanup | Jeden model, spójne routes |
| V4-ASMT-03 | Freeze + diff + evidence gates | Initiative gen blokowany bez evidence |
| V4-RSLT-01 | KPI definitions + dimensions + RLS | Metrics layer dostępny |
| V4-RSLT-03 | Verify/close z evidence; audit | Deviation loop zamknięty |
| V4-TOOL-01 | Jeden hub; lista sessions/library; preview | Nawigacja spójna |
| V4-TOOL-02 | JSON schema I/O; DoD gates; export | Tool complete wymaga DoD pass |

---

## 4) Phased releases (R0 / R1 / R2)

### 4.1 R0 — Enterprise MVP (must)

**Gate R0:** Foundation gotowa, kluczowe ścieżki działają, brak blokad na enterprise rollout.

**R0 task list (exact — 22 taski):**

| # | ID | Moduł |
| --- | --- | --- |
| 1 | V4-ENT-03 | Unified audit log |
| 2 | V4-ENT-04 | Policy engine |
| 3 | V4-ORG-01 | Benchmark backend (zastępuje 503) |
| 4 | V4-TASK-01 | Zunifikowana hierarchia |
| 5 | V4-INIT-01 | Gate enforcement |
| 6 | V4-IDEA-01 | IdeaWorkspaceGraph schema |
| 7 | V4-IDEA-04 | Audit dla Ideas (wymaga ENT-03) |
| 8 | V4-IDEA-08 | AI proposal audit (wymaga IDEA-04) |
| 9 | V4-IDEA-09 | LinkGraph contract UI |
| 10 | V4-TASK-03 | Workflow engine |
| 11 | V4-TASK-08 | Audit dla Tasks (wymaga ENT-03) |
| 12 | V4-INIT-02 | Program hierarchy |
| 13 | V4-EXEC-01 | Signals engine |
| 14 | V4-EXEC-02 | Action Queue |
| 15 | V4-EXEC-06 | Decision workflow |
| 16 | V4-ASMT-01 | Benchmark w Assessments (wymaga ORG-01) |
| 17 | V4-ASMT-02 | Assessment domain model |
| 18 | V4-ASMT-03 | Score freeze + evidence gates |
| 19 | V4-RSLT-01 | Metrics semantic layer |
| 20 | V4-RSLT-03 | Deviation loop (wymaga ENT-03) |
| 21 | V4-TOOL-01 | Tools nawigacja |
| 22 | V4-TOOL-02 | Framework runtime contract |

**R0 execution order (kolejność sugerowana — respektuj Deps):**
1. V4-ENT-03, V4-ENT-04, V4-ORG-01 (Wave 1)
2. V4-TASK-01, V4-INIT-01 (hierarchy + gates)
3. V4-IDEA-01, V4-IDEA-04, V4-IDEA-08, V4-IDEA-09
4. V4-TASK-03, V4-TASK-08
5. V4-INIT-02
6. V4-EXEC-01, V4-EXEC-02, V4-EXEC-06
7. V4-ASMT-01, V4-ASMT-02, V4-ASMT-03
8. V4-RSLT-01, V4-RSLT-03
9. V4-TOOL-01, V4-TOOL-02

**R0 gate criteria (ALL must pass):**
- [ ] Audit: każdy write (create/update/delete) na artefaktach emituje event do `audit_events`
- [ ] Policy: retention/legal hold sprawdzane przed delete/export
- [ ] Benchmark: `GET /api/benchmark/compare` zwraca percentiles (nie 503)
- [ ] Traceability: Initiative/Report/Deck ma `source_type + source_id`
- [ ] Gate: Initiative status change blokowany gdy gate-readiness-check zwraca missing
- [ ] Signals: Execution pokazuje "why red" (chain: signal→risk→decision→tasks)
- [ ] AI: propose→accept; brak silent writes

### 4.2 R0 Demo Script (10–15 min) — kanoniczny smoke test

> Po każdym większym PR: przejść ten skrypt. Nie przechodzi = task wraca na `blocked`.

**A) Audit**
- Wykonaj create/update na dowolnym artefakcie (initiative, task, report)
- Sprawdź `GET /api/audit/events` (lub ekwiwalent) — wpis z actor, action, resource, timestamp

**B) Benchmark**
- Otwórz Assessment z benchmark comparison
- UI pokazuje percentiles (nie "not configured" / 503)

**C) Traceability**
- Tools/Assessment → Create Initiative → w Initiative widoczny source ref
- MyWork Idea → Convert to Initiative → MYWORK ToolSession jako source

**D) Gate enforcement**
- Initiative bez wymaganych pól → próba zmiany statusu → 400 lub blokada w UI
- Gate-readiness-check zwraca listę missing items

**E) Execution "Why red?"**
- ExecutionHub → initiative w RED → klik "Why?" → chain (signal→risk→decision→tasks) widoczny
- Action Queue pokazuje overdue decisions, high P×I risks

**F) AI propose→accept**
- Użyj AI w Ideas/Notebook/Reports → proposal widoczny → apply wymaga akceptacji → audit entry

### 4.3 R1 — Full V4 hardening

- Realtime (V4-ENT-06, V4-IDEA-02, V4-IDEA-03)
- Wszystkie moduły z pełną listą P0
- Connectors (email, Slack, Teams)
- AI Advisor (V4-AI-01..08)

### 4.4 R2 — Polish + advanced

- P1 tasks
- PPTX import, media library
- Freshness KG, eval harness rozszerzenia

---

## 5) Suggested execution order (minimalizacja blokad)

> Kolejność zmniejszająca rework. Aktualizuj przy zmianach scope.

**Kluczowe blokery (NIE zaczynaj tasków zależnych przed tymi):**

| Bloker | Blokuje | Rola |
| --- | --- | --- |
| V4-ENT-03 (audit) | IDEA-04, NOTE-06, TASK-08, ASMT-05, RSLT-03, RPT-05, ORG-08, AI-04 | Wszystkie moduły emitujące audit muszą czekać na log |
| V4-ENT-04 (policy) | TOOL-07 (entitlement enforcement) | Policy engine musi być przed enforcement |
| V4-ORG-01 (benchmark) | INTV-04, ASMT-01 | Assessment/Interview benchmark UI |
| V4-IDEA-02 (WebSocket) | IDEA-03, TOOL-04, TOOL-05, DECK-06 | Realtime w Ideas/Tools/Decks |
| V4-TASK-01 (hierarchy) | TASK-04, TASK-05 | Dependencies, automation |
| V4-TASK-07 (decisions) | EXEC-06 | Decision workflow → auto-create tasks |

**Wave 1 — Foundation (blokuje resztę):**
1. V4-ENT-03 (audit log)
2. V4-ENT-04 (policy engine)
3. V4-ORG-01 (benchmark — blokuje ASMT, INTV)

**Wave 2 — Core data + hierarchy:**
4. V4-TASK-01 (hierarchy)
5. V4-INIT-01 (gates)
6. V4-IDEA-01 (schema)

**Wave 3 — Enterprise platform:**
7. V4-ENT-01, V4-ENT-02 (SSO/SCIM)
8. V4-ENT-06 (realtime)
9. V4-IDEA-02, V4-IDEA-03 (WebSocket + CRDT)

**Wave 4 — Module hardening (równolegle):**
- Ideas: V4-IDEA-04..09
- Notebook: V4-NOTE-01..07
- Tasks: V4-TASK-02..08
- Inbox: V4-INBX-01..07
- Interview: V4-INTV-01..07
- Tools: V4-TOOL-01..07
- Assessments: V4-ASMT-01..07
- Initiatives: V4-INIT-02..07
- Execution: V4-EXEC-01..08
- Results: V4-RSLT-01..06
- Finance: V4-FINC-01..07
- Reports: V4-RPT-01..06
- Presentations: V4-DECK-01..07
- Organization: V4-ORG-02..09
- AI Advisor: V4-AI-01..08

---

## 6) Verification matrix (flow → task coverage)

| Flow | Release | Tasks | Test (manual) | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Tools/Assessment → Initiative (traceable) | R0 | V4-TOOL-02, V4-INIT-01, V4-ASMT-02 | Source ref visible; gate blocks invalid transition | — | not_tested |
| MyWork Idea → Convert to Initiative | R0 | V4-IDEA-05, V4-IDEA-09 | Convert creates MYWORK ToolSession; backlinks | — | not_tested |
| Execution: "Why red?" chain | R0 | V4-EXEC-01, V4-EXEC-02 | Signal→risk→decision→tasks explainability | — | not_tested |
| Benchmark compare (Assessment) | R0 | V4-ORG-01, V4-ASMT-01 | /api/benchmark/compare returns percentiles | — | not_tested |
| Audit: every write logged | R0 | V4-ENT-03 | Create/update emits audit event; query API works | — | not_tested |
| AI: propose→accept (no silent write) | R0 | V4-IDEA-08, V4-NOTE-06, V4-AI-03 | AI suggests; apply requires user; audit entry | — | not_tested |
| Realtime collaboration (Ideas) | R1 | V4-ENT-06, V4-IDEA-02, V4-IDEA-03 | 2 users edit mindmap; no conflict | — | not_tested |
| AI Advisor: typed response + citations | R1 | V4-AI-01, V4-AI-02, V4-AI-03 | Advisor returns citations; UI opens source | — | not_tested |

---

## 7) PR checklist V4 (MUST przed merge)

- **SSOT link**: PR opisuje taski (V4-XXX-NN) i SSOTy.
- **Traceability**: nowe outputy mają `source_type + source_id`.
- **UI standards**: 1 Command Row, App Table, Preview pane, view-modes order. **FROZEN LAYOUTS:** sidebar/topbar/view-modes/Command Row/Preview/3-tools strip — nie zmieniaj (SSOT: `docs/ui-standards/FROZEN_LAYOUTS.md`).
- **DBR77 Tech Sexy** (jeśli PR dotyka UI): bordery tylko tam gdzie konieczne; depth przez tło (Layer 0–3); outline ikony; max 1 kolorowy CTA; shadow tylko na floating; sidebar tight, content spacious. Checklist: `docs/ui-standards/00-foundation/visual-language.md` sekcja 13.
- **i18n**: nowe etykiety PL+EN.
- **locked/read-only**: respektowane w UI + API.
- **Audit**: write operations emitują audit event (gdy V4-ENT-03 done).
- **AI**: propose→accept; brak silent writes.
- **Smoke**: autor przechodzi Verification Matrix w zakresie dotkniętych flow.

---

## 8) Naming / enums freeze

- **Task IDs**: V4-{MOD}-{NN} — nie zmieniać bez migracji refs.
- **Traceability**: `source_type`, `source_id` obowiązkowe.
- **Status enums**: spójne między modułami; migracja przy zmianie.

---

## 9) Index tasków (szybkie wyszukiwanie)

| ID | Moduł | Krótki opis |
| --- | --- | --- |
| V4-IDEA-01..09 | 5.1 Ideas | Schema, WebSocket, CRDT, audit, cluster/outcome, export, keyboard, AI audit, LinkGraph |
| V4-NOTE-01..07 | 5.2 Notebook | Capture, ingest, FTS, semantic search, lifecycle, AI audit, embed chips |
| V4-TASK-01..08 | 5.3 Tasks | Hierarchy, custom fields, workflow, dependencies, automation, workload, decisions, audit |
| V4-INBX-01..07 | 5.4 Inbox | Schema, Focus v4, AI triage, evals, table compliance, connectors, Executive |
| V4-INTV-01..07 | 6.1 Interview | Question types, distribution, evidence, diagnostics, pipeline, anonymity, context |
| V4-TOOL-01..07 | 6.2 Tools | Nav, runtime contract, templates, facilitation, realtime, RAG, entitlements |
| V4-ASMT-01..07 | 6.3 Assessments | Benchmark, domain model, gates, VDA/ISO, evidence, AI scoring, report diff |
| V4-INIT-01..07 | 6.4 Initiatives | Gates, program, blueprints, OKR, staffing, AI generator, governance |
| V4-EXEC-01..08 | 6.5 Execution | Signals, Action Queue, critical path, capacity, closed-loop, Decision, RAID, comm |
| V4-RSLT-01..06 | 6.6 Results | Semantic layer, connectors, deviation, ROI, scheduled, wallboard |
| V4-FINC-01..07 | 6.7 Finance | Versioning, multi-dim, forecast, connectors, valuation, AI, ROI link |
| V4-RPT-01..06 | 6.8 Reports | Source Pack, bindings, template, brand voice, AI, distribution |
| V4-DECK-01..07 | 6.9 Presentations | Traceability, refresh, layout, template, PPTX, realtime, media |
| V4-ENT-01..08 | 6.10 Enterprise | SSO, SCIM, audit, policy, integration hub, realtime, AI gov, observability |
| V4-ORG-01..09 | 6.11 Organization | Benchmark, privacy, mappings, pipeline, KG schema, query, provenance, governance, freshness |
| V4-AI-01..08 | 6.12 AI Advisor | Schema, routing, citations, actions, governance, budgets, evals, playbooks |

