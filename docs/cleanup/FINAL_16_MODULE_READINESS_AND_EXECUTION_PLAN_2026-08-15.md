# Consultify — finalny raport gotowości 16 modułów i plan wykonawczy

Data: 2026-08-15
Authority code SHA: `c0ca3f26d`
Cleanup baseline SHA: `b4b02deed`
Status całego systemu: `NOT_RELEASE_READY / CLEAN_CODE_INVENTORY_COMPLETE`

## 1. Co ten raport rozstrzyga

Raport jest różnicą `SSOT minus stan faktycznie podłączonego kodu`. Nie jest
listą pomysłów. Dla każdego modułu wskazuje właściciela danych, żywy łańcuch,
pozostałe zadania i dowody potrzebne do zamknięcia.

Źródła autorytetu:

1. `docs/SOURCE_OF_TRUTH.md` i `docs/ssot/registry.json`;
2. `docs/FUNCTIONAL_DOCUMENTATION.md` i kontrakt modułu;
3. `docs/modules/APPLICATION_LOGICAL_MODEL.md` oraz `MODULE_HANDOFFS.md`;
4. route, montowany UI, klient, endpoint, service i schema na authority SHA;
5. `docs/cleanup/generated/recovered-head-disposition.json`.

Pełna inwentaryzacja recovery jest zamknięta: `224/224` głów ma werdykt,
`SEMANTIC_REVIEW_REQUIRED=0`, `OWNER_DECISION_REQUIRED=0`. Dyspozycja:
18 reference/harness, 95 superseded, 76 represented canonical, 4 destructive
rejected, 23 integrated, 8 jawnych kandydatów integracyjnych. Żadne usunięcie
nie jest jeszcze autoryzowane.

Skala dowodu, stosowana osobno dla każdego modułu:

- `C` — code connected;
- `F` — focused tests;
- `D` — fresh/upgrade/replay real PostgreSQL;
- `S` — system gate na jednym SHA;
- `B` — signed-in browser desktop/mobile;
- `V` — visual/a11y;
- `P` — demo parity: deploy SHA, migracje, flagi i dane.

Brak litery oznacza `EVIDENCE_MISSING`, nie FAIL i nie DONE.

## 2. Werdykt 16 modułów

| # | Moduł | Kod | Dowód dziś | Werdykt | Minimalny zakres startowy |
|---:|---|---|---|---|---|
| 1 | Chat | podłączony, dwa kontrakty runtime | C/F; Ideas handoff D | PARTIAL | rozmowa, persistence, citation, proposal |
| 2 | My Work + Agent | hub podłączony; Agent ma 2 modele | C/F | PARTIAL | Inbox, Tasks, Decisions, Ideas, Notebook, Calendar, Transformation Case |
| 3 | Interview | kilka generacji API, flow podłączony | C/F | PARTIAL | jeden publish→response→approve→handoff |
| 4 | Tools | hub podłączony; Dynamic SWOT realny | C/F | PARTIAL | tylko Dynamic SWOT |
| 5 | Assessment | pięć powierzchni, konkurencyjne registries | C/F | PARTIAL | tylko DRD |
| 6 | Initiatives | canonical hub podłączony | C/F | PARTIAL | create/govern/start/handoff |
| 7 | Execution | canonical hub i spine podłączone | C/F | PARTIAL | initiative cards, work, control, evidence |
| 8 | Results | VNext podłączony w kodzie, deployment-gated | C/F | DISABLED/PARTIAL | KPI/ROI/OKR po cutover |
| 9 | Finance | wiele generacji, moduł closed | C/F | POST_MVP/PARTIAL | brak w podstawowym MVP |
| 10 | Materials | library + DOC/PPT/XLSX podłączone | C/F | PARTIAL | trzy realne formaty |
| 11 | Audits | dwa UI/API i sprzeczny badge | C/F | POST_MVP albo beta CRUD | tylko bazowy CRUD |
| 12 | Meeting | canonical service/hub zintegrowany | C/F/D | PARTIAL | meeting→minutes→approved task/decision |
| 13 | Organization | context/profile/claims podłączone | C/F | PARTIAL | approved context snapshot |
| 14 | Admin | tenant i superadmin control planes | C/F | SECURITY_PARTIAL | IAM + audit |
| 15 | Settings | szeroki hub ustawień podłączony | C/F | PARTIAL | preferences + security flows |
| 16 | Partner Portal | aktywny shell, legacy+V8 | C/F | POST_MVP/PARTIAL | bez nowej siódmej implementacji |

`C/F` nie oznacza gotowości produkcyjnej. Wspólny full gate nadal jest czerwony,
demo nie jest jeszcze przypięte do authority SHA, a większość modułów nie ma
aktualnego zestawu D/S/B/V/P.

## 3. Karty gotowości i zamknięte listy zadań

### 1. Chat — owner: conversations/messages; domeny docelowe posiadają handoffy

- Wejście/wyjście: wiadomość, plik, URL i scope → stream, citation, proposal,
  zatwierdzony handoff; Chat nie posiada Initiative, Idea ani artefaktu.
- Żywy łańcuch: `/chat` → `UnifiedChatPanel.tsx` → `useAIStream.ts` /
  `src/services/api.ts` → `/api/ai/chat/stream`, conversations i V8 handoff →
  `chatExecutionService.ts` / `teresaCopilotService.ts` → conversations,
  attachments, proposal/receipt tables.
- Gotowe: stream/stop/retry, ordering/idempotency, persistence, proposals,
  governed handoff; Teresa→Ideas ma atomowy writer i realPG rollback/concurrency
  `2/2 PASS`.
- Duplikat: legacy `/api/ai` stream i V8 snapshot/handoff nie są jednym
  publicznym kontraktem.
- Zadania:
  - `CHAT-001-T01` (`READY_SERIAL`): otwarty DOC/PPT/XLSX ma pierwszeństwo
    przed klasyfikatorem nowego outputu. Allowlist:
    `UnifiedChatPanel.tsx`, nowy `workspaceArtifactIntent.ts` i ich testy.
    DoD: open/edit istniejącego artefaktu nie tworzy nowego obiektu; nieznany
    kontekst wraca do normalnego classifiera.
  - `CHAT-001` (`READY_SERIAL`): opisać jeden publiczny contract i telemetry
    fallbacku. Allowlist: `src/services/api.ts`, `src/hooks/useAIStream.ts`,
    `server/src/Gateway.ts`, `server/src/routes/v8/chat.routes.ts`.
  - `CHAT-002` (`READY_PARALLEL`): realDB attachment/URL/citation provenance.
    Allowlist testów: `tests/acceptance/chat-003-*`, `tests/e2e/runtime/ai-chat-*`.
  - `CHAT-003` (`VERIFYING`): proposal approve/reject/retry i Ideas receipt;
    wykonać signed-in flow oraz tenant negative.
- DoD: C/F/D/S/B/V/P; reload tej samej conversation, zero silent mutation,
  dokładnie jeden owner receipt po retry.

### 2. My Work + Agent — owner: personal projections; Agent: transformation_cases

- Wejście/wyjście: domain events → inbox/tasks/decisions/ideas/notebook/calendar;
  outcome → jeden Transformation Case i wersjonowany Plan.
- Żywy łańcuch: `/my-work/*` → `MyWorkHub.tsx` / `AgentHubShell.tsx` →
  `/api/v8/my-work`, `/api/my-work`, `/api/v8/transformation-cases` →
  `myWorkRoofService.ts`, notebook/decision services,
  `transformationCaseService.ts` → My Work tables i `transformation_cases`.
- Gotowe: wszystkie podstawowe zakładki, Notebook CAS, Decisions/Ideas,
  manager workload AI+fallback. Agent ma case CRUD, plan approval i runtime.
- Konflikt: legacy `ai_agent_plans`, `transformation_cases` i `case_core` nie
  mogą być trzema writerami tego samego zlecenia. MVP owner:
  `transformation_cases`; `/zlecenia` i legacy archive pozostają OFF.
- Zadania:
  - `MYW-001`: usunąć niewidoczny V8→legacy success fallback lub zapisać
    telemetryczny degraded state. Allowlist: `InboxContent.tsx`,
    `src/services/api/v8/my-work.ts`, `server/src/routes/v8/my-work.routes.ts`.
  - `MYW-002`: readback `source_type/source_id` dla Decision, Notebook i Idea;
    realDB conflict/reopen/tenant suite.
  - `AGT-001-T01`: wykonać istniejący packet
    `docs/cleanup/execution-packets/AGT-001-T01.md` po odświeżeniu baseline;
    conversation→planning intake→ten sam `transformation_case_id` po retry.
    Nie wolno zapisywać do `case_core` ani `ai_agent_plans`.
  - `AGT-002`: Teresa i człowiek edytują tę samą plan-version lineage z diff/CAS.
  - `AGT-003`: jeden etap → owner-module write → artefakt → idempotent retry.
- DoD: My Work nie udaje canonical success po fallbacku; Agent nie pokazuje
  UUID/raw enum/NOT_CONNECTED normalnemu użytkownikowi; C/F/D/S/B/V/P.

### 3. Interview — owner: interview definitions, respondents, answers, insights

- Wejście/wyjście: scope/respondents/questions → immutable answers/evidence,
  approved insight i jeden downstream candidate.
- Żywy łańcuch: `/interview`, `/discovery` → `InterviewHub` → legacy/V4/V8
  interview clients → interview routes/services → sessions, assignments,
  answers, evidence, insights.
- Gotowe: assignments, questions, transcripts, AI review, summaries, insights.
- Zadania:
  - `INT-001`: jeden canonical client i adaptery; publish/invite/respond/resume/
    submit/revoke. Shared API client zastrzeżony dla integratora.
  - `INT-002`: approved insight → candidate preview → handoff.
  - `CLEAN-002-INT-005` + `INT-006` (`READY_SERIAL`): jedna transakcja/lease
    claim→initiative→receipt/status, preview enrichment, PBAC, fault/race tests;
    migracje i service integruje jedna osoba.
- DoD: respondent wall, expiry/revoke, answer lineage, stale version, tenant,
  role i no-orphan retry na fresh/upgrade PG oraz signed-in browser.

### 4. Tools — owner: ToolSession/ToolOutput; nie posiada Initiative

- Wejście/wyjście: mission/evidence/cards → approved immutable Tool Output,
  report/presentation i initiative candidate.
- Żywy łańcuch: `/discovery-tools` → `DiscoveryToolsHub.tsx` → tools/output APIs
  → `ToolController`, `ToolOutputsController`, `ToolInitiativeService` →
  sessions, known_tools, outputs, reports.
- Gotowe: pięć powierzchni; Dynamic SWOT ma realny engine, CAS, proposal
  lifecycle, real report i real presentation promotion. Raw initiative paths
  mają project anchoring i decoded titles.
- Zadania:
  - `TLS-001`: jeden Dynamic SWOT golden flow do immutable output, report,
    presentation i initiative lineage.
  - `TLS-002`: usunąć runtime CREATE/ALTER z `ToolController` do migracji.
  - `TEST-003`: dodać expectedVersion threading do aktualnych H3/H31 tests.
  - `TLS-003` (`POST_MVP`): każdy kolejny tool dopiero z niepustym builderem.
- DoD: stale 409/428, review/send-back/approve, output niepusty, tenant/race/
  idempotency, D/S/B/V/P.

### 5. Assessment — owner: method version, session, answers, report

- Wejście/wyjście: framework/answers/evidence → frozen assessment, immutable
  report, controlled initiatives batch.
- Żywy łańcuch: `/assessment/*` → `AssessmentHub` /
  `AssessmentSessionEditorView` → V8 + workflow-v2/report routes → definition,
  workbench, report and initiative services → assessment tables/method_packs.
- Gotowe: pięć powierzchni, DRD/SIRI/ADMA entry, freeze/report plumbing.
- Konflikt: `assessment_definitions` vs `method_packs`, V8 fallback, runtime DDL,
  legacy report redirect race.
- Zadania:
  - `ASM-001`: DRD-only golden flow i jeden methodology/version owner.
  - `ASM-002`: runtime DDL → migracje; fresh+upgrade ledger.
  - `ASM-003`: canonical report deep-link/origin filter i initiative batch.
  - `CLEAN-002-ASM-010` (`POST_MVP` unless DRD needs subset): reconcile artifact
    tabs, report/presentation surfaces, SIRI seed and Method Core suites from
    recovered head; never merge whole branch.
- DoD: save/reload/conflict/freeze/reopen, immutable lineage, role/tenant,
  C/F/D/S/B/V/P. Monday scope remains DRD only.

### 6. Initiatives — owner: initiatives and governance lifecycle

- Wejście/wyjście: approved candidate → exactly one Initiative → scheduled
  Execution handoff.
- Żywy łańcuch: `/initiatives` → `InitiativesHub` → initiatives/PMO API →
  initiative services/controllers → initiatives, history, gates, receipts.
- Gotowe: canonical hub; raw producers now resolve project and decode titles.
- Zadania:
  - `INI-001`: replay/idempotency, capability/role transitions, cancellation.
  - `INI-002`: exactly one handoff receipt and downstream ID.
  - `CLEAN-002-INT-005/006`: atomic candidate acceptance before declaring
    upstream handoffs safe.
- DoD: retry produces one row, all rows have tenant project, cold reopen,
  gate/CAS, provenance, role/tenant negatives and C/F/D/S/B/V/P.

### 7. Execution — owner: execution case, work, evidence; Initiative remains owner upstream

- Wejście/wyjście: approved handoff → work/resources/control/evidence → delivery
  decision and Results signal.
- Żywy łańcuch: `/execution` → `ExecutionHub` → execution/control APIs → PMO and
  execution services → execution spine, work, gates, rollout/evidence tables.
- Gotowe: Realizacje/Praca/Zasoby/Sterowanie/Raporty; advanced surfaces exist.
- Zadania:
  - `EXE-001`: one handoff = one execution case; idempotent readback.
  - `EXE-002`: delivery evidence independent of task status; current health
    model and blocked/recovery states.
  - UI requirement: główny widok Realizacji pokazuje karty realizowanych
    Initiatives, nie techniczną tabelę runtime.
- DoD: Initiative card→work/resource/control/report→evidence→decision;
  role/tenant/blocked/retry and C/F/D/S/B/V/P.

### 8. Results — owners: KPI, ROI i OKR są trzema osobnymi domenami

- Żywy łańcuch: `/results/kpi|roi|okr` → ResultsVNext surfaces →
  `/api/vnext/results/*` → command/repositories → RVN migrations.
- Gotowe: bogaty UI/API, visibility, versioning, deviation, PIR, check-ins;
  fixture roots/children istnieją i przeszły PostgreSQL 15/16 w acceptance seed.
- Blocker: deployment flags default OFF; normal route nie może kończyć w
  disabled shell ani polegać na query/localStorage.
- Zadania: `RES-001` cutover/profile/rollback; `RES-002` KPI observation→
  deviation→plan→effectiveness; `RES-003` ROI baseline→actual→variance→PIR;
  `RES-004` OKR objective/KR→check-in→reflection. Uzupełnić current pointers i
  brakujące child fixtures przed demo.
- DoD: three golden flows, visibility/self-approval/stale/append-only negatives,
  exact flags and C/F/D/S/B/V/P.

### 9. Finance — owner: finance-v3 canonical entities after bridge

- Żywy łańcuch: `/finance` → `FinanceHub` → legacy bridge + finance-v2/v3 →
  financial statements/modeling/adapters → Finance migrations.
- Gotowe: statement, baseline, prediction, analysis, valuation workspaces;
  shared utilities; assumption caveats; missing balance is no longer zero;
  11 acceptance flags can be org-scoped.
- Zadania:
  - `FIN-001`: bridge/backfill report i jedna ID space; zero unresolved IDs.
  - `FIN-002`: pięć workspaces create/update/approve/reopen.
  - `FIN-003`: Results ROI reconciliation and append-only Actual.
  - `CLEAN-002-FIN-005`: canonical i18n policy.
  - `CLEAN-002-FIN-006`: effective-tax policy, required-line presence,
    three-scenario persisted workbook export.
- DoD: precision, RLS/tenant, fresh+upgrade, exports and C/F/D/S/B/V/P.
  Finance pozostaje poza podstawowym MVP do wykonania FIN-001.

### 10. Materials — owner: Artifact registry plus native DOC/PPT/XLSX versions

- Żywy łańcuch: Materials launcher → Document Studio, Presentations, Excele →
  artifact/document/presentation/table APIs → registry/run/lineage/native
  services → artifact and native format migrations.
- Gotowe: library, editors, lineage; Tool presentation promotion; governed
  transformative document edit; comments/diff/export/streaming; workbook
  polish and operation leases.
- Zadania: `MAT-001` real DOCX; `MAT-002-T01` według istniejącego packetu
  `docs/cleanup/execution-packets/MAT-002-T01.md` dla real PPTX;
  `MAT-003` real XLSX; `MAT-004` launcher/retirement.
  `CLEAN-002-MAT-024` remains post-MVP data task:
  governed Atelier deck seed/materializer with target authority and rollback.
- DoD: editable real files, stable reopen, formulas/formats, immutable versions,
  four-eyes where required, provider errors, desktop/mobile visual/a11y and
  C/F/D/S/B/V/P.

### 11. Audits — owner unresolved between audit program and Method Audit

- Żywy łańcuch: `/audit-programs` + `/api/audit` and flag-gated Method Hub +
  `/api/audits` are two products; sidebar says soon while module gate says open.
- Zadania: `AUD-001` choose honest beta CRUD and align route/badge/API;
  `AUD-002` post-MVP single lifecycle owner, pack rights, segregation of duties,
  criterion→finding→action→closure/effectiveness.
- DoD beta: create/save/reopen/delete, role/tenant, consistent navigation.
  Full: proposal-only AI, immutable audit trail and handoff. No MVP DONE claim.

### 12. Meeting — owner: meetings/minutes; Tasks and Decisions remain downstream owners

- Żywy łańcuch: `/meeting` → `MeetingHub` → meeting API/service → meetings,
  participants, notes, agenda, outputs and idempotency/audit tables.
- Gotowe: canonical CRUD, adoption, participants, structured notes, archive,
  proposal-first task/decision outputs and realPG golden flow.
- Zadanie `MTG-001`: signed-in create→agenda/materials→notes→proposed summary→
  approve→one task+decision→reopen; consent/retention/role/tenant and badge.
- DoD: C/F/D/S/B/V/P. Integracja kodu jest gotowa; runtime/demo/visual nie.

### 13. Organization — owner: approved organization context snapshot

- Żywy łańcuch: `/organization/*` → Organization views → organization/context/
  claims APIs → profile/context/KG services → org, claims, sources, snapshots.
- Zadania: `ORG-001` document→claim proposal→approve→snapshot→AI request with
  exact snapshot ID; `ORG-002` one section/owner map and source delete/conflict.
- DoD: tenant/confidentiality/source-delete negatives, snapshot propagation,
  C/F/D/S/B/V/P.

### 14. Admin — owner: tenant control plane; SuperAdmin is separate platform plane

- Żywy łańcuch: `/admin/*` and `/superadmin/*` with separate guards → IAM,
  billing, integration, security and audit endpoints/services.
- Zadanie `ADM-001`: machine-readable route/action/capability matrix; audited
  invite/accept/role/revoke; last-admin, cross-org and stale-role negatives;
  hide controls without capability.
- DoD: every mutation tenant-scoped and audited; no admin/superadmin/settings
  ownership overlap; C/F/D/S/B/V/P.

### 15. Settings — owner: user preferences/integrations, never tenant policy

- Żywy łańcuch: `/settings/*` → settings modules → preferences, notifications,
  appearance, OAuth/calendar, MFA, export/deletion and AI settings APIs.
- Zadania: `SET-001` registry `setting→owner→storage→effect`, remove/hide no-op,
  prove reload/new-session; `SET-002` OAuth/MFA/export/delete and secret
  non-readback; forced tenant policies remain locked.
- DoD: language/theme/notifications/AI persist cross-session, mobile/a11y,
  policy/role negatives and C/F/D/S/B/V/P.

### 16. Partner Portal — owner: partner account, attribution ledger, payout

- Żywy łańcuch: `/partner/*` → Partner shell → legacy `/api/partners` + V8 →
  partner/referral/earnings services → partner, referral, ledger, payout tables.
- Gotowe: authenticated shell, start/referrals/clients/academy/resources/
  earnings/profile. Nie wolno budować siódmej implementacji.
- Zadania (`POST_MVP`): `PRT-001-CANONICAL-API` — jeden V8 contract i zero
  legacy fallbacku w golden flow; `PRT-002-INDIVIDUAL-LEDGER` — osobny ledger
  osoby, versioned commission rules i correction audit; `PRT-003-GOLDEN-FLOW`
  — pełny referral→sale→commission→payout.
- DoD: register→knowledge→certificate→code→sale→commission→payout plus expiry,
  correction, currency and partner isolation; C/F/D/S/B/V/P.

## 4. Osiem pozostałych kandydatów integracyjnych

| Kolejność | Task | Moduł | Zakres | Tryb |
|---:|---|---|---|---|
| 1 | `CLEAN-002-INT-005` | Interview/Initiatives | atomowy claim→initiative→receipt | serial, migrations/service |
| 2 | `CLEAN-002-INT-006` | Interview | lease, preview, PBAC/fault/concurrency | serial po INT-005 |
| 3 | `CLEAN-002-TEST-003` | Tools | CAS threading w H3/H31 tests | parallel |
| 4 | `CLEAN-002-QA-005` | test platform | tenant isolation 11 E2E | parallel |
| 5 | `CLEAN-002-ASM-010` | Assessment | artifact/report/presentation/SIRI reconciliation | bounded post-MVP; DRD subset only if required |
| 6 | `CLEAN-002-FIN-005` | Finance | canonical i18n coverage | parallel post-MVP |
| 7 | `CLEAN-002-FIN-006` | Finance | tax/required-lines/three scenarios | serial post-MVP |
| 8 | `CLEAN-002-MAT-024` | Materials data | governed Atelier deck fixture/materializer | serial data task, no demo write during integration |

Każdy task ma odzyskany SHA i `nextAction` w
`generated/recovered-head-disposition.json`. Nie wolno scalać całych gałęzi.

## 5. Zamrożona kolejność wykonania

1. **Fala 0 — authority:** freeze candidate SHA; update module/task documents;
   no shared checkout; zero semantic unknowns (osiągnięte).
2. **Fala 1 — data invariants:** INT-005/006, Tools CAS tests, E2E isolation;
   fresh/upgrade PG; candidate SHA A.
3. **Fala 2 — MVP code:** CHAT-001/2/3, MYW-001/2, AGT-001/2/3, INT-001/2,
   TLS-001/2, ASM-001/2/3, INI-001/2, EXE-001/2; candidate SHA B.
4. **Fala 3 — Materials and control plane:** MAT-001..4, ORG-001/2,
   ADM-001, SET-001/2, MTG-001; candidate SHA C.
5. **Fala 4 — cutover:** Results RES-001..4 only after D/S green; Finance,
   Audits full and Partner remain post-MVP unless scope is explicitly changed.
6. **Fala 5 — system acceptance:** standard sharded gate, dedicated performance,
   all realDB packets, deterministic fixtures, signed-in browser, visual/a11y.
7. **Fala 6 — deployment:** deploy exactly candidate SHA; verify server/client
   SHA, migration ledger, env flags and fixture readback; then owner acceptance.

Shared-file ownership: `AppRoutes.tsx`, route config, sidebar/menu, shared API,
feature profile, migration runner and deployment configuration are edited only
by the integrator at the end of a wave.

### MVP_REMAINING_WORK

1. `CHAT-001-T01`, `CHAT-001..003`, `MYW-001..002`, `AGT-001-T01..003`;
2. `INT-001..002` oraz jeden serialny packet `CLEAN-002-INT-005/006`;
3. `TLS-001..002` + `CLEAN-002-TEST-003`, `ASM-001..003` (DRD);
4. `INI-001..002`, `EXE-001..002`;
5. `MAT-001`, `MAT-002-T01`, `MAT-003..004`, `ORG-001..002`;
6. `ADM-001`, `SET-001`, `MTG-001`;
7. `RES-001..004` dopiero po zielonym D/S i kontrolowanym cutoverze.

### POST_MVP_BACKLOG

- Finance `FIN-001..003`, `CLEAN-002-FIN-005/006`;
- pełne Audits `AUD-002` (albo jawne wyłączenie; `AUD-001` może dać beta CRUD);
- Assessment poza DRD, katalog Tools poza Dynamic SWOT, Radar i pełne Cases;
- Partner `PRT-001..003`, Settings `SET-002`, Materials fixture `MAT-024`.

### Aktualny test/release baseline

Ostatni literalny pełny standardowy przebieg, wykonany przed bieżącym product
SHA, objął `4052/4052` plików dokładnie raz: `39 884` testy, `38 798 PASS`,
`581 FAIL`, `485 pending`, `19 todo`, `283` niezielone pliki; performance był
osobnym `PENDING`. Później naprawiono wiele starych harnessów, ale pełnej bramki
na `c0ca3f26d` nie wykonano. Dlatego `S=EVIDENCE_MISSING`, a nie zielone.

## 6. Standard pojedynczego pakietu wykonawczego

Żaden agent nie startuje z poleceniem „dokończ moduł”. Pakiet musi zawierać:

`TASK_ID, objective, baseline SHA, dependencies, exact allowlist, reserved shared
files, AS-IS evidence, TO-BE delta, writer/schema, fixture, readback, positive
flow, failure/stale/role/tenant tests, focused command, realDB command, browser
flow, visual/a11y, rollback, output commit and evidence record`.

Werdykt wykonawcy może być tylko `DONE_FOR_INTEGRATION`, `FIX_REQUIRED` albo
`BLOCKED`; status modułu nadaje integrator po pełnym dowodzie.

## 7. Brama końcowa

System jest gotowy do uruchomienia dopiero, gdy:

1. `candidate SHA == deployed server SHA == deployed client SHA`;
2. `SEMANTIC_REVIEW_REQUIRED=0`, `MVP candidate tasks=0`, untracked WIP=0;
3. fresh i upgrade migrations + replay są zielone;
4. standard full gate ma zero niesklasyfikowanych faili, performance ma osobny
   literalny wynik;
5. demo flags nie używają query/localStorage i zwykłe trasy nie pokazują shelli
   disabled/legacy;
6. dane demo mają tenant-scoped readback dla każdego golden flow;
7. wszystkie moduły MVP mają C/F/D/S/B/V/P;
8. wszystkie 16 kart mają verdict `MVP_READY`, `POST_MVP` albo `DONE`, nigdy
   ogólne „prawie gotowe”;
9. każde usunięcie ma recovery ref, bundle/manifest i dowód braku konsumenta.

Aktualny werdykt: inwentaryzacja kodu jest kompletna; produkt i release nie są
jeszcze gotowe. Pozostała praca jest jawna, skończona zakresowo i przypisana do
tasków powyżej.
