---
doc_id: current-mvp-control-2026-08-01
truth_type: delivery-status
status: canonical-current
owner: codex
business_owner: piotr
implementation_lead: claude
last_reviewed: 2026-08-03
---

# Bieżące sterowanie domknięciem MVP

## Stan kanonicznej integracji — 2026-08-03

- **92/92 zadań MVP ma status `CODE_GO_FROZEN`.**
- Ledger programu nadal zawiera dokładnie **93 unikalne pozycje**: 92 MVP oraz
  `ASM-09`, świadomie sklasyfikowane jako `OUTSIDE_MVP`.
- Wszystkie 93 pozycje są więc rozstrzygnięte; `ASM-09` nie jest brakującą
  funkcją release'u i nie wolno sztucznie zmieniać go na `CODE_GO_FROZEN`.
- Kod zaakceptowanych delt został zebrany na
  `codex/integrate-mvp-final-20260803`. Integracja do `origin/demo` oraz
  Railway `demo` pozostają oddzielnymi bramkami wydania do czasu zakończenia
  buildów, migracji, push i authenticated smoke.
- FIN-05 został ponownie sprawdzony na izolowanym realnym PostgreSQL:
  **55/55 PASS**, bez retry. Zaakceptowany INT-08 (`692bbc855d`) jest przodkiem
  kandydata; nieodebrany WIP `2bc65b8037` nie jest częścią release'u.

Historyczne sekcje poniżej zachowują chronologię odbiorów. Aktualny task-level
status znajduje się w `MVP_SUBMODULE_CONTROL_BOARD.md`; powyższe podsumowanie
ma pierwszeństwo przed starszymi licznikami zapisanymi w tej kronice.

## Pauza operacyjna — przejście między planami taryfowymi

Decyzja Piotra z 2026-08-02: w kończącym się planie Claude nie uruchamiamy już
nowych prac. Zamrożone wyniki pozostają bez zmian, a niezakończone work packets
zostaną przekazane workerom uruchomionym w kolejnym planie taryfowym.

Stan przekazania:

| Linia | Stan | Branch / checkpoint | Co przejmuje nowy worker |
| --- | --- | --- | --- |
| 1 — FIN-05 | `CODE_GO_FROZEN` | `feat/fin-005-statement-ingestion-golden-flow` / `784fd4d942` | niezależnie odebrane multi-section recovery 6/6 real-PG; kontrolowana integracja pending |
| 2 — TLS-04 | `CODE_GO_FROZEN` | `feat/tls-004-teresa-assisted-swot` / `d383ac7106` | nic; nie otwierać ponownie przed integracją |
| 3 — MAT-10 | `CODE_GO_FROZEN` | `feat/mat-010-canonical-artifact-receipt-lineage` / `9949337972` | niezależnie odebrane 84/84 real-PG; kontrolowana integracja i Railway pozostają oddzielnymi bramkami |
| 4 — EXE-08 | `CODE_GO_FROZEN` | `feat/exe-008-closure-evidence-gate` / `b359a4edad` | nic; nie otwierać ponownie przed integracją |
| 5 — INT-08 correction | `PAUSED_FOR_PLAN_HANDOFF / RECONCILE_FIRST` | `feat/int-008-canonical-candidate-handoff` / `1c4a430154` + dirty tree | zabezpieczyć diff, porównać z przyjętym `INT-08` na branchu integracyjnym i dopiero wtedy zdecydować, co zachować |

Nowy worker zawsze zaczyna od `git status --short`, `rev-parse HEAD`, pełnego
diffu oraz porównania z przyjętym branchem integracyjnym. Nie wolno mu przejąć
cudzego dirty worktree w ciemno ani zmieniać statusu `CODE_GO_FROZEN` bez nowej
sprzeczności potwierdzonej przez Codex.

## Rola dokumentu

Ten plik jest jedyną bieżącą prawdą o kolejności pracy, aktywnych liniach i
bramkach integracji. Nie zastępuje kontraktów produktowych. Rozstrzyga natomiast
konflikt między historycznymi falami, raportami agentów i aktualnym wykonaniem.

Hierarchia w przypadku sprzeczności:

1. decyzje Piotra w `DECISION_REGISTER.md`;
2. ten dokument;
3. `ACCEPTANCE_BOARD.md` i `MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md`;
4. kontrakty i golden-flow maps;
5. historyczne plany, handoffy oraz raporty agentów.

Raport agenta jest materiałem do review, a nie zmianą statusu. Status zmienia
wyłącznie Codex po sprawdzeniu drzewa, diffu, testów i zakresu.

## Dwa różne znaczenia zakresu

Zakres produktowy MVP nadal obejmuje dziesięć modułów wskazanych w `WK-D-027`:
Materials, Finance, Results, Execution, Initiatives, Assessment, Tools,
Interview, My Work i Chat.

Bieżąca liczba linii wykonawczych nie jest liczbą modułów MVP. Fala A/B/C jest
zamknięta; kolejna fala pięciu linii jest przygotowywana osobno.

## Stan programu po zamknięciu A/B/C i ostatnich odbiorach

- odebrane przed falą: **19/93**;
- odebrane w zamkniętej fali A/B/C: **9**;
- odebrane po fali: **MAT-02** (`df79799cf4`) — trwały autosave dokumentu,
  **MW-05..06** (`59360f9ec1`) — create/live Decisions oraz **MAT-04**
  (`f24248bac8`) — trwały share→public read→rotate→revoke z UI, real-PG i CAS,
  **MAT-01** (`783e64dacb`) — kanoniczny registry list→open owning runtime,
  **MAT-05** (`598613179c`) — trwały workbook create→edit→formula→reopen→XLSX na real-PG,
  **MW-09** (`86f5c4024b`) — Ideas owner lifecycle z UI reopen i cross-tenant 404,
  **CHAT-01** (`bd9bb884b4`) — trwała historia sesji i tenant isolation,
  **TLS-02..03**
  (`aa7ec91ead`) — SWOT create/resume/navigation/edit z browserowym hard reload,
  trwałym read-backiem i izolacją tenantów, oraz **TLS-05** (`737a9384ca`) —
  quality/review/approve z immutable snapshotem i bezpiecznym RBAC, a także
  **TLS-06** (`d20fbac2d4`) — zatwierdzony SWOT→trwały raport→API/PG read-back→PDF→Report Builder hard reload,
  **INT-03** (`9ff284e6fd`, `387e662534`) — trwały respondent save/resume z browserowym reopen,
  oraz **INT-05** (`50e4edac4e`) — immutable submit snapshot, blokada edycji podczas review i bezpieczny send-back/resubmit,
  **INT-06** (`4512a8c492`) — klikowy manager send-back/approve z trwałym read-backiem,
  **INT-04** (`ce9e4cfa09`) — trwały audyt sugestii Teresy z atomową akceptacją i jawnym odrzuceniem,
  **INT-07** (`0ce4640146`) — trwała zakończona generacja insightu z SQL/read-backiem i evidence lineage,
  **INT-02** (`de35c444c4`) — assignment z kontrolą roli i tenantu, trwałym mirror taskiem oraz notification receipt widocznym po świeżym odczycie odbiorcy,
  **RES-05** (`f903185f0b`) — współbieżny Deviation Case z jednym kanonicznym ID oraz pełnym audytem acknowledge→RCA→action→resolve→close,
  **EXE-02..04** — trwałe planowanie, capacity i RAID, **ASM-05..07**
  (`a0dad7d024`) — atomowy quality review i immutable output, oraz **INT-01**
  (`0b3381a876`) — atomowy publish wersji Template, immutable snapshot,
  CAS/rollback/tenant guard i sesje przypięte do właściwej wersji, oraz
  **RES-12** (`0b3dee1891`) — okresowy immutable KPI snapshot, refresh v2,
  trwały Report Builder lineage i izolacja tenantów, oraz **CHAT-05**
  (`36aa6ffc40`) — proposal→approval/reject→atomowe execute→durable receipt,
  idempotentny completed retry, świeży read-back, pełny audit i izolacja tenantów,
  oraz **CHAT-02** (`0757748b2e`) — composer/Stop, fragmentowany SSE, governed tool
  events, trzy bounded retries bez duplikowania partiala, jawny manual retry i
  brak automatycznych ponowień dla access/budget/rate-limit, oraz **CHAT-07/08/09**
  (`3dab705084`) — wspólny Chat/Canvas→owner writer dla Material/Note/Table/Initiative,
  atomowy approval bez duplikacji, durable receipt z URL oraz fresh reopen na real-PG;
- razem odebrane: **83/93 (89,2%)**;
- niezamknięte w boardzie 93: **10/93**, w tym 9 pozycji w zakresie MVP i 1
  znacznik `OUTSIDE_MVP` (`ASM-09`). Nie oznacza to jednego zadania poza MVP:
  osobny `POST_MVP_WAVE_1.md` obejmuje SIRI, ADMA, około 30 pozostałych Tools,
  Audyty, Spotkania i Referral i nie wchodzi do mianownika 93.

`ASM-05..07` są ponownie doliczone po korekcie i niezależnym odbiorze atomowej
transakcji, fault-injection rollbacku oraz testu współbieżnego pojedynczego
current snapshotu.

`INI-06` i `EXE-07` nie są doliczane ponownie: należały już do wcześniejszych
19 pozycji. Linia C domknęła wyłącznie brakujące `INI-07`.

## Zamknięte linie wykonawcze A/B/C

Każda linia jest zespołem prowadzonym przez jednego głównego agenta. Główny
agent może orkiestrwać 8–10 zadań Sonnet zgodnie z
`AGENT_TEAM_OPERATING_MODEL.md`. Limit trzech linii nie ogranicza liczby analiz,
testów i red-teamów wewnątrz linii; ogranicza liczbę równoległych ownerów
biznesowych oraz punktów integracji.

### Zamknięcie fali

A/B/C nie wykonują już kolejnych rund w ramach tej fali. Ich wynik jest
zamrożony do kontrolowanej integracji i Railway `demo`. D i E pozostają poza
release gate MVP i nie są automatycznie wznawiane.

| Linia | Zakres | Branch / ostatni sprawdzony HEAD | Stan kontroli | Warunek następnego GO |
| --- | --- | --- | --- | --- |
| Finance (stara) | spójność golden flow Atelier Toys | `fix/fin-005-atelier-coherence` / `fbadd3c263` | `CODE_GO_LOCAL / FROZEN_FOR_INTEGRATION` | kontrolowana integracja, materializacja i pełny Railway `demo` acceptance; bez kolejnej rundy agenta |
| A | Assessment DRD round-trip (`ASM-01..04`) | `feat/asm-001a-drd-form-matrix-roundtrip` / `a3205f1151` | `CODE_GO_FROZEN` | integracja i Railway `demo` |
| B | Results Deviation→Recovery (`RES-06..08`, `RES-13`) | `feat/res-002-canonical-kpi-recovery-loop` / `882a721a92` | `CODE_GO_FROZEN` | integracja i Railway `demo` |
| C | Decision→Initiative→Execution (`INI-07`) | `integrate/decision-initiative-execution-gate` / `7b59d3a63b` | `CODE_GO_FROZEN` | integracja i Railway `demo` |

HEAD w tabeli jest snapshotem ostatniego review, nie obietnicą, że branch się nie
zmienił. Każdy kolejny odbiór zaczyna się od ponownego `git status`, `rev-parse`
i porównania z bazą.

## Post-MVP Fala 1

Decyzją Piotra z 2026-08-02 elementy poza bieżącym release gate są prowadzone
jako jeden kontrolowany program **Post-MVP Fala 1**. Kanoniczny zakres, kolejność
i bramka startowa znajdują się w [`POST_MVP_WAVE_1.md`](POST_MVP_WAVE_1.md).

Fala obejmuje sześć strumieni: SIRI, ADMA, pozostałe około 30 Tools, Audyty,
Spotkania oraz Referral. `ASM-09` pozostaje jedynym wierszem z licznika 93
oznaczonym `OUTSIDE_MVP`, ale grupuje SIRI/ADMA i nie reprezentuje całej liczby
pakietów post-MVP. Pozostałe strumienie są osobnym backlogiem i nie zmieniają
licznika domknięcia MVP.

Aktywne FIN-05, MW-07, MAT-10 oraz INT-08 pozostają w zakresie MVP. `EXE-09`
zostało odebrane i zintegrowane na `163bcbf395`: real-PG 27/27 plus regresja
EXE-08 18/18, UI 11/11, type-check i build PASS.

`MW-12` zostało odebrane i zintegrowane na `0c28362f55`: Manager zapisuje
owner mutation oraz actor-owned audit atomowo, zero-row i awaria audytu kończą
się rollbackiem; real-PG 3/3, testy service/escalation/UI 12/12, routes 10/10
i pełny type-check PASS.

`MW-11` zostało odebrane i zintegrowane na `f2468b5eb7` w zakresie bramki MVP
approval/audit/materialization: side-effect nie uruchamia się przed zgodą,
zatwierdzony payload pozostaje trwały, `approvedBy`/`approvedAt` są widoczne po
read-backu, a rezultat jest materializowany i możliwy do ponownego otwarcia.
Regresja unit/routes 56/56, real router+auth+PostgreSQL 6/6 i pełny type-check
PASS. Szersze versioning definicji i DAG nie są deklarowane jako część tego
odbioru.

## Zatwierdzone wyjątki poza MVP — wejście do Fali 1

| Linia | Zakres | Stan | Zasada |
| --- | --- | --- | --- |
| D | Referral enrollment foundation | `CONDITIONAL_FOUNDATION_GO` | po backendowym feature gate zatrzymać; nie rozwiązywać DP-16/17/18, nie budować operator UI ani ACTIVE |
| E | Meeting core session | `OUTSIDE_MVP_REVIEW_ONLY` | zachować wynik i listę blockerów; bez dalszego rozwijania przed domknięciem krytycznego spine'u |

D i E są świadomymi odstępstwami i odpowiednio zasilają strumienie Referral
oraz Spotkania w Post-MVP Fali 1. Nie wchodzą do release gate MVP i nie mogą
zabierać slotów wykonawczych liniom Finance/A/B/C bez nowej decyzji Piotra.
Po zakończeniu obecnych rund ich status operacyjny wynosi
`PARKED_AFTER_CURRENT_ROUND`; wznowienie wymaga jawnej decyzji Piotra i nowego
pakietu od Codex.

## Kolejność dalszego domknięcia

1. Zachować 78 odebranych pozycji jako `CODE_GO_FROZEN`; nie otwierać ich
   ponownie bez potwierdzonej regresji.
2. Prowadzić szybki tor odbioru: najpierw zadania z kompletnym aktywnym runtime,
   którym brakuje tylko świeżego testu integracyjnego, real-PG read-backu albo
   negatywnej kontroli. Nie dopisywać funkcji wyłącznie po to, aby podnieść licznik.
3. Każdego kandydata najpierw klasyfikować jako `TEST_ONLY`, `SMALL_INTEGRATION`
   albo `REAL_BUILD`. Do samodzielnego szybkiego domknięcia wybierać tylko dwa
   pierwsze typy; `REAL_BUILD` wraca do kolejki implementacyjnej.
4. `RES-12` oraz `CHAT-02..05` zostały domknięte lokalnie i włączone do kanonicznej integracji.
   Kolejny kandydat musi przejść ponowną klasyfikację dowodów. `INI-05` odpada
   z szybkiego toru, ponieważ
   portfolio nadal przełącza się V8→legacy, a resources/roadmap nie mają jednego
   potwierdzonego ownera zapisu. `MW-12` przeszło już własny flow
   action→atomowa mutacja+audit→fresh read-back i nie przejmuje dowodu z innego modułu.
   `RES-03` także jest `REAL_BUILD`: aktywne writery nie mają idempotency i nie
   wolno zamknąć go samym istniejącym testem jednostkowym.
5. Po każdym lokalnym odbiorze wykonać fast-forward kanonicznej gałęzi
   `integrate/mvp-wave1-abc`, pełny type-check/build proporcjonalnie do zmiany i
   zsynchronizować `MVP_SUBMODULE_CONTROL_BOARD.md` z dokładnym dowodem.
6. Równolegle zachować zintegrowany spine Finance/Results/Materials i przygotować
   przekrojowy real-PG/browser runtime dla tych samych ID.
7. Railway `demo` acceptance pozostaje oddzielną bramką wydania, a nie dowodem
   lokalnego `CODE_GO_FROZEN`.
8. Settings/Admin/SuperAdmin przechodzą końcowy platform/security gate.
9. Railway `demo` jest jedynym środowiskiem finalnego odbioru; produkcja jest
   poza zakresem bez osobnej decyzji Piotra.

## Bramka integracji A/B/C

Integracja nie jest zwykłym scaleniem commitów. Wymaga jednocześnie:

- jednego kanonicznego wejścia użytkownika;
- braku aktywnego business state w `localStorage`;
- jednego owner service dla każdej mutacji;
- session-derived actor i tenant/project scope;
- atomowego zapisu stanu i audytu dla decyzji i transition;
- obsługi loading/empty/error/403/404/409/terminal;
- PL/EN i testów komponentowych zmienionej powierzchni;
- real-PG concurrency i negative controls;
- browser flow: Inbox → Task → Decision → GO → ta sama Initiative w Execution;
- read-back po reopen i pełnego lineage identyfikatorów;
- czystego drzewa oraz zatrzymania agentów po `AWAITING_CODEX_REVIEW`.

## Warunek dokumentacyjnego domknięcia modułu

Dokumentacja modułu jest zamknięta dopiero, gdy ma:

1. jednoznaczny owner i granice domeny;
2. kanoniczne wejście oraz aktywny runtime;
3. AS-IS potwierdzone w kodzie;
4. docelowy golden flow i jawne elementy poza MVP;
5. mapę route → UI → API → service → DB → read-back → audit;
6. role, tenant/project scope i negatywne przypadki;
7. status funkcji bez mieszania planu z dowodem;
8. packet implementacyjny dla każdej realnej luki;
9. dowód lokalny oraz oddzielny dowód Railway `demo`;
10. decyzję `GO`, `GO_WITH_KNOWN_GAPS` albo `NO_GO`.

## Czego nie uznajemy za domknięcie

- samego raportu implementatora;
- zielonych mocków bez realnego PostgreSQL;
- backendu bez zamontowanego UI;
- komponentu niewidocznego w runtime;
- UI z `localStorage`, synthetic fixture albo fake success;
- testów bez przeprowadzonej negative control;
- lokalnego testu jako dowodu stagingowego;
- statusu `ACCEPTED` odziedziczonego z historycznego planu bez wskazania zakresu.

## Korekta kontrolna 2026-08-02 — MW-08 / CHAT-07-09 / MW-11

Po ponownym odbiorze gałęzi `codex/fix-cto-delivery-gates-20260802` obowiązują:

- MW-08 delta — `AWAITING_CODEX_REVIEW / RECONCILE_FIRST`; istnieje równoległa aktywna implementacja agenta 2 i wybór wersji kanonicznej należy do review;
- CHAT-07/08/09 delta — `ACTIVE_BUILD/FIX`; niezależne powtórzenie testu aktywnego komponentu zakończyło się 0/1 (brak trwałego linku po handoff); nie zmienia to wcześniejszego `CODE_GO_FROZEN` zadań bazowych;
- MW-11 delta — `AWAITING_CODEX_REVIEW`; niezależne unit/route 49/49 PASS, ale real-PG 9/9 wymaga jeszcze niezależnego odtworzenia; branch `codex/mw11-final-gate`, HEAD `ab1d9e85cd8f598ec13d320ec235574251b60592`.

Licznik został zsynchronizowany po osobnych odbiorach `FIN-05`, `FIN-06`, `MAT-10`, `MW-07` i `INI-04`: **83/93**. Delty MW-08/MW-11/Chat oraz security fix RES-10 nie są doliczane ponownie.
