---
agreement_id: MOD-AGR-09
module: Initiatives
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
accepted_by:
accepted_at:
last_reviewed: 2026-07-31
superseded_in_scope_by: ../../../modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md
---

# Karta uzgodnienia — Initiatives

> **CURRENT TARGET OVERRIDE (2026-08-09):** Menu 2, dwanaście głównych business lifecycle states, niezależne gate/readiness/disposition/health/effectiveness oraz szczegółowe funkcje definiuje [`docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`](../../../modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md). Pozostałe granice i rationale tej karty zachowują wartość, o ile nie konkurują z nowym kanonem.

## 1. Definicja

**Initiatives** jest systemem podejmowania decyzji o zmianach, które
organizacja może podjąć. Zamienia problem, szansę, insight, rekomendację albo
wynik analizy w porównywalną propozycję, pomaga zdecydować, co warto zrobić,
ustala priorytet oraz przygotowuje zatwierdzoną Initiative do wykonania.

Moduł nie jest listą projektów w realizacji. Do momentu decyzji zarządza
propozycją i uzasadnieniem zmiany. Po zatwierdzeniu przekazuje ją do Execution,
zachowując trwały link i możliwość śledzenia wykonania oraz rezultatów.

## 2. Pytanie, na które odpowiada moduł

> Co powinniśmy zrobić, dlaczego właśnie to, w jakiej kolejności i na jakiej
> podstawie podejmujemy tę decyzję?

Granice:

- Chat, Interview, Tools, Assessment, Audits, Finance i Results mogą tworzyć
  kandydatów;
- Initiatives ocenia, porządkuje, łączy i prowadzi decyzję;
- Finance posiada modele i wartości finansowe;
- Results posiada KPI, baseline, target i actual;
- Execution posiada plan oraz wykonanie;
- Materials publikuje zatwierdzone materiały.

## 3. Kanoniczny przepływ i granica rejestracji

`Source work → Initiative Proposal Draft → Source Validation Gate → Registered
Initiative → Definition → Analysis → Portfolio Decision → Approved Backlog →
Scheduling Gate → Execution → Delivery Acceptance → KPI/Benefit Supervision →
Effectiveness Closure`

### 3.1 Dwa poziomy obiektu

1. **Initiative Proposal Draft** powstaje w zakładce `Initiatives` modułu
   źródłowego: Tools, Assessment, Audits, Interview, Finance lub Results/KPI.
   Jest roboczą koncepcją należącą do źródła, widoczną autorom, przypisanym
   reviewerom i uprawnionym ownerom źródła. Nie znajduje się jeszcze w
   organizacyjnym rejestrze Initiatives i nie konkuruje o capacity.
2. **Registered Initiative** powstaje dopiero po pierwszej walidacji. Otrzymuje
   kanoniczne `initiativeId`, widoczność wynikającą z projektu/organizacji,
   governance, lifecycle, karty i miejsce w rejestrze Initiatives.

Granica jest nieprzekraczalna: wygenerowanie propozycji przez AI, zakończenie
Tool/Assessment/Audit albo zapis analizy Finance nie rejestruje automatycznie
Initiative. Teresa może przygotować draft i walidację, lecz uprawniony człowiek
wykonuje `Register as Initiative`, `Merge`, `Extend`, `Return`, `Defer` albo
`Dismiss`.

Wszystkie moduły źródłowe korzystają z jednego
[`Initiative Proposal Generatora`](INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md)
oraz wspólnego
[`standardu artefaktu AI Generator`](AI_GENERATOR_ARTIFACT_STANDARD.md).
Różnią się adapterem wejściowym, lecz nie formatem Proposal Draft, bramkami ani
regułami zapisu.

### 3.2 Minimalna walidacja źródłowa

Draft może przejść do wspólnego rejestru, gdy ma:

- źródło, wersję, evidence i provenance;
- zrozumiały problem lub szansę;
- proponowany rezultat, nie wyłącznie działanie;
- wstępny scope oraz dotkniętą jednostkę/proces;
- propozycję ownera i widoczności;
- wstępne KPI lub sposób ustalenia sukcesu;
- jawne assumptions, ryzyka, zależności i braki;
- kontrolę duplikatu/overlapu z zarejestrowanym portfelem;
- ocenę `worth further analysis`, a nie obietnicę zatwierdzenia.

Walidacja nie wymaga kompletnego Investment Case ani planu wykonania. Jej
celem jest odfiltrowanie szumu i dopuszczenie wartościowej koncepcji do
kontrolowanej pracy nad Initiative.

## 4. Pierwsza zakładka — List

Pierwszą i domyślną zakładką oraz pierwszą funkcją modułu jest **List**: jedna
tabela wszystkich Initiative dostępnych użytkownikowi, niezależnie od ich
statusu.

Minimalne kolumny:

- nazwa;
- status i gate;
- typ;
- właściciel;
- źródło;
- problem/szansa;
- oczekiwany wpływ;
- strategic alignment;
- priority/score;
- koszt i wartość z Finance;
- target date;
- readiness;
- next decision/action.

Tabela wspiera filtrowanie, grupowanie, sortowanie, zapisane widoki, bulk
selection, StandardPreview i Menu 3. Kliknięcie otwiera preview, a pełna karta
Initiative otwiera się jako workspace.

Obsługiwane grupy statusów:

- pipeline: `Candidate`, `Draft`, `Defined`, `Analyzing`, `Ready for review`;
- decision: `Approved`, `Rejected`, `Deferred`, `Merged`;
- delivery: `In execution`, `Completed`, `Stopped`;
- history: `Archived`.

Statusy nie tworzą osobnych źródeł ani osobnych tabel. Są filtrami i zapisanymi
widokami tego samego rejestru.

## 5. Kanoniczne obszary

Pełny kontrakt funkcji, zależności oraz sposobu pracy wszystkich pięciu
powierzchni opisuje
[`INITIATIVES_FIVE_SURFACES_OPERATING_MODEL.md`](INITIATIVES_FIVE_SURFACES_OPERATING_MODEL.md).

1. **List** — rejestr wszystkich Initiative.
2. **Candidates** — inbox propozycji pochodzących ze wszystkich modułów.
3. **Portfolio** — merytoryczna analiza, porównanie, priorytety i alokacja
   ograniczonych zasobów.
4. **Roadmap** — czasowa analiza i sekwencja zatwierdzonego portfela względem
   okresowej capacity oraz zależności.
5. **Decisions** — centrum blokujących i odblokowujących decyzji Initiative,
   projektów, programów i Portfolio, w tym Go/No-Go i gates.

Proposal Drafts w Candidates nie są widoczne w List, Portfolio ani Roadmap przed
`Register`, `Merge` lub `Extend`. Candidates posiada kontrolowaną funkcję `AI
Analysis` do grupowania, deduplikacji i rekomendowania losu propozycji.

Szczegóły Initiative nie są osobną zakładką najwyższego poziomu. Otwierają się
z listy, kandydata, portfolio, roadmapy albo deep linku.

## 6. Źródła i Initiative Proposal Draft

Każdy lokalny draft posiada:

- source module, object ID i version;
- problem, szansę lub rekomendację;
- evidence i provenance;
- proponowany rezultat;
- oczekiwany wpływ;
- proponowane KPI;
- ograniczenia, ryzyka i braki;
- autora lub system tworzący;
- confidence;
- status triage.

Drafty mogą pochodzić z:

- Insight w Chat lub Interview;
- wyniku Tool;
- rekomendacji Assessment lub Audit;
- wniosku z Finance;
- odchylenia w Results;
- ręcznego zgłoszenia użytkownika;
- materiału lub decyzji;
- Teresy, zawsze jako jawna propozycja do review.

Source Validation pozwala:

- `Register as new Initiative`;
- `Merge into registered Initiative`;
- `Extend registered Initiative`;
- `Return for clarification`;
- `Defer`;
- `Dismiss with reason`;

Każdy moduł źródłowy kończy swój przepływ zakładką `Initiatives`, pokazującą
wyłącznie Proposal Drafts wynikające z bieżącego obiektu/przebiegu oraz ich
status walidacji. Nie jest to kopia całego rejestru Initiatives.

## 7. Deduplikacja i spójność portfela

Przed utworzeniem draftu system wyszukuje:

- duplikaty;
- częściowe nakładanie zakresu;
- wspólne KPI;
- sprzeczne rozwiązania;
- konkurencję o te same zasoby;
- zależności i możliwe połączenie Initiative.

Teresa pokazuje podobieństwo, evidence i rekomendację, lecz użytkownik decyduje
o utworzeniu, połączeniu lub rozszerzeniu.

## 8. Karta Initiative i biblioteka kart

Initiative jest jednym obiektem, ale jej workspace składa się z kart/sekcji.
Nie istnieje jeden obowiązkowy zestaw dla wszystkich typów zmian. System
utrzymuje wersjonowaną bibliotekę co najmniej 26 kart:

1. Summary / Initiative Scope; 2. Strategic Fit; 3. Success Criteria;
4. Outcomes & Benefits; 5. KPI; 6. Options; 7. Financial Analysis;
8. Financial Impact; 9. People / Team; 10. Roles & RACI; 11. Stakeholders;
12. Resources & Capacity; 13. Dependencies; 14. Risk & RAID; 15. Milestones;
16. Timeline; 17. Tasks; 18. Decisions; 19. Gates & Approvals;
20. Feasibility & Completeness; 21. Change & Adoption;
22. Communication & Engagement; 23. Capabilities & Training;
24. Technical Specification; 25. Attachments & Materials;
26. Comments, Activity & History.

Pełne kontrakty wszystkich kart — cel, dane, właściciel prawdy, relacje,
workflow, AI, powiadomienia, ryzyko, approval i definition of done — są częścią
tego uzgodnienia w
[`INITIATIVE_CARD_FUNCTION_CATALOG.md`](INITIATIVE_CARD_FUNCTION_CATALOG.md).

### 8.1 Dobór kart przez Teresę

Teresa przygotowuje wyjaśnialny `Initiative Workspace Profile`: karty wymagane
przez gate/politykę, zalecane, opcjonalne i nieadekwatne. Bierze pod uwagę typ,
skalę, wartość, ryzyko, regulacje, wpływ na ludzi i technologię, źródło,
zależności oraz tryb realizacji. AI nie może ukryć karty wymaganej. Użytkownik
może dodać kartę z biblioteki i ukryć opcjonalną; ukrycie rekomendowanej wymaga
powodu. W MVP nie tworzymy nowych typów kart swobodnym promptem.

Workspace pokazuje najpierw karty aktywne/wymagane, readiness i następny krok,
a nie 26 równorzędnych zakładek. Pełna biblioteka jest dostępna przez
`Add card / Configure workspace`.

### 8.2 Wspólny kontrakt operacyjny

Każda karta może generować lub wiązać Task, Decision, Risk/RAID, KPI,
Notification i Suggested Change, ale nie tworzy ich lokalnych kopii. Obiekty
mają stabilne ID, właściciela domenowego, provenance, status i deep link.
AI zapisuje tylko propozycję; zapis kanoniczny wymaga uprawnienia, widocznego
preview oraz approval odpowiedniego do wpływu.

## 8.3 Role, zadania i odpowiedzialność

Pełny model tworzenia zespołów, członkostwa, staffing, przypisań, authority,
capacity i resolvera uprawnień opisuje
[`PROJECT_TEAM_ROLES_AND_PIPELINE_GOVERNANCE.md`](PROJECT_TEAM_ROLES_AND_PIPELINE_GOVERNANCE.md).

Minimalne role to Sponsor, Initiative Owner, Business/Benefit Owner,
Project/Execution Manager, Workstream Owner, Task Owner, Decision
Owner/Approver, KPI Owner, Change Owner oraz PMO/Transformation Office. Każdy
wynik, task, decyzja, KPI, ryzyko i gate ma jednego `Accountable Owner`; może
mieć wielu `Responsible`. Initiative Owner nie staje się automatycznie
właścicielem wszystkich prac.

RACI dotyczy konkretnych deliverables, gates, decyzji i workstreamów. Przed
zatwierdzeniem Initiatives posiada zadania discovery/definition. Po handoff
zadania realizacyjne należą do Execution, a Initiative i My Work pokazują ich
synchronizowaną projekcję. Nie wolno tworzyć niezależnych kopii tego samego
zadania.

## 9. Scoring i priorytetyzacja

Scoring ma wspierać decyzję, nie ją automatyzować. Organizacja może wersjonować
model kryteriów, przykładowo:

- strategic alignment;
- expected impact;
- customer/employee value;
- urgency;
- regulatory or risk reduction;
- feasibility;
- evidence quality;
- cost;
- resource demand;
- time to value;
- dependency complexity;
- confidence.

Każdy wynik wskazuje:

- kryteria i ich wagi;
- wartości wejściowe;
- autora lub źródło;
- wersję modelu;
- confidence;
- wyjaśnienie.

Zmiana wag przelicza scenariusz, ale nie nadpisuje score użytego w historycznej
decyzji.

## 10. Portfolio

Portfolio służy podejmowaniu decyzji między Initiative. Pokazuje:

- wartość i koszt;
- strategic alignment;
- ryzyko i confidence;
- capacity i skill demand;
- zależności;
- terminy i time to value;
- balans typów zmian;
- scenariusze budżetowe i zasobowe;
- approved, proposed, deferred i stopped.

Użytkownik może tworzyć scenariusze `what-if`, lecz publikacja zmienionego
priorytetu lub roadmapy wymaga review zgodnego z governance.

## 11. Projekty, programy i Roadmap

Każda Initiative dopuszczona do szczegółowej analizy ma projekt. Organizacja,
która nie potrzebuje podziału, używa jawnego `General / Transformation
Backlog`, nie pustej wartości. Projekt jest kontenerem governance, zespołu,
capacity i raportowania; może zawierać wiele Initiative. Program grupuje wiele
projektów. List, Portfolio i Roadmap filtrują i grupują po projekcie, programie,
workstreamie, source cohort, właścicielu, statusie i terminie.

Nowy Assessment, Audit albo Tool może wytworzyć kolejną pulę kandydatów przy
istniejącym portfelu. System zachowuje source cohort, wykrywa duplikaty i overlap
z całym portfelem oraz proponuje: merge, extend, replace, create albo dismiss.

Roadmap nie jest kopią planu Execution. Pokazuje strategiczne położenie
Initiative, planowane okno, zależności, gates i oczekiwany czas dostarczenia.
Szczegółowe tasks, critical path i actual wykonania należą do Execution.

Roadmap obsługuje:

- timeline;
- now/next/later;
- kwartały i strategic horizons;
- programy i workstreams;
- dependencies;
- scenario compare;
- status decyzji i readiness.

## 12. Governance, statusy i stage gates

Pełna ścieżka z granicami odpowiedzialności, widocznością, ownerem prawdy i
bramkami od źródła do nadzoru rezultatów znajduje się w
[`INITIATIVE_END_TO_END_LIFECYCLE.md`](INITIATIVE_END_TO_END_LIFECYCLE.md).
Profil domyślny `SIMPLE`, rozszerzone warianty, progi eskalacji i konfigurację
Admin/Teresa opisuje
[`INITIATIVE_APPROVAL_GOVERNANCE_PROFILES.md`](INITIATIVE_APPROVAL_GOVERNANCE_PROFILES.md).

| Status biznesowy | Znaczenie | Warunek wyjścia |
| --- | --- | --- |
| `Candidate` | Niezatwierdzona propozycja ze źródła. | Triage: draft, merge, defer lub dismiss. |
| `Draft` | Formułowanie problemu, wyniku, źródeł i ownera. | Minimalny brief i Initiative Owner. |
| `Defined` | Uzgodniony scope, success criteria, warianty i relacje. | Definition review bez krytycznych luk. |
| `Analyzing` | Wartość, kompletność, wykonalność, capacity, change i ryzyko. | Profil wymaganych kart jest kompletny. |
| `Ready for review` | Wersjonowany snapshot gotowy do decyzji. | Approve, reject, defer, merge lub return. |
| `Approved backlog` | Zatwierdzona merytorycznie, jeszcze bez zobowiązania czasowego. | Capacity i schedule review. |
| `Scheduled` | Ma projekt, role, baseline window i potwierdzoną wykonalność. | Handoff do Execution. |
| `In execution` | Realizacja zarządzana w Execution. | Delivery acceptance lub stop. |
| `Completed` | Zakres dostarczony; trwa pomiar rezultatów. | Effectiveness/benefits review. |
| `Stopped` | Zatrzymana decyzją z oceną wpływu. | Restart, replacement lub archive. |
| `Rejected` | Odrzucona w określonym gate i wersji. | Nowe dowody tworzą nową wersję/candidate. |
| `Deferred` | Odłożona do daty/zdarzenia review. | Obowiązkowy review trigger. |
| `Merged` | Zakres przeniesiony do innej Initiative. | Read-only lineage. |
| `Archived` | Historyczna i tylko do odczytu. | Brak zwykłego wyjścia. |

Runtime ma dziś bardziej techniczny zestaw statusów. Przed implementacją
powstaje jedna jawna mapa status biznesowy ↔ runtime. UI nie miesza słowników.
`Approved backlog` i `Scheduled` pozostają rozdzielone: przypisanie terminu i
baseline capacity jest ostatnią decyzją dopuszczającą rozpoczęcie wykonania.

Gate może wymagać:

- kompletności karty;
- quality/evidence threshold;
- właściciela i sponsora;
- KPI contract;
- Finance Investment Case;
- potwierdzenia capacity;
- risk review;
- wskazanych approverów.

Decyzja zawiera rezultat, decydenta, datę, warunki, uzasadnienie i snapshot
informacji, na podstawie których została podjęta.

Każdy status definiuje właściciela następnego kroku, dostępne akcje, wymagane
karty, decydentów, SLA review, warunki wejścia/wyjścia, cofnięcie i alerty.
Teresa może przygotować przejście i ocenić readiness, ale nie zatwierdza gate.

## 12.1 Planowanie capacity i ochrona przed spiętrzeniem

Przed `Scheduled` system rozkłada Initiative na milestones, workstreams i effort,
identyfikuje role, skills i shared resources, uwzględnia aktywne projekty oraz
pracę nieprojektową i wykrywa konflikty, zależności oraz nierealną
wielozadaniowość. Teresa proponuje warianty: przesunięcie, sekwencjonowanie,
redukcję scope, zwiększenie capacity, podział albo rezygnację, pokazując wpływ
na termin, koszt, ryzyko i wartość. Użytkownik może planować ręcznie.

Wypełnione daty nie są dowodem wykonalności. Zmiana po zatwierdzeniu uruchamia
impact assessment, a naruszenie baseline/tolerancji wymaga decyzji rebaseline.

## 12.2 PMO / Transformation Office i change management

Pomiędzy Initiatives i Execution działa ciągła warstwa zarządcza: jeden
pipeline, język, stage gates i single source of truth; rytm action-oriented
review; wykrywanie overlapów, zależności i konfliktów zasobowych; coaching oraz
challenge nierealnych planów; decision briefs i eskalacje; zarządzanie adopcją,
komunikacją, kompetencjami i trwałością zmiany. PMO zapewnia proces i
przejrzystość, ale nie przejmuje odpowiedzialności Sponsorów i Ownerów.

## 13. Transfer do Execution

Approved Initiative tworzy `Execution Handoff Pack`:

- source Initiative i approved version;
- zakres i expected outcome;
- owner, sponsor i stakeholders;
- KPI contract;
- Investment Case link;
- constraints, risks i dependencies;
- decyzje oraz warunki approval;
- oczekiwane terminy;
- readiness gaps zaakceptowane jako wyjątki.

Handoff jest idempotentny. Ponowne uruchomienie otwiera istniejące Execution.
Initiative pokazuje read-back statusu wykonania, ale nie kopiuje jego tasków,
budżetowych actuals ani sygnałów.

## 14. Teresa

Szczegółowa instrukcja działania Teresy, `AI Analysis`, dziesięciowymiarowy
standard jakości i Quality Gates znajdują się w
[`INITIATIVE_AI_QUALITY_AND_OPERATING_PLAYBOOK.md`](INITIATIVE_AI_QUALITY_AND_OPERATING_PLAYBOOK.md).

Teresa:

- zamienia insight w Initiative Candidate;
- pomaga zdefiniować problem, rezultat i scope;
- wykrywa duplikaty i nakładanie;
- proponuje KPI oraz kieruje do Results;
- przygotowuje warianty rozwiązania, w tym `do nothing`;
- proponuje scoring z pełnym wyjaśnieniem;
- challenge'uje słabe dowody, brak ownera i nierealne założenia;
- przygotowuje portfolio comparison i decision brief;
- pilnuje braków readiness i terminów review;
- tworzy handoff draft do Execution.

Teresa nie:

- zatwierdza Initiative;
- wybiera priorytetu bez decyzji człowieka;
- tworzy wartości finansowych poza Finance;
- potwierdza capacity bez danych;
- ukrywa niepewności i braków;
- zmienia historycznego snapshotu decyzji.

Wspólny kontrakt AI Initiatives–Execution opisuje
[`TERESA_INITIATIVE_TO_EXECUTION_AI_SYSTEM.md`](TERESA_INITIATIVE_TO_EXECUTION_AI_SYSTEM.md).

Przed gate Teresa tworzy pełny `Initiative Sense Review` oraz `Feasibility
Analysis`: bada realność problemu, siłę dowodów, przyczynę, wariant `do
nothing`, alternatywy, koszt niewykonania, strategic alignment, finansowanie,
capacity, kompetencje, zależności, ryzyka i możliwość prawidłowego pomiaru
efektu.

Po zatwierdzeniu powstaje `AI Handoff Snapshot`. Execution otrzymuje obietnicę,
wybrany wariant, odrzucone alternatywy, assumptions, warunki decyzji, KPI,
financial anchors i unresolved unknowns. Dzięki temu Teresa zarządza realizacją
w zgodzie z pierwotnym sensem Initiative.

## 15. Stan obecny

### Mamy

- `InitiativesHub` z domyślnym `list`;
- kanoniczny `InitiativeDocumentView` i starszy aktywny `InitiativeFullView`;
- Candidates, generator, similarity check, merge i extend;
- section generation oraz suggested changes;
- lifecycle, gates, roles i status history;
- KPI, RAID, resources, budget items, stakeholders i dependencies;
- Portfolio Health, timeline/roadmap i scoring;
- capacity, readiness i gate AI check;
- materializację portfolio lub Initiative do Materials;
- API planning/V8, write-truth i testy handoffu.

### Fragmentacja i ryzyka

- kilka pełnych widoków Initiative i duży komponent dokumentu;
- `/initiatives`, `/portfolio`, `/roadmap` oraz historyczne mapowania;
- kilka generatorów/proposal boards/candidate flows;
- lokalne KPI, resources, budget i ROI mogą dublować moduły właścicielskie;
- szeroki zakres V8 miesza runtime z aspiracjami;
- fallback/demo może maskować niepełne integracje;
- nie ma jednego udowodnionego pionu source → decision → Execution.

## 16. Najważniejsze scalenia

1. Jedna nazwa i wejście `/initiatives`.
2. Pierwsza zakładka `List`.
3. Jeden candidate inbox i triage.
4. Jeden similarity/dedup/merge contract.
5. Jedna kanoniczna karta Initiative.
6. Jedna biblioteka 26 kart i jeden mechanizm profili dobieranych przez AI.
7. Jeden lifecycle i gate model z jawną semantyką każdego statusu.
8. Jeden model projekt/program/workstream oraz capacity.
9. Jeden protokół Task–Decision–Risk–KPI–Notification.
10. Jeden scoring model registry.
11. Jedna prawda KPI w Results i Finance w Finance.
12. Jedna relacja portfolio/roadmap do Initiative.
13. Jeden idempotentny handoff do Execution.

## 17. Golden flow MVP

`Assessment/Tool/Interview/Finance finding → Initiative Candidate →
cross-portfolio dedup → Draft → AI workspace profile → definition and delegated
tasks/decisions → feasibility + risk + capacity + change review → KPI + Finance
links → portfolio decision → Approved backlog → project and schedule approval →
Scheduled → Execution Handoff → PMO read-back → outcomes`

## 17.1. Funkcje dodane po benchmarku

Szczegółowa analiza znajduje się w
[`INITIATIVES_MARKET_BENCHMARK.md`](INITIATIVES_MARKET_BENCHMARK.md).

Do kanonu Initiatives wchodzą również:

- Definition Playbook zależny od typu Initiative;
- obowiązkowe `do nothing`, risk of doing i risk of not doing;
- delegowane Analysis Tasks z read-backiem;
- stakeholder assessments i jawne rozbieżności;
- rank order oraz priority limit niezależne od score;
- confidence-adjusted prioritization i sensitivity wag;
- Portfolio Scenario Lab z budżetem, capacity i kompetencjami;
- incremental/stage funding oraz zwalnianie zasobów po stop/defer;
- portfolio hygiene i wykrywanie zombie Initiative;
- feedback do autora kandydata po decyzji i po uzyskaniu rezultatu;
- closed loop obietnica → wykonanie → rzeczywisty efekt.

## 18. Kryteria ukończenia

1. Każdy kandydat zachowuje source object i version.
2. Triage nie tworzy duplikatu bez jawnej decyzji.
3. Merge i extend zachowują provenance wszystkich źródeł.
4. Initiative ma jednoznacznego ownera i oczekiwany rezultat.
5. Scope rozróżnia in/out.
6. KPI jest linkiem do kanonicznego kontraktu Results.
7. Finance jest linkiem do właściwej wersji Investment Case.
8. Scoring wskazuje model, wagi, dane i confidence.
9. Portfolio porównuje Initiative na tej samej wersji kryteriów.
10. Roadmap nie kopiuje planu Execution.
11. Gate blokuje brak wymaganych danych.
12. Decyzja zachowuje immutable snapshot i uzasadnienie.
13. Teresa nie zatwierdza ani nie ukrywa niepewności.
14. Handoff do Execution jest idempotentny.
15. Read-back otwiera właściwy rekord Execution.
16. Rejected/Deferred/Merged mają powód i historię.
17. Cross-org odczyt i zapis są blokowane.
18. Golden flow przechodzi E2E na stagingu.
19. UI spełnia kanon list/table/preview/workspace/Menu 3.
20. Mock i fallback nie maskują błędów runtime.
21. `List` obejmuje wszystkie statusy w jednym rejestrze.
22. Autor kandydata otrzymuje informację o decyzji i jej przyczynie.
23. Brakującą analizę można zlecić właścicielowi jako Analysis Task.
24. Portfolio pokazuje rank oraz realny priority limit.
25. Scenariusz respektuje budżet, capacity i krytyczne kompetencje.
26. Stop/defer zwalnia zarezerwowane środki i capacity.
27. Portfolio review wykrywa nieaktualne oraz pozbawione ownera Initiative.
28. Outcome review porównuje obietnicę z rzeczywistym rezultatem.
29. Sense Review odróżnia fakt, assumption, hypothesis i recommendation.
30. Sense Review zawiera counter-evidence, `do nothing` i prostsze warianty.
31. Feasibility Analysis sprawdza czas, budżet, capacity, skills i KPI.
32. AI rekomendacja wskazuje confidence, expiry i wymagany approval.
33. Approved Initiative tworzy wersjonowany AI Handoff Snapshot.
34. Execution zachowuje ciągłość analizy zamiast rozpoczynać od zera.

## 19. Pytania do właściciela

1. Czy `List`, `Candidates`, `Portfolio`, `Roadmap`, `Decisions` są właściwymi
   obszarami najwyższego poziomu?
2. Czy każda Initiative wymaga wariantu `do nothing`?
3. Czy model scoringu jest jeden dla organizacji, czy organizacja może posiadać
   kilka modeli dla różnych typów Initiative?
4. Jakie minimalne gate wymagamy przed `Approved` w MVP?
5. Czy małe Initiative mogą przechodzić uproszczoną ścieżkę decyzji?
