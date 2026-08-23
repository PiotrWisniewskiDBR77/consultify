# Initiatives — niezależny audyt biznesowo-metodyczny

Data audytu: 2026-08-24  
Kontrolowany worktree: `/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823`  
Inspekowany HEAD: `2cf780d62f9a421ec4b372e8168b247435c464ec`  
Charakter dokumentu: niezależny raport ekspercki; **nie zmienia** kodu, istniejących statusów odbiorowych ani decyzji właścicielskich.

## Werdykt

`NO-GO_FOR_OWNER_ACCEPTANCE / TECHNICAL_FOUNDATION_SUBSTANTIAL`

Moduł ma istotny fundament domenowy: kanoniczny rejestr inicjatyw, rozbudowaną kartę inicjatywy, wersjonowane agregaty Plan i Capacity, governance publikacji, historię/diff, zobowiązania zasobowe, handoff do Execution oraz model definicji i uruchomień raportów. Nie jest to jednak jeszcze dowód kompletnego produktu właścicielskiego. Najważniejsze przepływy — tworzenie inicjatywy z AI, pełny what-if z filtrowaniem i edytowalnym Ganttem, AI Analyze w planowaniu i obciążeniach, kompletna integracja Initiatives → Execution oraz raporty odtwarzane z zapisanych wersji — są częściowe, wyłączone w UI albo nieudowodnione na aktualnym HEAD.

Kanoniczny `MODULE_ACCEPTANCE.md` sam utrzymuje bramkę `OWNER_FEEDBACK_CAPTURED / P0_BROWSER_REPAIRS_VERIFIED / OWNER_RETEST_PENDING`; G16–G20 są `NOT_STARTED`. Niniejszy audyt tego nie nadpisuje.

## Oczekiwany przepływ biznesowy

1. Źródło lub człowiek zgłasza zwięzłą przesłankę; AI proponuje kompletny szkic inicjatywy wraz ze źródłem, założeniami i lukami.
2. Człowiek przegląda szkic, poprawia go i zapisuje dokładnie jedną kanoniczną inicjatywę; odczyt po zapisie zachowuje identyfikator i treść.
3. Rejestr pokazuje status/lifecycle, kolejny gate, readiness, ownera, kolejną akcję, efekt, okno planu i health; liczniki zgadzają się z widocznym mianownikiem.
4. Plan tworzy niezależne, wersjonowane scenariusze what-if bez mutowania dat źródłowych inicjatyw: wybór statusów i pozycji, include/exclude, zależności, tygodniowy Gantt, AI proposal, ręczna korekta, zapis/publikacja.
5. Capacity wybiera zapisaną wersję planu i tworzy jedną lub więcej wersjonowanych analiz obciążenia: osoba/zespół/rola, zakres popytu i podaży, saturacja, konflikty, koszt i opcje reakcji; AI jedynie proponuje, człowiek zatwierdza.
6. Zatwierdzony gate harmonogramu tworzy jeden Execution case powiązany z tym samym `initiativeId`; zadania, decyzje, kamienie i alokacje są odczytywane bez drugiego źródła statusu.
7. Raport jest wersjonowanym, odtwarzalnym snapshotem wskazanych wersji inicjatyw/planu/capacity; nie jest żywym widokiem zmieniającym przeszły wynik.

## Macierz pokrycia

| Obszar | Stan dowodu | Ocena |
|---|---|---|
| Rejestr i statusy | Naprawa 11 rekordów oraz mianownika ma dowód w kanonicznym rejestrze, ale owner retest oraz pełne stany graniczne są otwarte. | `PARTIAL / OWNER_RETEST_PENDING` |
| Karty inicjatywy | Istnieje rozbudowany workspace i katalog 27 kart; minimalny skład, kompozycja i pełna akceptacja wizualna nie są udowodnione. | `PARTIAL` |
| Tworzenie z AI | Aktywny CTA otwiera `InitiativeWizardModal`; owner wymaga premise/source → AI draft → human review → idempotent save/readback. Fixture jawnie nie wywołuje AI. | `NO-GO` |
| Plan what-if | Backend i UI wspierają szkic/publikację, kolejność, okna, assumptions, history/diff. AI jest wyłączone; brak tygodniowego drag/drop Gantta i kompletnego include/exclude/status selection. | `NO-GO` |
| Capacity | Bogaty model zakresów, constraintów, assignmentów, comparisons i commitment governance. AI jest wyłączone; brak dowodu wielu analiz na plan oraz widoku saturacji osoba/zespół. | `NO-GO` |
| Execution integration | Endpointy i runtime-v1 istnieją; kanoniczny kontrakt nadal wymaga exact-ID, status, tasks/decisions/resources i cold readback na kandydacie. | `NO-GO` |
| Wersjonowanie | Plan/Capacity mają version, history, diff i immutable publish semantics. Czytelne dla użytkownika name/author/supersession oraz kompletne readback są nieudowodnione. | `PARTIAL` |
| Raporty | Backend ma report definitions i report runs z transitionami i wersjonowanymi źródłami. Brak udowodnionego końcowego UI/flow powiązanego z Plan/Capacity. | `NO-GO` |

## Findings

### INI-METH-001 — brak aktualnego zamknięcia odbiorowego modułu

- **Priorytet:** `P0`
- **Dowód:** `docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md:5,36-40`; G16–G20 pozostają `NOT_STARTED`.
- **Naruszony kontrakt:** moduł może zostać uznany za gotowy dopiero po retestach każdego owner finding, dokładnym kandydacie SHA, regresji zmian późniejszych i replay 16/16.
- **Wpływ:** lokalnie widoczna naprawa może zostać pomylona z przyjętym modułem; brak zamkniętego mianownika dowodów.
- **Bramka domknięcia:** na jednym zamrożonym SHA wykonać G16–G20; każdy `INI-OWN-*` otrzymuje wynik właściciela i ścieżkę dowodu; zero `UNKNOWN` w wyniku bramki bez jawnego powodu. Do tego czasu `NO-GO_FOR_OWNER_ACCEPTANCE`.

### INI-METH-002 — Initiatives → Execution nie ma dowodu jednej tożsamości end-to-end

- **Priorytet:** `P0`
- **Dowód:** owner contract `MODULE_ACCEPTANCE.md:80`; klient runtime ma endpointy handoff/schedule/execution (`src/services/initiatives-execution/runtimeApi.ts:142-253`), backend ma osobne agregaty handoff, schedule i execution; dotychczasowy rejestr oznacza integrację jako `INTEGRATION_REPLAY_PENDING`.
- **Naruszony kontrakt:** ten sam `initiativeId` i lifecycle muszą zasilać rejestr Initiatives i kartę Realizacji w Execution; bez duplikatu i bez niezależnej prawdy statusowej.
- **Wpływ:** użytkownik może planować jedną inicjatywę, a wykonywać inną projekcję; raporty i capacity tracą wiarygodność.
- **Bramka domknięcia:** utworzyć/wybrać jedną inicjatywę na exact SHA; zatwierdzić schedule gate; potwierdzić dokładnie jeden Execution case; sprawdzić identyczny ID/status, task, decision, milestone i allocation; zimny restart i ponowny odczyt muszą zachować relację; retry nie może utworzyć duplikatu.

### INI-METH-003 — tworzenie inicjatywy z AI nie realizuje udowodnionego kontraktu ownera

- **Priorytet:** `P1`
- **Dowód:** `MODULE_ACCEPTANCE.md:76`; aktywny przycisk otwiera `InitiativeWizardModal` (`src/components/Initiatives/InitiativesHub.tsx:2390-2393,2421-2458`), równolegle pozostaje historyczny formularz manualny (`InitiativesHub.tsx:2466-2573`); G04 jawnie stwierdza, że AI nie zostało wywołane (`MODULE_ACCEPTANCE.md:24`).
- **Naruszony kontrakt:** concise premise/source → kompletna propozycja AI → jawne assumptions/gaps → human review → idempotent save → cold readback.
- **Wpływ:** samo istnienie kreatora nie dowodzi, że AI tworzy użyteczną, audytowalną inicjatywę; dwa wejścia mogą rozjechać semantykę i walidację.
- **Bramka domknięcia:** jeden kanoniczny CTA; test fixture z przesłanką i source reference; AI zwraca pełny draft bez automatycznego zapisu; użytkownik akceptuje/zmienia; zapis tworzy jedną inicjatywę; retry z tym samym request ID nie duplikuje; ponowne otwarcie pokazuje source, assumptions, autora AI/human i finalną treść. `UNKNOWN`, czy obecny wizard spełnia całość.

### INI-METH-004 — Plan jest edytorem scenariusza, ale nie pełnym narzędziem what-if/Gantt

- **Priorytet:** `P1`
- **Dowód:** `MODULE_ACCEPTANCE.md:77`; `PlanScenarioSurface.tsx:650-692` renderuje szeroką tabelę, `694-763` workbench, `820-977` ręczną tabelę kolejności i dat, `979-1029` add/assumptions/diff. Kolejność zmieniają przyciski góra/dół (`832-843`), a nie tygodniowy Gantt. `InitiativeGantt.tsx` istnieje, ale dotyczy karty pojedynczej inicjatywy i nie jest dowodem użycia w `PlanScenarioSurface`.
- **Naruszony kontrakt:** nowa analiza ma wybierać statusy i poszczególne inicjatywy include/exclude, układać je na tygodniowej osi, pozwalać przesuwać elementy oraz porównywać warianty bez zmiany źródła.
- **Wpływ:** użytkownik nadal pracuje na technicznej tabeli okien, a nie na narzędziu scenariuszowym potrzebnym do decyzji zarządczej.
- **Bramka domknięcia:** z rejestru scenariuszy utworzyć nowy wariant; wybrać statusy, ręcznie wyłączyć minimum jedną pozycję; zobaczyć tylko włączone pozycje na Gantcie w tygodniach; przesunąć pasek i zapisać; source Initiative dates pozostają niezmienione; wariant ma name/version/author i odtwarza się po cold reopen.

### INI-METH-005 — AI Analyze dla planu jest celowo wyłączone

- **Priorytet:** `P1`
- **Dowód:** `src/components/Initiatives/PlanScenarioSurface.tsx:622-625` pokazuje `disabled: true` z komunikatem o braku governed analysis request.
- **Naruszony kontrakt:** AI ma proponować dependency-aware sequencing, wskazywać konflikty i uzasadniać zmiany, ale nigdy zapisywać ich bez decyzji człowieka.
- **Wpływ:** centralna wartość planowania „poukładaj/analyze” nie działa; ręczna kolejność nie skaluje się do wielu inicjatyw.
- **Bramka domknięcia:** przycisk Analyze tworzy osobny proposal z ID, input versions, assumptions i rationale; UI pokazuje before/after oraz konflikty; Reject nie zmienia draftu, Apply zmienia wyłącznie draft; publikacja pozostaje osobnym działaniem; replay zachowuje audit trail.

### INI-METH-006 — Capacity ma poprawną semantykę zakresów, ale nie dowodzi pełnej analizy obciążenia

- **Priorytet:** `P1`
- **Dowód:** `CapacityScenarioSurface.tsx:580-659` ma tabelę demand/supply/gap/confidence/criticality/owner; `661-755` workbench, periods, constraints, assignments i comparisons; `755-780` rozdziela commitment od decyzji Resource Managera. AI jest wyłączone (`553-556`). `MODULE_ACCEPTANCE.md:78` nadal ma `IMPLEMENTATION_PENDING`.
- **Naruszony kontrakt:** wybrana wersja planu → wiele analiz obciążeń → osoba/zespół/rola i saturacja → konflikty → AI propozycje czasu/reallocation → decyzja człowieka.
- **Wpływ:** technicznie bogaty model może nie odpowiedzieć menedżerowi „kto, kiedy i w jakim stopniu jest przeciążony” oraz nie umożliwić porównania kilku analiz tego samego planu.
- **Bramka domknięcia:** dla jednego opublikowanego planu zapisać co najmniej dwie analizy; każda pokazuje wykorzystanie osoba/zespół, popyt/podaż jako zakres i confidence, konflikt oraz koszt; AI generuje co najmniej dwie opcje z wpływem; Apply wymaga akceptacji; wersje i plan source ref odtwarzają się po restarcie. Do tego czasu pełna saturacja i multi-analysis są `UNKNOWN`.

### INI-METH-007 — raportowanie istnieje jako backend, nie jako zamknięty produkt Initiatives

- **Priorytet:** `P1`
- **Dowód:** backend udostępnia create/transition/list/read dla definicji i uruchomień raportów (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:4461-4662`); klient ma create/list report runs (`src/services/initiatives-execution/runtimeApi.ts:1397-1427`). W kanonicznym top-level pozostają tylko Initiatives/Plan/Capacity (`InitiativesHub.tsx:240-244`), a aktualny owner contract nie daje dowodu finalnego raportowego UI.
- **Naruszony kontrakt:** raport ma być odtwarzalnym artefaktem decyzji, z zakresem/statusami, source versions, datą stanu danych, autorem, definicją i wersją — nie kolejną żywą tabelą.
- **Wpływ:** istniejące endpointy mogą pozostać niewidoczne i nieprzetestowane; plan/capacity nie kończą się materiałem decyzyjnym.
- **Bramka domknięcia:** z Plan i z Capacity uruchomić raport na wskazanej wersji; lista raportów pokazuje typ/status/author/data-as-of/source version; otwarcie i cold reopen renderują identyczny snapshot; zmiana inicjatywy po wygenerowaniu nie zmienia starego raportu; nowa generacja tworzy nową wersję/run. Umiejscowienie raportów w IA wymaga jawnej decyzji, nie należy przywracać historycznej zakładki bez ownera.

### INI-METH-008 — wersjonowanie jest mocne domenowo, ale słabe jako zweryfikowany przepływ użytkownika

- **Priorytet:** `P2`
- **Dowód:** Plan zawiera `scenarioVersion`, history i diff oraz immutable publish (`PlanScenarioSurface.tsx:683-685,699-742,1014-1028`; `runtimeApi.ts:768-814`). Capacity ma version i immutable publish (`CapacityScenarioSurface.tsx:650-652,683-695`) oraz history API (`runtimeApi.ts:832-855`).
- **Naruszony kontrakt:** użytkownik musi rozumieć nazwę, autora, wersję, status, bazę porównania i supersession każdego scenariusza/analizy.
- **Wpływ:** poprawna eventowa wersja techniczna nie musi być czytelną wersją biznesową; trudno porównać scenariusze i odtworzyć decyzję.
- **Bramka domknięcia:** UI listy pokazuje name/version/author/status/updated/source version; publish zamraża wersję; edit tworzy kolejną wersję zamiast nadpisania; diff pokazuje dodane/usunięte/przesunięte inicjatywy i zmianę assumptions; oba warianty otwierają się po cold restart.

### INI-METH-009 — fixture i demo mode nie dowodzą trwałości Plan/Capacity

- **Priorytet:** `P1`
- **Dowód:** G06 stwierdza, że owner fixture nie zawiera scenariuszy i Plan/Capacity mają honest empty (`MODULE_ACCEPTANCE.md:26`). Oba surfaces zawierają twardo zakodowane scenariusze demo (`PlanScenarioSurface.tsx:134-167`; `CapacityScenarioSurface.tsx:283-310`).
- **Naruszony kontrakt:** dane odbiorowe muszą przejść przez ten sam backend, tenant/auth i persistence/readback co produkt; sample data służą oglądaniu, nie akceptacji.
- **Wpływ:** ekran może wyglądać poprawnie na mocku, a nie działać po zapisie, ponownym logowaniu lub zmianie organizacji.
- **Bramka domknięcia:** deterministyczny owner fixture zapisuje Initiative + Plan draft/published + co najmniej dwie Capacity analyses + report run; manifest zawiera ID i expected versions; browser używa backendu bez `sampleData`; cold restart/readback i tenant isolation przechodzą.

### INI-METH-010 — pokrycie statusów i stanów granicznych pozostaje niepełne

- **Priorytet:** `P2`
- **Dowód:** `MODULE_ACCEPTANCE.md:28` (`G10 PARTIAL`) opisuje 11 rekordów, ale stany terminal/empty/error/permission pozostają pending; `INI-OWN-005` ma owner retest pending (`MODULE_ACCEPTANCE.md:75`).
- **Naruszony kontrakt:** rejestr musi prawdziwie obsługiwać pełny lifecycle, nie tylko happy path i showcase.
- **Wpływ:** archiwizacja, denied access, stale data i błędy mogą zniknąć z licznika albo prowadzić do nielegalnych akcji.
- **Bramka domknięcia:** fixture obejmuje draft, decision, approved backlog, planned, in execution, results, closed, cancelled/archived, denied persona, stale source i backend error; liczniki sumują się do widocznego mianownika; niedozwolone akcje są ukryte/wyjaśnione i nie wykonują requestu.

### INI-METH-011 — karta inicjatywy ma szeroki katalog, ale minimalny produkt nie jest zamrożony dowodem

- **Priorytet:** `P2`
- **Dowód:** `MODULE_ACCEPTANCE.md:72-73` rejestruje 27 kart i minimalny kontrakt 7 kart, ale skład runtime i akceptacja wizualna są nieudowodnione. `InitiativeDocumentView.tsx` zawiera liczne sekcje AI, governance, RAID, finance i komentarze.
- **Naruszony kontrakt:** każda inicjatywa ma stabilny rdzeń; karty opcjonalne wynikają z typu/poziomu i konfiguracji, bez powielonych źródeł prawdy.
- **Wpływ:** bogactwo funkcji może ponownie stworzyć przeładowany workspace, różne warianty karty i regresje nawigacji.
- **Bramka domknięcia:** dla każdego poziomu Initiative udokumentować dokładny minimalny zestaw, opcjonalne karty i źródło danych; cold link otwiera tę samą konfigurację; jedna sekcja ma jednego właściciela danych; owner ocenia desktop/tablet, PL/EN i preview/edit.

### INI-METH-012 — standard preview/menu jest technicznie użyty, lecz nie zaakceptowany

- **Priorytet:** `P2`
- **Dowód:** Plan i Capacity używają `StandardTable` oraz `TableWithPreviewLayout`; owner finding `INI-OWN-009` pozostaje `REGISTERED / SHARED-COMPONENT AUDIT_PENDING` (`MODULE_ACCEPTANCE.md:79`).
- **Naruszony kontrakt:** full-height preview od Menu 3 do dołu, zwięzłe standardowe row menu, brak ściany disabled actions i brak duplikatów.
- **Wpływ:** wspólny komponent nie gwarantuje poprawnego składu konkretnego ekranu.
- **Bramka domknięcia:** aktualne screenshoty exact SHA dla register/plan/capacity w desktop/tablet i dwóch themes; geometryczna kontrola preview; row menu ma tylko działające, kontekstowe akcje; owner wydaje jawne ACCEPT/REWORK dla każdego ekranu.

## Mocne elementy, których nie należy przebudowywać bez dowodu

- Domenowe rozdzielenie Initiative, Plan Scenario, Capacity Scenario, schedule gate, Execution case i report run.
- Optymistyczne wersjonowanie, client request ID i jawne transitiony w backendzie.
- Zasada: publikacja scenariusza nie mutuje dat źródłowej inicjatywy (`PlanScenarioSurface.tsx:1026-1029`).
- Zakresy low/base/high oraz confidence zamiast fałszywej minutowej precyzji w Capacity.
- Osobne kroki resource commitment, assignee acceptance i Resource Manager decision.
- Historia/diff i zasada supersede zamiast destrukcyjnego delete.

## Minimalna kolejność wdrożeniowa

1. **P0 identity spine:** exact Initiatives → schedule gate → Execution replay z readback.
2. **P1 creation:** jeden AI-assisted create flow z source, assumptions i idempotencją.
3. **P1 Plan:** registry + include/exclude/status filters + tygodniowy draggable Gantt + proposal-only AI.
4. **P1 Capacity:** plan-bound multi-analysis + czytelna saturacja + proposal-only AI.
5. **P1 reports:** immutable runy powiązane z dokładnymi source versions.
6. **P2 acceptance:** status boundaries, card minimal set, preview/menu, PL/EN/tablet/themes.
7. Dopiero wtedy G16–G20 i owner acceptance na zamrożonym SHA.

## Warunki uczciwego zamknięcia

- Kod domenowy lub test jednostkowy nie zastępuje browser readback.
- `sampleData`/demo fixture nie zastępuje persistence.
- Screenshot nie zastępuje dowodu zapisu, retry i cold reopen.
- Istnienie endpointu nie oznacza dostępnej funkcji użytkownika.
- Brak błędu nie oznacza kompletnego flow.
- Każdy brak wymieniony w raporcie pozostaje `UNKNOWN` albo `NO-GO`, dopóki nie ma wskazanej bramki i jej artefaktu.
