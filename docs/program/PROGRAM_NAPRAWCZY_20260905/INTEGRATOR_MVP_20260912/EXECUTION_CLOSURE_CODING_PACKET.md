# Realizacja — paczka domknięcia do wydania zespołowi

Data: 2026-09-12. Status: **READY_FOR_ASSIGNMENT — instrukcja, nie odbiór produktu**. Autor: niezależny delivery audit. Przegląd wyłącznie odczytowy; bez kodu, testów, DB, live i indeksu. Badane źródła integratora osiągnęły HEAD `2233eac0801875eef553e79f758f467fd282ed13`; wykonawca dostaje nowy dokładny marker od integratora i porównuje różnicę przed startem. Nie pracować w zajętym worktree integratora.

## 1. Wiążący cel i kolejność źródeł

Przeczytane W CAŁOŚCI: `/Users/piotrwisniewski/.codex/attachments/da1658c4-427c-427b-9b48-c52b82665a15/pasted-text.txt` oraz wskazany na początku `/Users/piotrwisniewski/Developer/wt/fable-inicjatywy/docs/program/ZALOZENIA/ZALOZENIA_INICJATYWY_REALIZACJA_20260912.html`. Nowe polecenie właściciela nakazuje domknięcie **dwóch modułów teraz**. HTML jest wcześniejszą diagnozą/propozycją; jego pytania i odroczenia nie unieważniają nowszej odpowiedzi właściciela.

Kontynuować istniejący model z `docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` i `docs/modules/initiatives-execution-canon/00_INDEX_AND_AUTHORITY.md`; przed kodowaniem przeczytać pakiet w jego kolejności, szczególnie01 proces,02 funkcje,03/04 powierzchnie,05 domena/API,06 adaptery,08 odbiór,11 karta,12 Task/Decision/My Work. Reguły Triady i N-karty: `docs/ui-standards/TRIADA_KANON.md`, `03-modules/TABLE_AND_PREVIEW_CANON.md`, `03-modules/INITIATIVE_CANON.md`, `03-modules/TIMELINE_CALENDAR_CANON.md`. Pkt W03/W04/W09–W13 w `PLAN_WDROZENIA_DOPRECYZOWAN_20260912.md` stanowią kontekst zlecenia.

Rozstrzygnięcia już zawarte w nowej notatce, bez ponownego pytania:

- Menu2 Realizacji ma **Bank realizacji / Praca / Zarządzanie ryzykiem / Raporty**, w tej kolejności. Starsze osobne Zasoby i Sterowanie nie zostają kolejnymi top-level funkcjami: zasoby operacyjne w Pracy, istotna interwencja w Ryzyku; kokpit i rollout jako właściwe widoki Raportów/karty.
- To **ta sama inicjatywa i jej historia**, a nie nowa ręcznie tworzona kopia. Istniejący Execution Case i Handoff Package mogą pozostać technicznymi powiązanymi obiektami kanonu; nie kasować ich i nie tworzyć drugiej inicjatywy.
- Planowanie nie zmienia obsady ani harmonogramu pracy już rozpoczętej. Praca może wykonywać uprawnione korekty operacyjne; przekroczenie zatwierdzonych założeń przechodzi do istniejącego procesu material change.
- AI opracowuje, człowiek o właściwej roli zatwierdza. Zatwierdzenie ma prowadzić do realnego apply i informacji dla zainteresowanych, a nie tylko zmiany plakietki.
- KPI skutku są uzgadniane w przygotowaniu inicjatywy i później mierzone. DONE nie oznacza osiągnięcia korzyści.

Nie przejmować roboczej sugestii HTML „approve automatycznie rozpoczyna wykonanie”: kanon rozróżnia APPROVED_BACKLOG, plan/commitment i accepted handoff. Nowa notatka usuwa potrzebę kopiowania artefaktu, nie znosi bramek rozpoczęcia. Zachować jedną drogę z W04/C7. Pełny lifecycle nie jest w tej paczce odkładany z powodu dawnej etykiety Fala2.

## 2. Mapa zastanego kodu — obecność nie oznacza gotowości

Wszystkie poniższe ścieżki względem przydzielonego repo.

| Obszar | Istniejące pliki / API | Co wiadomo z odczytu; co trzeba domknąć |
|---|---|---|
| Shell Banku i karta | `src/components/Execution/ExecutionHub.tsx`, `executionModuleTabs.ts`, `canonicalMenu3.ts`, `ExecutionTimelineView.tsx`, `delaySignals.ts`, `executionRealData.ts`; `src/components/Initiatives/InitiativeDocumentView.tsx` | Hub lazy-otwiera tę samą InitiativeDocumentView. Obecne Menu2 to list/work/resources/control/reports z opcjonalnym summary. Zmienić projekcję na4funkcje, zachowując stare deep linki i identyczność rekordu. |
| Read model | `src/services/initiatives-execution/runtimeApi.ts`; `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`; domenowe `initiativeUnifiedReader.ts`, `postgresInitiativeReader.ts` | `/api/initiatives/runtime-v1/execution-cases/bulk` stoi przed trasą parametryczną; limit100, scoped canViewAggregate. Nie usuwać nowego readera ani wracać do N+1. Obecny test nie dowodzi legalnego niepustego readbacku. |
| Przyjęcie realizacji | domenowe `scheduleDecision.ts`, `handoffAcceptance.ts`, `executionWork.ts`, `executionWorkHardening.ts`, `executionMilestone.ts`; runtime `/initiatives/:id/handoff/requests`, `/handoff/decisions`, `/handoff-packages/:id` | Jest accepted handoff i powiązanie executionCaseId; trzeba udowodnić ciągłość od przygotowania do pracy bez nowej inicjatywy. W04/C7 jest właścicielem bramek. |
| Praca | `ExecutionWorkSurface.tsx`, `ExecutionWorkloadView.tsx`, `ExecutionResourcesSurface.tsx`; domenowe `operationalAllocation.ts`, C2b `staffingPlans.ts`; `server/src/services/taskAssignmentService.ts` | Surface miesza jawnie origin runtime i klasyczne tasks. Klasyczne edycje idą PUT `/api/tasks/:id`; runtime ma envelope/version/requestId. Nie zamieniać jednego protokołu drugim. E1 projectless assign422 pozostaje właściwym kontraktem, nie naprawiać przez poluzowanie. |
| Analiza pracy | `src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx`, `workReportModel.ts`, `ResourcesCapacityReport.tsx`, `UnifiedExecutionReportGenerator.tsx` | Są wskaźniki z drilldown i koszyki przyszłych terminów. Model jawnie ma decisionLatency UNKNOWN/NO_API_HISTORY. To nie jest jeszcze historyczny raport realizacji zeszłego tygodnia. Generator wymaga ręcznych technicznych IDs; część pól formularza nie trafia do createReportRun, sources=[] — nie odbierać go jako finalnego kreatora konsultanta. |
| Ryzyko/interwencja | `ExecutionControlSurface.tsx`, `raidGovernance.ts`, `WhyRedChain.tsx`, `src/components/Initiatives/sections/RaidSection.tsx`, `src/components/MyWork/MaterialChangeQueue.tsx`; domenowe `raidItem.ts`, `managementIntervention.ts`, `materialChange.ts`; runtime `/management-signals`, `/interventions`, `/material-changes` z create/transitions | Istnieją fingerprint sygnału, exact versions, opcja DO_NOTHING, owner/authority, impact i niezależna weryfikacja. Brakuje potwierdzonego pełnego N-workspace czterech kart i spięcia biznesowego apply→powiadomienia. |
| Apply/outbox | domenowe `materialCommand.ts`, `postgresMaterialCommandUnitOfWork.ts`; `server/src/services/initiativeExecutionOutboxConsumer.ts`, `notificationOutboxService.ts` | Material publish zapisuje target + audit/event w UoW. Intervention APPLY wymaga receipt **wcześniej wykonanej** komendy targeta i ustawia VERIFICATION_DUE; nie wykonuje target command. Consumer IE jedynie zapisuje immutable delivery receipt i oznacza event processed, explicite bez mapowania na produkt. DELIVERED w nim nie oznacza powiadomienia człowieka. |
| Raporty | `ExecutionReportsSurface.tsx`, `ExecutionReportDocument.tsx`, `ReportDocumentView.tsx`, `src/services/executionReports/executionReportsApi.ts`; domenowe `reportDefinition.ts`, `reportRun.ts`, `reportReconstruction.ts`; `server/src/routes/executionReports.routes.ts`, `server/src/cron/ExecutionReportCron.ts`, `reportCadenceService.ts`, `executionDistributionService.ts` | Dwa światy: canonical definitions/runs i snapshot/export/distribution. Nie tworzyć trzeciego. Definition ma version/cadence/audience/scope/source bindings; export ma PDF/DOCX. Cron cadence tylko liczy findDueReports — trzeba dowieść powstania run, nie uznać samego skanu za generację. |
| KPI | `src/components/Initiatives/initiativeKpiContract.ts`, `sections/KpisSection.tsx`, `src/components/Execution/RolloutTab.tsx`, `BenefitsRegisterPanel.tsx`; domenowe `resultsMeasurement.ts`, `deliveryAcceptance.ts`, `effectivenessClosure.ts`; `server/src/routes/resultsVnext/kpi.routes.ts`, `server/src/services/results/kpiMeasurementWriterService.ts`, `server/src/services/resultsVnext/kpi/kpiCrosswalkService.ts` | Istnieją osobne realization/post-implementation/both, mappingId, cadence; ResultsObservation ma baseline/target/unit/window/source/confidence i NOT_MEASURED. Zachować Results jako właściciela aktualnych pomiarów, nie skopiować ich do nowej tabeli Realizacji. |

Ścieżki domenowe w tabeli mają wspólny prefiks `server/src/domain/initiatives-execution/`. Runtime router to jedno współdzielone miejsce — tylko jeden pisarz w danym czasie. Zmiany jego autoryzacji wymagają dowodu HTTP, nie samego wywołania domeny.

## 3. Granica codziennej pracy i istotnej zmiany

| Praca — dozwolona tylko aktualną polityką | Zarządzanie ryzykiem / material change |
|---|---|
| Odczyt ostatniego tygodnia i nadchodzących terminów; otwarcie task/decision; komentarz/dowód; stan zadania w jego workflow; eskalacja istniejącą ścieżką; delegacja i przydział przez uprawnionego przełożonego **wewnątrz zatwierdzonego zakresu i tolerancji** | Zmiana celu, zakresu, kryterium sukcesu, zatwierdzonego baseline, strategicznych terminów, budżetu/finansowania, accountability lub akceptowanego materialnego ryzyka; zmiana operacyjna przekraczająca zatwierdzone granice |
| Nie zmienia automatycznie zgody na inicjatywę ani pomiaru efektu | Wersjonowany before/after, skutki, alternatywy, odpowiedzialny decydent z governance W03/C7, decyzja i stosowna ponowna zgoda |

Nie hardkodować nowego progu materialności ani szerokiego „ADMIN zawsze może”. Resolver governance projektu decyduje, istniejące UNKNOWN/tolerance unknown eskaluje i blokuje apply. Nie zastępować prawa wynikającego z projektu samą równością payload.authorityId==actor. W szczególności obecny middleware runtime rozpoznaje capability review po nazwie ścieżki, podczas gdy `/transitions` niesie action DECIDE w body: nowy test musi sprawdzić aktora z update bez review oraz ręcznie podanego „kolegę” jako authority. To **cel weryfikacji i domknięcia**, nie potwierdzony w tej paczce exploit. Istniejące zasady separation-of-duties nie mogą być usunięte pod pretekstem uproszczenia UI.

## 4. Kolejność wykonania — pionowe odcinki, każdy z oddzielnym odbiorem

### E0 — kontrakt wejścia i dane odbiorowe

Najpierw uzgodnić z integratorem dokładny marker/worktree, zasoby PG/API/preview i wyłączność shared plików. Nie używać starych cx4 baz/portów z pamięci. Wykonawca czyta SOURCE_OF_TRUTH i przydzieloną instrukcję stanowiska. Zachować flagi i migracje; ewentualna addytywna zmiana istniejącego modelu ma dostać osobny diff i odbiór integratora, bez nowego rejestru procesu.

Z zespołem Inicjatyw ustalić adapter wspólnego initiativeId/lineageId, ścieżkę N-karty i status→widoczność. Fixture dwie organizacje, dwa projekty wspólnego tenantu, aktor bez dostępu do jednego projektu, owner/task assignee/resource manager/sponsor/reviewer; jedna inicjatywa dopiero planowana, jedna w realizacji, jedna zakończona bez pomiaru oraz ryzyko i zaległa decyzja. Nazwy ról nie mogą udawać grantów — utworzyć rzeczywiste przypisania governance.

### E1 — Bank i ta sama karta

Pliki: ExecutionHub, executionModuleTabs, canonicalMenu3, ExecutionTimelineView, delaySignals, executionRealData, runtimeApi; InitiativeDocumentView tylko uzgodniony adapter props/deep link, nie równoległa przebudowa jej sekcji.

Wprowadzić4funkcje; stare resources→Praca właściwy podwidok, control/sterowanie/decyzje-i-ryzyka→Ryzyko, summary→Raporty kokpit, rollout→istniejąca sekcja/karta. Zachować recordId/query/back i nie cicho kierować wszystkiego na Bank. Lista, kanban, kalendarz/Gantt z filtrami projektu/statusu/zdrowia i opóźnieniem względem właściwego baseline/as-of. Kolor ma opis i ikonę; brak forecast/baseline daje UNKNOWN, nie zielony. Skale z W10 1/3/6/12 miesięcy ze spójnym tygodniowym drilldown.

RED: nowa nawigacja4funkcji, wejście z obu modułów na ten sam rekord, zmiana→reload→drugi moduł; błędny deep link i foreign ID; widoczny lineage z niepustymi tasks/decisions/allocations przez bulk; przeciwnik brak lineage. GREEN: te same nazwy testów, cold API/SQL identity i UI screenshots wszystkich4widoków listy light/dark. Chronić bulk przed N+1 i mutację harmonogramu drag-and-drop bez zgody.

### E2 — Praca i analiza operacyjna

Pliki: ExecutionWorkSurface, ExecutionWorkloadView i obecny resources surface/adapters, reports-intelligence/WorkIntelligenceReport oraz workReportModel; runtimeApi; domenowe executionWork/executionWorkHardening/operationalAllocation; klasyczne taskAssignmentService tylko jeśli real test wskaże lukę w legalnym uprawnieniu, bez globalnego override. C2b staffing pozostaje osobną prawdą planu/obsady; nie kopiować records do work report.

Zbudować analizę wybranego tygodnia: co miało być wykonane, co faktycznie zakończono, co przeniesiono i dlaczego; następny tydzień/miesiąc, task/decision/milestone, priorytet/projekt/owner, rekomendowana uwaga. Historyczny wynik wymaga historii/as-of, nie samego bieżącego statusu. Użytkownik otwiera istniejący obiekt, deleguje/eskaluje zgodnie z prawem; retry nie tworzy drugiego zadania. Generacja cykliczna na początek tygodnia jest częścią E5, nie osobny scheduler w komponencie.

Podwidok zasobów w Pracy zachowuje rzeczywiste godziny/remaining estimate i deklarowaną tygodniową dostępność projektową z W10; >100% czerwone, brak dostępności/estymaty UNKNOWN, nie domyślne40h. Symulacja pokazuje wpływ na inne zobowiązania oraz wymaganą akceptację przydzielonej osoby. Kalendarz/kompetencje/koszty nieobecne mają jawne braki, a nie fikcyjną pełną obsługę.

RED→GREEN: legalna zmiana przydziału przez resource manager i odmowa ordinary member/foreign; zadanie bez projektu422 zamiast500; runtime/classic readback i brak dubli; rozpoczętej inicjatywy nie przesuwa apply planowania; przedział tygodnia z timezone/DST, ukończenie po terminie, brak daty, brak danych/historii. Mutacja tenant guard i usunięcie ochrony rozpoczętej pracy mają obalić test. UI klik w rekomendację otwiera właściwy task/decision, a odbiorca widzi zmianę w My Work po reloadzie.

### E3 — N-karta ryzyka i propozycji

Pliki: ExecutionControlSurface, RaidSection/raidGovernance jako adaptery istniejącego RAID, MaterialChangeQueue jako wejście My Work; managementIntervention, materialChange, raidItem, runtime router/schema; nowy komponent **`src/components/Execution/InterventionCaseDocument.tsx` (planowany nowy plik UI)** oparty na wspólnym N-shell. Nie tworzyć nowego modelu „RiskProposal”.

Cztery karty jednego intervention_case: (1) sytuacja/zagrożenia: sygnały i ich wersje, evidence/counterevidence/unknowns; (2) działania: warianty w tym do-nothing, zadania i właściciele, kolejność, proponowany diff; (3) skutki: scope/time/capacity/budget/KPI, blast radius, confidence, reversibility, warunki, pomiar efektu; (4) poinformowani: wybrani uprawnieni odbiorcy i późniejszy faktyczny status informacji. To projekcja istniejących pól i relacji; brakujące dane trwałe uzupełniać addytywnie w istniejącym kontrakcie, nie osobną kopią.

AI proponuje i uzasadnia na danych dwóch modułów. Nie inventuje liczb/praw. Edycja/komentarz użytkownika utrwalone z wersją; ponowna generacja nie kasuje ręcznych ustaleń. Oddzielić risk observation od decyzji o interwencji. Nie każdy sygnał od razu otwiera nową sprawę: użyć fingerprint i relacji INTERVENTION_SIGNAL.

RED→GREEN: duplicate signal/retry, brak źródła i niska jakość, ręczna zmiana opcji zachowana po reloadzie, foreign evidence, brak do-nothing, samodzielne zatwierdzenie zakazane polityką; wygasłe prawa oraz nieaktualna wersja sygnału. Real render N-karty z4kartami, back/forward i My Work→ta sama sprawa. Test źródłowego stringu nie zastępuje edycji i odczytu. Każdy sygnał ma wyjście: działanie, akceptacja ryzyka/odrzucenie z powodem, połączenie lub eskalacja; źródła i historia pozostają. Nie dawać zielonej prognozy bez baseline. Do UI dodać odrębne empty/filtered-empty/partial/stale/conflict/loading/error/permission states oraz bezpieczny powrót do rejestru z zachowaniem filtrów i scrolla.

### E4 — zatwierdzenie → zastosowanie → informacja → weryfikacja

Pliki: managementIntervention, materialChange, materialCommand/UoW tylko niezbędne adaptery, runtime route+schema, istniejący consumer IE i notificationOutboxService, MaterialChangeQueue/N-karta. **Nie deklarować obecnego APPLY jako wystarczającego**: odczyt wskazuje receipt-check poprzedniego target command, a consumer nie informuje ludzi.

Po poprawnej zgodzie uruchomić kontrolowane wykonanie istniejącej kanonicznej komendy (material-change publish lub uprawniona komenda operacyjna), powiązać receipt i przejść do oczekiwania na weryfikację. Złożyć istniejące komendy w spójny mechanizm transakcyjny/recovery; nie składać kilku niezależnych fetch z toastem sukcesu. Przed zapisem ponownie sprawdzić scope, role, policyVersion, expectedVersion, before hash, stale source i zatwierdzone warunki. Conditional approval nie jest pozwoleniem na pominięcie niezrealizowanego warunku. MaterialChange PUBLISH obecnie dopuszcza CONDITIONALLY_APPROVED — test musi dowieść semantyki konkretnych warunków, nie sam label.

Zapis targeta, powiązania, audytu i trwałego zdarzenia z intencją informacji muszą być spójne; zewnętrzne doręczenie asynchroniczne po commit z retry/dedup, osobnym statusem queued/sent/failed/delivered zgodnym z dowodem. Reuse notification outbox; nie nadawać neutralnemu receipt IE znaczenia „wszyscy poinformowani”. Odbiorców wyliczać z objętych zmianą rekordów i świadomego wyboru uprawnionego autora; rewalidacja tenant/access przy odczycie i dystrybucji. Brak faktycznej wysyłki do ludzi podczas lokalnego odbioru: testowy sink, rzeczywisty lokalny worker i trwałe readback.

Najważniejsze RED→GREEN: przed zgodą target niezmieniony; update-only actor próbuje DECIDE; sfałszowana authority; stara wersja planu po zgodzie; dwa równoległe apply; timeout po commit/retry; awaria po pierwszej mutacji i przed outbox, brak częściowego sukcesu; worker crash/redrive, ponowienie nie dubluje informacji; odebrany dostęp odbiorcy; zmiana strategiczna pokazuje dokładny before/after w obu modułach. Weryfikacja EFFECTIVE wymaga niezależnego uprawnionego weryfikatora i pomiaru, INEFFECTIVE/PARTIAL wraca do eskalacji, nie automatycznie CLOSED.

### E5 — raporty i cykle

Pliki: UnifiedExecutionReportGenerator, ExecutionReportsSurface/Document, ReportDocumentView, runtimeApi/executionReportsApi; reportDefinition/reportRun/reportReconstruction; executionReports.routes; ExecutionReportCron/reportCadenceService/executionDistributionService. Wspólny adapter W13 dla obu modułów; nie budować dodatkowego generatora tylko dlatego, że zakładka jest nowa.

Kreator ma tytuł/cel, projekt lub organizację (autoryzowany zbiór), odbiorców, okres/as-of/timezone, szablon i cykl, format. IDs/policy/scope refs dobiera aplikacja. Każde pole formularza musi mieć realny wpływ na zapis i wynik. Źródła i definicja przypięte wersją. Współdzielić silnik i rejestr wzorców W13. Profil preparation ma5startowych wzorców z paczki Inicjatyw; profil execution ma własne właściwe wzorce tygodnia pracy/postępu/rezultatów. Nie wymuszać identycznego zestawu5raportów w obu modułach ani nie scalać raportu przygotowania z raportem wykonania. Dodać kokpit i rollout/closure jako widoki, nie następne Menu2.

Łańcuch cadence→powstanie run→źródła/as-of→render→review/publication zgodnie z definicją→dystrybucja ma być realny. Zbiorczy raport nie otwiera odbiorcom dostępu do obcego projektu. PDF należy wygenerować i wyrenderować, nie sprawdzić tylko mimetype. Liczby tasków/milestones/inicjatyw rozdzielone; „paski” z notatki mapować na istniejące etykietowane obiekty osi, bez nowego aggregate bar.

RED→GREEN: manual run i poniedziałkowy cykl tylko raz na okres w danej strefie, DST, worker restart, niedostępne źródło→PARTIAL/FAILED zamiast zielonego, brak historii≠0, odbiorca po cofnięciu roli, PDF z realnym tekstem i tabelą, retry dystrybucji bez dubli. Source snapshot ten sam po zmianie danych bieżących. Nie stosować rekomendacji starego raportu bez nowej walidacji E4.

### E6 — KPI od kontraktu inicjatywy do wyniku realizacji

Pliki: initiativeKpiContract/KpisSection z zespołem Inicjatyw, Results kpi routes/writer/crosswalk, resultsMeasurement, deliveryAcceptance/effectivenessClosure, RolloutTab/BenefitsRegisterPanel i report model. Minimalny adapter W12 dostarczyć teraz, pełnej przebudowy modułu Results nie dołączać do paczki.

Przygotowanie ma sugerować KPI skutku z uzasadnieniem i pozwolić właściwemu owner/admin/komitetowi według governance przyjąć kontrakt: owner pomiaru, jednostka/formuła, baseline/target, okres/cadence, źródło i reguła realizacja/post-implementation. Jedno mappingId/KPI ID, te same odczyty w obu modułach. W Realizacji zbieranie/wezwanie do pomiaru i status brak/spóźniony/skorygowany; actuals poprzez właścicielski writer Results. Finanse tylko przypięta referencja i reconciliation; bez wymyślania financial actuals.

RED→GREEN: KPI zatwierdzony przed startem; pomiar w innym okresie/jednostce odrzucony; brak odczytu niezmieniony w0; korekta z historią; drift KPI po zgodzie wymaga właściwej rewalidacji; delivery accepted przy NOT_MEASURED nie udaje efektu; wynik przelicza się w raporcie i N-karcie po cold read; foreign KPI/pomiar niewidoczny; retry nie tworzy drugiej karty działania.

## 5. Testy do wykorzystania i sposób dowodzenia

Nie zakładać, że wymienione pliki teraz przechodzą. Są punktami startu; wykonać właściwe pliki po przypisaniu zasobów, bez retry maskującego błędy.

- Bank/identyczność: `src/components/Execution/__tests__/ExecutionHub.sourceRelation.render.test.tsx`, `ExecutionHub.entityLookup.test.tsx`, `executionCaseFanOut.test.ts`, `executionCaseNPlusOne.test.ts`; `server/src/routes/pmo/__tests__/executionCasesBulk.pg.test.ts`; `tests/integration/initiatives-execution/goldenThread.http.realdb.test.ts`, `authorizationBoundary.http.realdb.test.ts`.
- Praca: `src/components/Execution/__tests__/ExecutionWorkSurface.edycjaWierszem.test.tsx`, `ExecutionWorkSurface.otworzZadanie.test.tsx`; `tests/integration/initiatives-execution/executionWork.realdb.test.ts`, `executionWorkHardening.realdb.test.ts`, `operationalAllocation.realdb.test.ts`; E1 `server/src/routes/__tests__/codex4LegacyInboxAndAssignment.pg.test.ts` i C2b staffing tests.
- Zmiana: `tests/integration/initiatives-execution/managementIntervention.realdb.test.ts`, `materialChange.realdb.test.ts`, `planResequenceIntervention.realdb.test.ts`; `tests/unit/initiatives-execution/materialChangeQueue.test.tsx`; `server/src/services/__tests__/initiativeExecutionOutboxConsumer.pg.test.ts` (receipt dowód, nie notification proof).
- Raporty: `tests/integration/initiatives-execution/reportRun.realdb.test.ts`, `server/src/domain/initiatives-execution/__tests__/reportRunSources.test.ts`, `reportReconstruction.test.ts`; `server/src/routes/__tests__/executionReports.export.test.ts`; `src/components/Execution/reports-intelligence/__tests__/UnifiedExecutionReportGenerator.test.tsx`, `WorkIntelligenceReport.test.tsx`.
- KPI: `tests/integration/initiatives-execution/resultsMeasurement.realdb.test.ts`, `deliveryAcceptance.realdb.test.ts`, `effectivenessClosure.realdb.test.ts`; `server/src/services/results/__tests__/kpiMeasurementWriterService.pg.test.ts`; `server/src/routes/__tests__/day142.initiative-kpi-survival.pg.test.ts`.

Dla brakującego zachowania najpierw zachować pełne nazwy testów i realny RED z przyczyną, potem GREEN identycznego mianownika; targeted mutation wymaganych guardów musi wywołać RED, po przywróceniu GREEN. Import/collection error nie jest dowodem produktu. Test bezpośredniej funkcji domenowej nie dowodzi autoryzacji routera: wymagane ApiGateway+JWT+PG oraz SQL/cold GET. Frontend vitest per plik; server tsc po finalnych typach, build dopiero w przydzielonym ciężkim slocie. Nie uruchamiać równoległych buildów ani zmieniać wspólnej bazy.

Końcowy scenariusz użytkownika: jedna inicjatywa z KPI i zaakceptowanym handoff → Bank i ta sama karta → analiza zaległej pracy → uprawniona delegacja i My Work → ryzyko N → decyzja → apply/reload w Inicjatywach i Realizacji → informacja odbiorcy → pomiar → raport tygodniowy/PDF. Dla UI prawdziwe kliknięcia i reload, light/dark1440, PNG+bezpieczny JSON url/state/hash; obserwacja co najmniej2s po ready dla delayed auto-save errors. Zachować known CLOSEDinitiative PUT403 jako defekt do rozstrzygnięcia, nie ukryć w filtrze konsoli. Brak danych i foreign actor są osobnymi scenariuszami, nie wariantem sukcesu.

## 6. Zależności i granice wydania

1. Inicjatywy/W03/W04/C7 dostarczają role/governance, lifecycle/handoff, kontrakt karty i KPI; Realizacja może równolegle robić E1 UI i fixture, ale nie wymyśla własnych ról lub auto-start.
2. W10/C2b dostarczają istniejące plan/capacity/commitments; E2/E4 egzekwują granicę rozpoczętej pracy. Move inicjatywy między projektami osobno, bez przemycania przez edycję zasobów.
3. W13 wspólny report adapter; W12 minimalny pomiar i readback w tym zamknięciu. Nie odraczać tych połączeń automatycznie do Fali2.
4. **Spotkania pozostają zależnością**: wejście z interwencji do istniejącego meeting i relacje do decyzji mogą być zachowane. Ta paczka nie wdraża trzech faz spotkania, Teams/Ania, nagrywania ani nowej sesji Teresy. Dwa moduły to zakres aktualnego wydania.
5. Bez nowej prawdy Task/Decision/Risk/KPI, bez nowego business lifecycle „execution initiative”, bez kopiowania Finance actuals. Nie zmieniać jednocześnie szeroko queryHelpers, auth ani globalnych ról. Shared domain/router/locale/InitiativeDocumentView otrzymują czasową wyłączność pisarza; drugi zespół pracuje w rozłącznych plikach.
6. Bez live, zewnętrznych wiadomości, deploy/push, cleanup cudzych baz. Lokalny worker kieruje do sinka, nie klienta. Wydanie końcowe integrator odbiera oddzielnie.

Każdy commit podaje marker, przypisany zakres, aktualne wymagane znaczniki odmrożenia, RED/GREEN denominator, API/PG/UI dowody i pozostałe braki. Nie kopiować numeru DEC z innej paczki bez przypisania integratora. Raport końcowy ma oddzielić zrobiony kod, lokalne zachowanie, zbudowany runtime i odbiór scalenia. Wszystkie E1–E6 są wymaganym zamknięciem Realizacji; nie oznaczać modułu gotowym po samej zmianie Menu2.
