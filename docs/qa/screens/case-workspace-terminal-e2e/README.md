# Case Workspace — 20-scenario terminal E2E (Strumień E, żywy stack)

Data: 2026-08-10/11. Backend realny (`bash scripts/dev/case-workspace-local-backend.sh`,
port 3001), Postgres jednorazowy (`case-workspace-test-pg`, port 55432,
`case_workspace_test`). `/api/*` nigdy nie mockowane. Logowanie realne
(`POST /api/auth/login`), token realny JWT. Każdy scenariusz ma dowód (a) realny
HTTP status, (b) SELECT z bazy, (c) ślad w `case_workspace_event_outbox`.

Testy: `server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.pg.test.ts`
(część 1, 10 scenariuszy — istniejąca, potwierdzona zielona) +
`liveStack.e2e.part2.pg.test.ts` (część 2, nowa w tej sesji — scenariusze których
część 1 nie pokrywała). Uruchomienie **obu plików razem wymaga
`--no-file-parallelism`** — patrz P0 poniżej.

Komenda uruchomieniowa (z `server/`):
```
DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
npx vitest run src/services/caseWorkspace/__tests__/e2e --environment node --no-file-parallelism
```
Wynik ostatniego uruchomienia (po restarcie backendu I bazy, patrz scenariusze 18/19):
**34/34 PASS** (24 część 1 + 10 część 2).

---

## Tabela 20 scenariuszy

| # | Scenariusz | Werdykt | Dowód (a) HTTP | Dowód (b) baza | Dowód (c) outbox |
|---|---|---|---|---|---|
| 1 | Chat → dokładne podsumowanie → potwierdzenie → Case (realna trasa czatu) | **PASS** | `POST .../case-intake/turn` 200 (`mode:work_order_proposed`) → `POST .../confirm` 201 (`caseCreated:true`) | `case_core` 1 wiersz, `case_status='DRAFT'` | `case.created`, `case.intake.work_order_confirmed` |
| 2 | DWA różne Case w JEDNYM projekcie | **PASS** | 2× `POST /cases` → 201, różne `caseId` | `case_core` 2 wiersze, ten sam `project_id`, różne `case_id` | każdy Case ma własny `case.created` z innym `aggregate_id` |
| 3 | LIGHT one-click → zero albo jeden Run | **PASS (z udokumentowaną luką GAP-E-01/02)** | `confirm` 201 tworzy Case; `run-bindings` na wymyślony `runId` → 400/404 | `case_workspace_run_bindings` 0 wierszy dla LIGHT Case | `case.created` jest; żadnego `run.*` |
| 4 | STANDARD: plan → publish → start | **PASS** | draft 201→`propose` 200→`publish` 200→`status ACTIVE` 200; skrót DRAFT→PUBLISHED odrzucony | `case_plan_versions.status='PUBLISHED'`, `case_core.case_status='ACTIVE'` | `case.plan.draft_created`,`.proposed`,`.published`,`case.activated` |
| 5 | TRANSFORMATION | **PASS** | `POST /cases` (profile TRANSFORMATION) 201 → plan→propose→publish→start identycznie jak STANDARD | `case_profile='TRANSFORMATION'`, `governance_tier='CONTROLLED'`, zero Run przy starcie | `case.created`,`case.plan.published`,`case.activated` |
| 6 | approval: approve / reject / request changes / defer | **PASS** | APPROVE (część 1): 200 APPROVED. REJECT: 200 REJECTED. REQUEST_CHANGES: 200 REQUESTED_CHANGES. DEFER: 200, proposal **zostaje** w PENDING_REVIEW (nie zmienia statusu) | `case_workspace_action_proposals.status` zgodny z każdą decyzją; `case_workspace_action_proposal_decisions.decision` = DEFER zapisane mimo braku zmiany statusu | `approval.rejected`,`approval.changes_requested`,`approval.deferred` — trzy różne eventy, nie jeden wspólny |
| 7 | external inbox → wait → resume (przez `/api/webhooks/case-workspace`) | **PASS (wymagał restartu backendu z kanałem skonfigurowanym — patrz P0)** | `POST /api/webhooks/case-workspace/docusign-webhook/deliveries` z realnym HMAC-SHA256 → 200 `outcome:applied`, `waitId` zwrócony | `case_workspace_event_inbox` 1 wiersz `status='APPLIED'`; `case_workspace_waits.status='SATISFIED'`, `satisfied_by_event_id='docusign-webhook:evt-restart-vendor-2'` | `wait.satisfied`, `actor_user_id='system:case-workspace-event-inbox'` |
| 8 | internal event → wait → resume | **PASS** | `POST /waits/:id/resolve` z realnym `event_id` z `case_workspace_event_outbox` (case.blocked) → 200 SATISFIED; zły typ (case.activated dla waita na case.closed) → 4xx odrzucony | `case_workspace_waits.status='SATISFIED'`, `satisfied_by_event_id`=realny `event_id`; **zero** wiersza w `case_workspace_event_inbox` (dowód że to ścieżka wewnętrzna, nie zewnętrzna) | `wait.satisfied` na agregacie waita |
| 9 | pause / resume / cancel | **PASS** | `status BLOCKED` 200 → `status ACTIVE` 200 → `cancel` 200; próba ożywienia CANCELLED → 409 | `case_core.case_status` zgodny na każdym kroku | `case.blocked`,`case.activated`,`case.cancelled` |
| 10 | failure / retry / recovery | **PASS** | `transition-to-executing` 200 → `transition-to-failed` 200 (wolny tekst błędu na wejściu) → `retry` 200 → status wraca do APPROVED | `case_workspace_action_proposals.status` FAILED→APPROVED; `redacted_summary.reasonClass='unclassified'` (surowy tekst NIE trafia do zdarzenia) | `proposal.failed` w łańcuchu, po nim kolejny event potwierdzający retry |
| 11 | wynik częściowy widoczny | **PASS** | `node-result-acceptances` z `resultAcceptance:PARTIAL` → 201; `value-measurements` z `measurementStatus:PARTIAL` → 201; `CONFIRMED` bez dowodu → 422 odrzucone | `result_acceptance='PARTIAL'` w bazie, nigdy zaokrąglone do ACCEPTED; `measurement_status='PARTIAL'` | `node.result_accepted`, `outcome.measurement_recorded` |
| 12 | deliverable open / return | **PASS** | `artifact-links` (relation DELIVERABLE) 201 → `GET /artifact-links/:id` 200 autorytatywny (linkStatus, isStale, caseId zwrotny) → `GET /cases/:id` nadal 200 | `case_workspace_artifact_links.relation='DELIVERABLE'` | `artifact.linked_to_case` |
| 13 | refresh / reconnect | **PASS** | 7 endpointów GET po "odświeżeniu" → wszystkie 200; ponowne `confirm` tego samego digestu → 200 (nie 201), `caseCreated:false` | `case_core` nadal 1 wiersz dla projektu (brak duplikatu) | brak nowego `case.created` |
| 14 | cross-tenant | **PASS** | obcy token na 6 różnych obiektach (Case/plan/proposal/wait/link/run-binding) → wszystkie 404 identyczne z nieistniejącym obiektem (SEC-009); mutacja obcym tokenem → 404 | `case_core.case_status` niezmieniony | brak nowych eventów po próbie obcego tokenu |
| 15 | revoked membership | **PASS** | po `SUSPENDED`: `GET /cases` 403, `GET /cases/:id` 404, mutacja 404, `POST /cases` 403; po przywróceniu `ACTIVE`: `GET /cases` znów 200 | `case_core.version` i `case_status` **niezmienione** przez cały okres zawieszenia (dokładna kontrola diff przed/po) | brak zapisów w oknie zawieszenia |
| 16 | stale digest / stale version | **PASS** | digest: drugi `turn` w tej samej konwersacji nadpisuje pierwszy; `confirm` starym digestem → 409 `INTAKE_WORK_ORDER_DIGEST_STALE`; wersja: `publish` ze starym `expectedVersion` → 409 (część 1) | brak Case utworzonego ze starego digestu; aktualny digest nadal potwierdza się poprawnie (201) | brak `case.created` dla próby ze starym digestem |
| 17 | duplicate confirmation / duplicate delivery | **PASS** | potwierdzenie: 3× to samo `Idempotency-Key` na `artifact-links` → zawsze ten sam `linkId`, 201 za każdym razem; dostawa: redelivery TEGO SAMEGO `eventId` przez realny webhook → 200 `outcome:duplicate`, ten sam `inboxRecordId` | 1 wiersz w bazie mimo 3/2 wywołań | dokładnie 1 event `artifact.linked_to_case` (nie 3); wait satysfakcjonowany tylko raz mimo redelivery |
| 18 | restart backendu | **PASS** | `kill -9` procesu na :3001 → port zwolniony → restart skryptem → `/api/health` 200 po ~4 s | Case i Wait utworzone PRZED restartem czytelne PO restarcie z identycznym stanem; negatywna kontrola auth-bypass (`e2e:true` sfałszowany token) nadal 401 po restarcie | mutacja PO restarcie (status→ACTIVE) trafia normalnie do outboxu — łańcuch 11 eventów kompletny |
| 19 | restart bazy (`docker restart case-workspace-test-pg` + `pg_isready`) | **PASS** | `docker restart` → `pg_isready` "accepting connections" po 2 s → backend odpowiada 200 na pierwszej próbie po restarcie (bez ręcznej interwencji — pula połączeń pg samoodtwarza się) | dane sprzed restartu bazy (25529 wierszy outboxu) w 100% obecne po restarcie; mutacja PO restarcie bazy zapisuje się i czyta poprawnie | pełny łańcuch eventów Case (11 pozycji) nienaruszony po restarcie kontenera |
| 20 | restart workera outboxa | **BLOCKED — nie da się zrestartować procesu, który nigdy nie wystartował** | brak — nie ma osobnego procesu do zrestartowania | `case_workspace_event_outbox`: 25996/26230 wierszy `delivered_at IS NULL` (rosnąco w trakcie tej sesji, `delivered` prawie płaskie: 192→234, przyrost wyłącznie z testów jednostkowych wywołujących `dispatchPendingEvents` bezpośrednio) | brak — worker nigdy nie publikuje potwierdzenia dostawy w żywym procesie |

---

## P0 — defekt/luka odkryta w TEJ sesji (nie z audytu, z realnego uruchomienia)

### P0-1 (nowy, tej sesji): `case_workspace_event_outbox_worker` nigdy nie jest uruchamiany w produkcyjnym procesie

`server/src/services/caseWorkspace/outboxWorker.ts` eksportuje
`startCaseWorkspaceOutboxWorker()` — poprawną implementację pętli interwałowej
wywołującej `dispatchPendingEvents()`. **Zero wywołań** w `server/src/index.ts` ani
`server/src/Gateway.ts` (zweryfikowane grepem, potwierdzone empirycznie: po
całej sesji testowej — dwóch restartach backendu, setkach mutacji —
`delivered_at IS NULL` dla 25996 z 26230 wierszy; `delivered` rośnie tylko o tyle,
ile testy jednostkowe (`*.pg.test.ts`) same wywołują `dispatchPendingEvents()` w
swoim procesie testowym, NIE przez żywy backend). Nagłówek pliku sam to
przyznaje: "this packet's allowlist does not cover server/src/index.ts... this
file therefore does not call itself" — czyli świadomie zostawiony niedowieziony
kawałek.

**Skutek**: każdy subskrybent zarejestrowany przez `subscribeToOutboxDelivery()`
nigdy nie odpala w prawdziwym wdrożeniu — cała warstwa "coś się dzieje na
podstawie zdarzenia z outboxu" (webhooki wychodzące, integracje, powiadomienia
sterowane zdarzeniami Case Workspace) jest martwa, mimo że sam mechanizm
zapisu do outboxu (append-only, `ON CONFLICT DO NOTHING`) działa bez zarzutu.

**Waga**: P0 — jeśli ktokolwiek zbuduje na tym integrację wychodzącą (np.
webhook do klienta o zamknięciu Case), będzie działać w testach
(`dispatchPendingEvents()` wywołane wprost) i milczeć na produkcji.

**Naprawa** (poza allowlistem tej sesji — tylko zgłoszenie): dodać w
`server/src/index.ts`, obok `startNotificationOutboxDrainCron()`:
```ts
import { startCaseWorkspaceOutboxWorker } from './services/caseWorkspace/outboxWorker.js';
startCaseWorkspaceOutboxWorker();
```

### P0-2 (potwierdzenie luki znanej z części 1, GAP-E-01/GAP-E-02): LIGHT one-click nie ma realnej ścieżki do Runa

Nie nowa w tej sesji, ale zreplikowana i potwierdzona: `POST /run-bindings`
twardo wymaga `casePlanVersionId`, a LIGHT ma zerowy plan przed startem z
założenia. Żadna trasa HTTP w `server/src` (poza skryptami testowymi) nie
tworzy wiersza w `v8_execution_runs`. Obietnica "LIGHT może wystartować jeden
Run od razu po potwierdzeniu" nie jest wykonalna przez produkt.

---

## Uwaga metodologiczna: cross-file race w Vitest (NIE defekt produktu)

Uruchomienie części 1 i części 2 RÓWNOLEGLE (domyślne zachowanie Vitest —
różne pliki testowe w osobnych workerach) dawało sporadyczne 403/409, bo
scenariusz 15 części 1 (`revoked membership`) tymczasowo zawiesza
(`SUSPENDED`) to samo konto `cw-local-user`/`cw-local-org`, którego część 2
używa równolegle do własnych wywołań. To ARTEFAKT WSPÓŁBIEŻNOŚCI TESTÓW, nie
błąd backendu — potwierdzone przez 3-krotne powtórzenie z
`--no-file-parallelism`: 34/34 PASS za każdym razem. Każdy przyszły plik E2E w
tym katalogu musi albo używać innego konta, albo runy uruchamiać sekwencyjnie
(`--no-file-parallelism`).

## Pułapka odkryta przy pisaniu testów (nie defekt, ale warta zapisania)

`proposalVersion` w payloadzie `/proposals/:id/decision` to **licznik
per-Case** (`COALESCE(MAX(proposal_version),0)+1 FROM ... WHERE case_id=?`),
NIE stała 1 i NIE ten sam numer co OCC `version` zwracany przez
`submit-for-review`. Pierwszy proposal pod danym Case dostaje
`proposal_version=1`, drugi `=2`, itd. — niezależnie od własnego `version`
(OCC). Podanie złej wartości daje 409 `PROPOSAL_STALE`, co brzmi jak spór o
wersję (OCC), a w rzeczywistości jest pomyłką co do ZUPEŁNIE INNEGO licznika.
Poprawny sposób: zawsze czytać `proposalVersion` z odpowiedzi `POST
/proposals` i wątkować dalej — nigdy nie zakładać.

## Otwarte pozostaje

1. **Scenariusz 20 nie może przejść z definicji** dopóki P0-1 nie zostanie
   naprawiony na produkcyjnym kodzie (poza allowlistem tej sesji — zgłoszone,
   nie naprawione).
2. GAP-E-01/GAP-E-02 (LIGHT bez realnej ścieżki do Run) — potwierdzone
   ponownie, nie naprawione (poza allowlistem tej sesji).
3. GAP-E-05 (`case_core` bez kolumny na cel/nazwę — "Zlecenie bez nazwy" na
   liście) — potwierdzone w części 1, nie dotyczy tej sesji dalej.
4. Dane testowe w `case_workspace_test` (baza jednorazowa, NIE demo/staging)
   nie zostały posprzątane — zgodnie z harnessem to baza jednorazowa
   przeznaczona do wyrzucenia, nie produkt.
