---
doc_id: current-mvp-control-2026-08-01
truth_type: delivery-status
status: canonical-current
owner: codex
business_owner: piotr
implementation_lead: claude
last_reviewed: 2026-08-02
---

# Bieżące sterowanie domknięciem MVP

## Pauza operacyjna — przejście między planami taryfowymi

Decyzja Piotra z 2026-08-02: w kończącym się planie Claude nie uruchamiamy już
nowych prac. Zamrożone wyniki pozostają bez zmian, a niezakończone work packets
zostaną przekazane workerom uruchomionym w kolejnym planie taryfowym.

Stan przekazania:

| Linia | Stan | Branch / checkpoint | Co przejmuje nowy worker |
| --- | --- | --- | --- |
| 1 — FIN-05 | `PAUSED_FOR_PLAN_HANDOFF` | `feat/fin-005-statement-ingestion-golden-flow` / `03f01021ac` | exactly-once keyed upload: trwały marker/result, fault recovery i cleanup plików |
| 2 — TLS-04 | `CODE_GO_FROZEN` | `feat/tls-004-teresa-assisted-swot` / `d383ac7106` | nic; nie otwierać ponownie przed integracją |
| 3 — MAT-10 | `PAUSED_FOR_PLAN_HANDOFF` | `feat/mat-010-canonical-artifact-receipt-lineage` / `48a757ba2c` | real-route Document/Presentation hooks, durable lineage recovery i tenant-safe Workbook cache |
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
  **EXE-02..04** — trwałe planowanie, capacity i RAID, oraz **ASM-05..07**
  (`a0dad7d024`) — atomowy quality review i immutable output;
- razem odebrane: **66/93 (71,0%)**;
- niezamknięte: **27/93**, w tym 26 pozycji w zakresie MVP i 1 pozycja
  `OUTSIDE_MVP`.

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

## Zatwierdzone wyjątki poza MVP

| Linia | Zakres | Stan | Zasada |
| --- | --- | --- | --- |
| D | Referral enrollment foundation | `CONDITIONAL_FOUNDATION_GO` | po backendowym feature gate zatrzymać; nie rozwiązywać DP-16/17/18, nie budować operator UI ani ACTIVE |
| E | Meeting core session | `OUTSIDE_MVP_REVIEW_ONLY` | zachować wynik i listę blockerów; bez dalszego rozwijania przed domknięciem krytycznego spine'u |

D i E są świadomymi odstępstwami. Nie wchodzą do release gate MVP i nie mogą
zabierać slotów wykonawczych liniom Finance/A/B/C bez nowej decyzji Piotra.
Po zakończeniu obecnych rund ich status operacyjny wynosi
`PARKED_AFTER_CURRENT_ROUND`; wznowienie wymaga jawnej decyzji Piotra i nowego
pakietu od Codex.

## Kolejność dalszego domknięcia

1. Zachować A/B/C jako `CODE_GO_FROZEN`; nie otwierać ich ponownie bez regresji.
2. Wykonać kontrolowaną integrację ich commitów i rozwiązać kolizje migracji
   oraz shared files wyłącznie w branchu integracyjnym.
3. Uruchomić jeden przekrojowy real-PG test i browser runtime dla tych samych ID.
4. Wykonać Railway `demo` acceptance jako oddzielną bramkę wydania.
5. Połączyć spine z Finance, Results i Materials zgodnie z `GF-FLOW-01`.
6. Następnie przejść przez pozostałe moduły MVP bottom-up:
   Assessment → Tools → Interview → pełne My Work → Chat.
7. Settings/Admin/SuperAdmin przechodzą końcowy platform/security gate.
8. Railway `demo` jest jedynym środowiskiem finalnego odbioru; produkcja jest
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
