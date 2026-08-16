# Consultify — finalny raport gotowości 16 modułów i plan wykonawczy

Data: 2026-08-15
Authority product candidate SHA: `6e31012fbe3458dd6a3faccde2e6540f7837d613`
Authority acceptance code SHA: `14c8852a71cdc5c8bf723a9b21f5e1cc00a467f5`
Repository-owned browser evidence SHA: `7a25a88a59193c24a0516ae78c293e0e5774a357`
Repository-owned system-gate evidence SHA: `d1ee32a43` (canonical evidence HEAD `ad402cda3`)
Cleanup/report baseline SHA: `8210bc170`
Status całego systemu: `NOT_RELEASE_READY / LOCAL_ACCEPTANCE_PASS_WITH_1_EXPLICIT_PENDING / DEPLOY_PARITY_PENDING`

> CURRENT EVIDENCE CHECKPOINT — 2026-08-16, product authority `6e31012fb`,
> acceptance authority `14c8852a7`. Sekcje historyczne pozostają śladem audytu;
> sekcje 10–12 są bieżącym werdyktem i pakietem wykonawczym, zastępując ich
> starsze statusy.

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
18 reference/harness, 96 superseded, 76 represented canonical, 4 destructive
rejected, 30 integrated, 0 kandydatów integracyjnych. Żadne usunięcie
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
  - `CLEAN-002-INT-005` (`INTEGRATED_CANONICAL`): jedna przypięta transakcja
    claim→initiative→receipt/status; fresh PG 708 migracji, PBAC/tenant 12 PASS
    + 1 jawny skip, fault/concurrency 2/2 PASS dwukrotnie.
  - `CLEAN-002-INT-006` (`READY_SERIAL`): wyłącznie preview enrichment i
    signed-in proof, że snapshot/title/rationale/actor/evidence pokazane przed
    approval odpowiadają finalnemu Candidate i Initiative. Stary lease jest
    zastąpiony przez silniejszy transaction invariant i nie wraca.
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
  - `CLEAN-002-ASM-010`: DRD MVP subset jest zintegrowany — cold reopen pobiera
    właściwy session Output oraz persisted Reports/Initiative Drafts; focused
    DRD `62/62 PASS`. Jedyna zgodna delta recovery, tenant-safe SIRI draft seed,
    jest również zintegrowana. Rich viewers i niezamontowany presentation player
    są jawnym post-MVP, nie kandydatem recovery.
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
  - `CLEAN-002-INT-005` jest zintegrowany i ma realPG no-orphan/concurrency;
    `INT-006` pozostaje tylko preview-to-final lineage.
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
  - `CLEAN-002-FIN-005` jest zintegrowany: 22 brakujące klucze semantyczne w
    kanonicznych katalogach DE/ES/AR/JA; kontrakt locale `9/9 PASS`.
  - `CLEAN-002-FIN-006` jest zintegrowany: effective-tax policy,
    required-line presence i persisted Base/Bull/Bear workbook; `21/21 PASS`.
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
  `CLEAN-002-MAT-024` jest zintegrowany jako bezpieczna capability danych:
  dry-run default, ścisła authority/allowlist, pinned transaction, podpisany
  rollback manifest i lost-COMMIT reconciliation. Nie wykonano zapisu na demo.
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

## 4. Recovery ledger — zamknięty

Wszystkie 224 niezależne odzyskane heads mają dyspozycję: 30 zostało
zintegrowanych chirurgicznie, 76 jest reprezentowanych przez kanon, 96 ma
nowsze odpowiedniki, 18 to wyłącznie harness/reference, a 4 to odrzucone
destrukcyjne snapshoty. Pozostało zero kandydatów integracyjnych, zero
semantic unknown i zero owner-decision unknown. `CLEAN-002-ASM-010` zachował
DRD oraz SIRI seed, `CLEAN-002-FIN-005` domknął locale, a
`CLEAN-002-MAT-024` dostarczył governed materializer bez zapisu na demo.

Pełna dyspozycja i reguła odzyskania pozostają w
`generated/recovered-head-disposition.json`. Brak kandydatów recovery nie jest
równoznaczny z gotowością runtime: dalszą pracę wyznaczają atomowe taski 16
modułów i wspólna brama release.

## 5. Zamrożona kolejność wykonania

1. **Fala 0 — authority:** freeze candidate SHA; update module/task documents;
   no shared checkout; zero semantic unknowns (osiągnięte).
2. **Fala 1 — data invariants:** INT-005, Tools CAS tests i E2E isolation są
   zintegrowane; fresh PostgreSQL 16 + 708 migracji i atomic realPG są zielone.
   Preview lineage z INT-006 jest również zintegrowany i ma real route/PG 7/7
   PASS wykonane dwukrotnie.
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

1. `SYS-001` — jeden full system/typecheck/build/performance gate;
2. `REL-001` — exact-SHA deploy, migration/flag/data parity i rollback;
3. `UX-001` oraz 16 atomowych `*-BVP-001` — signed-in desktop/mobile,
   visual/a11y i demo acceptance;
4. `MAT-POL-001`, `MTG-POL-001`, `PRT-POL-001` tylko jeśli ich moduły mają
   wejść do deklarowanego release scope.

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
na `5bd7cece0` nie wykonano. Dlatego `S=EVIDENCE_MISSING`, a nie zielone.

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

## 8. CURRENT 16/16 evidence checkpoint — `032ca27f7`

Commity od `6d2b6d05f` do authority SHA domknęły realne delty produktu dla Chat,
My Work, Agent, Interview, Dynamic SWOT, DRD, Initiatives, Execution, Materials,
Results, Finance, Meeting, Audits beta, Organization, Admin/Settings i Partner
V8. Nie zmienia to bramy dowodowej: na `032ca27f7` nie wykonano jednego pełnego
system gate ani signed-in desktop/mobile + visual + demo-parity.

| # | Moduł | Aktualny dowód | Werdykt current | Jedyna pozostała praca |
|---:|---|---|---|---|
| 1 | Chat | C/F; D dla governed handoff | ACCEPTANCE_PENDING | `CHAT-BVP-001` |
| 2 | My Work + Agent | C/F; D częściowe dla Case/artefaktu | ACCEPTANCE_PENDING | `MYW-AGT-BVP-001` |
| 3 | Interview | C/F/D assignment+invitation | ACCEPTANCE_PENDING | `INT-BVP-001` |
| 4 | Tools | C/F/D Dynamic SWOT | MVP_SCOPE_ACCEPTANCE_PENDING | `TLS-BVP-001`; reszta katalogu POST_MVP |
| 5 | Assessment | C/F/D DRD, HTTP cutover | MVP_SCOPE_ACCEPTANCE_PENDING | `ASM-BVP-001`; inne metody POST_MVP |
| 6 | Initiatives | C/F/D exactly-once handoff | ACCEPTANCE_PENDING | `INI-BVP-001` |
| 7 | Execution | C/F/D case, health, evidence | ACCEPTANCE_PENDING | `EXE-BVP-001` |
| 8 | Results | C/F/D, KPI/ROI/OKR cutover w kodzie | RELEASE_ACCEPTANCE_PENDING | `RES-BVP-001` |
| 9 | Finance | C/F/D, inventory unresolved=0 i workspaces realPG | POST_MVP_ACCEPTANCE_PENDING | `FIN-BVP-001` |
| 10 | Materials | C/F; D dla workbook/presentation persistence | ACCEPTANCE_PENDING | `MAT-BVP-001`; provider export policy `MAT-POL-001` |
| 11 | Audits | C/F, base beta CRUD podłączony | BETA_ACCEPTANCE_PENDING | `AUD-BVP-001`; full lifecycle POST_MVP |
| 12 | Meeting | C/F/D acceptance packet | POST_MVP_ACCEPTANCE_PENDING | `MTG-BVP-001`; consent/retention owner sign-off `MTG-POL-001` |
| 13 | Organization | C/F/D immutable snapshots i surface ownership | ACCEPTANCE_PENDING | `ORG-BVP-001` |
| 14 | Admin | C/F/D IAM, last-owner, audit | SECURITY_ACCEPTANCE_PENDING | `ADM-BVP-001` |
| 15 | Settings | C/F/D preferences; secret redaction | ACCEPTANCE_PENDING | `SET-BVP-001`; sensitive `SET-002` POST_MVP |
| 16 | Partner Portal | C/F, canonical V8 boundary | POST_MVP_POLICY_BLOCKED | `PRT-BVP-001`; payout policy `PRT-POL-001` |

Wspólne taski: `SYS-001` = pełny test/typecheck/build/performance gate na jednym
SHA; `REL-001` = deploy tego SHA, fresh/upgrade ledger, flag/env/data readback;
`UX-001` = signed-in desktop/mobile, loading/empty/error, visual/a11y i brak
technicznych enumów/UUID. Dopiero `SYS-001 + REL-001 + UX-001` może dodać S/B/V/P.

## 9. FINAL evidence delta — authority `25adb3251`

Ta sekcja zastępuje statusy bieżące z sekcji 8; historia pozostaje zachowana.

| Brama | Stan na authority SHA | Dokładny dowód / ograniczenie |
|---|---|---|
| Recovery | `PASS_SEMANTICALLY_CLOSED` | 224 heads: 30 integrated, 76 represented canonical, 96 represented/superseded, 18 reference harness only, 4 rejected destructive; 0 candidate, owner decision i semantic review. `deletionAuthorized=0`, więc nie jest to zgoda na kasowanie. |
| Static | `PASS_TYPECHECKS` | Root i server typecheck PASS na `25adb3251`. Production build na tym exact SHA pozostaje częścią `FULL_STANDARD=PENDING`. |
| Triage 198 | `PASS_WITH_EXPLICIT_PENDING` | Discovery 198/198; 145 plików i 1363 assertions PASS, 53 pliki i 254 assertions jawnie PENDING, 0 unexpected; fresh pgvector 718/718 migracji. To nie jest pełny 4093-file standard. |
| Performance | `PASS_FOCUSED_5_MINUTE` | 30 próbek: 37.68→38.30 MB, +1.65%, last-10 +0.25%, próg 20%; positive control +54.17% został wykryty. To nie jest production-load/demo proof. |
| Local browser | `PASS_32_OF_32` | 16 modułów × desktop/mobile, normal OWNER; 0 console errors, blocking failed requests, unexpected API ≥400, blocking Axe i heading/layout failures. 32 runtime JSON + 32 screenshots. Dwa Chat aborty były wyłącznie reload-caused. |
| Full standard | `PENDING` | Placeholder do wyniku finalnego agenta; brak wyniku nie może być zastąpiony triage198 ani local browser. |
| Deploy/demo parity | `PENDING` | Brak dowodu, że demo serwuje exact product SHA z tym samym DB/flags/data. |

Wszystkie 16 kart `*-BVP-001` mają obecnie lokalne `B=PASS` i `V=PASS` na
`25adb3251`; ich `P` pozostaje `PENDING`. Dlatego identyfikatory nie są zamykane,
lecz przechodzą do stanu `LOCAL_BV_DONE / DEPLOY_P_PENDING`.

`UX-001=LOCAL_DONE`, `SYS-001=PARTIAL_FULL_STANDARD_PENDING`, a
`REL-001=PENDING`. Finalny werdykt pozostaje `NOT_RELEASE_READY`. Jawne taski
policy/deferred nadal obowiązują: `MAT-POL-001`, `MTG-POL-001`, `PRT-POL-001`,
`AUD-002`, `SET-002`, non-DRD Assessment, non-SWOT Tools i full Partner payout.

Authority evidence:

- `docs/program/gates/LOCAL_BROWSER_16_EVIDENCE_25adb3251.json`;
- `docs/program/gates/evidence/local-browser-16-25adb3251/`;
- `docs/program/CONSOLIDATED_GATE_TRIAGE_198_1dd3aad2a.json`;
- `docs/program/gates/PERFORMANCE_MEMORY_LEAK_GATE_3be83d285.json`;
- `docs/cleanup/generated/recovered-head-disposition.json`.

## 10. FINAL acceptance checkpoint — product `6e31012fb`

Ta sekcja jest aktualnym autorytetem statusu i zastępuje sekcje 8–9 tam, gdzie
podają starszy SHA. Aktualny final gate SHA:
`14c8852a71cdc5c8bf723a9b21f5e1cc00a467f5`; patch
raportu przygotowano w izolowanym worktree wywodzącym się z `cfcb90500`.
Kod produktu pozostaje zamrożony na
`6e31012fbe3458dd6a3faccde2e6540f7837d613`; późniejsze commity testowe i
evidence nie zmieniają product authority.

| Brama | Stan | Dowód / ograniczenie |
|---|---|---|
| Recovery | `PASS / CLOSED` | 224/224 heads sklasyfikowane; 0 semantic review, owner decision i candidate integration. Bundle/manifest są recovery authority; `deletionAuthorized=0`. |
| Cleanup | `PASS_BOUNDED` | Po preservation usunięto 43 potwierdzone worktree. Nie jest to zgoda na usuwanie kolejnych checkoutów, refs ani orphan candidates. |
| Static 6e3 | `PASS` | Root/server typecheck PASS; production build z limitem 8 GiB PASS w 57.24 s; migration unit/order/parity 17/17; inventory 931 unique bez kolizji; fresh PG 719; completeness 2/2; columns 12/12; bundle verify + restore + fsck PASS. |
| Browser 6e3 | `PASS_32_OF_32` | Evidence `7a25a88a5`; fresh disposable pgvector PG, 719 migracji, normal OWNER, 16 modułów × desktop/mobile, 32 JSON + 32 PNG, 0 fail/skip/flaky, console/API/request/Axe/heading/main/overflow/loading = 0. Dwa Socket.IO aborty Chat były reload-caused. |
| Full standard | `PASS_SCOPE_EQUIVALENT_034_4058` | 4058 plików; 40206 total, 39562 PASS, 0 FAIL, 625 pending, 19 todo na exact034. Dwa pliki 14c są realDB-only i standard-excluded, więc scope jest identyczny. |
| Isolated matrix | `PASS_EXACT_14C_72_OF_72` | Exact14c: 72/72 pliki, 1590/1590 PASS, 0 pending, 0 fail. Wcześniejsze socket transients nie reprodukują się w finalnym evidence. |
| RealDB matrix | `PASS_WITH_1_EXPLICIT_PENDING` | Exact14c, fresh PG 719: 64/64 pliki, 428 total, 427 PASS, 0 FAIL, 1 jawny My Work fixture-authority pending, 0 bad exits/unhandled. |
| Deploy/demo | `PENDING` | Brak server/client SHA, migration/flag/data readback i rollback proof. Cleanup nie wykonał deployu. |

`B/V=PASS_LOCAL` pochodzi z exact-6e3 matrix. `P=PENDING` dla wszystkich, więc
żaden moduł nie otrzymuje pełnego `DONE`.

| # | Moduł | C/F | D | B/V | P | Werdykt / pozostały task |
|---:|---|---|---|---|---|---|
| 1 | Chat | PASS | PASS_BOUNDED | PASS_LOCAL | PENDING | `CHAT-BVP-001` — tylko deployed parity. |
| 2 | My Work + Agent | PASS | PASS_BOUNDED | PASS_LOCAL | PENDING | `MYW-AGT-BVP-001`. |
| 3 | Interview | PASS | PASS | PASS_LOCAL | PENDING | `INT-BVP-001`. |
| 4 | Tools | PASS | PASS Dynamic SWOT | PASS_LOCAL | PENDING | `TLS-BVP-001`; reszta POST_MVP. |
| 5 | Assessment | PASS | PASS DRD | PASS_LOCAL | PENDING | `ASM-BVP-001`; inne metody POST_MVP. |
| 6 | Initiatives | PASS | PASS | PASS_LOCAL | PENDING | `INI-BVP-001`. |
| 7 | Execution | PASS | PASS | PASS_LOCAL | PENDING | `EXE-BVP-001`. |
| 8 | Results | PASS | PASS | PASS_LOCAL | PENDING | `RES-BVP-001`. |
| 9 | Finance | PASS | PASS_BOUNDED | PASS_LOCAL | PENDING | `FIN-BVP-001`; POST_MVP scope. |
| 10 | Materials | PASS | PASS_BOUNDED | PASS_LOCAL | PENDING | `MAT-BVP-001`; `MAT-POL-001`. |
| 11 | Audits | PASS beta | PASS_BOUNDED | PASS_LOCAL | PENDING | `AUD-BVP-001`; `AUD-002` POST_MVP. |
| 12 | Meeting | PASS | PASS | PASS_LOCAL | PENDING | `MTG-BVP-001`; `MTG-POL-001`. |
| 13 | Organization | PASS | PASS | PASS_LOCAL | PENDING | `ORG-BVP-001`. |
| 14 | Admin | PASS | PASS | PASS_LOCAL | PENDING | `ADM-BVP-001`. |
| 15 | Settings | PASS | PASS core | PASS_LOCAL | PENDING | `SET-BVP-001`; `SET-002` POST_MVP. |
| 16 | Partner Portal | PASS bounded | PASS_BOUNDED | PASS_LOCAL | PENDING | `PRT-BVP-001`; `PRT-POL-001`. |

Pozostają dokładnie: `MYW-REALDB-FIXTURE-AUTH-001` dla jednego jawnego
fixture-authority pending; `REL-001-T01` do exact-SHA
deploy/readback/rollback; 16 istniejących `*-BVP-001` do deployed `P`; oraz
jawne policy/deferred `MAT/MTG/PRT-POL-001`, `AUD-002`, `SET-002`, non-DRD
Assessment, non-SWOT Tools i pełny Partner. Jeśli product SHA się zmieni,
powtórzyć pełne lokalne 32/32.

Werdykt: `LOCAL_SYSTEM_GATE_DONE_BOUNDED / PASS_WITH_1_EXPLICIT_PENDING / DEPLOY_NOT_STARTED / NOT_RELEASE_READY`.

## 11. Rejestr wykonania siedmiu etapów sprzątania

Ten rejestr rozlicza pierwotny plan, a nie tylko ostatnią falę testów. `DONE`
oznacza wykonany zakres techniczny z dowodem; nie oznacza automatycznie release.

| Etap | Stan | Co wykonano | Dowód | Wynik / ograniczenie |
|---|---|---|---|---|
| 1. Freeze | `DONE_BOUNDED` | Zapisano SHA i status aktywnych zadań, zatrzymano współdzielone kodowanie na czas inwentaryzacji, WIP trafił do nazwanych worktree/kwarantanny. | manifesty worktree/SHA i handoff; dalsze pakiety wykonywano wyłącznie w izolowanych worktree | Freeze był kontrolowanym oknem, nie permanentną blokadą repo. |
| 2. Pełna inwentaryzacja | `DONE` | Sklasyfikowano 224/224 recovered heads; unknown, owner-decision i candidate-integration = 0. | `docs/cleanup/generated/recovered-head-disposition.json` | Każda znaleziona historia ma disposition; brak zgody na utożsamianie nieosiągalnego ref z brakującym produktem. |
| 3. Zabezpieczenie wartości | `DONE` | Zapisano bundle, manifesty SHA-256, recovery refs oraz odtwarzalne kopie przed cleanupem. | bundle verify, fresh restore i `git fsck` PASS na exact product gate | `deletionAuthorized=0` pozostaje literalne dla celów spoza potwierdzonej listy. |
| 4. Rekonstrukcja jednego drzewa | `DONE_CODE` | Funkcje przenoszono chirurgicznie do jednego kanonu; nie scalano brudnych branchy w ciemno. | product authority `6e31012f…`; acceptance authority `14c8852a…`; clean evidence branches | Acceptance zawiera matrix/evidence, product SHA pozostaje osobnym autorytetem runtime. |
| 5. Audyt modułów | `DONE_INVENTORY` | Wszystkie 16 modułów ma ownera danych, mounted chain, stan kodu/D/B/V/P i jawny backlog. | sekcje 2–3 oraz finalne karty poniżej | Kod i local acceptance są mocne; `P` pozostaje otwarte dla 16/16. |
| 6. Usuwanie | `DONE_BOUNDED` | Po preservation usunięto 43 potwierdzone duplikaty/worktree; nie wykonano szerokiego delete refs/checkouts. | rejestr cleanup i recovery manifest | Każde dalsze usunięcie wymaga nowej listy celów i authority. |
| 7. Brama końcowa | `DONE_BOUNDED / PASS_WITH_1_EXPLICIT_PENDING` | Browser/static PASS; standard 4058 scope-equivalent PASS; isolated exact14c 72/72; realDB exact14c 64/64 z jednym jawnym fixture-authority pending. | evidence `d1ee32a43`, canonical evidence HEAD `ad402cda3`; 0 test fail i 0 bad exits/unhandled | Lokalny gate zakończony uczciwie; otwarte są jeden material pending oraz release/deploy parity. |

Wniosek po 1,5 dnia: inwentaryzacja i integracja kodu nie są już pracą do
powtarzania. Pozostała weryfikacja systemowa i wdrożeniowa. Nowy development
jest dozwolony tylko po reprodukowalnym failu jednej z tych bramek albo po
jawnej decyzji policyjnej.

## 12. Wykonywalny pakiet domknięcia 16 modułów

### 12.1 Wspólny kontrakt wykonania

Każde `*-BVP-001` ma ten sam owner wykonawczy: Release/CTO integrator. Product
owner uczestniczy tylko przy `*-POL-001`. Kolejność jest stała:
`SYS-001-TFINAL` → `SYS-001-ISOLATED` → `SYS-001-REALDB` → preflight
`REL-001-T01` → deploy exact product SHA → governed fixture/readback → deployed
desktop+mobile → rollback rehearsal. In-scope są tylko route/UI/API/service/
schema już wskazane w karcie; out-of-scope: refactor, nowy UX, nowy writer,
reaktywacja legacy i post-MVP.

Brama modułowa wymaga: `S` source/static, `D` fresh/upgrade DB, `B` signed-in
browser, `V` visual/a11y i `P` deployed parity. Obowiązkowe negatywy to tenant,
role/capability, stale/replay, concurrency/idempotency oraz cold reopen, jeśli
domena zapisuje dane. Migracja: `NONE_EXPECTED`; jeśli test ujawni schema gap,
powstaje osobny defect z jedną ordered idempotent migration, fresh+upgrade testem
i ponowieniem wszystkich bramek dotkniętych zmianą. Rollback: powrót do
poprzedniego potwierdzonego SHA oraz odtworzenie poprzednich flag; migracji nie
cofa się destrukcyjnie — muszą być backward-compatible. Literalne `DONE`:
wszystkie wymagane S/D/B/V/P PASS na tym samym product SHA, zero unknown fail,
server/client SHA i DB ledger readback zgodne, rollback rehearsal PASS.

Komenda lokalnego modułu (już PASS na 6e3):
`E2E_CANDIDATE_SHA=<product> E2E_BASE_URL=<url> npx playwright test -c playwright.local-browser-16.config.ts --grep "<NN-module>"`.
Ta sama komenda z deployed URL jest wymagana dla `P`; nie wolno użyć query,
localStorage, token injection ani route interception.

### 12.2 Atomowe karty pozostałej pracy

| Moduł / task | Już zintegrowane — nie otwierać ponownie | Exact in-scope / techniczny punkt kontroli | Out-of-scope / authority | Scenariusz + negatywy | DONE / rollback |
|---|---|---|---|---|---|
| 1 Chat `CHAT-BVP-001` | stream, retry, persistence, proposals, governed handoff | `/chat`; `UnifiedChatPanel.tsx`, `useAIStream.ts`, `api.ts`; `/api/ai/chat/stream`, V8 chat; conversations/messages/attachments/receipts | bez zmiany public contractu i bez legacy revival; owner Release | message+attachment+URL→citation→proposal→approve→receipt→reload; tenant, reject/retry, duplicate/concurrent approval | S/D/B/V/P na exact SHA; rollback deploy/flags |
| 2 My Work + Agent `MYW-AGT-BVP-001` | tabs, Notebook CAS, Decisions/Ideas, transformation case CRUD/plan/runtime | `/my-work/*`; `MyWorkHub.tsx`, `AgentHubShell.tsx`; `/api/v8/my-work`, `/api/v8/transformation-cases`; My Work tables + `transformation_cases` | bez `case_core`/`ai_agent_plans` writerów; Release | event→inbox→decision/notebook/idea; conversation→same case/plan→reopen; tenant, stale CAS, retry/concurrency | exact P plus stable IDs/readback; rollback SHA/flags |
| 3 Interview `INT-BVP-001` | assignments, answers/evidence, AI review, insight and atomic initiative claim | `/interview`, `/discovery`; `InterviewHub`; interview routes/services/tables | bez nowego client rewrite; Release | publish→invite→respond→resume→submit→approve insight→one candidate→reopen; expiry/revoke, respondent wall, tenant, stale, retry/no-orphan | S/D/B/V/P; rollback SHA, preserve immutable answers |
| 4 Tools `TLS-BVP-001` | Dynamic SWOT engine, CAS, output/report/presentation promotion | `/discovery-tools`; `DiscoveryToolsHub.tsx`; `ToolController`, `ToolOutputsController`, `ToolInitiativeService`; sessions/known_tools/outputs/reports | tylko Dynamic SWOT MVP; inne tools `POST_MVP`; Release | mission/cards/evidence→review→approve immutable output→report/presentation/candidate→reopen; 409/428, tenant, race, replay | exact P and nonempty lineage; rollback flag/SHA |
| 5 Assessment `ASM-BVP-001` | DRD HTTP workspace, CAS, freeze/report/output/reopen, initiative batch | `/assessment/*`; `AssessmentHub`, `AssessmentSessionEditorView`; V8/workflow-v2/report services; method/session/report tables | DRD only; SIRI/ADMA rich viewers `POST_MVP`; Release | library→session→answers/evidence→review/freeze→immutable report→batch→cold reopen; role, tenant, stale/replay, duplicate batch | exact P, one methodology/version and one batch; rollback flag/SHA |
| 6 Initiatives `INI-BVP-001` | canonical hub, project anchoring/title decode, atomic candidate acceptance | `/initiatives`; `InitiativesHub`; initiatives/PMO controllers/services; initiatives/history/gates/receipts | bez nowego producer/writera; Release | approved candidate→exactly one initiative→gate→execution handoff→reopen; tenant project required, role, stale, retry/concurrency | one row/receipt/downstream ID, S/D/B/V/P; rollback SHA |
| 7 Execution `EXE-BVP-001` | one handoff/case model, work/resources/control/report, independent evidence→Results | `/execution`; `ExecutionHub`; execution/control APIs and PMO services; execution/work/gates/evidence tables | retired light shell i technical table out; Release | Initiative card→case→work/resource/control/report→approved evidence→one Results write→reload; blocked, tenant, role, replay/concurrency | one health model and append-only result, exact P; rollback SHA |
| 8 Results `RES-BVP-001` | KPI/ROI/OKR VNext, versioning, deviation/PIR/check-in/reflection | `/results/kpi|roi|okr`; ResultsVNext; `/api/vnext/results/*`; RVN tables/migrations | bez legacy shell; flags wyłącznie zgodnie z registry; Release | KPI observation loop, ROI baseline→actual→PIR, OKR KR→check-in→reflection; visibility, self-approval, stale, append-only, tenant | 3 flows local+deployed, flag readback; rollback flags/SHA |
| 9 Finance `FIN-BVP-001` | five workspaces, caveats, missing-vs-zero, tax/tie-out, persisted 3-scenario workbook | `/finance`; `FinanceHub`; finance-v2/v3 bridge, statement/modeling services; finance-v3 entities | FIN expansion poza bounded MVP; Release | statement/baseline/prediction/analysis/valuation create→update→approve→export→reopen; precision, RLS/tenant, unresolved IDs=0, replay | exact D/B/V/P and export IDs; rollback SHA, non-destructive schema |
| 10 Materials `MAT-BVP-001` | artifact registry, native editors/lineage, governed document edit, workbook leases | launcher→Document Studio/Presentations/Excele; artifact/native routes and services; artifact/version/native tables | real format policy only via `MAT-POL-001`; Release + product owner | open/edit/version/export/reopen existing DOC/PPT/XLSX; provider error, lease/CAS, four-eyes, tenant/concurrency | files reopen editable with stable lineage and exact P; rollback SHA/provider flag |
| 11 Audits `AUD-BVP-001` | honest bounded beta surface and persisted audit program path | `/audit-programs` and mounted beta API/service; audit program tables | full Method Audit `AUD-002 POST_MVP`; no lifecycle merge now; Release | create→save→reopen→delete bounded audit; role/tenant, stale/replay, badge/route consistency | beta claims only, S/D/B/V/P; rollback route flag/SHA |
| 12 Meeting `MTG-BVP-001` | CRUD, agenda/materials/notes, proposal-first outputs, realPG golden flow | `/meeting`; `MeetingHub`; meeting API/service; meetings/participants/notes/outputs/idempotency/audit | retention/consent choice only `MTG-POL-001`; Release + owner | create→agenda/materials→notes→proposal→approve→exactly one decision/task/material→reopen; consent, tenant, role, replay/concurrency | exact cardinality/readback and P; rollback SHA, retain audit |
| 13 Organization `ORG-BVP-001` | immutable approved context snapshots consumed by Chat | `/organization/*`; Organization views; context/claims APIs and profile/KG services; org/claims/sources/snapshots | bez nowego KG model; Release | document→claim proposal→approve→snapshot→Chat with exact refs→reopen; conflict, source delete, tenant/confidentiality | immutable snapshot/ref equality, S/D/B/V/P; rollback SHA |
| 14 Admin `ADM-BVP-001` | capability/ownership registry and invite/role/revoke persistence/audit | `/admin/*` (nie `/superadmin/*`); IAM/billing/integration/security/audit endpoints and tables | bez zmiany capability policy; Release | invite→accept→role→revoke→new session; last-owner, cross-org, stale role, no-capability | every mutation scoped/audited, controls hidden, exact P; rollback SHA |
| 15 Settings `SET-BVP-001` | profile/language/theme/notifications/AI persistence and secret non-readback | `/settings/*`; settings modules; preferences/notification/appearance/AI APIs and storage | sensitive OAuth/MFA/export/delete `SET-002 POST_MVP`; Release | save→DB readback→reload→new session; tenant lock, no-op/error no fake success, secret absent | cross-session effect and S/D/B/V/P; rollback SHA/preferences compatible |
| 16 Partner `PRT-BVP-001` | bounded authenticated V8 partner connect/read surfaces | `/partner/*`; Partner shell; current V8 partner routes/services; partner/referral/ledger tables | payout policy/full ledger `PRT-POL-001`/`PRT-002/003 POST_MVP`; owner required | register/connect→certification→code→read attribution→reopen; expiry, tenant/partner isolation, retry/concurrency | bounded claim only, exact P; rollback SHA/flag, no fabricated payout |

### 12.3 Pełna integracja — zadania nadrzędne

| Task | Owner | Wejście → wyjście | Exact acceptance / DONE |
|---|---|---|---|
| `SYS-001-TFINAL` | QA integrator | exact034 scope-equivalent dla 14c → 4058 dispositions | 40206 total / 39562 pass / 0 fail / 625 pending / 19 todo; `PASS_SCOPE_EQUIVALENT`. |
| `SYS-001-ISOLATED` | QA integrator | exact14c 72 dedicated records | 72/72 files, 1590/1590 PASS, zero pending/fail. |
| `SYS-001-REALDB` | DB/QA integrator | exact14c, fresh PG719, 64 records | 64/64 files, 428 total, 427 PASS, 0 fail, 1 explicit My Work fixture-authority pending, 0 bad exits/unhandled. |
| `MYW-REALDB-FIXTURE-AUTH-001` | My Work fixture owner + QA | istniejący jawny pending → material authority/disposition | Potwierdzić właściciela fixture i wykonać właściwy assertion albo jawnie sklasyfikować non-product fixture; nie zmieniać produktu bez reprodukcji. |
| `REL-001-T01` | Release owner, wymaga authority do deploy | green system gates + product `6e31012f…` → deployed exact SHA | preflight remote/env/flags; deploy; server+client SHA, 719 migration ledger, governed fixture, 16 desktop/mobile, visual/API/console, rollback rehearsal. |

Nie istnieje drugi „plan budowy 16 modułów”. Jeżeli cztery zadania nadrzędne są
zielone, a 16 deployed `*-BVP-001` spełnia literalne `DONE`, bounded MVP jest
gotowy. Policy/post-MVP pozostaje jawnie poza tym werdyktem.
