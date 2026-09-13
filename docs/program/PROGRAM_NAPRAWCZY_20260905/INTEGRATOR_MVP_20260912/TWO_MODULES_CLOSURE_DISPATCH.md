# Domknięcie Inicjatyw i Realizacji — zlecenie integratora

## Mandat i zakres

12.09.2026 właściciel polecił: „MVP miało warunkowe 2 zaliczone moduły — czas je dokończyć także; przejrzyj to co daję i przygotuj do pisania zespoły”. To uruchomienie domknięcia Inicjatyw i Realizacji teraz, w istniejącym pełnym programie. Nie czekamy z tym do końca wszystkich innych prac. Bieżące Interview i C6 kończą swoje paczki; następne zwalniane sloty otrzymują zadania poniżej. Pełne MVP i dalsza Fala2 zachowują cały zakres; ten dokument nie oznacza wdrożenia.

Nowy załącznik OWNER_TWO_MODULES_CLOSURE_20260912.txt przeczytany w całości, treść merytorycznie identyczna z poprzednim OWNER_INITIATIVES_EXECUTION_MEETINGS_20260912_ORIGINAL.txt (różnica końcowego newline). Przeczytano wskazany HTML z wt/fable-inicjatywy; jego propozycje i pytania są starsze od odpowiedzi właściciela. Nie przywracać 6statusów, 110% ani 3/5zakładek z HTML.

Obowiązują cztery funkcje Inicjatyw: **Inicjatywy (Lista/Analiza), Plan, Obciążenie, Raport z pracy**; cztery Realizacji: **Bank, Praca, Zarządzanie ryzykiem, Raporty**. Portfel przenosi się do Analizy, Zasoby do Pracy, Sterowanie do Ryzyka; to zmiana rozmieszczenia istniejących funkcji, nie ich usunięcie. Ta odpowiedź właściciela ma pierwszeństwo przed starym Menu2 4/5 w kanonie z09.08. Pełna semantyka kanonu, canonical ownership i jego12stanów pozostają celem; nie kończyć na siedmiu statusach tylko dlatego, że dawny P12 wyznaczał minimumMVP.

Spotkania z końca notatki pozostają zachowane w W18 wraz z zależnością od kontekstu/artefaktów/notifications. Aktualnie uruchomione są DWA moduły. Nie budować po cichu trzeciego, nie usuwać jego wymagań.

## Zespoły i własność

- Integrator: wspólne kontrakty, kolejność, rozwiązywanie zależności, dopuszczenie dostaw i scalenia. RootWT `codex-integrator-mvp-20260912`, aktualny punkt odniesienia2233eac080; przed implementacją odczytać nowy HEAD.
- Zespół Inicjatywy: gotowy szczegółowy plan w INITIATIVES_CLOSURE_CODING_PACKET.md (autor Galileo). Rejestr/karty/analiza/plan/workload/raport przygotowania.
- Zespół Realizacja: EXECUTION_CLOSURE_CODING_PACKET.md (autor Nietzsche). Bank/praca/ryzyko/raport wykonania.
- Niezależny odbiór: osoba inna niż autor kodu; po każdym przyroście, z realnym UI/API/JWT/PG i testem odmowy. Zespoły przygotowujące pakiet mogą kodować po zwolnieniu slotu, ale nie odbierają własnej dostawy.
- Maksymalnie2równoczesne paczki implementacyjne, każdy plik/source writer ma jednego właściciela. Root jest jedynym właścicielem scalenia. Nie otwierać nowych pełnych baz/worktree bez sprawdzenia miejsca (~12GiB).

## Kolejność gotowa do wydania

| Paczka | Właściciel zakresu | Rezultat kończący paczkę | Zależność |
| --- | --- | --- | --- |
| IE-00 | Integrator + pierwszy wolny wykonawca | Mapa istniejącego canonical ownership, projekt/role/gates i bezpieczny przewód decyzji; zamknięcie staregoSTOP C7 konkretnym aktywnym UI i zgodnym kontraktem | Teraz przygotowanie, pierwszy wolny slot kodowania |
| IE-01 | Inicjatywy | Jedna inicjatywa od źródła/projektu przez kartę z wymaganiami jakości i zwrotami do gotowej decyzji, bez utraty pól | IE-00 contract; naprawa CLOSED autosave jako pierwszy mały defekt |
| IE-02 | Inicjatywy | Lista+Analiza: wszystkie statusy, actual/archive/projekt, porównanie, pokrycie/duplikaty/historia, uzasadniony parking z triggerem; decyzja ma readback | IE-01; nie automatyczny write AI |
| IE-03 | Inicjatywy | Jeden scenario Plan↔Obciążenie,1/3/6/12, dependencies/critical path, godziny/dostępność i >100%; propozycja→review→apply planowanej pracy | IE-02; bez zmiany running schedule i staffing |
| IE-04 | Realizacja | Bank tego samegoinitiativeId, zaakceptowany handoff, task/decision/resource w Pracy i readback My Work | IE-00; może iść równolegle z IE-01/02 po zamknięciu sharedcontract |
| IE-05 | Realizacja | Analiza ostatniego/następnego tygodnia i miesiąca, priorytety/delegacja/escalation; zgodna zmiana tylko w uprawnieniu przełożonego | IE-04 |
| IE-06 | Realizacja | N-card ryzyka: sytuacja→działania→skutki→poinformowani; approval→materialchange→readback→verification, retry bez dubla | IE-04/05; wspólne decyzje IE-00 |
| IE-06K | Realizacja, kontrakt wejścia uzgadnia Inicjatywy | Obowiązkowy adapter E6 KPI/Results: przygotowany kontrakt IE-01 → canonical measurement → oba moduły i raport IE-07; Delivery nie oznacza Benefit achieved | IE-01 + IE-04/06 |
| IE-07 | Jeden właściciel wspólnego raportowania, oba zespoły adaptery | Oddzielny raport przygotowania i wykonania; definition/run/snapshot, manual+cadence, PDF, odbiorcy,5domyślnych wzorców przygotowania, jawny wynik dostarczenia | IE-02/03 i IE-05/06; istniejący transport poczty W19 |
| IE-08 | Niezależny odbiorca + integrator | Pełny łańcuch obu modułów i Results, macierz ról/projektów/org, retry/stale/partial, wizualny odbiór menu4/4 i wszystkich działań; zero otwartych blockerów/ważnych | Wszystkie powyższe |

Nie wydawać wszystkich paczek równocześnie. Każda dostawa kończy użytkowy fragment, a nie wyłącznie nowe zakładki lub sam backend.

## IE-00: instrukcja pierwszej paczki kodowej

Czytanie: nowa notatka+HTML; INITIATIVES_EXECUTION_FUNCTIONS_CANON.md; cały indeksowany pakiet00–12 w docs/modules/initiatives-execution-canon, w podanej kolejności; aktualne Workflow/PMO/projectSSOT, zamrożenia i istniejący raportC7 na590915fc897f85b54b36c80dcc0998ef0ae0bd23. Nowe odpowiedzi mają pierwszeństwo nad dawnymi pytaniami, ale nie zwalniają z prawdziwego audytu.

Sprawdzić aktualne implementacje:
- `src/components/MyWork/DecisionsPanelContent.tsx` — aktywna kolejka decyzji; `DefinitionDecisionQueue` jest wycofana i nie ma wrócić.
- `src/components/Initiatives/InitiativeDocumentView.tsx`, lifecycle section i menu istniejącej karty — miejsce przygotowania/request z konkretnej inicjatywy.
- `src/services/initiatives-execution/runtimeApi.ts`, `src/contracts/initiatives-execution/{foundation,statusMapping,gateReadiness,runtimeCardAdapter,cardRegistry}.ts`.
- `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` i `server/src/domain/initiatives-execution/` — bieżący canonical commands/UoW/gates/handoffs.
- `server/src/services/initiative/initiativeLifecycleGateDecisionService.ts`, `initiativeTransitionService.ts`, `server/src/services/initiativeGovernanceService.ts` i istniejące routes governance.
- `server/migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql` — istniejące append-only receipt, FK/Case/A05 i digest; żadnego DROP/FK/trigger bypass.

Rozstrzygnięcie integratora dotyczące staregoSTOP C7: rozszerzamy aktywny flow istniejącej karty inicjatywy → canonical Decision → aktywny DecisionsPanelContent, z deep-linkiem do tego samego Decision. Nie dodajemy nowego panelu/kolejki ani tabeli decyzji. Samo zamontowanie starego komponentu nie spełnia zadania.

Pierwszy mierzalny wynik przed zmianą: dla jednej nowej inicjatywy przedstawić dokładny UI→request→decision writer→transition reader→receipt→reload. Legacy `initiative_lifecycle_gate_decisions` i `ie_aggregate_state` nie są wymienne. Ustalić owneradapter z rzeczywistym source/version/authority i zachowanymi więzami; wymagany payload Case/A05 należy uzyskać z prawdziwego istniejącego procesu, nigdy syntetycznie udawać. Jeżeli potrzebna addytywna ewolucja kontraktu, przygotować konkretny schema+komenda+compatibility diff do wewnętrznego przeglądu integratora; nie zakładać z góry nowej tabeli ani upraszczać kontraktu przez NULL. To praca inżynierska, nie powrót do ogólnej ankiety właściciela.

Projekt jest wybierany/tworzony najpóźniej przy nowej inicjatywie. Diagnostyka może poprzedzać projekt.105starych rekordów pozostaje nietknięte zgodnieDEC-469. Projekt/organizacja ma jawny wersjonowany profil authority; frontend nie wnioskuje approvera z ownerId/ADMIN. Brak konfiguracji daje konkretny finding, nie milczący selfapprove.

Materialny snapshot: istniejący wspólny digest/version obejmuje wymagane karty i źródła gate; istotna zmiana scope/time/cost/owner/KPI/ryzyka unieważnia właściwy approval poprzez comparison tego samego kontraktu. Nie przepisywać historii. Doprecyzowania techniczne implementuje zespół; zastrzeżonyDEC-474 wybór ceremonii A/B/C pozostaje parametryzowany i ma dostać konkretny rekomendowany rezultat do finalnej decyzji, nie blokuje budowy wspólnego rdzenia. Nie podnosić flag live bez odbioru.

RED→GREEN minimum: widoczna inicjatywa bez authority403zprzyczyną, obca/niewidoczna404bezwycieku; request→return(reason/card)→edit→resubmit→approve→reload na jednymID; zmiana digest poapprove odmawiastart; retry nie duplikujeDecision aniExecution; projectscope i membershiprevoke; transactionfailure nie pozostawia półstatusu; MyWork i karta czytają tę samą decyzję. Pełny canonical12stanów rozliczyć w macierzy przejść, nie aliasować businessresult do legacyetykiety.

## Wspólny odbiór i ograniczenia

Kod, helperPASS, screenshot i flagaOFF nie zamykają modułu. Wymagane: działający interfejs, realne utrwalenie i reload, trace do źródła, skuteczne capability, stale/versionconflict, retry, partialfailure, brak wycieku, materialhumanapproval, log wysyłki z odróżnieniem queued/delivered/failed. Brak poczty blokuje wyłącznie dowód doręczenia, nie pozostałą implementację. Wykresy mają jednostki/mianownik/okres i tekstowy status; unknown nie jest zielonymzerem. Nie zmieniamy cudzych WIP, nie pushujemy i nie uruchamiamy live z tej paczki przygotowania.

Niezależny review TWO_MODULES_DISPATCH_REVIEW.md: READY_FOR_ASSIGNMENT. Uwaga dotycząca ownershipKPI zamknięta pozycjąIE-06K (Realizacja). Zasoby i marker pierwszego wykonawcy: reużyty czysty C7WT `/Users/piotrwisniewski/Developer/codex-wt/codex7-zatwierdzanie`, branch `codex/ie00-governance-20260912`, bazaee397109a0; Galileo prowadzi read/preflight. Kodowanie rusza po oddaniu paczkiInterview, żeby zachować2sloty.
