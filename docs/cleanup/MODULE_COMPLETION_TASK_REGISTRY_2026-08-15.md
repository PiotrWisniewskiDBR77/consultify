# Consultify — wykonawczy rejestr dokończenia modułów

Data: 2026-08-15  
Authority SHA dla bazowego full gate: `aeb28eb6abeb0af9f16750c66d6de0e8bb359702`  
Status: `EXECUTION_REGISTRY / NOT_RELEASE_READY`

## Rozszerzenie siedmiopunktowego planu sprzątania

Pierwotne punkty 1–7 pozostają obowiązujące. Po nich wykonywane są trzy
dodatkowe etapy, które zamieniają inwentaryzację w jednoznaczny plan domknięcia
produktu.

### 8. Rejestr braków do finalnego wdrożenia

Każdy moduł otrzymuje jeden kanoniczny rekord obejmujący cały łańcuch
`SSOT -> route -> UI -> API -> service -> schema -> data -> tests -> demo`.
Rekord nie może opierać się na opinii. Każde twierdzenie wskazuje plik, endpoint,
tabelę, flagę albo wynik wykonanej bramki. Brak dowodu ma literalny status
`EVIDENCE_MISSING`, a sprzeczne implementacje status `OWNER_DECISION`.

Minimalne pola rekordu:

- `module_id`, cel, wejścia, wyjścia i właściciel danych;
- aktualny route i faktycznie montowany komponent;
- canonical API/service/schema oraz wykryte warianty legacy;
- wymagane migracje, fixture i deployment flags;
- elementy `CONNECTED`, `UNMOUNTED`, `DUPLICATE`, `DEAD_CANDIDATE` i `MISSING`;
- dokładne task IDs zamykające każdą lukę;
- testy pozytywne, replay, stale-version, role i tenant negatives;
- status realDB, demo, desktop, mobile, visual i accessibility;
- finalny verdict `MVP_READY`, `POST_MVP`, `BLOCKED` albo `DONE`.

DoD etapu 8: wszystkie 16 modułów ma rekord bez pustych pól krytycznych; każda
luka ma dokładnie jeden task ID; żadna funkcja znaleziona w recovery ledger nie
pozostaje bez verdictu lub przypisanego zadania.

### 9. Wykonawcze pakiety dla agentów

Każdy task ID z tego dokumentu staje się samodzielnym pakietem wykonawczym.
Pakiet jest gotowy do uruchomienia dopiero po uzupełnieniu wszystkich pól:

- objective i jednoznaczna granica `in scope / out of scope`;
- exact baseline SHA i zależności, które muszą być `DONE`;
- dozwolone pliki oraz pliki współdzielone zastrzeżone dla integratora;
- kontrakt AS-IS i oczekiwany TO-BE, wraz z zachowywanymi zachowaniami;
- wymagane zmiany UI, API, danych, migracji, flag i dokumentacji;
- deterministyczne fixtures oraz komendy focused/realDB/browser;
- scenariusz golden flow i obowiązkowe negative cases;
- dowody końcowe, rollback i jawne pozostałe ryzyka;
- format handoffu: final SHA, changed files, wyniki bramek i literalny status.

Agent nie może rozszerzyć tasku, scalić całej starej gałęzi, aktywować funkcji
parametrem URL ani nadać sobie statusu `DONE`. Odkrycie pracy spoza zakresu
tworzy wpis w rejestrze, nie ukrytą dodatkową implementację.

DoD etapu 9: każdy task przeznaczony do startu ma kompletny pakiet; zakresy
równoległych agentów są rozłączne; shared-file ownership i kolejność integracji
są zapisane przed rozpoczęciem kodowania.

### 10. Integracja, odbiór i kwalifikacja MVP

Integrator przyjmuje wyłącznie małe, opisane commity z pakietów etapu 9.
Integracja przebiega falami zależności z macierzy poniżej. Po każdej fali
powstaje jeden immutable candidate SHA oraz aktualizacja rejestru.

Kolejne poziomy dowodu są niezamienne:

1. `CODE_CONNECTED` — route, UI, API i persistence są faktycznie połączone;
2. `FOCUSED_GREEN` — pakiet przechodzi własne testy;
3. `REALDB_GREEN` — fresh i upgrade PostgreSQL oraz readback są zielone;
4. `SYSTEM_GREEN` — pełna brama na jednym SHA nie ma niesklasyfikowanych faili;
5. `DEMO_PARITY` — demo raportuje ten sam SHA, migracje i flag profile;
6. `OWNER_ACCEPTED` — podpisany flow desktop/mobile i ocena wizualna są PASS.

Moduł trafia do poniedziałkowego MVP tylko wtedy, gdy osiąga wszystkie wymagane
poziomy bez silent fallbacku, mocków, query/localStorage flags i danych
technicznych widocznych użytkownikowi. Pozostałe moduły są jawnie `POST_MVP` lub
`BLOCKED`; nie obniżają prawdziwości statusu MVP.

DoD etapu 10: jeden release SHA, jedna lista modułów MVP, komplet evidence links,
rollback, brak nieprzypisanego WIP oraz końcowy raport `implemented / missing /
deferred / rejected` dla każdego modułu.

## Cel i reguła statusu

Ten dokument przekłada audyt modułowy na rozłączne paczki wykonawcze. Każdy
wpis ma zamknięty zakres, zależności i dowód odbioru.

- `READY` — można rozpocząć pracę;
- `PARTIAL` — kod istnieje, ale DoD nie jest udowodnione;
- `BLOCKED` — wskazana zależność blokuje prawidłowe wykonanie;
- `EVIDENCE_MISSING` — kod może istnieć, ale brak wymaganego dowodu;
- `DONE` — komplet dowodów istnieje dla jednego SHA.

Focused test, route, widoczny przycisk, fixture, query flag lub deklaracja autora
same nigdy nie nadają statusu `DONE`.

## Zamrożone decyzje integracyjne

1. Dla MVP Agent zapisuje `transformation_cases`. `/zlecenia` i legacy
   `ai_agent_plans` nie są drugim aktywnym writerem. Konwergencja do `case_core`
   wymaga ADR, mapowania ID i migracji.
2. Results KPI/ROI/OKR aktywujemy wyłącznie przez deployment profile, nigdy
   query/localStorage. Normalna trasa nie może pokazywać disabled shell.
3. Finance pozostaje closed do kompletnego bridge/backfill report, jednej
   przestrzeni ID i realDB proof pięciu kanonicznych workspaces.
4. Audits jest poza podstawowym MVP albo jawnie oznaczone jako beta CRUD.
5. Historyczny ekran, route, flaga, migracja lub checkout może zostać usunięty
   dopiero z verdict `REPRESENTED|SUPERSEDED|REJECTED` i recovery path.

## Kontrakt paczki dla agenta

Agent otrzymuje jeden task ID lub rozłączny zestaw z jednej sekcji. Handoff musi
zawierać baseline/final SHA, listę plików, focused gate, realDB/readback,
ryzyka, status demo i literalny verdict. Wspólne `AppRoutes`, menu/navigation,
shared API, flag resolvers, migrator i global styles ma wyłącznie integrator.

### Szablon pojedynczego zadania

Każde zadanie uruchamiane przez agenta musi zostać skopiowane z rejestru w tym
formacie; brak któregokolwiek pola oznacza `NOT_READY_TO_START`:

```text
TASK_ID:
MODULE / OWNER:
OBJECTIVE:
BASELINE_SHA:
DEPENDS_ON:
IN_SCOPE:
OUT_OF_SCOPE:
ALLOWLIST:
SHARED_FILES_RESERVED_FOR_INTEGRATOR:
AS_IS_EVIDENCE:
TO_BE_CONTRACT:
DATA_AND_MIGRATION_REQUIREMENTS:
FIXTURE_AND_READBACK:
GOLDEN_FLOW:
NEGATIVE_CASES:
COMMANDS_TO_RUN:
DEMO_AND_VISUAL_PROOF:
ROLLBACK:
DONE_EVIDENCE:
HANDOFF_FORMAT:
```

Jeżeli analiza tasku nie pozwala wpisać konkretnego pliku, kontraktu lub
komendy, pierwszym rezultatem agenta jest bounded discovery report. Agent nie
przechodzi wtedy do kodowania, dopóki rejestr nie wskaże chirurgicznego zakresu.

## Fala 0 — authority, recovery i test truth

### CLEAN-001 — klasyfikacja pełnego standard gate

- Status: `IN_PROGRESS`, P0; owner: test-integrator.
- Wejście: `test-gates/standard-aeb28eb6a/summary.json` i 24 shard JSON/log.
- Zakres: 242 niezielone pliki / 476 testów. Każdy otrzymuje jeden verdict:
  `PRODUCT_REGRESSION`, `STALE_CONTRACT`, `HARNESS_BUG`, `WRONG_GATE`,
  `EXTERNAL_DEPENDENCY` lub `NONDETERMINISTIC`.
- Sygnały wejściowe: 36 plików ma 503-versus-401, 40 timeout, 17 niepełny
  mock/import, 7 niepełny i18n mock, co najmniej 4 używa DB sentinel. To hipotezy
  triage, nie końcowe werdykty.
- DoD: 242/242 ma verdict, ownera i komendę reprodukcji; full gate ma
  4052/4052 oraz 0 missing/unexpected.
- Zakaz: nie zmieniać produktu tylko po to, aby zachować starą asercję.
- Reprodukcja izolowana: 242/242 pliki wykonano ponownie, każdy w świeżym
  procesie na SHA `94d94e797e94020d22f47484c1f97e88e78f544c`; 0 przeszło,
  242 nadal niezielone. Jeden test workbook pozostawiał otwarty proces po
  zapisaniu JSON i został zakończony sygnałem TERM. Evidence:
  `/Users/piotrwisniewski/Developer/consultify-cleanup-evidence-20260814/test-gates/isolated-triage-94d94e797`.

#### CLEAN-001A — 132 server-runtime/DB harnesses

- Owner: DB-gate lane; allowlist: wyłącznie wskazane testy, matrix i test runner.
- Fakt: źródła importują server runtime/database lub `supertest`; standard gate
  celowo podaje niedostępny DB sentinel. Przykładowy test Settings otrzymuje 503
  zamiast oczekiwanego 401 oraz unhandled PostgreSQL rejection przed auth.
- Praca: dla każdego pliku wybrać `fresh-postgres`, `legacy-sqlite` albo
  `external-runtime`; zbudować wymagane fixtures i usunąć runtime DDL/open handles.
- DoD: 132/132 ma jawny gate i przechodzi w nim; standard nie uruchamia testów
  wymagających DB; auth negatives są wykonywane przy zdrowym runtime.

#### CLEAN-001B — 58 UI component contracts

- Owner: UI-harness lane; allowlist: 58 testów i ich bezpośrednie component
  fixtures/mocks; produkt tylko po udowodnionym regression verdict.
- Praca: porównać oczekiwanie z aktualnym kanonem UI/i18n/design tokens; nadać
  `STALE_CONTRACT`, `HARNESS_BUG` lub `PRODUCT_REGRESSION`.
- DoD: focused 58/58 PASS, brak act/unhandled warnings i brak snapshotów
  akceptujących techniczne UUID/enums.

#### CLEAN-001C — 16 unit tests z mockami

- Owner: mock-contract lane; allowlist: 16 testów i współdzielone test fixtures.
- Praca: uzupełnić aktualne eksporty, hoisted factories, i18n i API contract;
  nie maskować brakującej funkcji produktu przez mock.
- DoD: 16/16 PASS pojedynczo i razem; zero missing export/unhandled rejection.

#### CLEAN-001D — 36 pure/source contracts

- Owner: contract-review lane; allowlist: 36 testów, docs/SSOT i bezpośredni
  kod produktu tylko dla potwierdzonej regresji.
- Praca: rozdzielić świadome supersession od realnej utraty kontraktu; usunąć
  kruche source-anchor checks na rzecz zachowania lub jawnego structural proof.
- DoD: każdy verdict ma wskazany commit/SSOT; 36/36 PASS; brak osłabienia
  security, provenance, idempotency i honesty assertions.

### CLEAN-002 — semantyczny ledger 421 rozbieżnych tipów

- Status: `IN_PROGRESS`, P0; owner: recovery-integrator.
- Wejście: `refs/recovery/unknown-20260815/*`; bundle SHA-256
  `5bb23bea9d794b038a2710942a5bdf693417f6034ce7581f4c78480b034f5ade`.
- Zakres: merge-base, moduł, unikalne migrations/seeds/routes/UI/tests i verdict
  `REPRESENTED`, `CANDIDATE`, `SUPERSEDED`, `REJECTED` lub `OWNER_DECISION`.
- DoD: 421/421 ma verdict; każdy `CANDIDATE` wskazuje task ID i module diff;
  brak whole-branch merge.
- Patch-equivalence wykonane dla 421/421: 124 tipy są `PATCH_REPRESENTED`, 297
  zawiera unikalne patche. `git merge-base --independent` redukuje 297 do 224
  niezależnych końcówek; 68 z nich dotyka migrations. Evidence:
  `recovered-tip-patch-equivalence-257a1393f8.json` oraz
  `recovered-independent-head-module-inventory-257a1393f8.json` w katalogu
  cleanup evidence. Pozostały verdict jest semantyczny, nie automatyczny.

### CLEAN-003 — kontrolowane usuwanie

- Status: `BLOCKED` przez CLEAN-002; owner: cleanup-integrator.
- Zakres: martwe ekrany/routes/flagi, duplikaty checkoutów, cache i artefakty.
- DoD: import/dynamic-import/history proof, recovery path, delete commit i
  focused/full gate dla każdej pozycji.

### REL-001 — jeden identyfikowalny release candidate

- Status: `PARTIAL`, P0; owner: release-integrator.
- Zakres: immutable candidate SHA, client/server marker, migration ledger,
  deployment environment i evidence manifest.
- DoD: UI i `/api/health` zwracają ten sam SHA; artifact digest, demo deployment
  i browser trace wskazują dokładnie ten SHA.

## Fala 1 — rdzeń MVP

### CHAT-001 — jeden publiczny kontrakt rozmowy

- Status: `PARTIAL`, P0; owner: Chat lane.
- Zakres: rozdzielić core stream od V8 snapshot/handoff; usunąć silent fallback
  albo dodać jednoznaczną telemetrykę; zachować ordering i retry.
- Allowlist: `src/components/AIChat/**`, `src/hooks/useAIStream.ts`, chat clients,
  chat routes/services/tests.
- DoD: ask -> stream -> stop/retry -> persist -> cold reload; replay nie
  duplikuje; normalny route; zero cross-conversation leak.
- Dowód: UI/API, realDB readback, tenant negative, desktop/mobile trace.

### CHAT-002 — attachment, URL i citation provenance

- Status: `PARTIAL`, P0; zależność: CHAT-001.
- DoD: upload i URL mają accepted/failed states; cytowanie otwiera exact source;
  refresh zachowuje link; denied tenant nie odczytuje źródła.

### CHAT-003 — proposal-first action

- Status: `PARTIAL`, P0; zależność: CHAT-001.
- DoD: AI nie mutuje przed approve; approve/reject są audytowane; replay approval
  nie duplikuje skutku.

### ORG-001 — kanoniczny context snapshot

- Status: `PARTIAL`, P0; owner: Organization lane.
- Zakres: document -> claim proposal -> approve -> immutable snapshot; Teresa
  otrzymuje snapshot ID i source refs.
- DoD: conflict/source-delete semantics; tenant/confidentiality negatives; Chat
  czyta zatwierdzony snapshot, nie robocze claims.

### ORG-002 — jedna mapa sekcji i ownerów

- Status: `READY`, P1; zależność: ORG-001.
- DoD: profiles/context/claims/KG mają po jednym writerze i canonical deep link;
  wariant usuwa dopiero CLEAN-003.

### MYW-001 — Inbox bez niewidocznego fallbacku

- Status: `PARTIAL`, P0; owner: My Work lane.
- DoD: materialize -> triage -> task -> close -> cold reload; origin/source ID
  readback; tenant negative; fallback counter zero.

### MYW-002 — Decisions, Notebook i Ideas lineage

- Status: `PARTIAL`, P0; zależność: MYW-001.
- DoD: decision approve, notebook CAS/conflict/reload i idea conversion mają
  source_type/source_id, version i audit; desktop/mobile proof.

### AGT-001 — jeden widoczny model Transformation Case

- Status: `PARTIAL`, P0; owner: Agent lane.
- Zakres: normalny Agent używa `transformation_cases`; legacy Archive/Plans i
  `/zlecenia` nie są writerami w MVP.
- DoD: create -> reload -> ten sam ID; brak UUID/raw enum/`NOT_CONNECTED` dla
  użytkownika; diagnostics tylko operator.

### AGT-002 — Teresa i człowiek edytują jeden Plan

- Status: `PARTIAL`, P0; zależność: AGT-001.
- Zakres: persisted collaboration mode, wspólna wersja, semantic diff,
  proposal-first AI i human edit.
- DoD: cztery tryby mają trwały kontrakt; stale version daje conflict; approve
  tworzy jedną wersję i audit.

### AGT-003 — jeden wykonywalny etap i artefakt

- Status: `EVIDENCE_MISSING`, P0; zależność: AGT-002, MAT-001.
- DoD: approved stage -> owning-module write -> idempotent retry -> result i
  editable artifact; cold reopen otwiera oba.

### INT-001 — jeden canonical Interview API/client

- Status: `PARTIAL`, P0; owner: Interview lane.
- Zakres: owner legacy/v4/V8, jawne adaptery, invitation lifecycle, autosave/CAS
  i immutable answer lineage.
- DoD: create/version/publish -> invite -> external resume/submit -> review/
  send-back/approve; expiry/revoke, anonymous wall, tenant/role negatives.

### INT-002 — insight i kontrolowany handoff

- Status: `EVIDENCE_MISSING`, P0; zależność: INT-001.
- DoD: answer refs -> insight -> handoff receipt -> jeden downstream ID; retry
  zachowuje cardinality 1.

### TLS-001 — Dynamic SWOT jako jedyny tool MVP

- Status: `PARTIAL`, P0; owner: Tools lane.
- DoD: create/reopen/CAS -> review/send-back/approve -> immutable non-empty
  output -> canonical report -> one initiative; race/replay/tenant negatives.

### TLS-002 — migracje zamiast runtime DDL

- Status: `PARTIAL`, P0; zależność: TLS-001.
- DoD: DDL przeniesiony do migracji; canonical output/report reads; fresh i
  upgrade PostgreSQL; runtime DB role bez DDL rights.

### TLS-003 — bramka dla kolejnych narzędzi

- Status: `READY`, P2; zależność: TLS-001.
- DoD: każdy tool ma osobny task, non-empty builder, output assertions i golden
  browser flow; katalog nie jest hurtowo uznany za gotowy.

### ASM-001 — DRD jako jeden Assessment MVP

- Status: `PARTIAL`, P0; owner: Assessment lane.
- DoD: jeden methodology/version owner; start -> evidence/answers -> CAS ->
  freeze -> immutable report -> reopen; brak silent workflow-v2 fallback.

### ASM-002 — migracje zamiast runtime DDL

- Status: `PARTIAL`, P0; zależność: ASM-001.
- DoD: ordered fresh+upgrade migrations; golden flow działa z rolą bez DDL.

### ASM-003 — report link i initiatives batch

- Status: `PARTIAL`, P1; zależność: ASM-001.
- DoD: brak redirect race, server origin filter, batch z immutable lineage;
  retry nie duplikuje Initiative.

### INI-001 — idempotentna Initiative i governance

- Status: `PARTIAL`, P0; owner: Initiatives lane.
- DoD: candidate-to-initiative cardinality 1; concurrent accept/retry, CAS,
  role transitions, cancel/reversal, audit i cold reopen.

### INI-002 — dokładnie jeden handoff receipt

- Status: `EVIDENCE_MISSING`, P0; zależność: INI-001, EXE-001.
- DoD: approved Initiative -> scheduled handoff -> jeden Execution ID; replay i
  network retry nie duplikują.

### EXE-001 — one-handoff-one-execution-case

- Status: `PARTIAL`, P0; owner: Execution lane.
- Zakres: inicjatywy w realizacji jako karty; work/resource/control/report
  writeback; jeden health model i jawne blocked states.
- DoD: incoming handoff -> karta -> zmiana -> cold reload; role/tenant negatives.

### EXE-002 — delivery evidence zamiast task status

- Status: `EVIDENCE_MISSING`, P0; zależność: EXE-001.
- DoD: completed task bez evidence nie zamyka delivery; approved evidence robi
  jeden downstream Results write.

## Fala 2 — artefakty, control plane i Results

### MAT-001 — Document Studio real flow

- Status: `PARTIAL`, P0; owner: Materials DOC lane.
- DoD: create/edit/version/reopen/export editable DOCX; provenance, stable link,
  four-eyes, real provider i visual desktop/mobile.

### MAT-002 — Presentation real flow

- Status: `PARTIAL`, P0; owner: Materials PPT lane.
- DoD: create/edit/version/reopen/export PPTX; template approval, autosave title,
  lineage i render visual.

### MAT-003 — Spreadsheet real flow

- Status: `PARTIAL`, P0; owner: Materials XLS lane.
- DoD: workbook/sheet/formula/format/version/reopen/export XLSX; formuły po
  roundtrip i preview zgodny z plikiem.

### MAT-004 — library/launcher i retirement

- Status: `BLOCKED` przez MAT-001/002/003 i CLEAN-002.
- DoD: jeden launcher/canonical deep links; stare Studio/Wizard usuwane dopiero
  po recovery verdict.

### ADM-001 — machine-readable capability matrix

- Status: `PARTIAL`, P0; owner: Admin lane.
- Zakres: route/action -> role/capability -> org scope -> audit event; rozdzielić
  Tenant Admin i SuperAdmin.
- DoD: invite/accept/role/revoke oraz cross-org, last-admin, stale-role i
  no-capability negatives z DB audit readback.

### SET-001 — registry ustawień

- Status: `PARTIAL`, P0; owner: Settings lane.
- Zakres: control -> owner -> scope -> storage -> effect -> secret rule; hide
  no-op, bez symulowania sukcesu.
- DoD: profile/language/theme/notifications/AI save/reload/new session; forced
  policy locked; sekret nie wraca z API.

### SET-002 — security-sensitive flows

- Status: `EVIDENCE_MISSING`, P1; zależność: SET-001, ADM-001.
- DoD: OAuth/calendar, MFA, export i deletion z re-auth, audit, cross-user
  negatives, mobile/a11y.

### RES-001 — deployment cutover KPI/ROI/OKR

- Status: `PARTIAL`, P0; owner: Results integrator.
- DoD: trzy VNext flags w demo config; normalny signed-in route otwiera KPI/ROI/
  OKR bez query/localStorage; disabled shell niemożliwy; rollback opisany.

### RES-002 — KPI golden flow

- Status: `EVIDENCE_MISSING`, P0; zależność: RES-001.
- DoD: current definition -> observation -> deviation -> action -> effectiveness;
  scorecard fixture, stale/self-approval/tenant/append-only negatives.

### RES-003 — ROI golden flow

- Status: `EVIDENCE_MISSING`, P0; zależność: RES-001.
- DoD: baseline -> approval snapshot -> actual -> variance -> PIR; precision,
  stale/self-approval/tenant/append-only negatives.

### RES-004 — OKR golden flow

- Status: `EVIDENCE_MISSING`, P0; zależność: RES-001.
- DoD: policy/cycle/set -> objective/KR -> check-in -> review/reflection; current
  pointer, not-calculable, role/tenant i immutable history.

## Fala 3 — świadomie poza podstawowym MVP

### FIN-001 — bridge/backfill i jedna przestrzeń ID

- Status: `BLOCKED`, P1; owner: Finance integrator.
- DoD: legacy/v2/v3 inventory, deterministic bridge, unresolved report, ADR
  canonical generation; 100% aktywnych demo records mapped lub jawnie unresolved.

### FIN-002 — pięć canonical workspaces

- Status: `BLOCKED` przez FIN-001.
- DoD: statement/baseline/prediction/analysis/valuation create-update-approve-
  reopen; utilities tylko z real IDs; precision/RLS/tenant/fresh+upgrade/browser.

### FIN-003 — Results ROI reconciliation

- Status: `BLOCKED` przez FIN-001 i RES-003.
- DoD: jeden owner pól economics; reconciliation report bez nieopisanych różnic.

### AUD-001 — uczciwy base CRUD beta

- Status: `PARTIAL`, P1; owner: Audits lane.
- DoD: route/menu/API mają jeden status; create/save/reopen/delete program i
  role/tenant proof; bez obietnicy pełnego lifecycle.

### AUD-002 — jeden full lifecycle owner

- Status: `BLOCKED` przez AUD-001 i decyzję post-MVP.
- DoD: jeden owner `/api/audit` i `/api/audits`; pack rights, segregation of
  duties, criterion-to-closure, effectiveness i handoff.

### MTG-001 — Meeting/Minutes contract

- Status: `PARTIAL`, P1; owner: Meeting lane.
- DoD: create -> agenda/materials -> notes -> proposed summary -> approve ->
  one decision + task + material -> cold reopen; consent/retention/tenant proof.

### PAR-001 — jeden V8 partner contract

- Status: `PARTIAL`, P2; owner: Partner lane.
- DoD: legacy/V8 adapter, participant_type, individual ledger, versioned
  commission rules; register -> certificate -> code -> sale -> commission ->
  payout z expiry/currency/correction/isolation negatives.

## Macierz współbieżności

Równolegle: `CHAT-*`/`ORG-*`; `MYW-*`/`AGT-*`; osobno `INT-*`, `TLS-*`,
`ASM-*`; osobno `INI-*`/`EXE-*`; `MAT-001/002/003`; `RES-002/003/004` dopiero
po RES-001; `ADM-*`/`SET-*` z jednym ownerem policy boundary.

Nie wolno równolegle edytować `AppRoutes`, route config, sidebar/menu config,
global flag resolvers, migrator/ledger, shared API barrel, global CSS/tokens ani
deployment config. Te pliki ma integrator fali.

## Wspólna brama `DONE`

1. baseline/final SHA i czysty status;
2. reviewed changed-file allowlist i `git diff --check`;
3. focused unit/component/API;
4. fresh i upgrade PostgreSQL dla persistence;
5. replay/stale-version/role/tenant negatives;
6. normalny route bez query/localStorage aktywacji;
7. demo służące dokładnie z final SHA;
8. signed-in desktop/mobile trace i network/console verdict;
9. visual verdict: Consultify tokens, typography, density, loading/empty/error,
   brak technicznych enumów i UUID;
10. downstream handoff oraz rollback/recovery path.

## Kolejność uruchomienia agentów

1. CLEAN-001 i CLEAN-002; integrator nie zmienia funkcji produktu.
2. CHAT-001, ORG-001, MYW-001, AGT-001, INT-001, TLS-001, ASM-001, INI-001 i
   EXE-001 w rozłącznych worktree.
3. Następcy dopiero po dowodzie poprzednika, nie po deklaracji agenta.
4. Materials/control plane, potem Results cutover.
5. Finance/Audits/Meeting/Partner zgodnie z falą 3.
6. REL-001, pełne gates oraz demo/browser/visual na jednym finalnym SHA.
