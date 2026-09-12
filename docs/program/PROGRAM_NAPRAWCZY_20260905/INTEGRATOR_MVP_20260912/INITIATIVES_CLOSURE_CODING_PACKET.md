# Inicjatywy — paczka kodowania pełnego domknięcia warunkowo przyjętego modułu

12.09.2026. Read-only przygotowanie; nie zmieniano źródeł, DB, live ani nie wykonywano testów. Punkt odniesienia: root kandydat `6494a5b239364a0f1252b7135ab8a7e786a91a37`, `/Users/piotrwisniewski/Developer/codex-wt/codex-integrator-mvp-20260912`. Przy wydaniu kodowania root podaje aktualny exact SHA, izolowany WT, porty/bazę i właścicieli wspólnych plików; nie kopiować PID/portów historycznych harnessów.

**Mandat:** właściciel uruchomił teraz domknięcie Inicjatyw i Realizacji. Dawna etykieta W2 nie odracza tych prac. Ten packet obejmuje Inicjatywy i jawne styki do równoległej paczki Realizacji; nie uruchamia sam kodowania ani kolejnego modułu.

## 1. Źródła i rozstrzygnięcia zakresu

Przeczytano całą nową notatkę `/Users/piotrwisniewski/.codex/attachments/da1658c4-427c-427b-9b48-c52b82665a15/pasted-text.txt` oraz treść wskazanego HTML `/Users/piotrwisniewski/Developer/wt/fable-inicjatywy/docs/program/ZALOZENIA/ZALOZENIA_INICJATYWY_REALIZACJA_20260912.html`. HTML jest roboczą propozycją i opisem starego stanu, **nie decyzją**: jego sześć statusów, próg110%, tylko kwartał i odsuwanie PDF/scenariuszy nie wygrywają z nowszym poleceniem.

Kanon: `docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` (szczególnie §4–9/15–19), `docs/modules/initiatives-execution-canon/00_INDEX_AND_AUTHORITY.md`, katalog26kart w `11_INITIATIVE_CARD_SYSTEM.md` i integracja Task/Decision w `12_TASK_DECISION_MY_WORK_INTEGRATION.md`. Pełny porządek lektury01–12 zapisany w00 jest obowiązkiem wykonawcy przed zmianą odpowiedniej domeny; niniejszy packet nie zastępuje tych kontraktów. Jakość: `docs/standards/CARD_CONTENT_FORMULA.md` §A3–A4/B3–B4 i `docs/initiatives/INITIATIVE_FORMULA.md`. Plan handoff: `PLAN_WDROZENIA_DOPRECYZOWAN_20260912.md` W03/W04/W09/W10/W13, odczytany w całości w tej sesji.

Wiążące nowsze zachowanie:
- Menu2 Inicjatyw: **Inicjatywy / Plan / Obciążenie / Raport z pracy**. Menu3 pierwszej funkcji: **Lista inicjatyw / Analiza inicjatyw**. Portfel jest analizą wewnątrz tej funkcji; dawny osobny Portfel/Health/Observability nie ma tworzyć dodatkowych zakładek klienta.
- Lista wszystkie lifecycle, domyślnie aktualne; archive/actual i projekt jako filtry. Widoki table/kanban/calendar/Gantt zachowują scope, zaznaczenie i tożsamość.
- Analiza ocenia karty oraz sens portfela: cele/pokrycie/luki/overlap/duplikaty/priorytety/biegnąca praca/historyczne doświadczenia. Decyzje/rekomendacje wymagają uzasadnienia i uprawnionego człowieka. Parking przechowuje powód i warunek powrotu. „No Done” z notatki nie jest poleceniem dopisania nowego enumu.
- Plan i obciążenie: horyzont1/3/6/12 miesięcy,1/3 tygodniami,6/12 miesiącami z zejściem do tygodni. Godziny / deklarowana tygodniowa dostępność projektowa. **>100% czerwone**, brak podaży nie jest0 ani40h. Planning apply nie zmienia dat/przydziałów biegnących inicjatyw; ich zmiana jest osobnym procesem Realizacji.
- Raporty na żądanie/okresowo, as-of, projekt/org, odbiorcy, PDF i rzeczywisty status wysyłki. To pełny zakres obecnego domknięcia, nie sam szkic generatora.
- Jedna Initiative identity, kanoniczne Tasks/Decisions/RAID/resources. Results jest właścicielem KPI actuals; Finance danych finansowych. Analiza godzin nie czeka na pełne modelowanie Finance.
- Projekt najpóźniej przy nowej inicjatywie;105 zastanych bez projektu nie migruje samo (DEC-469). C2b MOVE nadal ma odrębną granicę dostępu dzieci; nie wykonywać go przez podmianę project_id.
- DEC-474 nadal chroni konkretną ceremonię approval; dostarczyć parametryzowany rdzeń i konkretny wariant do finalnego odbioru. Nie stopować pozostałych funkcji ani wybierać za właściciela kworum. Nowy mandat nie jest poleceniem samowolnej migracji statusów: zachować runtime i przygotować jawne mapowanie12 etapów kanonu, nie redukować celu do dawnych7 etykiet. Aktywacja migracji/ceremonii oddzielnym przełącznikiem i odbiorem.
- EN teraz (DEC-461), nawet jeżeli starsza rubryka CARD_CONTENT_FORMULA wymaga PL. Progi długości/jakości zachować; tłumaczyć komunikaty bez obniżania wymagań.

## 2. AS-IS: co reużyć, czego nie uznawać za zakończone

| Obszar | Rzeczywiste pliki/API | Wykazana granica ze źródła |
|---|---|---|
| Hub/lista/karta | `src/components/Initiatives/InitiativesHub.tsx`, `CanonicalInitiativeRegister.tsx`, `InitiativeDocumentView.tsx`, `initiativeDocumentSource.ts`, `sections/registry.ts`; list/metadata przez `src/services/initiatives-execution/runtimeApi.ts` | Istnieją taby plan/capacity/portfolioHealth i osobne kanoniczne filtry. Nie ma dowodu aktualnej4-funkcyjnej drogi właściciela. `SECTION_REGISTRY` ma29 technicznych kluczy, nie26 semantycznych kart1:1. |
| Portfel | `server/src/services/initiative/portfolioAnalysisService.ts`, `src/components/Initiatives/PortfolioHealthView.tsx`, `server/src/domain/initiatives-execution/portfolioScenario.ts`, `portfolioDecision.ts`, `analysisReadiness.ts`, `analysisDecision.ts` | Analysis service jawnie liczy deterministyczny Jaccard/stałą taksonomię/effort-impact. To użyteczna analiza danych, **nie pełna ocena konsultingowa historycznych powodów i spójności treści**. `portfolioDecision` ma UoW/expectedVersion i zmienia lifecycle po decyzji — reużyć, nie frontend status patch. |
| Plan | `PlanScenarioSurface.tsx`, `cards/PlanCard.tsx`, `Generator/GeneratorPlanuModal.tsx`, `planProposalReview.ts`; domain `planScenario.ts`, `planSolver.ts`, `planAnalysisProposal.ts` | Solver ma topologię/cycle detection i realistyczne okna. Publish blokuje niewłaściwy state i wymaga poprawnego portfolio/APPROVED_BACKLOG (planScenario:170–219). Review plan proposal:145 zapisuje tylko cały ACCEPT/REJECT+rationale; frontend `applyAcceptedPlanProposal` nakłada wszystkie changes po ACCEPTED. To nie kontrakt indywidualnych edycji/komentarzy/partial accept. Critical path i wymagany calendar zoom wymagają osobnego pomiaru, nie ogłoszenia „brak solvera”. |
| Capacity | `CapacityScenarioSurface.tsx`, `CapacityOptionsPanel.tsx`, `cards/CapacityAnalysisCard.tsx`, `cards/PlanRoleDemandEditor.tsx`; domain `capacityScenario.ts`, `capacityRoleSheet.ts`, `capacityOptionsAdvisor.ts`, `staffingPlans.ts` | Istnieje role/team envelope: `capacityRoleSheet` supply=fteWeekly×weeks, komentarz40h/FTE. Nie dowodzi osobowej deklaracji godzin projektowych ani wspólnego obciążenia projektów. Nie zamieniać starego FTE w40h dostępności użytkownika. C2b staffing to kanoniczny writer, nie pełny produkt heatmapy. |
| Reports | domain `reportDefinition.ts`, `reportRun.ts`, `reportReconstruction.ts`; `src/services/executionReports/executionReportsApi.ts`; `src/components/Execution/ExecutionReportsSurface.tsx`; istniejące `Reports/Management/ReportScheduleView.tsx`, `ReportBuilder/ScheduleReportModal.tsx` | ReportDefinition ma cadence/audience i wersje; reportRun:42/254 eksportuje package **JSON**. To nie dowód PDF, działającego schedulera lub doręczenia. Wspólny silnik wykorzystać z profilem „initiative preparation”, nie kopię truth Realizacji. |
| API wspólne | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`; klient `src/services/initiatives-execution/runtimeApi.ts` | Rodziny `/api/initiatives/runtime-v1/portfolio-scenarios`, `/plan-scenarios`, `/capacity-scenarios`, historia/diff, compute, analysis-proposals; report-definitions/report-runs klient przez allocationRequest. Router także PMO mount — przed kodowaniem potwierdzić rzeczywisty mount w ApiGateway i tenant middleware, nie kopiować URL z komentarza. |

## 3. Gotowe zadania w kolejności zależności

### I-01 — mapa kontraktu i shell List/Analysis

**Właściciel plików:** InitiativesHub, CanonicalInitiativeRegister, własne Initiative routing/menu/locales i testy. Żadnych zmian ExecutionHub.

Zamienić widoczne Menu2 na4 funkcje; wewnątrz Inicjatyw dwa rejestry List/Analysis. Zachować stare deep-linki jako jawne przekierowanie do właściwego lens, nie utracić dostępu do starych artefaktów. List: wszystkie statusy, actual domyślnie, archiwum i projekt, table/kanban/calendar/Gantt. Przywracanie tabeli utrzymuje filtry/scroll. Reużyć `Portfolio/*View.tsx` tylko po sprawdzeniu semantyki, nie drugi rejestr.

**RED→GREEN:** istniejąca inicjatywa executing i archived nie giną z pełnego zakresu; default ukrywa archived, filtr przywraca; identyczne tytuły/differentID widoczne; zmiana widoku nie zmienia scope. UI→API→PG→reload, drugi tenant niewidoczny. Testy start: `InitiativesHub.menu3Chips.test.tsx`, `InitiativesHub.licznikiSpojne.test.tsx`, `CanonicalInitiativeRegister`/`PortfolioKanbanView.executingVisible.test.tsx`; źródłowe regexy nie są odbiorem UI.

### I-02 — N-karta, obowiązkowe sekcje i jakość

**Własność:** InitiativeDocumentView, sections registry/types/panel, właściwy Initiative generator/validator; domain writer tylko jeśli istniejące pole nie ma producenta. Shared UoW/capability/Results writers pod lockiem integratora.

Zmapować26 semantycznych kart do29 technicznych komponentów, wskazać połączenia i brakujące grupy; nie mnożyć typu sekcji tylko dla wyglądu. Start zawsze pokazuje tożsamość/projekt/owner/source, Summary/Scope, StrategicFit, Success/Outcomes/KPI, Team/RACI i History oraz stan jakości/gate. Są to obowiązkowe widoczne grupy początkowego briefu; ich kompletność może być EMPTY w szkicu, ale brak blokuje właściwy gate. Pozostałe karty są dostępne do dodania z zamkniętego katalogu, a ich requiredness wynika z wybranego profilu i etapu. Nie ustanawiać jednego arbitralnego zestawu wymaganych kart dla wszystkich przedsięwzięć.

26 kart: Summary/Scope; StrategicFit; SuccessCriteria; Outcomes&Benefits; KPI; Options; FinancialAnalysis; FinancialImpact; People/Team; Roles&RACI; Stakeholders; Resources&Capacity; Dependencies; Risk&RAID; Feasibility&Completeness; TechnicalSpecification; Milestones; Timeline; Tasks; Decisions; Gates&Approvals; Change&Adoption; Communication&Engagement; Capabilities&Training; Attachments&Materials; Comments/Activity/History. Karty Finance są referencją z jawnym brakującym źródłem, nie nowym silnikiem Finance.

Każda karta ma applicability REQUIRED/OPTIONAL/NOT_APPLICABLE, completion, quality, freshness, review, save. COMPLETE≠APPROVED. Ukrycie/opcjonalność nie usuwa danych; required waiver wymaga authority i powodu. Zmiana template pokazuje impact i zachowuje treść.

**Istniejąca rubryka treści A3:** title≤14 słów; problem120–250; hypothesis1–3zdania; summary40–90; description400–750; business_value2–3zdania; min4deliverables,4success criteria,3scope-in,3scope-out,2kill criteria; min2KPI z≥1primary i baseline/target/unit/direction;3milestones (relatywne daty dozwolone);2risks+1assumption+1dependency; RACI1A+1R+≥1C/I; pełny lineage/metadane; puste WAR/OPC z uzasadnieniem. ≥80% tez ugruntowane; completeness≥90/100 i wszystkie wymagane rubryki poprawne. Liczby bez danych mają „to establish”+powód, nie fikcyjne minimum. Treść EN po DEC-461. Jeśli starsze minima RAID/dependency kolidują z rzeczywiście niezależną inicjatywą, uzasadnić applicability/waiver w istniejącym modelu, nie fabrykować zależności.

**Odbiór:** nowa ręczna/AI inicjatywa z projektem+źródłem; dwa różne konteksty firm dają różną treść; powrót z quality check z konkretną listą braków, poprawa jednej sekcji nie zmienia innych. Stale source/version nie przepuszcza wcześniejszej zgody. Testy `initiativeSections.day136.pg.test.ts`, `initiativeSections.day136.test.ts`, `initiativeDocumentSource.saveRuntimeOnlyMetadata.test.ts` jako regresje; wymagany real gateway+PG i otwarcie N-karty, nie długość napisu jako jedyny dowód jakości.

### I-03 — analiza portfela z historią i decyzją człowieka

**Własność:** PortfolioHealthView/nowy lens w Initiatives, portfolioAnalysisService, portfolioScenario/Decision i ich testy. Zmiana wspólnego runtimeApi/routera w jednym uzgodnionym commicie przez integratora.

Wersjonowany Analysis/PortfolioScenario wiąże exact set IDs+versions, project/org, as-of, model/rubric version, sources i assumptions. Deterministyczny etap liczy pokrycie i kandydatów duplicate; analiza merytoryczna uzasadnia overlap, wartość, priorytety i historyczne doświadczenia oraz odróżnia „nowa” od „rozszerzenie biegnącej”. Każda obserwacja zawiera affectedIDs, evidence, rationale, confidence, recommended action, alternatives, brakujące dane. Użytkownik może komentować/zmieniać/odrzucać/przyjmować wybrane pozycje; AI nie zatwierdza.

Parking/defer zapisuje reason, decider, date, source snapshot, review trigger; archive/reject zachowuje historiię. Kolejna analiza uwzględnia powód i nie proponuje tego samego bez wyjaśnienia, że warunek zmienił się. Lifecycle/disposition nie są tłumaczone przez losowy status „no Done”. Decyzja portfela idzie kanonicznym portfolioDecision, nie listowym PATCH.

**RED→GREEN:** portfel2projektów zawiera duplicate, gap, ongoing, history rejected i nowy kontrdowód. Analiza rozróżnia5przypadków; partial accept zmienia tylko wybrane, stale snapshot409/no-write, foreign403/404/no-write, retry receipt bez duplikatu. Testy `tests/unit/initiative/portfolioAnalysisService.test.ts`, `tests/integration/initiatives-execution/analysisDecision.realdb.test.ts`, portfolioScenario/Decision tests oraz rzeczywisty UI review queue. Historyczny `PortfolioAnalysisView.r13-wiring.source-anchor.test.ts` nie dowodzi tej funkcji.

### I-04 — Plan: częściowa ocena, zależności i kalendarz

**Własność:** PlanScenarioSurface, PlanCard, GeneratorPlanuModal, planProposalReview, domain planScenario/planAnalysisProposal/planSolver i ich testy.

Rozszerzyć istniejący proposal o item-level rationale/comment/manual override/acceptance i base versions. Akceptacje pojedyncze/wszystkie stosują tylko aktualny wybrany draft; material publish nadal osobno istniejącym Schedule Gate. Reużyć solver i mapę cykli; dodać/zweryfikować wynik ścieżki krytycznej z predecessor constraints i jawnie warunkowymi krawędziami, assumptions, niewykonalnością zamiast arbitralnych dat. Calendar1/3/6/12 i odpowiednie granularity, timeline report z assumptions po kliknięciu. Planning UI oznacza running tekstem+kolorem i nie pozwala zmieniać ich baseline; backend rewaliduje ten zakaz przy apply, nawet jeśli status zmienił się od analizy.

**RED→GREEN:** DAG z ręcznie policzoną ścieżką krytyczną; cycle; brak czasu trwania; conditional dependency; częściowy accept; komentarz zmienia propozycję; initiative staje się running po analizie→odmowa/pominięcie jawnie zgodnie kontraktem, jej SQL/daty bez zmian. Existing planScenario publish ma guard APPROVED_BACKLOG — zachować go i rozszerzyć dowód, nie osłabiać. Testy `planSolver50x4.realdb.test.ts`, `planPublish.konflikt.realdb.test.ts`, `planScenario.relationIdentity.realdb.test.ts`, `PlanCard.zatwierdz.test.ts`, `GeneratorPlanuModal.uzasadnienie.test.tsx` plus UI snapshot1/3/6/12 i real version conflict.

### I-05 — Obciążenie: godziny osób i bezpieczny apply przyszłości

**Własność:** CapacityScenarioSurface, CapacityOptionsPanel, CapacityAnalysisCard/PlanRoleDemandEditor; domain capacityScenario/RoleSheet/OptionsAdvisor. **Współdzielone:** availability/assignment/staffingPlans z zespołem Realizacji — jeden writer, integrator ustala właściciela zmiany.

Wpiąć istniejące dane dostępności; jeśli brak jawnej tygodniowej deklaracji projektowej, dostarczyć minimalny canonical input z okresem i uprawnieniem, nie lokalny localStorage ani stałe40h. Wyliczenie person-week: suma godzin planowanych w wybranym scope/statusach ÷ zadeklarowane godziny tego samego tygodnia; pokazać numerator/denominator/unit/as-of. Brak podaży=UNKNOWN, zadeklarowane0+positive demand=infeasible, nie dzielenie przez0. Heatmap osoby×tygodnie, stosy inicjatyw/projektów, org/projekt/status, >100% red + tekst, projected vs committed oddzielnie.

AI proponuje future reassign/resequence z regułami kompetencji/dostępności i skutkami dla innych projektów. Partial/bulk approve przez canonical commands z versions. **Nie wolno** zmienić running assignment lub schedule przez ten ekran; recheck status/authority pod transakcją. Równoległa paczka Execution zachowuje własny uprawniony proces interwencji dla pracy biegnącej.

**RED→GREEN:** osoba deklaruje12h, dwa projekty8h+7h→125%; filtr projektu pokazuje8/12 i jawny total15/12, bez fałszywej wolnej capacity; brak vs0; zmiana podaży w czasie review; status draft→running przedapply; jedna niedozwolona pozycja bez fałszywego full success; retry no duplicate; foreign assignee/org blokada. Testy `capacityCompute.realdb.test.ts`, `capacityRoleSheet.test.ts`, `capacityOptions.realdb.test.ts`, `capacityOptionsAdvisor.infeasibleResequence.test.ts` i C2b `staffingPlansCanonical.pg.test.ts` jako chroniona regresja.

### I-06 — Raport z pracy: rzeczywisty Report Run, PDF, cykl i odbiorcy

**Własność:** Initiatives report lens/profile i treść preparation. **Shared domain/router/scheduler/export** ma jednego właściciela root z zespołem Execution; nie dwa niezależne generatory.

Reużyć ReportDefinition/Run/SourceSnapshot, dodać profil initiative-preparation (kompletność, decyzje zaległe i kto, poprawy, portfolio, plan/capacity), project/org/as-of. Pięć startowych wzorców wykonawczych z notatki: readiness; pending approvals; portfolio selection; plan/dependencies; workload. To konfiguracje wspólnego raportu, nie5silników. Kreator tytuł/scope/okres/cadence/odbiorcy, run on demand i scheduled. Report Run immutable snapshot z drill-through; PDF render z tego samego frozen snapshot, nie bieżącego mutującego GET.

Dostarczyć jawny scheduler→run→outbox→delivery status, recipient ACL w momencie uruchomienia i wysyłki, retry dedupe. Po cofnięciu dostępu nie wysyłać starego raportu. HostingerDEC-471 pozostaje; brak dostępu zewnętrznego blokuje tylko dowód doręczenia, nie kodowanie PDF/schedulera. Żadnej wysyłki do ludzi w tym read-only zadaniu.

**RED→GREEN:** on demand i zegar testowy scheduled dają1run na slot; stale/partial data jawne; PDF otwiera się i liczby/odbiorcy/as-of zgodne; retry nie tworzy dwóch wysyłek; ACLrevoked blokuje wysyłkę; failing transport nie raportuje delivered. Testy `reportDefinition.realdb.test.ts`, `reportRun.realdb.test.ts`, `reportReconstruction.test.ts`, router `reportDefinitions.adminGate.routes.test.ts`; osobno real PDF/download UI i receipt transportu. JSONexport nie jest PDFproof.

## 4. Kontrakt wspólnych mutacji i zakres własności

- Istniejący MaterialCommandUnitOfWork/executeMaterialCommand: organizationId, aggregateId/type, expectedVersion, clientRequestId, actor, capability, audit/outbox/receipt i odpowiedź z wersją. Nie drugi transaction manager i nie shadow table na status/assignment/KPI.
- Zachować C2b milestone/resource/budget/gate/staffing, OFF parity legalnych wywołań, tenant guards przed flagą i parent locking przed replay. Flagi/scalenie nie oznaczają dostępności klientowi; config manifest osobno.
- Root przydziela wyłączność `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`, `src/services/initiatives-execution/runtimeApi.ts`, shared UoW/capabilities, locales wspólne, models, migrations. Initiatives agent nie zmienia ExecutionHub/Work/Control; Execution agent nie zmienia InitiativesHub/Plan/Capacity bez uzgodnienia.
- Nowe wymagania schema addytywnie, inventory rzeczywistych tabel/kolumn najpierw; nie edytować historycznych migracji. UoW scope jednocześnie sprawdza org/parent/status przed replay/apply. Receipt nie upoważnia do odczytu usuniętego/obcego parenta.
- Materialne zmiany wersji/scope/terminu/zasobów mają impact preview, authority i jasny wynik częściowy/odmowę. Pusty generator nie może „zapisać sukcesu”; real failure zachowuje możliwość retry bez dubli.

## 5. Protokół odbioru i kolejność commitów

1. Aktualny base/WT/ownership → cały właściwy kontrakt w kolejności00 → source-to-contract delta; zarezerwować rozłączne lokalne zasoby. Source review tego packetu to przygotowanie, nie runtime.
2. I-01+i-02 minimalny pion: lista→N-card→quality→save/readback; wtedy I-03 portfel→decyzja; I-04 plan→I-05capacity loop; I-06 raporty nad tymi samymi źródłami. Przygotowanie wspólnego raportu/schedulera może iść wcześniej równolegle po zamknięciu ownership.
3. Per rodzina commit z real RED→GREEN, identyczne fullName, legal positive/unauthorized/foreign/stale/retry/failure. ApiGateway+JWT+PG (nie tylko direct domain); UI musi kliknąć realne control, reload i właściwy odbiorca/reader pokazać rezultat. Mock LLM testuje mechanikę, prawdziwy model i dwa konteksty testują konsultingową jakość.
4. Wspólny przykład2projektów: nowa inicjatywa→quality fixes→portfolio partialdecision→plan→12h/15h workload→safeaccept→report/PDF; biegnąca inicjatywa pozostaje niezmieniona, a jej zmiana idzie przez paczkę Execution. Obcy tenant nie czyta i nie zapisuje.
5. Render actual changed UI w light/dark i wymaganych szerokościach, klawiatura, loading/empty/filtered-empty/stale/unknown/conflict/error; status nie tylko kolor. Otworzyć finalne PDF; screenshot nie dowodzi pliku.
6. Niezależny reviewer dokładnego SHA, fix findings, integracja root i wspólny runtime; aktualizacja istniejącego index programu. Nie zamykać dwóch modułów po samej zmianie Menu2 ani po zapisaniu tego packetu.

## 6. Pozostałe granice, które nie zatrzymują całej pracy

CeremoniaDEC-474, migracja12 etapów i MOVE/dostęp dzieci wymagają jawnego rozliczenia w już istniejących decyzjach i adapterach. Pełne finanse nie blokują hours/portfolio/reportpreparation; nie podawać zmyślonego ROI. Hostinger delivery i docelowy rollout mają własny rzeczywisty odbiór. Żaden z tych punktów nie uzasadnia odłożenia całych Inicjatyw do wcześniejszej etykiety W2. Gotowe zadania I-01…I-06 są mapą istniejącego W03/04/09/10/13, nie nowymi programami.
