---
doc_id: execution-function-catalog-2026-07-31
module: Execution
truth_type: product-target
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Execution — katalog i specyfikacja funkcji

## 1. Cel dokumentu

Ten dokument jest wykonawczą specyfikacją produktu. Opisuje funkcje niezależnie
od obecnej jakości interfejsu i nie uznaje funkcji za gotową tylko dlatego, że
istnieje komponent, endpoint lub tabela.

Każda funkcja podlega temu samemu kontraktowi:

- ma jasno określonego użytkownika i problem;
- czyta i zapisuje kanoniczne obiekty;
- posiada stany, reguły i uprawnienia;
- obsługuje empty, loading, error, stale i conflict;
- zachowuje audit trail;
- ma test kontraktu, integracji i E2E;
- jest odbierana na działającym stagingu.

Obowiązkowy format pełnej karty określa
[`EXECUTION_FUNCTION_SPEC_STANDARD.md`](EXECUTION_FUNCTION_SPEC_STANDARD.md).
Tabela katalogu i opisy grupowe nie oznaczają jeszcze, że dana funkcja osiągnęła
bramkę `READY_FOR_TASK_BREAKDOWN`.

## 2. Role

| Rola | Odpowiedzialność |
| --- | --- |
| Sponsor | zatwierdza cel, materialne zmiany, eskalacje i closure |
| Initiative Owner | odpowiada za uzasadnienie i oczekiwany wynik |
| Execution Manager | odpowiada za plan, koordynację i dowiezienie |
| Workstream Owner | odpowiada za work package i zależności |
| Task Owner | wykonuje pracę i utrzymuje prawdziwy status |
| Resource Manager | zarządza dostępnością, kompetencjami i konfliktami |
| Finance Owner | potwierdza budżet i finansowe actuals |
| Results Owner | prowadzi docelowe KPI i późniejsze pomiary |
| Reviewer/Approver | zatwierdza wskazane bramki oraz zmiany |
| Viewer | czyta dozwolony zakres bez prawa zmiany |
| Teresa | analizuje, proponuje, przypomina i przygotowuje decyzje |

Jedna osoba może pełnić kilka ról, ale system zachowuje rozdzielenie
odpowiedzialności. Konfiguracja może zabronić self-approval.

## 3. Model informacji

Kanoniczna hierarchia:

`Portfolio → Program → Initiative → Execution → Workstream → Work Package →
Milestone/Task → Checklist`

Obiekty zarządcze:

- `ExecutionBrief`;
- `ExecutionBlueprint`;
- `PlanVersion`;
- `Baseline`;
- `ResourceAllocation`;
- `BudgetEnvelope`;
- `RAIDItem`;
- `Decision`;
- `ChangeRequest`;
- `ExecutionSignal`;
- `Intervention`;
- `RolloutWave`;
- `ReadinessReview`;
- `CutoverRunbook`;
- `StatusSnapshot`;
- `ClosureRecord`;
- `HandoverPack`;
- `LessonLearned`.

## 4. Katalog funkcji

### 4.1. Intake i uruchomienie

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-INT-001` | Utworzenie Execution z Approved Initiative | MVP |
| `EXE-INT-002` | Guided Execution Brief z Teresą | MVP |
| `EXE-INT-003` | Wybór trybu Lite/Standard/Complex | MVP |
| `EXE-INT-004` | Wybór i wersjonowanie Blueprint | MVP |
| `EXE-INT-005` | Readiness gate | MVP |
| `EXE-INT-006` | RACI/DACI i governance cadence | MVP |
| `EXE-INT-007` | Review i aktywacja Execution | MVP |

### 4.2. Planowanie

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-PLN-001` | WBS i hierarchia pracy | MVP |
| `EXE-PLN-002` | Workstreams i work packages | MVP |
| `EXE-PLN-003` | Tasks, subtasks i checklist | MVP |
| `EXE-PLN-004` | Milestones i bramki | MVP |
| `EXE-PLN-005` | Dependencies i constraints | MVP |
| `EXE-PLN-006` | Timeline/Gantt | MVP |
| `EXE-PLN-007` | Critical path i float | NEXT |
| `EXE-PLN-008` | Estymacje czasu, effort i kosztu | MVP |
| `EXE-PLN-009` | Baseline planu | MVP |
| `EXE-PLN-010` | What-if sandbox i scenariusze | NEXT |
| `EXE-PLN-011` | Porównanie i publikacja scenariusza | NEXT |
| `EXE-PLN-012` | Szablony cyklicznych elementów | NEXT |

### 4.3. Wykonanie pracy

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-WRK-001` | Lista/board/timeline nad jednym task truth | MVP |
| `EXE-WRK-002` | Aktualizacja statusu i progress | MVP |
| `EXE-WRK-003` | Definition of Done i evidence | MVP |
| `EXE-WRK-004` | Blocker i request for help | MVP |
| `EXE-WRK-005` | Komentarze, @mentions i decyzje | MVP |
| `EXE-WRK-006` | Rejestr czasu/effort actual | MVP |
| `EXE-WRK-007` | Review i approval ukończenia | MVP |
| `EXE-WRK-008` | Dwukierunkowy widok My Work | MVP |
| `EXE-WRK-009` | Szybka aktualizacja mobilna | NEXT |

### 4.4. Control Tower

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-CTL-001` | Portfolio health | MVP |
| `EXE-CTL-002` | Action queue | MVP |
| `EXE-CTL-003` | Delay/milestone signal | MVP |
| `EXE-CTL-004` | Risk/issue signal | MVP |
| `EXE-CTL-005` | Budget signal | MVP |
| `EXE-CTL-006` | Capacity/skill signal | MVP |
| `EXE-CTL-007` | Decision overdue signal | MVP |
| `EXE-CTL-008` | Alert deduplication i severity | MVP |
| `EXE-CTL-009` | Forecast daty i kosztu zakończenia | MVP |
| `EXE-CTL-010` | Triage i acknowledge | MVP |
| `EXE-CTL-011` | Interwencja reassign/smooth/replan/escalate | MVP |
| `EXE-CTL-012` | Effectiveness review | MVP |

### 4.5. Zasoby

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-RES-001` | Profile kompetencji i ról | MVP |
| `EXE-RES-002` | Kalendarz dostępności | MVP |
| `EXE-RES-003` | Allocation do Initiative/work package | MVP |
| `EXE-RES-004` | Capacity heatmap | MVP |
| `EXE-RES-005` | Konflikty i przeciążenia | MVP |
| `EXE-RES-006` | Vacancy/skill gap | NEXT |
| `EXE-RES-007` | Demand forecast | NEXT |
| `EXE-RES-008` | Substitute/delegation | MVP |
| `EXE-RES-009` | Resource scenario | NEXT |

### 4.6. Budżet i koszty

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-BUD-001` | Approved budget envelope | MVP |
| `EXE-BUD-002` | Plan kosztów work package | MVP |
| `EXE-BUD-003` | Commitments i actual cost | MVP |
| `EXE-BUD-004` | Estimate to complete/EAC | MVP |
| `EXE-BUD-005` | Cost variance i progi | MVP |
| `EXE-BUD-006` | Cost of delay | NEXT |
| `EXE-BUD-007` | Cash timing | NEXT |
| `EXE-BUD-008` | Reconciliation z Finance | MVP |

### 4.7. Governance

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-GOV-001` | RAID+D register | MVP |
| `EXE-GOV-002` | Decision record i deadline | MVP |
| `EXE-GOV-003` | Decision brief Teresy | MVP |
| `EXE-GOV-004` | Change Request | MVP |
| `EXE-GOV-005` | Impact analysis | MVP |
| `EXE-GOV-006` | Approval matrix | MVP |
| `EXE-GOV-007` | Rebaseline i wersjonowanie | MVP |
| `EXE-GOV-008` | Exception/waiver | NEXT |
| `EXE-GOV-009` | Audit trail | MVP |
| `EXE-GOV-010` | Widoczność elementu | MVP |

### 4.8. Rollout

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-RLL-001` | Rollout strategy | MVP |
| `EXE-RLL-002` | Pilot | MVP |
| `EXE-RLL-003` | Readiness criteria i review | MVP |
| `EXE-RLL-004` | Waves, lokalizacje i grupy | MVP |
| `EXE-RLL-005` | Go/no-go | MVP |
| `EXE-RLL-006` | Cutover runbook | MVP |
| `EXE-RLL-007` | Communication/training readiness | MVP |
| `EXE-RLL-008` | Hypercare | MVP |
| `EXE-RLL-009` | Rollback/contingency | MVP |
| `EXE-RLL-010` | Operational handover | MVP |

### 4.9. Raportowanie i zamknięcie

| ID | Funkcja | Priorytet |
| --- | --- | --- |
| `EXE-RPT-001` | Status update ownera | MVP |
| `EXE-RPT-002` | Automatyczny status draft | MVP |
| `EXE-RPT-003` | Operator/manager/sponsor/executive view | MVP |
| `EXE-RPT-004` | Status Snapshot | MVP |
| `EXE-RPT-005` | Scheduled distribution | NEXT |
| `EXE-RPT-006` | Publikacja przez Materials | MVP |
| `EXE-CLS-001` | Closure readiness | MVP |
| `EXE-CLS-002` | Scope/time/cost reconciliation | MVP |
| `EXE-CLS-003` | Results handoff | MVP |
| `EXE-CLS-004` | Finance handoff | MVP |
| `EXE-CLS-005` | Lessons learned | MVP |
| `EXE-CLS-006` | Formal closure | MVP |

## 5. Szczegółowe kontrakty funkcji MVP

### `EXE-INT-001` — utworzenie Execution

**Użytkownik:** Initiative Owner lub Execution Manager.

**Warunek wejścia:** Initiative ma status zatwierdzony i dostępny snapshot
zakresu, oczekiwanego wyniku, Investment Case oraz KPI contract.

**Działanie:**

1. użytkownik wybiera `Start Execution`;
2. system pokazuje dane źródłowe i wykryte braki;
3. Teresa proponuje typ, blueprint i zakres briefu;
4. użytkownik potwierdza utworzenie;
5. system tworzy jeden rekord Execution ze source linkiem;
6. ponowne wywołanie prowadzi do istniejącego rekordu zamiast tworzyć duplikat.

**Błędy:** brak uprawnienia, niezatwierdzona Initiative, nieaktualny snapshot,
istniejące Execution, konflikt wersji.

**Odbiór:** read-back w Initiative otwiera dokładnie utworzony rekord.

### `EXE-INT-002` — Guided Execution Brief

Teresa prowadzi dialog sekcjami, pokazuje postęp i zapisuje draft po każdej
zaakceptowanej części. Nie wymusza jednakowego formularza dla małej i złożonej
zmiany.

Brief nie przechodzi do review, jeśli brakuje:

- zakresu i kryteriów ukończenia;
- ownera;
- głównych milestones;
- najważniejszych zależności;
- budżetu lub jawnego statusu `not required/not available`;
- planu zasobów;
- KPI wykonania i linku do Results;
- ryzyk startowych;
- closure criteria.

### `EXE-INT-003` — tryby złożoności

| Tryb | Zastosowanie | Wymagane elementy |
| --- | --- | --- |
| Lite | mała, niskoryzykowna zmiana | brief, owner, tasks, termin, DoD, closure |
| Standard | typowa Initiative | pełny plan, budget, RAID, reporting, handoff |
| Complex | program/wiele zespołów | workstreams, gates, capacity, rollout, governance |

Zmiana trybu jest audytowalna. Obniżenie trybu nie usuwa danych i może wymagać
approval.

### `EXE-PLN-001..009` — plan i baseline

Plan wspiera hierarchię, zależności, milestones, constraints, estymacje i
przydziały. List, board i timeline/Gantt są widokami tych samych obiektów.

Baseline zawiera zamrożone:

- scope i WBS;
- start/end i milestones;
- effort i capacity;
- budget;
- najważniejsze assumptions i dependencies;
- wersję oraz approvera.

Zmiana bieżącego planu nie zmienia baseline. Widok variance jest dostępny na
poziomie task, milestone, workstream i całego Execution.

### `EXE-WRK-001..008` — wykonanie i My Work

Statusy:

`Not started → Ready → In progress → In review → Done`

Stany równoległe:

`Blocked`, `Waiting`, `At risk`, `Cancelled`.

`Done` wymaga spełnienia DoD i dowodu, jeśli blueprint tego wymaga. Odrzucenie
review przywraca `In progress` wraz z przyczyną.

My Work pokazuje ten sam obiekt. Aktualizacja statusu lub komentarza w My Work
jest natychmiast widoczna w Execution; konflikt wersji wymaga świadomego
rozwiązania.

### `EXE-CTL-001..012` — Control Tower

Sygnał zawiera:

- typ, severity, confidence i czas;
- obiekt oraz scope;
- baseline, actual, forecast i próg;
- wyjaśnienie;
- przewidywany wpływ;
- ownera reakcji i SLA;
- dostępne interwencje;
- status oraz historię.

Powiązane sygnały są grupowane, aby nie tworzyć wielu alarmów o tej samej
przyczynie. Action queue sortuje według wpływu, pilności, confidence i braku
reakcji, nie tylko daty utworzenia.

Interwencja zawsze posiada:

`preview → impact → approval if required → execute → read-back → verify`

### `EXE-RES-001..005` — zasoby

Capacity wynika z kalendarza dostępności minus zatwierdzone allocations, a nie
z samej liczby zadań. Przydział określa okres, procent lub godziny, rolę,
kompetencję, koszt i confidence.

Konflikt pokazuje wszystkie konkurujące Initiative i prowadzi do decyzji:

- reprioritize;
- reassign;
- smooth;
- defer;
- split;
- add capacity;
- accept risk.

### `EXE-BUD-001..005` — budżet

Execution przechowuje wykonawczą alokację budżetu i actual cost, ale Finance
pozostaje właścicielem finansowej interpretacji.

Widoczne wartości:

- approved budget;
- planned;
- committed;
- actual;
- estimate to complete;
- estimate at completion;
- variance;
- data freshness i source.

Koszt bez źródła lub okresu nie może zostać oznaczony jako zatwierdzony actual.

### `EXE-GOV-001..009` — RAID+D i change control

Każdy element ma ownera, termin, severity, wpływ, status i historię.

Change Request przechodzi:

`Draft → Impact assessed → In review → Approved/Rejected → Implemented →
Verified`

Materiality decyduje o approverze. Zatwierdzony rebaseline tworzy nową wersję,
ale nigdy nie usuwa pierwotnej.

### `EXE-RLL-001..010` — rollout

Każda fala posiada:

- scope, odbiorców i lokalizację;
- ownera;
- readiness criteria;
- plan i termin;
- communication/training;
- cutover steps;
- contingency oraz rollback;
- go/no-go decision;
- hypercare window;
- operational acceptance.

Brak obowiązkowego kryterium blokuje go-live albo wymaga jawnego waiver.

### `EXE-RPT-001..006` — raport

Teresa generuje draft z danych snapshotu, ale owner uzupełnia kontekst:

- co się zmieniło;
- dlaczego;
- co zagraża wynikowi;
- jakie decyzje lub wsparcie są potrzebne;
- co wydarzy się dalej.

Publikowany raport jest wersjonowanym snapshotem. Późniejsze zmiany danych nie
zmieniają historycznego raportu.

### `EXE-CLS-001..006` — closure

Closure gate sprawdza:

- scope i wyjątki;
- milestones i DoD;
- otwarte RAID+D;
- actual time/cost;
- operational owner;
- rollout/hypercare;
- Results handoff;
- Finance handoff;
- lessons learned.

Dozwolony komunikat końcowy:

`Execution completed — outcome measurement continues in Results`.

## 6. Standard widoków

### Portfolio

Pierwszą i domyślną zakładką modułu jest `List`: tabela wszystkich
realizowanych inicjatyw. Portfolio analytics może korzystać z tych samych
danych, lecz nie zastępuje tabeli wejściowej.

Minimalne kolumny `List`:

- Initiative/Execution;
- owner;
- etap;
- health;
- baseline end i forecast end;
- schedule variance;
- approved budget, actual i EAC;
- capacity risk;
- top risk;
- overdue decision;
- next milestone;
- next required action.

Tabela używa StandardTable i StandardPreview, wspiera sortowanie, filtrowanie,
grupowanie, zapisane widoki, wybór wielu wierszy oraz Menu 3. Kliknięcie wiersza
otwiera preview; jawna akcja albo deep link otwiera pełny workspace Execution.
Domyślnie widoczne są aktywne realizacje. Zakończone, wstrzymane i
zarchiwizowane są dostępne przez filtry, a nie mieszane bez oznaczenia z pracą
aktywną.

### Execution workspace

- lewa część: właściwy widok pracy;
- preview: pełny kontekst wybranego obiektu;
- Menu 3: filtry, zakres, scenariusz, status danych i akcje;
- stały pasek health, baseline/forecast, budget i decisions;
- widoczna ścieżka do Initiative, Results, Finance i Materials.

### Control Tower

Domyślnie pokazuje kolejkę działań, nie galerię wykresów. Każdy element ma
wyjaśnienie, ownera, SLA i przycisk prowadzący do kontrolowanej interwencji.

## 7. Stany systemowe

Każdy widok i funkcja obsługuje:

- `loading` bez pustego flasha;
- `empty` z właściwym następnym krokiem;
- `error` z kodem, retry i bez fałszywych danych;
- `stale` z datą ostatniej aktualizacji;
- `partial` z informacją, czego brakuje;
- `conflict` z porównaniem wersji;
- `forbidden` bez ujawniania danych;
- `archived` tylko do odczytu.

Mock/demo/fallback są jawnie oznaczone i nigdy nie imitują danych organizacji.

## 8. Minimalna macierz testów

Każda funkcja MVP wymaga:

1. happy path;
2. brak uprawnień;
3. cross-org denial;
4. niepełne dane;
5. konflikt równoczesnej zmiany;
6. retry po błędzie sieci;
7. audit trail;
8. read-back w module źródłowym lub docelowym;
9. light/dark oraz podstawowa responsywność;
10. dostępność klawiaturą i czytelny status bez samego koloru.

## 9. Definicja gotowości funkcji

Funkcja nie jest `DONE`, dopóki:

- nie ma zatwierdzonego kontraktu;
- UI nie jest podłączone do kanonicznego API;
- zapis nie jest trwały;
- ponowne otwarcie nie pokazuje zapisanych danych;
- role i izolacja organizacji nie są sprawdzone;
- błędy nie są widoczne i naprawialne;
- integracje nie mają read-backu;
- E2E na stagingu nie przechodzi;
- nie istnieje dowód runtime.

## 10. Wspólny kontrakt AI

Wszystkie funkcje Teresy, forecasty, status drafts i interwencje podlegają
[`TERESA_INITIATIVE_TO_EXECUTION_AI_SYSTEM.md`](TERESA_INITIATIVE_TO_EXECUTION_AI_SYSTEM.md).

Każda Function Card wykorzystująca AI musi dodatkowo opisać:

- źródła, wersje i permission scope;
- rozdzielenie fact/assumption/hypothesis/recommendation;
- counter-evidence;
- confidence i expiry;
- action preview;
- wymagany poziom autonomii L0–L3;
- human approval;
- verification skuteczności;
- zachowanie `insufficient evidence`.
