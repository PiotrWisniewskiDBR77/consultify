# Consultify — modułowy gap plan i plan integracji

Data: 2026-08-15  
Authority SHA: `5792f250564b28bafc77b39fa1c9083e4756570d`  
Status: `CANONICAL_CLEANUP_ANALYSIS / RUNTIME_ACCEPTANCE_PENDING`

## Cel i granica dowodu

Dokument domyka semantyczną inwentaryzację wszystkich 16 pozycji menu i
przekłada istniejący kod na plan ukończenia. Źródłem TO-BE jest hierarchia
`SOURCE_OF_TRUTH -> FUNCTIONAL_DOCUMENTATION -> kontrakt modułu`. Źródłem
AS-IS są trasy, montowane komponenty, API, backend, migracje i testy w authority
SHA. To klasyfikacja code-level, nie dowód parity z demo.

`DONE` wymaga całego łańcucha:

`ordinary route -> production UI -> API -> service -> migration/realDB -> focused tests -> full gate -> exact-SHA demo -> browser + visual acceptance`

## Wniosek zarządczy

Repozytorium nie zawiera szesnastu pustych modułów. Zawiera duży, w większości
osiągalny produkt, ale z czterema klasami długu:

1. konkurencyjni właściciele: Agent/Case oraz generacje Finance, Audits i Results;
2. funkcje za flagami, fallbackami lub sprzecznymi statusami menu;
3. kod i testy bez aktualnego exact-SHA realDB/demo/browser proof;
4. monolity UI, osierocone warianty i historyczne API/schema wymagające decyzji
   ownera oraz recovery proof przed usunięciem.

Najkrótsza droga do MVP to odbiór wąskich golden flows, nie dalsza masowa
budowa. Finance, pełne Cases, pełne Audits i Partner Portal pozostają poza
pierwszym cutem.

## Macierz 16 modułów

| # | Moduł | AS-IS | Dokładny blocker | MVP |
|---:|---|---|---|---|
| 1 | Chat | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | legacy stream i V8 nie tworzą jednego kontraktu; brak provider/browser/readback | core |
| 2 | My Work | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | silent V8-to-legacy fallback i niepełny lineage | bez Radar |
| 3 | Interview | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | brak publish/invite/respond/approve/handoff E2E i respondent isolation | jeden flow |
| 4 | Tools | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | tylko Dynamic SWOT ma pełny engine; generic output może być pusty; runtime DDL | Dynamic SWOT |
| 5 | Assessment | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | generacje schema/API, fallback, runtime DDL, report redirect race | DRD |
| 6 | Initiatives | `LIVE_CONNECTED_CANDIDATE` core | idempotency, role-transition i handoff/readback bez live proof | core |
| 7 | Execution | `LIVE_CONNECTED_CANDIDATE` core | one-handoff-one-case i delivery evidence nieudowodnione | core |
| 8 | Results | `PARTIAL / DISABLED` | `/results` prowadzi do VNext, ale KPI/ROI/OKR default OFF | po cutover |
| 9 | Finance | `PARTIAL / DUPLICATE / CLOSED` | różne ID spaces, niepełny bridge/backfill, workspaces OFF | nie |
| 10 | Materials | base `LIVE_CONNECTED_CANDIDATE`, V2 `PARTIAL` | brak realnych DOC/PPT/XLSX reopen/export i visual/provider proof | base |
| 11 | Audits | `PARTIAL / DUPLICATE` | dwa UI/API, sprzeczne `open/soon`, lifecycle i prawa nieudowodnione | nie/beta CRUD |
| 12 | Meeting | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | realny hub ma badge `soon`; brak approval/handoff/consent proof | później/beta |
| 13 | Organization | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | profile/context/claims/KG nakładają się; snapshot propagation nieudowodnione | context core |
| 14 | Admin Panel | `LIVE_CONNECTED_CANDIDATE / SECURITY_CRITICAL_PARTIAL` | capability matrix i audit/last-admin negatives niezamknięte | minimalny admin |
| 15 | Settings | `LIVE_CONNECTED_CANDIDATE / PARTIAL` | brak jednego ownership/persistence/secret registry | core preferences |
| 16 | Partner Portal | `LIVE_CONNECTED_CANDIDATE / PARTIAL / DUPLICATE_API` | legacy+V8, brak individual referral i money-flow proof | nie |

## Chirurgiczne karty modułów

### 1. Chat

- Cel: intencja, wiadomości, pliki i źródła -> odpowiedź, cytowania, propozycja
  i kontrolowany handoff; bez przejmowania trwałych obiektów domenowych.
- AS-IS: `/chat` montuje `UnifiedChatPanel`; główny stream używa `/api/ai`, a
  `/api/v8/chat` obsługuje osobne snapshot/handoff/case-intake.
- Exact work: jeden publiczny kontrakt rozmowy; jawne adaptery i fallback
  telemetry; ordering, idempotency, attachment ingest, citation provenance i
  approve-once.
- DoD: ask/stream/stop/retry/persist/reload, plik i URL, citation, proposal
  approve/reject, tenant negative, cold reopen i czysta konsola.

### 2. My Work

- Cel: osobisty router uwagi; nie kopiuje domain truth.
- AS-IS: Inbox, Tasks, Decisions, Ideas, Notebook, Calendar oraz Agent/Vault są
  zamontowane; V8 Inbox może cicho przejść do legacy.
- Exact work: usunąć silent fallback lub uczynić go widocznym i telemetrycznym;
  ujednolicić origin/link; udowodnić source_type/source_id; Radar poza MVP.
- DoD: inbox->triage->task->close, decision approve, notebook conflict/reload,
  idea conversion i cross-tenant negative.

### 3. Interview

- Cel: kontekst, respondenci i pytania -> odpowiedzi, cytowalne insights i
  handoff do Tools/Assessment/Initiatives/Materials; nie posiada Assessment ani
  Initiative i AI nie dopisuje odpowiedzi respondenta.
- AS-IS: `/interview`, `/discovery` i legacy Project Intelligence montują
  `InterviewHub`; `/discovery/canvas` zachowuje wariant. Backend ma
  `/api/interview`, `/api/interview-v4` i V8, wraz z assignments, questions,
  AI review, transcript, evidence, summary i insights.
- Exact work: jeden canonical client/API; adaptery legacy; invitation lifecycle,
  autosave/CAS, anonymous wall, reviewer approval i immutable answer lineage.
- DoD: create/version/publish -> invite -> external response/resume/submit ->
  review/send-back/approve -> insight z answer refs -> jeden handoff; expiry,
  revoke, role, tenant i fresh/upgrade migration proof.

### 4. Tools

- Cel: evidence-backed analiza -> tool output/report/recommendation.
- AS-IS: pięć powierzchni działa, lecz generic snapshot może być pusty. Dynamic
  SWOT ma realny engine; `tool_reports` i legacy builder współistnieją; runtime DDL.
- Exact work: MVP tylko Dynamic SWOT; DDL do migracji; canonical output/report
  reads; każdy kolejny tool wymaga niepustego buildera i osobnego golden flow.
- DoD: create/reopen/CAS -> review/send-back/approve -> immutable output ->
  report + initiative z lineage; race/idempotency/tenant negatives.

### 5. Assessment

- Cel: framework, answers i evidence -> zatwierdzony Assessment, raport i drafts.
- AS-IS: pięć powierzchni, wiele backendów/method registries; V8 fallback do
  workflow-v2; runtime DDL; legacy report redirect ma race.
- Exact work: MVP tylko DRD; jeden methodology/version owner; migracje zamiast
  DDL; canonical report link i server-side origin filter.
- DoD: start -> answer/evidence -> save/reload/conflict -> freeze -> immutable
  report -> reopen -> controlled initiative batch; role/tenant negatives.

### 6. Initiatives

- Cel: evidence/recommendation -> zatwierdzona Initiative i Scheduled Handoff.
- AS-IS: `/initiatives` i cztery kanoniczne powierzchnie są podłączone;
  Full/Roadmap/Portfolio pozostają historycznymi kandydatami.
- Exact work: candidate-to-initiative constraint/replay; role matrix;
  cancel/reversal; Finance/Results provenance; handoff receipt.
- DoD: dokładnie jedna Initiative po retry; cold reopen; gate/CAS; approved
  handoff z jednym downstream ID.

### 7. Execution

- Cel: przyjąć handoff i prowadzić delivery bez kopiowania domain truth.
- AS-IS: `/execution`, Realizacje/Praca/Zasoby/Sterowanie/Raporty i backend
  spine istnieją; warstwy advanced zależą od flag.
- Exact work: one-handoff-one-execution-case; jeden health model; delivery
  receipt/evidence niezależny od samego task status; retry.
- DoD: karta Initiative -> work/resource/control/report writeback -> evidence ->
  delivery decision; role, tenant i blocked states.

### 8. Results — KPI, ROI, OKR

- Cel: osobne domeny measurement/deviation, economics/PIR oraz OKR/check-ins.
- AS-IS: bogate VNext UI/API/migrations/testy są w routingu, ale trzy flagi
  default OFF; legacy Results i `/roi` współistnieją.
- Exact work P0: jawny deployment cutover bez URL/localStorage; naprawić
  disabled-shell route; current-version pointers i pełne fixtures.
- DoD: KPI observation->deviation->action->effectiveness; ROI baseline->actual
  ->variance->PIR; OKR objective/KR->check-in->reflection; visibility,
  self-approval, stale-version i append-only negatives.

### 9. Finance

- AS-IS: legacy host, finance-v2/v3 i bridge działają w różnych ID spaces;
  moduł closed, większość flags OFF.
- Exact work po MVP: backfill/unresolved report; jedna generacja; brak pustych
  entity/version IDs; legacy retirement; reconciliation z Results ROI.
- DoD: statement/baseline/prediction/analysis/valuation create-update-approve-
  reopen, precision/RLS/tenant, upgrade ledger i export.

### 10. Materials

- Cel: jedna biblioteka i wersjonowane DOC/PPT/XLSX z provenance.
- AS-IS: hub prowadzi do edytorów; V2 lanes flagowane; stare Presentation
  Studio/Wizard nie są canonical ownerem.
- Exact work: realny flow każdego formatu z providerem, stable link, lineage,
  reopen/export i poprawnym preview.
- DoD: editable DOCX/PPTX/XLSX, formuły i formaty, immutable version, four-eyes
  tam gdzie wymagane, desktop/mobile visual acceptance.

### 11. Audits

- AS-IS: `/audit-programs` + `/api/audit` oraz flagowany Method Hub +
  `/api/audits` to dwa produkty; menu `soon`, konfiguracja `open`.
- Exact work: poza MVP albo uczciwe beta CRUD. Później jeden UI/API owner,
  prawa do packów, segregation of duties i lifecycle.
- DoD base: create/save/reopen/delete program, role/tenant, spójny badge. Full:
  criterion-to-closure, AI proposal-only, effectiveness i handoff.

### 12. Meeting

- Cel: agenda, uczestnicy i materiały -> zatwierdzone minutes, decisions, tasks
  i review outcomes; trwałe obiekty wracają do ownerów.
- AS-IS: `/meeting` montuje `MeetingHub`; `/api/meeting` jest za betaGate;
  list/agenda/notes/Operator Brief mają kod i testy, sidebar mówi `soon`.
- Exact work: minimalny Meeting/Minutes contract; proposal-first summary,
  decision/task approval; source refs; consent i retention; potem badge.
- DoD: create -> agenda/materials -> notes -> proposed summary -> approve -> one
  decision + task + material link -> cold reopen; consent/role/tenant negatives.

### 13. Organization

- Cel: profile/documents/claims -> zatwierdzony context snapshot dla Teresy.
- AS-IS: `/organization/*` jest kanoniczne, `/context/*` redirectuje; profiles,
  context store, claims/confidence/conflicts, KG, audit i snapshot istnieją.
- Exact work: jedna mapa sekcji; claim review/publish; snapshot ID w AI request;
  source deletion/conflict semantics; usunąć drugą administrację.
- DoD: document -> claim proposal -> approve -> snapshot -> Teresa z exact source
  -> conflict/resolution; tenant/confidentiality/source-delete negatives.

### 14. Admin Panel

- Cel: tenant control plane; SuperAdmin to osobny platform control plane.
- AS-IS: `/admin/*` ma guard ADMIN, `/superadmin/*` osobny guard/shell; backend
  obejmuje IAM, billing, integrations, security i audit.
- Exact work: machine-readable route/action capability matrix; org scope i audit
  dla mutacji; oddzielić settings/admin/superadmin; usunąć pozorne controls.
- DoD: invite/accept/role/revoke; policy + audit readback; last-admin,
  cross-org, stale-role i no-capability negatives.

### 15. Settings

- Cel: user/workspace preferences i user-owned integrations, nie tenant policy.
- AS-IS: `/settings/*` montuje preferences, notifications, appearance,
  calendar/OAuth, MFA, export/deletion i AI settings; część controls jest historyczna.
- Exact work: registry `setting -> owner -> storage -> effect`; hide no-op;
  user/org/system scope; read-after-write i cross-session persistence; secret
  nigdy nie wraca po zapisie.
- DoD: profile/language/theme/notifications/AI save/reload/new-session; forced
  policy locked; OAuth, MFA, export/deletion, a11y/mobile.

### 16. Partner Portal

- Cel: individual referral i solution partner z certyfikacją, attribution,
  earnings i payout.
- AS-IS: `/partner/*` ma authenticated shell i server-scoped data; Start,
  referrals, clients, academy, resources, earnings i profile istnieją. Legacy
  `/api/partners` i V8 są używane; część akcji to 503/hidden; katalog ma fallback.
- Exact work: participant_type i oddzielny individual ledger; jeden V8 contract;
  versioned commission rules; stable attribution; correction audit; bez fallback
  w acceptance flow.
- DoD po MVP: register -> knowledge -> certificate -> code -> attributed sale ->
  commission -> payout; expiry/correction/currency i partner isolation.

## Decyzje integracyjne P0

1. **Case owner:** dla MVP `transformation_cases`; `/zlecenia` OFF, legacy
   `ai_agent_plans` poza normalnym flow. Następnie ADR migracji/bridge do
   `case_core`; trzech writerów dla jednego zlecenia jest niedopuszczalne.
2. **Results:** aktywować KPI/ROI/OKR VNext w deployment profile bez
   query/localStorage i przejść trzy flows; w razie niepowodzenia jawny rollback,
   nigdy disabled shell.
3. **Finance:** pozostaje closed; bridge/backfill report, ADR generacji i legacy
   retirement przed aktywacją.
4. **Audits/Meeting:** Audits poza MVP lub base CRUD beta; Meeting dopiero jako
   wąski beta po approval/handoff/consent E2E.

## Kolejność finalnego montażu

### Faza A — authority

1. Jeden candidate SHA i czysty worktree.
2. [DONE] Przyrost iCloud jest w zweryfikowanym snapshotcie; 460 tipów
   odzyskano, przypięto refs i zapisano w osobnym bundle.
3. Żadnych whole-dirty-branch merges; tylko commit/modułowy diff.
4. Zamrozić shared routes i migracje podczas exact-SHA acceptance.

### Faza B — poniedziałkowy produkt

1. Chat core + Organization snapshot boundary.
2. My Work core + Agent na `transformation_cases`.
3. Interview jeden flow, Dynamic SWOT, DRD.
4. Initiatives -> Execution handoff.
5. Materials DOC/PPT/XLSX.
6. Settings core i minimalny Admin.
7. Results wyłącznie po decyzji cutover.

### Faza C — po MVP

Case convergence; Finance v3; Audits lifecycle; Meeting facilitator/integracje;
Partner individual referral; kolejne Tools/Assessment po osobnym golden flow.

## Wspólna brama odbioru

Każdy evidence record zawiera: Git i server/client SHA; route bez activation
query/localStorage; UI states; network/console; API/service/DB readback; fresh i
upgrade migrations; replay/stale-version/role/tenant negatives; desktop/mobile
trace; visual verdict oraz literalny status PASS/FAIL/BLOCKED/EVIDENCE_MISSING.

## Kandydaci do późniejszego usunięcia

Historyczne FullInitiatives/Roadmap/Portfolio; legacy ResultsHub,
FullROIWorkspace i BenefitsHub; stare PresentationStudioPage/Wizard;
AgentPlanView i legacy Agent Plan po migracji; stare API/clients po cutover;
no-op Settings controls i fallback catalogs. Do czasu import/history review,
recovery manifest i dynamic-import check są `DEAD_CANDIDATE`/`DUPLICATE`, nie
zatwierdzonym delete.

## Definition of Done cleanup

1. jeden czysty kanon i candidate SHA;
2. każda wartościowa zmiana reachable albo w zweryfikowanym recovery;
3. 16/16 modułów ma kartę i ownera;
4. konflikty Case/Results/Finance/Audits rozstrzygnięte ADR-em;
5. aktualny full gate i jawne isolated/realDB/external/performance gates;
6. demo służy dokładnie z testowanego SHA;
7. MVP przechodzi signed-in browser i visual acceptance;
8. materialne usunięcia mają recovery path.

Na authority SHA raport modułowy jest kompletny 16/16. Runtime/release readiness
pozostaje `PARTIAL`, dopóki bramy powyżej nie zostaną wykonane.
