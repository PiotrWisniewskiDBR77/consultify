# Consultify Results Next — Master Implementation Plan

> Status: APPROVED FOR IMPLEMENTATION PLANNING  
> Wersja: 1.0  
> Data: 2026-08-09  
> Zakres: wspólny program wdrożenia KPI, ROI, OKR oraz warstwy Teresa/MyWork/Decisions

## 1. Executive decision

Results Next jest wspólnym środowiskiem pracy dla trzech niezależnych systemów zarządczych:

- **KPI Management** — kontrakt pomiaru, odpowiedzialności i reakcji na odchylenie;
- **ROI & Benefits Realization** — ekonomiczny kontrakt jednej Initiative i realizacji jej korzyści;
- **OKR Management** — niezależny system ambicji, koncentracji i alignmentu.

Wspólne są: shell, identity, framework egzekucji polityk, wersjonowanie polityk, prymitywy widoczności, audit, eventy, MyWork, Decisions, Teresa i standard interakcji. Niewspólne są: domyślne polityki domenowe, agregaty, statusy, workflow, semantyka wartości i reguły zatwierdzania.

Nie powstanie generyczny `ResultsItem`, wspólny status ani wspólna tabela domenowa.

## 2. Zatwierdzone decyzje Foundera

| ID | Decyzja | Konsekwencja implementacyjna |
|---|---|---|
| D01 | Trzy niezależne domeny pod wspólnym Results | osobne agregaty, commands, events i lifecycle |
| D02 | Top-level: Scorecard / ROI Case / OKR Set | listy nigdy nie pokazują encji liściowych jako obiektów nadrzędnych |
| D03 | Nowy centralny KPI aggregate | istniejące modele KPI nie są automatycznie targetem |
| D04 | Scorecard = żywa kolekcja + review snapshots | brak kopiowania definicji KPI |
| D05 | ROI Case wymaga Initiative od utworzenia | unikalność aktywnego case per Initiative |
| D06 | Results i Finance zachowują obecnie osobne modele | jawny future integration seam; brak fałszywego SSOT |
| D07 | Original Approved + Current Forecast + Actual | reapproval nie usuwa pierwotnej historii |
| D08 | OKR Set jest materializowany | Set = Cycle + scope/team + owner |
| D09 | OKR niezależny od KPI/ROI/Initiative | tylko jawne referencje kontekstowe lub neutralny source binding |
| D10 | Widoczność zależy od domeny | KPI scope/chain; ROI restricted; OKR open-org z override |
| D11 | Maker-checker zależy od domeny i materialności | ROI ma najsilniejszą separację |
| D12 | Domain state + MyWork obligation + formal Decision | brak kopiowania stanu do systemu zadań |
| D13 | Clean start bez migracji legacy | nowe modele są puste; legacy read-only archive |
| D14 | Równoległa budowa KPI, ROI, OKR | wspólny Gate 0/1, potem trzy workstreamy |
| D15 | Teresa od pierwszego etapu | AI jest warstwą organizacyjną, nie późnym dodatkiem |

### 2.1 Bezpieczna interpretacja D13

`Clean start` oznacza brak backfillu i brak automatycznego uznania historycznych rekordów za nową prawdę. Nie oznacza fizycznego skasowania tabel lub rekordów. Legacy zostaje:

- zablokowane do nowych zapisów po cutover;
- usunięte z nowych liczników i default views;
- dostępne wyłącznie jako oznaczone archiwum;
- objęte osobną decyzją retention/deletion.

### 2.2 Kontrolowana interpretacja D06

Results ROI i Finance mogą obecnie rozwijać osobne modele, ale muszą od początku używać interoperacyjnej koperty referencyjnej:

- `organization_id`;
- `initiative_id`;
- `roi_case_id` po stronie Results;
- `finance_artifact_id` i `finance_version_id` po stronie Finance;
- currency, horizon, as-of date;
- engine/model version;
- input hash oraz source/evidence references.

Nie implementujemy automatycznego dwukierunkowego sync w pierwszym programie.

## 3. Krytyczna ocena obecnego stanu

### 3.1 Problem nie jest tylko wizualny

Aktualny ekran mieszał dashboard, listę encji liściowych i panel narzędziowy. Po przebudowie shell ujawnił głębszy problem: źródła danych i modele nie odpowiadają obiektom widocznym w rejestrach.

### 3.2 Split truth

- KPI istnieje równolegle w `initiative_kpis`, `v8_kpi_definitions` i strukturach scorecard.
- ROI jest rozłożony między płaskie assumptions, realized values i KPI-centric realization entries.
- OKR ma zalążek Objectives/KRs, ale nie ma stabilnego Program/Set, a starszy model łączy KR bezpośrednio z KPI.
- MyWork, Decisions, audit i Teresa nie mają jeszcze jednego, domkniętego kontraktu Results.

### 3.3 RealDB — interpretacja

Audyt wykazał dane w kilku konkurencyjnych modelach, a jednocześnie puste docelowo brzmiące tabele dla części organizacji. To tłumaczy puste rejestry, ale nie upoważnia do automatycznego scalenia. Zgodnie z D13 nowe agregaty rozpoczynają się puste.

### 3.4 Krytyczne zakazy

- Nie rozwijać fake tools opartych na `id: 'new'`.
- Nie traktować błędu API jak pustej listy ani pustej listy jak wartości zero.
- Nie utożsamiać Initiative lifecycle z ROI lifecycle.
- Nie utożsamiać KPI lifecycle z performance lub data quality.
- Nie utożsamiać OKR progress, confidence i attention.
- Nie używać shadow authorization jako dowodu bezpieczeństwa.
- Nie pozwalać Teresie omijać command authorization.

## 4. Model indywidualny i organizacyjny

Każdy agregat ma jedną prawdę, lecz wiele projekcji.

### 4.1 Perspektywa indywidualna

Odpowiada na pytania:

- Za co odpowiadam?
- Co wymaga mojego działania dzisiaj?
- Co jest opóźnione, ryzykowne albo bez danych?
- Jakie review, approval, measurement lub check-in mam wykonać?
- Jak zmieniły się obiekty, których jestem właścicielem?

Główne wejścia: `My Results`, MyWork, Teresa, bezpośredni deep link.

### 4.2 Perspektywa organizacyjna

Odpowiada na pytania:

- Jak działa organizacja, jednostka, proces lub portfolio?
- Gdzie występują wyjątki i brak reakcji?
- Jak wygląda alignment i realizacja korzyści?
- Które decyzje i przeglądy są wymagane?
- Czy system zarządzania działa zgodnie z polityką?

Główne wejścia: rejestry Results, saved organizational views, manager/portfolio views i Teresa.

### 4.3 Reguła projekcji

Widok `My` nie jest osobną tabelą domenową. Jest filtrem/read modelem opartym na ownership, contribution, obligation i management chain. Widok organizacyjny nie może ujawniać rekordów poza polityką widoczności, również przez count, search, export, AI lub notification.

## 5. Docelowa architektura powierzchni

### 5.1 Results registry shell

Menu 1 pozostaje globalną nawigacją aplikacji.

Menu 2 zawiera:

- search;
- KPI / ROI / OKR;
- tabela / karty;
- opcjonalnie saved views;
- dokładnie jeden prawy CTA: `New scorecard`, `New ROI case`, `New OKR set`.

Menu 3 zawiera domenowe presety, liczniki, filtry pomocnicze, standardową akcję kontekstową Teresy, tryb bulk selection oraz — zgodnie z TRIADA — dynamiczne taby już otwartych obiektów. Nie służy do umieszczania różnych narzędzi lub tabel o innych schematach pod postacią filtrów.

### 5.2 Standard tabeli

Nowa lista musi używać kanonicznego zestawu i jego warstw zgodnie z hierarchią UI:

- `StandardModuleBar` jako fasady Menu 2/3;
- `StandardTable` jako fasady tabeli, delegującej mechanikę do `FilterableTable`;
- `StandardPreview` jako kanonicznej treści preview;
- `TableWithPreviewLayout` jako orkiestracji wyboru, preview, J/K, historii i mobile;
- `GridView` jako alternatywna reprezentacja tych samych rekordów;
- standardowych chipów, komórek, ustawień i row actions.

Nagłówki pozostają widoczne dla empty/loading/error. Failure jednej domeny nie blokuje pozostałych.

### 5.3 Progressive disclosure

| Poziom | Pytanie użytkownika | Powierzchnia |
|---|---|---|
| L0 | Co istnieje i co wymaga uwagi? | tabela/karty |
| L1 | Dlaczego ten obiekt jest ważny? | preview |
| L2 | Co mam teraz zrobić? | full-tool overview |
| L3 | Jak wykonać pracę domenową? | edytory, pomiary, check-iny, modele |
| L4 | Jak to udowodnić i prześledzić? | history, lineage, audit, analytics |

Preview jest zamknięty domyślnie i nie jest pomniejszonym pełnym narzędziem.

## 6. Wspólna architektura techniczna

### 6.1 Command path

```text
Identity/context
  -> policy resolution
  -> authorization
  -> typed domain command
  -> domain validation and transition
  -> transactional write
  -> append-only domain event/outbox
  -> MyWork/Decision/notification projections
  -> readback and audit evidence
```

### 6.2 Wspólna koperta zdarzenia

Każde zdarzenie zawiera co najmniej:

- event ID i schema version;
- aggregate type/ID;
- organization ID;
- actor i effective role;
- command/correlation/causation ID;
- timestamp;
- policy version;
- before/after lub state hash;
- reason i evidence references;
- source oraz idempotency key.

### 6.3 Shared capabilities, nie shared domain

Wspólne usługi:

- identity i organization graph;
- RBAC + ABAC;
- audit/event store/outbox;
- evidence/provenance;
- MyWork obligations;
- Decisions;
- notification routing;
- saved views i read models;
- Teresa proposal/execution runtime.

Każda domena posiada własne commands, invariants i event catalog.

## 7. Governance i bezpieczeństwo

### 7.1 Kontrola dostępu

Decyzja uwzględnia:

- organization i scope;
- management chain;
- ownership i contributor role;
- lifecycle;
- visibility mode;
- sensitivity/materiality;
- self-authorship;
- delegation i czas obowiązywania;
- separation of duties.

### 7.2 Widoczność

Obsługiwane tryby:

- `OPEN_ORG`;
- `SCOPE`;
- `MANAGEMENT_CHAIN`;
- `PRIVATE`;
- `RESTRICTED_ACL`.

Domyślne polityki:

- KPI: scope plus management chain;
- ROI: restricted w fazie budowy/decyzji, szersze approved summary;
- OKR: open organization z możliwością restricted override.

### 7.3 Maker-checker

- ROI: autor nie zatwierdza własnego case; approval snapshot jest immutable.
- KPI: dla materialnych targetów i corrective plans rozdzielamy submitter/approver.
- OKR: owner aktualizuje, manager reviewuje; manager nie nadpisuje check-inu autora.

### 7.4 Enforcement

Można użyć kolejności shadow -> decision log -> targeted enforce -> full enforce, ale shadow nie stanowi security GO. Każdy chroniony command wymaga negatywnego testu outsidera i testu przekroczenia roli.

## 8. Teresa jako organizacyjna warstwa zarządzająca

### 8.1 Rola

Teresa od pierwszego etapu:

- wykrywa obligations, stale data, overdue review i wyjątki;
- wyjaśnia użytkownikowi aktualny stan i następny krok;
- przygotowuje typed proposals;
- proponuje MyWork i formalne Decisions;
- tworzy indywidualne i organizacyjne briefy;
- wspiera rytm KPI, ROI i OKR;
- uczy się z jawnych wyników review, nie z niezatwierdzonych sugestii.

### 8.2 Granice

Teresa nie może:

- cicho modyfikować targetu, actual, approval lub grading;
- zatwierdzać własnej propozycji;
- omijać visibility i tenant isolation;
- przedstawiać missing jako zero;
- łączyć obiektów bez jawnej semantyki;
- podejmować formalnej decyzji finansowej lub zarządczej za człowieka.

### 8.3 Contract

Każda propozycja zawiera:

- action type;
- target reference i expected version;
- proponowany payload;
- uzasadnienie;
- source/evidence;
- policy/permission preflight;
- preview konsekwencji;
- wymagany approver;
- expiry/idempotency key;
- audit result po wykonaniu.

Teresa działa w obu trybach:

- `personal`: moje obowiązki, coaching, przygotowanie wpisu;
- `organizational`: wyjątki, zaległości, ryzyka systemowe i review packs.

## 9. Osiem etapów programu

### Etap 1 — kontrakt architektoniczny i threat model

Deliverables:

- ten pakiet;
- ADR granic KPI/ROI/OKR;
- status/lifecycle dictionaries;
- ownership/visibility matrix;
- route/deep-link contract;
- legacy archive decision;
- source-to-target code inventory.
- kontrakty perspektyw `My` i `Organization`;
- threat model i macierz maker-checker.

Gate 0:

- brak nierozstrzygniętych P0 semantycznych;
- dokumenty domenowe i master są wzajemnie zgodne;
- jawne wskazanie, które wcześniejsze doktryny są superseded.

### Etap 2 — platform foundation i addytywny clean-start schema

Deliverables:

- nowe tenant-scoped tabele i repozytoria agregatów;
- constraints, indexes i optimistic versions;
- typed command/query skeletons;
- RBAC/ABAC i wersjonowane visibility policies;
- transactional audit/event outbox;
- typed references dla MyWork, Decisions i Evidence;
- archive-only legacy adapters;
- brak runtime lazy DDL;
- rollback/recovery plan.

Gate 1:

- migracja przechodzi na pustej i realistycznej kopii bazy;
- command zapisuje agregat i event atomowo;
- authorization odrzuca cross-tenant i niedozwoloną rolę;
- legacy nie zasila nowych odczytów i nie przyjmuje nowych zapisów vNext;
- rollback i ponowne uruchomienie są bezpieczne.

### Etap 3 — projekcje indywidualne/organizacyjne i wspólny shell Results

Deliverables:

- trzy typowane registry adapters;
- read models `My` i `Organization`;
- ownership/contribution/obligation predicates;
- management chain i visibility enforcement;
- non-leaking counts/search/export/AI;
- Menu 2/Menu 3;
- table/cards;
- empty/loading/error headers;
- preview/deep link/history state;
- quick create zapisujący prawdziwy Draft.

Gate 2:

- test owner, manager, contributor, authorized viewer i restricted outsider;
- ten sam agregat widoczny poprawnie w projekcjach bez duplikacji prawdy;
- single click/Enter/Esc/J/K;
- powrót zachowuje registry/filter/sort/scroll;
- lokalna awaria nie wyłącza innych domen;
- cold reopen działa na realnym ID.

### Etap 4 — Teresa/Results/MyWork/Decisions na prawdziwych commands

Deliverables:

- typed proposal catalog;
- obligation reference i dedupe;
- formal Decision references;
- event subscriptions;
- personal/organizational brief;
- permission-aware execution.

Gate 3:

- proposal -> preview -> approval -> command -> audit -> cold reopen;
- duplicate event nie tworzy drugiego zadania;
- outsider nie otrzymuje danych w prompt, count ani notification.

### Etap 5 — trzy równoległe gold flows

Deliverables:

- KPI closed loop;
- ROI Build and Approval;
- OKR operating rhythm;
- minimalne projekcje owner/manager/org dla każdego flow;
- Teresa zintegrowana z każdym zaakceptowanym slice.

Gate 4:

- każdy flow zapisuje się i odtwarza po cold reopen;
- działa w perspektywie indywidualnej i organizacyjnej;
- Teresa wspiera flow bez obchodzenia governance;
- acceptance per domena jest niezależne.

### Etap 6 — domknięcie operacyjne domen

KPI:

`create KPI -> approve definition -> measure -> deviation -> plan -> action -> remeasure -> effectiveness verification`

ROI:

`Approved -> Forecast -> evidence-backed Actual -> variance -> PIR`

OKR:

`Program/Cycle -> Set -> Objectives/KRs -> approve/launch -> check-in -> support -> grade/reflection`

Gate 5:

- scorecard review snapshot, KPI recovery verification, ROI realization/PIR oraz OKR closing/reflection są domknięte;
- scheduler obligations są idempotentne;
- historia zatwierdzonych zmian jest odtwarzalna.

### Etap 7 — integracje

Deliverables:

- KPI evidence reference dla ROI Benefit;
- neutralne data-source references dla OKR;
- Initiative projections;
- Finance pinned-artifact seam bez automatycznego sync;
- MyWork/Decision/Reporting integrations;
- portfolio exception views.

Gate 6:

- linki są dwukierunkowo otwieralne, ale nie kopiują stanu;
- version pinning jest jawne;
- brak unit mismatch i silent overwrite;
- awaria integracji nie niszczy domenowego source truth.

### Etap 8 — hardening i odbiór

Deliverables:

- accessibility i keyboard-only flows;
- PL/EN, dark/light, 1920/1440/1280 i tablet review;
- performance/SLO/observability;
- concurrency, idempotency, recovery;
- realDB, tenant isolation i two-user maker-checker;
- exact-SHA runtime evidence.

Gate 7:

- wszystkie obowiązkowe macierze acceptance mają PASS;
- nie ma otwartego P0/P1;
- deployment SHA odpowiada zweryfikowanemu kandydatowi;
- audit potrafi odtworzyć każdą zatwierdzoną zmianę.

## 10. Organizacja równoległej pracy

### 10.1 Workstreamy

| Workstream | Odpowiedzialność | Wspólne zależności |
|---|---|---|
| Platform | schema conventions, auth, events, outbox, references | Gate 0–4 |
| Registry UX | shell, Menu 2/3, table, preview, routing | Gate 0–3 |
| KPI | pełny KPI gold flow | Platform + Registry |
| ROI | build/approval, potem realization | Platform + Registry + Initiative |
| OKR | operating rhythm | Platform + Registry + org scope |
| Teresa | proposals, briefs, orchestration | commands/events/policies |
| QA/Evidence | contract, integration, runtime, realDB | wszystkie |

### 10.2 Zasady pracy współbieżnej

- Każdy workstream ma jawny file allowlist przed rozpoczęciem implementacji.
- Wspólne kontrakty zmienia wyłącznie właściciel Platform po review domen.
- Domain UI nie może definiować własnego auth, event envelope ani table standard.
- Integracja następuje przez versioned interface, nie bezpośredni import wewnętrznych modeli.
- Każdy przyrost ma osobny candidate SHA i evidence packet.
- Równoległość nie oznacza jednego wspólnego, brudnego worktree.

## 11. API i routing — wspólny kontrakt

Rekomendowane przestrzenie:

```text
/api/vnext/results/kpi/...
/api/vnext/results/roi/...
/api/vnext/results/okr/...
/api/vnext/results/obligations/...
/api/vnext/results/teresa/proposals/...
```

UI:

```text
/results/kpi
/results/kpi/scorecards/:scorecardId
/results/roi
/results/roi/cases/:roiCaseId
/results/okr
/results/okr/sets/:okrSetId
```

Dokładny prefix może zostać dopasowany do repo, ale semantyka i stabilne IDs są obowiązkowe. URL przechowuje obiekt i główny view; ephemeral selection nie może niszczyć historii przeglądarki.

## 12. Strategia legacy i cutover

1. Inwentaryzacja tabel, routes i aktywnych konsumentów.
2. Oznaczenie legacy write paths.
3. Addytywne utworzenie nowych modeli.
4. Uruchomienie nowych rejestrów na nowych read models.
5. Nowy create/write tylko do nowych agregatów.
6. Legacy UI i routes przechodzą w read-only archive albo zostają odłączone.
7. Telemetry potwierdza brak aktywnych konsumentów.
8. Retention review rozstrzyga późniejsze usunięcie.

Zakazane: nieskoordynowany dual-write, heuristic dedupe, nazywanie starej prognozy Approved, automatyczne przeniesienie KR->KPI oraz fizyczny drop w pakiecie startowym.

## 13. Wspólna Definition of Done

Funkcja jest `DONE` dopiero, gdy istnieje:

- zatwierdzony kontrakt domenowy;
- schema i migration evidence;
- command validation oraz authorization;
- audit/outbox event;
- UI zgodne z list-preview-tool;
- perspektywa personal i organizational;
- Teresa proposal lub jawne uzasadnienie braku;
- MyWork/Decision integration tam, gdzie wymaga tego lifecycle;
- unit/contract/integration tests;
- negatywne testy uprawnień;
- realDB create -> reload -> update -> cold reopen;
- exact-SHA runtime proof;
- evidence packet zaakceptowany niezależnie.

## 14. Globalne kryteria jakości

### Product

- Użytkownik zawsze rozumie obiekt, jego stan, właściciela i następny krok.
- Statusy są domenowo kwalifikowane. Podobne etykiety nie oznaczają wspólnej semantyki i nie są agregowane bez jawnego mapowania projekcyjnego.
- `My` i `Organization` są projekcjami tego samego source truth.

### Data

- Missing nigdy nie jest automatycznie zero.
- Każda wartość ma unit, period/as-of i provenance.
- Zatwierdzona historia jest immutable lub wersjonowana.

### UX

- Tabele zachowują nagłówki w każdym stanie.
- Preview nie duplikuje narzędzia.
- Maksymalnie jeden primary CTA na danej powierzchni.
- Pełny flow możliwy klawiaturą; focus wraca do wiersza.

### Security

- Scope jest egzekwowany po stronie serwera.
- Search, counts, exports, AI i notifications nie przeciekają.
- Maker-checker i self-approval rules mają testy negatywne.

### AI

- Teresa przedstawia źródła, założenia i konsekwencje.
- Każda mutacja jest typed, previewable, permission-checked i audytowalna.
- Brak silent writes i autonomicznego formalnego approval.

## 15. Program dowodowy

Minimalny evidence packet per slice:

1. scope, owner i allowlist;
2. baseline SHA i candidate SHA;
3. migration checksum/status;
4. test commands i pełne wyniki;
5. API request/response dla gold flow;
6. realDB row IDs przed/po reloadzie;
7. user A/user B/restricted outsider proof;
8. Teresa proposal/approval/audit roundtrip;
9. screen evidence w wymaganych breakpointach i motywach;
10. cold reopen i recovery;
11. znane ograniczenia oznaczone `PARTIAL`, `BLOCKED` lub `EVIDENCE_MISSING`;
12. niezależna decyzja acceptance.

## 16. Ryzyka programu i odpowiedzi

### 16.1 Macierz odbioru decyzji D01–D15

| Decyzja | Artefakt wdrożeniowy | Bramka | Dowód | Właściciel |
|---|---|---|---|---|
| D01 | trzy osobne agregaty/commands/events | G0/G1 | ADR + schema/API contract tests | Master + domeny |
| D02 | trzy parent registries | G2 | runtime list/open proof | Registry UX |
| D03 | centralny KPI aggregate | G1/KPI G2 | realDB identity/readback | KPI |
| D04 | live Scorecard + snapshot | KPI G4 | membership + immutable reopen | KPI |
| D05 | Initiative-bound ROI Case | ROI foundation | uniqueness/FK/duplicate create test | ROI |
| D06 | osobne Results/Finance + seam | G6 | pinned reference contract, no sync | ROI/Finance |
| D07 | Approved/Forecast/Actual | ROI realization | known-answer + immutable history | ROI |
| D08 | materialized OKR Set | OKR foundation | Cycle/Set independence test | OKR |
| D09 | niezależność OKR | G1/OKR | brak FK/roll-up inheritance | OKR |
| D10 | domenowa widoczność | G1/G2/G7 | owner/manager/viewer/outsider, non-leak | Security + domeny |
| D11 | maker-checker | G1/G7 | self-approval denied, second user succeeds | Security + domeny |
| D12 | domain/MyWork/Decision references | G3 | dedupe + roundtrip + same object ID | Platform |
| D13 | clean start | G1/G7 | no backfill/write; archive-only proof | Data |
| D14 | równoległe workstreamy | program governance | allowlists, independent candidate evidence | Architecture |
| D15 | Teresa od pierwszego slice | G3 i każdy domain gate | proposal/accept-or-reject/audit/no silent write | Teresa + domeny |

| Ryzyko | Odpowiedź |
|---|---|
| trzy workstreamy rozjadą shared contracts | Gate 0/1, versioned interfaces i Platform owner |
| dwa ROI modele staną się trwałym split truth | future integration envelope od dnia 1; brak automatycznego sync |
| clean start ukryje wartościową historię | read-only archive z retention review |
| Teresa stanie się niekontrolowanym superuserem | identyczny auth jak człowiek, typed proposals, no silent writes |
| UI zostanie zbudowane przed modelem | registry shell dopiero po typed read contracts; tool po commands |
| parallel delivery stworzy konflikty | osobne worktrees/allowlists, integracja przez contracts |
| indywidualne widoki rozjadą się z organizacją | read models z jednego aggregate/event source |
| fałszywe GO na podstawie mocków | obowiązkowy realDB/cold reopen/exact SHA evidence |

## 17. Non-goals pierwszego programu

- automatyczna migracja lub scalenie legacy;
- fizyczne usunięcie starych danych;
- pełna automatyczna integracja Results ROI z Finance;
- wspólny scoring KPI/OKR/ROI;
- dashboard cross-domain udający źródło prawdy;
- bulk approval lub bulk overwrite actuals;
- autonomiczne formalne decyzje Teresy;
- zaawansowane predictive analytics przed zamknięciem gold flows.

## 18. Warunek rozpoczęcia implementacji

Implementacja może ruszyć po:

1. wzajemnym cross-review czterech dokumentów;
2. zamknięciu sprzeczności P0;
3. utworzeniu ADR supersession;
4. rozpisaniu pierwszych pionowych pakietów z file allowlist;
5. ustaleniu właścicieli Platform, Registry, KPI, ROI, OKR, Teresa i QA;
6. zarejestrowaniu baseline repo/DB i sposobu izolacji prac.

Ten dokument nie jest dowodem wykonania. Jest kontraktem organizującym wykonanie i odbiór.

## 19. Kontrakt wykonania i terminalnego odbioru

Całe wykonanie i odbiór są dodatkowo związane przez:

- `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` — globalne gates, golden flows, UI/CX, realDB, security, Teresa i terminalne DoD;
- `07_EPIC_AND_TRACEABILITY_LEDGER.md` — epiki oraz obowiązkowe mapowanie feature → AC → code → test → evidence;
- `08_CLAUDE_COMPLETE_EXECUTION_PROMPT.md` — nadrzędny kontrakt przekazania całego programu jednemu wykonawcy.

Zakończenie epiku, domeny, builda lub suite testów nie jest zakończeniem programu. Wykonawca może przekazać wyłącznie kompletnego kandydata do niezależnego review; terminalny werdykt pozostaje własnością Codex i końcowego odbioru Foundera.
