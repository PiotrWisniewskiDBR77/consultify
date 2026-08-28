# DYŻUR 66 — TEST DEBT P1: RAPORT I KARTA DOWODOWA

Status: **PARTIAL**. Data: 2026-08-28.

## 1. Rodowód i rozstrzygnięcie instrukcji

- Marker: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`.
- Baza `github-backup/codex/m03-admin-20260824`: dokładnie marker; `merge-base --is-ancestor` exit 0.
- Gałąź: `codex/day66-test-debt-p1-20260828`.
- Worktree: `/private/tmp/consultify-day66-test-debt-p1`.
- Instrukcja była pobrana z tipa `654ae1daf966e0fbc597faf103dd563b038d9eaa`, przeczytana w całości i zawierała związany marker oraz stan WYDANY.
- Instrukcja była wewnętrznie sprzeczna: cel, raport, polecenie DB i jawne polecenie nadzorcy wskazywały P1, ale §1, §2 i §6 zawierały nazwy `p6`. Zgodnie z §12 zastosowano spójny, węższy zakres P1. Nie utworzono gałęzi ani worktree P6.
- Wolne miejsce przed startem: 68 GiB. Tip bazy nie uciekł przed marker ani za marker.

Commity i push na jedyny dozwolony remote `github-backup`:

1. `b3886a458f` — `P1-DECCASE`, push po pierwszym commicie;
2. `31b87eb7bf` — `P1-T2`, push;
3. `ae2d0c1044` — czerwony kontrakt `P1-T2-PIN`, push;
4. `c45fc3e4c4` — czerwony kontrakt `P1-RED-FINAL-PIN`, push.

## 2. Ponowny mianownik P1

Parser:

```bash
git show 6868d57e:docs/program/waves/WAVE_03_ACCEPTANCE/TEST_DEBT_DAY59_MAPA.md \
  | awk '/^### P1 — dokładna lista plików/{on=1;next}/^### P2 — dokładna lista plików/{on=0}on' \
  | sed -n 's/^- `\(.*\)`$/\1/p'
```

Wynik: **59** ścieżek, **59** unikalnych, **59** istniejących, 0 brakujących. `git status --short` przed pracą był pusty.

## 3. Lokalny PostgreSQL i migracje

- Własny kontener: `cx-day66-pg`, `pgvector/pgvector:pg16`, `127.0.0.1:5938`, baza `cx_day66_testdebt`.
- Pierwszy pełny przebieg istniejącego runnera: 862 migracje, exit 0; SHA-256 logu `e1397a7dd80a3ce34c2c80f80e663e1e74b27718fb16e6173e3ddf5d4e08bf98`.
- Drugi przebieg: 0 migracji do zastosowania, exit 0; SHA-256 `6469a5c7aac57e4f8e4917569d6bb2dda3ce2b798c44441ac4874f088464657e`.
- Nie utworzono migracji z rezerwacji `20261660-20261669`.
- Nie użyto Railway, demo, stagingu, produkcji ani GitHub Actions.

## 4. Pomiar bazowy P1

Komenda zawierała wszystkie wymagane zmienne, literalny `JWT_SECRET=test-debt-day66-local-only` oraz `--retry=0`; uruchomiono dokładnie 59 plików P1. Wynik: 441 testów, 84 PASS, 60 FAIL, 297 pending; 166 suite, 97 czerwonych. SHA-256 JSON: `72b3f3bcb47421bb750fd7c96471d7af3977b4be8197dbd1684062052f37aadf`.

Ten wynik ujawnił sprzeczność: wymagany sekret ma 26 znaków, natomiast `tests/acceptance/harness.ts` wymaga co najmniej 32. Wiele suite nie doszło do asercji. Nie zmieniono harnessu, bo jest poza P1. Pomiar pomocniczy czterech obowiązkowych plików wykonano z jawnie oznaczonym dłuższym sekretem lokalnym: 102 testy, 97 PASS, 5 FAIL; nie jest on relabelowany jako zgodny przebieg końcowy.

## 5. Status przyczyn i obowiązkowych pinów

| Pozycja | Przed | Po | Status / werdykt |
| --- | --- | --- | --- |
| `odbior--deccase--initiative-status-case`: BEFORE unblock | zielony test utrwalał martwy lowercase CASE | brak wykonywalnej asercji historycznego błędu; kanoniczny BLOCKED→EXECUTING zielony | **naprawa testu; kanonizacja dziury usunięta** |
| `odbior--deccase--initiative-status-case`: BEFORE autoblock | czerwony na realnym CHECK, bo próbował wpisać lowercase `blocked` | brak wykonywalnej asercji historycznego błędu; uppercase BLOCKED/DONE zielony | **naprawa testu; kanonizacja dziury usunięta** |
| `t2-sla-flow`: fixture admina | oczekiwano losowego admina, runtime wybierał wspólnego `odbior--user-0001` | dedykowana organizacja; podstawowy SLA 2/2 zielony | **naprawa danych testowych** |
| `t2-sla-flow`: `assignment_kind=artifact` | oczekiwał eskalacji generic sweep i payloadu bez typu | oczekuje braku eskalacji i braku notification; test czerwony na `escalated_to_user_id` | **kanonizacja dziury → czerwony kontrakt; produkt poza P1** |
| `red-final-500s`: AI preferences | oczekiwał 500 `Failed to load route` | oczekuje 200, `success: true`, `data`; runtime daje 503 | **kanonizacja dziury → czerwony kontrakt; produkt poza P1** |
| `red-assess-500s` | mapa opisywała 8 oczekiwanych 500 | na markerze `KNOWN_RED={}` i pomocniczy przebieg 92/92 zielony | **PARTIAL**: stare piny już nie istnieją, ale wspólna asercja `<500` jest zbyt ogólna i nie została relabelowana jako właściwy kontrakt |

### Briefy produktu poza P1

1. Właściciel `server/src/services/slaService.ts`: generic sweep musi wykluczyć `assignment_kind='artifact'` albo delegować rekord do dedykowanej ścieżki z typowanym payloadem. Czerwony kontrakt: `leaves assignment_kind=artifact for its dedicated review SLA path`.
2. Właściciel routera AI preferences/lazy route: `GET /api/user/ai-preferences/` ma zwracać 200 i realny payload preferences; obecnie zwraca 503. Czerwony kontrakt: `GET /api/user/ai-preferences returns the configured preferences contract`.

## 6. Dowód mutacyjny i regres

| Zmiana | Czerwony przed | Wynik po | Ocena |
| --- | --- | --- | --- |
| DECCASE BEFORE | autoblock: `violates check constraint initiatives_status_check` | 2/2 kanoniczne przypadki PASS | **PARTIAL** — naturalne before/after jest zachowane w JSON, ale nie wykonano osobnego copy→revert→restore |
| T2 izolacja fixture | `expected 'odbior--user-0001' to be <ADMIN_ID>` (2 przypadki) | 3/3 poprzednie kontrakty PASS | **PARTIAL** — naturalne before/after, bez osobnego cyklu mutacyjnego |
| T2 artifact red contract | stara asercja była zielona po izolacji | czerwony: `expected <ADMIN_ID> to be null` | zamierzony czerwony kontrakt, nie regres produktu P1 |
| RED-FINAL red contract | stary pin oczekiwał 500; runtime już dawał 503 | czerwony: `expected 503 to be 200` | zamierzony czerwony kontrakt, nie regres produktu P1 |

Globalnego regresu 59 plików po zmianach nie uznaje się za udowodniony: literalny sekret uniemożliwia ważny przebieg, a pomocniczy dłuższy sekret nie spełnia literalnej instrukcji.

## 7. Kompilacja produkcyjna 4b

- Serwer: `NODE_OPTIONS="--max-old-space-size=3072" ../node_modules/.bin/tsc --build tsconfig.build.json` w `server/` → **exit 0**; SHA-256 logu `d10d10464cba8c1ca1e8b06487ab5bc9f91dd3c921ba893d697c6d88985181bd`.
- Front: `NODE_OPTIONS="--max-old-space-size=6144" npm run build` → **exit 0**; SHA-256 logu `c63bf551018de4b2241050d04b1c3e59622ccf3cfe0acc49b6bb95df0e22ee17`.
- Literalne `rm -rf server/dist` zostało odrzucone przed wykonaniem przez ochronę poleceń. Istniejący `server/dist` przeniesiono odzyskiwalnie do własnego scratch przed kompilacją.

## 8. Kontrola diffu i osiągalność

Zapisano wyłącznie trzy istniejące pliki z listy P1 oraz ten raport. Migracje: zero. Pliki produkcyjne/przekrojowe: zero. Harness 3996 nie był potrzebny ani uruchamiany.

Osiągalność HTTP: **NIE DOTYCZY dla napraw fixture/CASE**, bo pakiet nie zmienił runtime. Dla czerwonego kontraktu AI preferences test montuje realny router za realnym `verifyToken`, ale nie przez `ApiGateway`; dlatego pełna osiągalność Gateway pozostaje **NOT_PROVEN**.

## 9. KARTA DOWODOWA

```text
KARTA DOWODOWA — DYŻUR 66 (TEST DEBT P1)
Gałąź: codex/day66-test-debt-p1-20260828   Tip: przed commitem raportu c45fc3e4c4   Marker: 6868d57e   Data: 2026-08-28

1. RODOWÓD
Marker jest przodkiem tipa: TAK (merge-base exit 0)
Kopia zapasowa po pierwszym commicie: TAK, github-backup b3886a458f
Commitów ponad marker: 4 przed raportem; plików testowych zmienionych: 3

2. ROZŁĄCZNOŚĆ
Pliki spoza licencji zapisane: ŻADNE
Pliki przekrojowe dotknięte: ŻADNE
Przedział migracji użyty: ŻADEN (rezerwacja 20261660-20261669)
Port PG / harness: 5938 / 3996 (harness nieuruchomiony)

3. OSIĄGALNOŚĆ
NIE DOTYCZY dla fixture/CASE; runtime niezmieniony. AI preferences przez Gateway: NOT_PROVEN.

4. DOWÓD MUTACYJNY
DECCASE i T2 fixture: PARTIAL — zachowane czerwone→zielone, brak wymaganego osobnego cyklu copy/revert/restore.
Czerwone kontrakty T2 i RED-FINAL: produkt poza P1, nie deklarowane jako naprawione.

4b. KOMPILACJA PRODUKCYJNA
Serwer server/tsconfig.build.json: exit 0
Front npm run build: exit 0

5. REGRES
Zakres: 59 plików P1; --retry=0: TAK
Pełny ważny regres po zmianach: NOT_PROVEN z powodu 26-znakowego wymaganego JWT_SECRET.

6. ZMIANY ISTNIEJĄCYCH TESTÓW
deccase: BEFORE executable → usunięte; NAPRAWA TESTU PINUJĄCEGO BUGA.
t2 artifact: eskalowany bez typu → nieeskalowany; NAPRAWA PINU, czerwony kontrakt.
red-final: 500/error → 200/success/data; NAPRAWA PINU, czerwony kontrakt.
t2 fixture: wspólna org → dedykowana org; NAPRAWA DANYCH TESTU.

7. MIANOWNIKI
59 plików / 59 unikalnych / 59 istniejących: parser sekcji P1 opisany w raporcie.
441/84/60/297: JSON bazowego `vitest ... --retry=0` dla 59 ścieżek.
862/0 migracji: dwa przebiegi `migrate.postgres.ts` na pustym/wypełnionym lokalnym PG.

8. WYGLĄD
NIE DOTYCZY; brak zmian widocznych dla użytkownika.

9. STATUS PER POZYCJA
DECCASE BEFORE: CZĘŚCIOWO — brak ścisłego cyklu mutacyjnego i aktualnej ścieżki controller/Gateway.
T2 fixture: CZĘŚCIOWO — brak ścisłego cyklu mutacyjnego.
T2 artifact: CZĘŚCIOWO — czerwony kontrakt; naprawa produktu poza P1.
RED-FINAL K1: CZĘŚCIOWO — czerwony kontrakt; naprawa produktu poza P1.
RED-ASSESS: CZĘŚCIOWO — brak starych pinów, ale pozostaje ogólne <500.

10. TWIERDZENIA NIEZWERYFIKOWANE
Pełny regres po zmianach NOT_PROVEN; Gateway reachability NOT_PROVEN; 59 przyczyn niezależnie nie naprawiono; globalne P2-P6 NOT_PROVEN.

11. STOP-y
Brak STOP dla niezależnych pozycji. Do pełnej akceptacji potrzebny poprawny >=32-znakowy sekret w instrukcji oraz licencje właścicieli dwóch produktów.
```

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- **NOT_PROVEN:** pełny przebieg P1 po zmianach z literalnym środowiskiem instrukcji; wymagany JWT secret ma 26 znaków i jest odrzucany przez harness.
- **PARTIAL:** DECCASE i T2 fixture mają naturalny dowód czerwony→zielony, ale nie mają wymaganego osobnego cyklu mutacyjnego copy→revert→restore.
- **NOT_PROVEN:** DECCASE po aktualnym controllerze/Gateway; pozostałe zielone asercje wykonują kanoniczne fragmenty SQL bez Gateway.
- **NOT_PROVEN:** `red-assess` nie ma już ośmiu mapowanych 500-pinów, ale ogólna asercja `status < 500` nie dowodzi konkretnych kontraktów endpointów.
- **PARTIAL:** nie wykonano napraw ani osobnych cykli dowodowych dla wszystkich 59 plików P1; bazowy pomiar klasyfikuje stan, nie zamyka całego pakietu.
- **NOT_AUTHORIZED:** naprawa `slaService` oraz routera AI preferences, jak również jakiekolwiek wdrożenie, migracja lub zdalna baza.
- **NOT_PROVEN:** globalna zieleń P2-P6 i wspólna integracja pakietów.

+## 11. Dokończenie po odbiorze (wiążące uzupełnienie)

Ta sekcja superseduje wcześniejsze wpisy o błędnym 26-znakowym sekrecie, braku mutacji, ogólnym RED-ASSESS oraz czerwonym kontrakcie 200 dla AI preferences. Wiążący sekret to `JWT_SECRET=test-debt-day66-local-only-secret-32chars-min`.

### 11.1 Korekta AI preferences

**WERDYKT:** wcześniejszy pin 500 kanonizował crash. Aktualne 503 `not_configured` jest zamierzonym, uczciwym zachowaniem, a kontrakt 200/success/data był błędem dyżuru. Test wymaga dokładnie HTTP 503, `status:false`, `type:not_configured` i komunikatu zawierającego `not implemented`. Kod produkcyjny pozostał nietknięty. Named test AI preferences jest zielony; cały plik RED-FINAL pozostaje czerwony wyłącznie przez osobny test GET rewir dla dwóch tras megatrends zwracających uczciwe 503.

### 11.2 RED-ASSESS

Wspólne `<500` oraz pusty `KNOWN_RED` usunięto. Każdy z 91 przypadków ma dokładnie jeden status (200, 201, 400 albo 404), stan `success`/`created`/`validation`/`not-found`, minimalny kształt payloadu oraz wskazanie importowanego routera w komunikacie asercji. Nie ma zbioru zastępczego `[200,400,404]`. Wynik: **91/91 PASS**, SHA-256 JSON `37fb2e64d8e5f31635ba4a0af32b1bf744669b3949d7510f7ab43ed21b13813d`.

### 11.3 Dowody mutacyjne

| Naprawa | Bez poprawki | Po przywróceniu | Tożsamość odtworzenia |
| --- | --- | --- | --- |
| DECCASE executable BEFORE | named `buggy lowercase literal corrupts EVERY status` exit 1: `initiatives_status_check` | kanoniczny plik 2/2 PASS | SHA pliku i kopii `1d2d5eaf...` identyczne; diff exit 0 |
| T2 izolacja organizacyjna | named `escalates the overdue assignment to the org admin...` exit 1: wspólny admin zamiast dedykowanego | ten sam named test PASS | SHA pliku i kopii `117e5cc2...` identyczne; diff exit 0 |

JSON SHA-256: DECCASE red `28c5002e...`, green `b1969453...`; T2 red `115dfeb9...`, green `d75184ed...`. Użyto kopii `cp` w scratch; nie użyto stash.

### 11.4 Pełny regres 59 plików

Świeży PG przeszedł 862/0 migracji. Komenda 59 ścieżek zawierała komplet zmiennych, poprawny sekret i `--retry=0`. Wynik: **439 total, 248 PASS, 102 FAIL, 89 pending; 166 suite, 115 czerwonych**. SHA-256 JSON: `0c51173460cc2e94db4b9664dec854edbef4208fe3fb1ed186447b89877dc7b8`.

Czerwone→zielone (4, pełne nazwy):

- MYW-AGT mounted signed-JWT acceptance > mounts all three canonical writers and blocks spoof, foreign, revoked, self-approval, stale and collision
- RED-FINAL · rewir czysty (schema-green) + pinned known exceptions > WRITE utwardzenie: named-target write paths przechodzą (adapter neutralizuje SQLite-izmy)
- RED-FINAL · rewir czysty (schema-green) + pinned known exceptions > KNOWN K2 · degraded-mode stuby zwracają świadome 503 not_configured
- T2 · slaService.runSlaCheck — overdue approval_assignments escalates exactly once > escalates the overdue assignment to the org admin and enqueues exactly one ESCALATION + one APPROVAL_DUE notification

Zielone→czerwone wśród testów wykonanych po obu stronach: **0**. Nowy zamierzony czerwony kontrakt produktu poza P1: `T2 · FINDING — SLA sweep has no assignment_kind filter (also escalates artifact reviews) > leaves assignment_kind=artifact for its dedicated review SLA path`. Testy niewykonane wcześniej z powodu błędnego sekretu są poniżej nazwane jako finalne czerwone, nie jako regresje.

#### Wszystkie finalne czerwone testy (102)

- `tests/acceptance/agent-audit.e2e.test.ts`
  - Acceptance HP-2 · Agent Audit (real router + auth + generic agentRuntime + DB) > runs the audit agent end-to-end (1 agent, smallest sensible wave) via generic agentRuntime, persists the run, and reads it back
- `tests/acceptance/aiExecutiveReporting.e2e.test.ts`
  - Acceptance: AI-enhanced executive report (real runtime, real LLM) > odbior--t7b3--aiExecutiveReporting.generateReport() genuinely transforms a grounded summary
- `tests/acceptance/backup-service-t7b2.e2e.test.ts`
  - T7b-2 backupService — real logical export > createBackup writes a storage file + manifest with counts matching the DB
  - T7b-2 backupService — real logical export > org-scoped backup only dumps the target org rows
- `tests/acceptance/chat-005-proposal-approval-audit.realdb.test.ts`
  - CHAT-05 — proposal, approval, execution and durable audit > does not write before approval, executes once, and survives a fresh read
- `tests/acceptance/chat-007-009-owner-handoff-reopen.realdb.test.ts`
  - CHAT-07/08/09 — owner handoff, durable receipt and reopen > creates one canonical initiative, persists its receipt, and reopens it after retry
- `tests/acceptance/fin-003-004-case-scenario-lifecycle.e2e.test.ts`
  - FIN-03/FIN-04 — Investment Case + Scenario/Baseline lifecycle (real Postgres, real router) > test 4b: retried approve (save version) with the same Idempotency-Key does not create a duplicate version row
  - FIN-03/FIN-04 — Investment Case + Scenario/Baseline lifecycle (real Postgres, real router) > test 4b-concurrent: Promise.all approve with one key creates one version and replays the winner
  - FIN-03/FIN-04 — Investment Case + Scenario/Baseline lifecycle (real Postgres, real router) > test 5: a stale expectedVersion is rejected 409 VERSION_CONFLICT on both PUT and approve, never overwrites
- `tests/acceptance/fin-mvp-reconciliation.mounted.pg.test.ts`
  - FIN-MVP-RECONCILIATION mounted realPG auth/tenant matrix > MEMBER+responsibility is denied; qualified OWNER maker opens but cannot self-resolve
  - FIN-MVP-RECONCILIATION mounted realPG auth/tenant matrix > ADMIN wildcard is insufficient and revoked membership is rechecked with the same token
  - FIN-MVP-RECONCILIATION mounted realPG auth/tenant matrix > append-only revocation disables an explicit grant and cannot be mutated back
- `tests/acceptance/h1-chain.e2e.test.ts`
  - H1.3 — Assessment completion auto-creates DRAFT initiatives (real runtime) > materializes DRAFT initiatives from recommendations, linked + back-referenced
  - H1.3 — Assessment completion auto-creates DRAFT initiatives (real runtime) > is idempotent — re-completing does not double-create
  - H1.5 — Idea→Initiative convert records origin back-reference (real runtime) > converts an idea and sets created_from=idea on the initiative
- `tests/acceptance/h16-start-execution.e2e.test.ts`
  - H1.6 — POST /api/initiatives/:id/start-execution (kanoniczny kontrakt PO fixie H16) > DRAFT → 400 (INVALID_TRANSITION) — gate blokuje spoza SCHEDULED
  - H1.6 — POST /api/initiatives/:id/start-execution (kanoniczny kontrakt PO fixie H16) > REGRESJA H16: APPROVED (jeszcze NIE SCHEDULED) → 400 INVALID_TRANSITION, NIE 200 (stary bypass zamknięty)
  - H1.6 — POST /api/initiatives/:id/start-execution (kanoniczny kontrakt PO fixie H16) > PRAWDZIWA ścieżka happy-path: SCHEDULED + zatwierdzona decyzja GO/NO-GO → 200, status EXECUTING (uppercase), execution_started_at zapisany
  - H1.6 — POST /api/initiatives/:id/start-execution (kanoniczny kontrakt PO fixie H16) > uruchomiona inicjatywa JEST widoczna w GET execution summary (liczniki +1)
- `tests/acceptance/h3-dowody.e2e.test.ts`
  - H3.1 — SWOT (dynamicSwot) tool-sesja e2e (real router + auth + DB) > creates the session, saves accepted SWOT items + a W2 verdict, reloads, and the conclusion lands in `conclusions`
- `tests/acceptance/h31-swot-flow.e2e.test.ts`
  - H3.1 — dynamic-swot pełny cykl e2e (real router + auth + DB + engine gate) > creates a dynamic-swot session, saves all 4 quadrants, reloads, saves a validated W2 (tensions+moves+summary), reloads complete, passes the real tool gate, and the conclusion lands in `conclusions`
- `tests/acceptance/h44-m13-flow.e2e.test.ts`
  - H4.4 — M13 initiative generator flow: create → DRAFT → document → timeline > 4) timeline/harmonogram: milestones start empty, then persist real rows in order
- `tests/acceptance/hp8-artifact-approvals.e2e.test.ts`
  - Acceptance HP-8 · Initiative approval (real router + auth + DB) > drives create(draft) → submit(review) → approve(approved); GET reflects each state
  - Acceptance HP-8 · Report approval (real router + auth + DB) > submit -> reject(rejected) -> resubmit(review): the 3rd type flows through the same state machine
  - Acceptance HP-8 · Deck approval (real router + auth + DB) > submit(review) -> approve(approved); DB row carries artifact_type=deck
- `tests/acceptance/int-008-candidate-handoff.e2e.test.ts`
  - INT-08 — interview candidate handoff (golden flow, idempotency, concurrency, rollback) > insight-finding path: preview -> approve (created) -> retry (idempotent), curated content only
- `tests/acceptance/integrate--decision-initiative-block-gate.e2e.test.ts`
  - Decision-driven Initiative BLOCK/UNBLOCK integration (real Postgres, real routers) > 3) approved blocker + current GO + no other blockers -> canonical UNBLOCK fires, EXECUTING, exactly +1/+1 audit rows, visible via GET /api/initiatives/:id and GET /api/execution/:projectId/summary
  - Decision-driven Initiative BLOCK/UNBLOCK integration (real Postgres, real routers) > 4) a second still-pending blocking decision prevents UNBLOCK even after the first blocker is approved; resolving BOTH unblocks
- `tests/acceptance/interview-ai-suggestion-audit.e2e.test.ts`
  - INT-04 — durable Teresa suggestion provenance > audits generation, atomically accepts an edited draft, rejects another, and isolates tenants
- `tests/acceptance/interview-assignment-delivery-readback.e2e.test.ts`
  - INT-02 assignment tenant/role and delivery acceptance > persists assignment + mirror task + recipient notification and blocks unauthorized writers
- `tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts`
  - INT-05/INT-06 — immutable submit and manager review lifecycle > persists each submission, locks review state, supports send-back/resubmit, and freezes approval
- `tests/acceptance/j26-edit-step.e2e.test.ts`
  - J26 edit_step — rewrite an existing process step in place > rewrites step 2 via updateNodes; adds no node; leaves neighbours untouched
- `tests/acceptance/kpi-deviation-concurrency.e2e.test.ts`
  - RES-05 deviation case concurrency > coalesces concurrent RED measurements and audits the full governed lifecycle
- `tests/acceptance/m01-p07b-teresa-handoff.realdb.test.ts`
  - M01-P07B — Teresa handoff, real Postgres > notebook — owner_user_id fix + real receipt on completion > forwards the real acting userId and writes exactly one confirmed receipt on real Postgres
- `tests/acceptance/mgmt-reports-red4.e2e.test.ts`
  - Acceptance: RED #4 — management_reports CHECK + getBasicTaskMetrics AVG(TEXT) > odbior--mgmt--getBasicTaskMetrics returns a numeric avgProgress for a project with tasks
- `tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts`
  - MW-DEC-001 — Canonical Decision Workflow (real Postgres, real router) > FINDING: decision_impacts.is_blocker (INTEGER) vs "is_blocker = TRUE" (boolean literal) is a real Postgres type error, independent of any HTTP call
- `tests/acceptance/notebook-tenant-isolation.e2e.test.ts`
  - MW-08 notebook tenant isolation > rejects foreign delete and the stored row survives
- `tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts`
  - O1.8 — SIRI assessment completion auto-creates DRAFT initiatives (real runtime) > materializes DRAFT initiatives from SIRI recommendations, linked + back-referenced
  - O1.8 — SIRI assessment completion auto-creates DRAFT initiatives (real runtime) > is idempotent — re-completing a SIRI run does not double-create
  - O1.8 — ADMA assessment completion auto-creates DRAFT initiatives (real runtime) > materializes DRAFT initiatives from ADMA recommendations, linked + back-referenced
  - O1.8 — keyFindings fallback source materializes initiatives (real runtime) > uses keyFindings when nextActions is empty
- `tests/acceptance/odbior--ets--ensuretools-no-log-spam.e2e.test.ts`
  - ensureToolsSchema — no 42701 log spam on repeat calls > creates two tool_sessions back-to-back and logs zero "already exists" errors on the second
- `tests/acceptance/odbior--exec3ax--three-axis-live.e2e.test.ts`
  - Execution 3-osi (threeAxisReportService) — real-runtime wiring > GET /program-3axis/live computes REAL T/Z/W + SPI-derived scheduleHealth/impactGap/deliveryPromise from seeded Postgres rows
- `tests/acceptance/odbior--fin005--fresh-schema-golden-flow.e2e.test.ts`
  - FIN-005 fresh-schema bootstrap — sanctioned migration path alone is sufficient > XLSX golden flow works on a database that only ever ran the sanctioned migration path
  - FIN-005 fresh-schema bootstrap — sanctioned migration path alone is sufficient > CSV golden flow works on a database that only ever ran the sanctioned migration path
- `tests/acceptance/odbior--ini005--autostart-system-actor.e2e.test.ts`
  - INI-005 auto-start — case 1: SCHEDULED + current approved GO decision + past-due date → EXECUTING via system actor > promotes to EXECUTING with audit rows attributed to system:initiative-auto-start
  - INI-005 auto-start — case 5: audit-write failure rolls back the status change (atomicity via the system-actor path) > forced initiative_history INSERT failure leaves the initiative UNCHANGED (still SCHEDULED), not partially EXECUTING-with-no-audit
  - INI-005 auto-start — case 6: auto-start job racing a live HTTP PATCH on the SAME initiative → exactly one transition, shared row lock across both entry points > Promise.all([job, httpPatch]) — exactly one canonical history row, no double-apply
- `tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts`
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 1) SCHEDULED + approved GO decision + authorized PMO actor -> EXECUTING (200)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 3) APPROVED (not SCHEDULED) -> EXECUTING rejected BOTH via canonical PATCH and via /start-execution (core regression proof)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 4) SCHEDULED with NO GOVERNANCE_DECISION_MAKING decision row at all -> 400 GATE_DECISION_REQUIRED
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 5) SCHEDULED with a NO-GO/rejected decision (most recent row) -> 400 GATE_DECISION_REQUIRED
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 6) SCHEDULED: OLD approved decision superseded by a NEWER non-approved decision -> 400 (decision-currency fix — the critical case)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 7) SCHEDULED + valid GO decision but actor lacks PMO/ADMIN role -> 403
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 8) Tenant B token cannot start tenant A initiative (404 — org-scoped SELECT hides it)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 9) forged organizationId body field / x-organization-id header cannot redirect the transition to a different org
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 10) successful transition: initiatives.status changes + exactly ONE status_history row + ONE history row, matching from/to/actor
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 11) failed transition (400 GATE_DECISION_REQUIRED) writes ZERO new history rows
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 12) same successful request fired twice sequentially: 1st 200, 2nd sees new status -> 400 INVALID_TRANSITION; exactly ONE history row total
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 13) two concurrent requests on the SAME fixture: exactly one succeeds (200), the other gets a deterministic 400 INVALID_TRANSITION; exactly ONE history row (row-lock concurrency proof — run for real, no assumptions)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 14) after successful transition, GET execution summary sees the same initiative id (executingCount +1)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 15) direct /start-execution and /approve calls on illegal states are rejected, matching the equivalent canonical PATCH call on an identical fixture (bypass-closed proof)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 16) /approve and PATCH {status:PROMOTED} on equivalent REVIEW+GO-decision fixtures produce the same resulting status and the same audit-row shape (legacy-adapter parity)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 17) after any transition (success or failure), GET /api/initiatives/:id read-back matches Postgres exactly
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 18) a real DB-level constraint failure inside the transaction does NOT produce a false-success response (rollback proof)
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 19) PATCH .../status, /start-execution and /approve on a nonexistent id -> honest 404
  - INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix) > 20) actor with no role/capability produces ZERO audit rows (distinct fixture, pairs with case 11)
- `tests/acceptance/odbior--ini005--decision-race.e2e.test.ts`
  - INI-005 — GO/NO-GO decision-race TOCTOU fix > 1) a competing decision rejection landing AFTER the decision read but BEFORE the pre-commit recheck IS caught: 409 GATE_DECISION_SUPERSEDED, initiative untouched, zero new audit rows
  - INI-005 — GO/NO-GO decision-race TOCTOU fix > 2) [DOCUMENTS A KNOWN, DISCLOSED GAP — NOT A REGRESSION] a competing decision rejection landing AFTER the pre-commit recheck (between it and COMMIT) is NOT caught: the transition still succeeds on the now-superseded decision
- `tests/acceptance/odbior--ini005--unblock-timeline-lockdown.e2e.test.ts`
  - INI-005 — unblockInitiative (POST /:id/unblock) > BLOCKED + current approved GO decision + PROJECT_SPONSOR role → 200 EXECUTING with audit rows
  - INI-005 — unblockInitiative (POST /:id/unblock) > BLOCKED but no current GO decision → 400 GATE_DECISION_REQUIRED, not the old unconditional bypass
  - INI-005 — unblockInitiative (POST /:id/unblock) > SCHEDULED (not BLOCKED) → 400 UNEXPECTED_CURRENT_STATUS — old bypass let ANY status jump straight to EXECUTING
- `tests/acceptance/odbior--o4c--business-case-live.e2e.test.ts`
  - O4-cluster · O4.1/O4.5 Business Case LIVE generation (real router + auth + LLM) > POST /api/v8/advisory/business-case generates a REAL business case (NPV/ROI + narrative + WACC resolution) — no mock LLM
- `tests/acceptance/odbior--t5--sanitizer-decode.e2e.test.ts`
  - T5: sanitizer double-escape decode-before-store > projects.name round-trips plain through create AND update
- `tests/acceptance/parity-3areas.e2e.test.ts`
  - PARITY: INTERVIEW — /api/interview/sessions (real runtime) > creates a session, saves an answer, reopens the same id and rejects a foreign tenant
  - PARITY: TERESA — note treść-LLM (real service, real LLM, real DB) > generates a note whose persisted body is real LLM prose, not the intent fallback
  - PARITY: BUSINESS CASE — /api/v8/advisory/business-case (real pipeline, real LLM) > runs the full 5-phase pipeline and returns a real numeric model (NPV/IRR/ROI)
- `tests/acceptance/red-final-500s.e2e.test.ts`
  - RED-FINAL · rewir czysty (schema-green) + pinned known exceptions > GET rewir: żaden endpoint nie zwraca 5xx (brak schema-500)
- `tests/acceptance/red-sync-500s.e2e.test.ts`
  - RED-SYNC schema-500 regressions (fixed) > write paths that depend on the new table/columns succeed
- `tests/acceptance/res003a-kpi-recovery-card.e2e.test.ts`
  - RES-003A — KPI Recovery Card canonical loop > 6) two parallel POST recovery-card for the same case create exactly one row
  - RES-003A — KPI Recovery Card canonical loop > 7) parallel close + continue on the same version: exactly one wins, DB version=2 (not 3)
  - RES-003A — KPI Recovery Card canonical loop > 8) two parallel POST actions with the same idempotencyKey create exactly one action, same id returned
  - RES-003A — KPI Recovery Card canonical loop > 9) retry POST link-task for the same action: the action stays linked to the SAME task both times
  - RES-003A — KPI Recovery Card canonical loop > 10) close succeeds: measurement fresher than activeSince, in-target, evidence + rating present
  - RES-003A — KPI Recovery Card canonical loop > 11) close rejected (STALE_MEASUREMENT) when no measurement is newer than activeSince — card state unchanged
  - RES-003A — KPI Recovery Card canonical loop > 12) close rejected (STILL_BREACHING) when latest measurement is still AMBER/RED — but continue succeeds on the same card
  - RES-003A — KPI Recovery Card canonical loop > 13) close rejected (MISSING_EVIDENCE) via the API when neither evidenceText nor evidenceRef is present
  - RES-003A — KPI Recovery Card canonical loop > 14) close rejected (400) when effectivenessRating is missing/invalid — required by the endpoint before the evidence/measurement gate runs
  - RES-003A — KPI Recovery Card canonical loop > 15) a CLOSED card reopens to ACTIVE via handleTimeSeriesRecorded when a new breaching measurement lands; activeSince advances
  - RES-003A — KPI Recovery Card canonical loop > 16) reopen does not delete pre-existing actions/checkpoints — both survive
  - RES-003A — KPI Recovery Card canonical loop > 18) org B cannot GET org A recovery card — 404, no leak of org A ids
  - RES-003A — KPI Recovery Card canonical loop > 19) org B cannot mutate org A card (PUT/close/continue) — 404, org A card state unchanged
  - RES-003A — KPI Recovery Card canonical loop > 20) org B cannot create a recovery card by guessing org A deviationCaseId
  - RES-003A — KPI Recovery Card canonical loop > 21) positive control: org A can fully read/write/close its own card
- `tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts`
  - RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 6 — a diverging actual snapshot opens exactly one reconciliation without mutating either side's authoritative source
  - RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 7 — cold reopen: re-reading through materializeInboxItems/getInboxItems + listRoiFinance* confirms every earlier claim, nothing depended on in-memory state
  - RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 8 — a second organization, run through the same dispatch, sees none of org A's inbox items/projections/reconciliations via the public paths
  - RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 9 — zero outbox rows for this suite's fixtures are left failed/dead_letter/parked, and zero CRITICAL alerts fired
  - RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 10 — the event log is complete and ordered: every tracked command has its event row + matching dispatched outbox row(s)
- `tests/acceptance/rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts`
  - RN-G4 · Point 1+2 — ROI Benefit optional KPI evidence link + Finance projection creates no second source of truth > Step 3 — a finance_projection dispatch tick that projects a value AND opens a reconciliation never mutates any ROI source table (hash+count identical before/after)
  - RN-G4 · Point 1+2 — ROI Benefit optional KPI evidence link + Finance projection creates no second source of truth > Step 4 — cold reopen: every claim above still holds via fresh public-path reads, nothing depended on in-memory state
- `tests/acceptance/t2-sla-flow.e2e.test.ts`
  - T2 · FINDING — SLA sweep has no assignment_kind filter (also escalates artifact reviews) > leaves assignment_kind=artifact for its dedicated review SLA path

### 11.5 Kompilacja 4b

- Serwer `server/tsconfig.build.json`: exit 0; log SHA-256 `7966bcb8cd71f77ef0bbcbc5638ceca84ebc8bd285a345232defd5e347f492fa`.
- Front `npm run build`: exit 0; log SHA-256 `10e1fd1d8535be56ce5cb1c003ac00a024633fd92d1fc5c23229710519dd2ddf`.
- Terminal ponownie zablokował literalne `rm -rf`; dokładny `server/dist` przeniesiono odzyskiwalnie do własnego scratch przed buildem.

### 11.6 Aktualizacja karty i status

- Status końcowy: **PARTIAL**. RED-ASSESS i dwa wymagane dowody mutacyjne są domknięte; globalny P1 pozostaje czerwony.
- Zmiany testów: AI preferences — **zamierzone zachowanie 503**; RED-ASSESS — **wzmocnienie do konkretnych kontraktów**; DECCASE — **usunięcie kanonizacji dziury**; T2 fixture — **naprawa danych**; T2 artifact — **czerwony kontrakt produktu poza P1**.
- Osiągalność: brak zmian runtime; RED-ASSESS i RED-FINAL montują realne routery oraz realny auth, lecz nie pełny `ApiGateway`, więc Gateway reachability pozostaje `NOT_PROVEN`.
- Finalny tip: **commit zawierający tę sekcję raportu (`git rev-parse HEAD`)**. SHA nie może być samoreferencyjnie wpisany do treści commita; literalny SHA jest potwierdzony w finalnym handoffie i na `github-backup/codex/day66-test-debt-p1-20260828`.

### 11.7 TWIERDZENIA NIEZWERYFIKOWANE

- **NOT_PROVEN:** naprawa 102 finalnych czerwonych testów; nie były przedmiotem zmian poza pięcioma obowiązkowymi pinami i RED-ASSESS.
- **NOT_PROVEN:** pełna osiągalność przez `ApiGateway` dla lokalnie montowanych routerów sweepów.
- **NOT_AUTHORIZED:** naprawa `slaService` dla artifact SLA oraz pozostałych plików produkcyjnych ujawnionych przez regres.
- **NOT_PROVEN:** globalna zieleń P2–P6, wdrożenie i stan środowisk zdalnych; nie były używane.
- **PARTIAL:** porównanie względem pierwszego baseline ma 4 czerwone→zielone i 0 zielone→czerwone tylko dla testów wykonanych po obu stronach; testy zablokowane wcześniej przez sekret są nieporównywalne.
