---
agreement_id: MOD-AGR-11
module: Tools
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
accepted_by:
accepted_at:
last_reviewed: 2026-07-31
---

# Karta uzgodnienia — Tools

## 1. Definicja

Tools jest biblioteką i środowiskiem pracy z metodami konsultingowymi. Pomaga
użytkownikowi prawidłowo sformułować problem, zebrać evidence, przeprowadzić
ustrukturyzowaną analizę, wyciągnąć insights, zaprojektować warianty działania i
przekazać zatwierdzony wynik do dalszej pracy.

Tools nie jest zbiorem formularzy ani automatycznym generatorem odpowiedzi.
Każda metoda ma prowadzić widoczną współpracę człowieka z Teresą i kończyć się
wynikiem wspierającym decyzję.

Granice:

- Assessment wykonuje zamknięte, licencjonowane badanie dojrzałości;
- Audits prowadzi formalne postępowania audytowe;
- Interview zbiera i waliduje wiedzę od respondentów;
- Tools prowadzi elastyczną pracę metodą konsultingową;
- Materials publikuje końcowe raporty/decki/arkusze;
- Initiatives zarządza Initiative dopiero po Source Validation Proposal Draftu.

## 2. Pytanie modułu

> Jaką metodą najlepiej przeanalizować ten problem, co wynika z evidence i co
> użytkownik powinien zrobić dalej?

## 3. Pięć głównych powierzchni

1. **Library** — katalog metod, wybór właściwego narzędzia i start.
2. **Processes** — Tool Sessions: cała trwająca, niezatwierdzona praca nad
   narzędziem.
3. **Outputs** — zatwierdzone, sfinalizowane i nieedytowalne wyniki narzędzi w
   natywnej formie aplikacji.
4. **Deliverables** — raporty, prezentacje, arkusze i inne artefakty wygenerowane
   z zatwierdzonych Outputs.
5. **Initiatives** — lokalne Initiative Proposal Drafts wynikające z
   zatwierdzonych wniosków Tools.

Rekomendowana kolejność menu jest zgodna z dojrzewaniem pracy:

`wybierz metodę → pracuj → zatwierdź wynik → opakuj wynik → zaproponuj zmianę`

Assessment nie jest zakładką Tools. Megatrends może być metodą/kontekstem w
Library, ale nie powinno tworzyć równoległego modułu bez odrębnej decyzji.
Wspólny standard Libraries opisuje
[`METHOD_LIBRARY_FIRST_STANDARD.md`](METHOD_LIBRARY_FIRST_STANDARD.md).
Pełny standard pięciu powierzchni opisuje
[`METHOD_MODULE_FIVE_SURFACES_STANDARD.md`](METHOD_MODULE_FIVE_SURFACES_STANDARD.md).

### 3.1 Granica między powierzchniami

| Powierzchnia | Edytowalność | Kanoniczny obiekt | Odpowiada na pytanie |
| --- | --- | --- | --- |
| Library | definicje tylko dla Catalog Admina | ToolDefinition/version | Jakiej metody użyć? |
| Processes | tak, do finalizacji | ToolSession/draft version | Nad czym i jak teraz pracujemy? |
| Outputs | nie; korekta tworzy nową wersję/reopen session | Finalized ToolOutput | Co zostało zatwierdzone jako wynik analizy? |
| Deliverables | edycja przez workflow Materials | Material/Artifact linked to Output | Jak opakowaliśmy i udostępniamy wynik? |
| Initiatives | edycja lokalnego Proposal Draft do Source Validation | Initiative Proposal Draft | Jaką zmianę warto rozważyć na podstawie wyniku? |

Nie przenosimy jednego rekordu przez pięć tabel. Każda powierzchnia posiada
inny obiekt i trwałe relacje między wersjami.

## 4. Library

### Cel

Pomóc użytkownikowi wybrać właściwą metodę, a nie tylko przeglądać nazwy
frameworków.

### Funkcje

- wyszukiwanie, kategorie, cele, branże, role i problem-to-solve;
- widoki `Recommended for me/project`, Favorites, Recent i All;
- opis: kiedy użyć, kiedy nie używać, wymagane inputs, czas, uczestnicy,
  trudność, expected outputs i przykłady;
- preview grafiki i krótkiej demonstracji;
- porównanie metod side-by-side;
- `Ask Teresa to recommend a tool` z uzasadnieniem i alternatywami;
- sprawdzenie dostępności/licencji/permissions;
- start nowej sesji albo użycie zatwierdzonego template;
- status metody: production-ready, pilot, beta, unavailable;
- jawny zakres możliwości AI i wymaganych approvals.

### Teresa

Analizuje cel, decyzję, etap projektu, dostępne evidence, czas i oczekiwany
output. Rekomenduje maksymalnie kilka metod, wyjaśnia trade-offs i może
zaproponować pracę bez narzędzia, jeżeli framework nie jest potrzebny.

## 5. Processes — Tool Sessions

### Cel

Zarządzać całym życiem analizy: draft, wspólna praca, review, finalizacja,
wznowienie, wersje i read-back.

### Funkcje

- tabela z tool, title, project, owner, participants, phase, status, readiness,
  updated, output state i next action;
- filtry po narzędziu, projekcie, ownerze, statusie, czasie i readiness;
- Draft, Active, Needs input, In review, Finalized, Superseded i Archived;
- autosave, resume, duplicate-as-new, version history i compare;
- zaproszenia oraz role session owner/contributor/reviewer/observer;
- presence, comments, proposal queue i safe concurrent editing;
- source/evidence freshness i degraded states;
- reopen przez nową wersję, nie nadpisanie finalized snapshotu;
- otwarcie Tool Session Workspace.

## 6. Tool Session Workspace

Pełny, powtarzalny standard shellu, nawigacji, kolorów, Canvas, dwóch trybów
pracy, panelu Teresy, Method Knowledge Pack, AI runtime, jakości i adoption gate
opisuje
[`TOOL_SESSION_WORKSPACE_STANDARD.md`](TOOL_SESSION_WORKSPACE_STANDARD.md).
Model `Tool Artifact`, wspólny kontrakt templates, Visual Manifest i AI
Capability Manifest opisuje
[`TOOL_ARTIFACT_TYPE_CONTRACT.md`](TOOL_ARTIFACT_TYPE_CONTRACT.md).
Katalog wszystkich funkcji wspólnych i standard późniejszego task breakdown
opisuje
[`TOOL_ARTIFACT_FUNCTION_CATALOG.md`](TOOL_ARTIFACT_FUNCTION_CATALOG.md).

Workspace jest widokiem konkretnej sesji, nie dodatkową zakładką modułu.

Wspólny shell:

`Header → Properties → Actions → Phase navigation + Main Canvas + Teresa panel`

Canvas ma być elastycznym środowiskiem podobnym w ergonomii do nowoczesnego
Canvas AI: wspólna praca na treści, selekcja i lokalna edycja, propozycje/diff,
wersje, undo, komentarze, tabele, diagramy, wykresy i native blocks. Nie może
jednak tworzyć drugiego niezależnego Business Work Canvas — wykorzystuje ten
sam platformowy engine i zapisuje wynik w ToolSession.

Pięć wspólnych faz:

1. **Mission & Context** — pytanie decyzyjne, scope, horizon, sukces,
   assumptions i constraints.
2. **Input & Exploration** — evidence z rozmów, materiałów, danych, benchmarków
   i wiedzy organizacji.
3. **Tool Build** — struktura specyficzna dla metody.
4. **Synthesis & Insights** — tensions, implications, trade-offs, conclusions i
   candidate moves.
5. **Outputs & Actions** — review, finalizacja oraz wybór dalszych obiektów.

Metoda może mieć własne kroki wewnątrz faz, ale nie tworzy osobnego shellu,
ukrytego generatora ani niespójnego workflow.

## 7. Human–AI contract

Teresa pracuje w pętli:

`frame → ask why → gather evidence → propose → accept/edit/reject → challenge →
synthesize → verify → prepare output`

Musi być zawsze jasne:

- co pochodzi od użytkownika;
- co jest faktem, obserwacją, hipotezą i interpretacją;
- co Teresa proponuje;
- co zostało zaakceptowane;
- dlaczego pytanie jest zadawane teraz;
- jakich evidence brakuje;
- jaki jest confidence;
- co można bezpiecznie wygenerować dalej.

Teresa nie może po cichu zmieniać zaakceptowanej treści, finalizować sesji,
publikować outputu ani rejestrować Initiative.

## 8. Standard jakości Tool Session

Każda sesja jest oceniana jako PASS/WARNING/BLOCKER/N/A w wymiarach:

1. jasność pytania decyzyjnego;
2. adekwatność wybranej metody;
3. kompletność i jakość evidence;
4. poprawność zastosowania logiki metody;
5. oddzielenie faktów, assumptions i interpretacji;
6. obecność kontrdowodów i alternatyw;
7. jakość insights — nie tylko streszczenie inputs;
8. wykonalność recommended moves;
9. traceability insight/output do evidence;
10. gotowość downstream: Decision, Material, Proposal Draft albo keep as idea.

Wysoki wynik agregowany nie może ukryć blockera. Finalizacja wymaga braku
blockerów albo jawnie zaakceptowanego wyjątku z ownerem i reason.

## 9. Dynamic SWOT jako golden standard MVP

SWOT nie kończy się czterema listami. Proces:

1. decyzja/problem i scope;
2. evidence workbench;
3. Strengths/Weaknesses/Opportunities/Threats z provenance;
4. dedup, quality i challenge;
5. SO/WO/ST/WT correlations;
6. strategic tensions i implications;
7. warianty moves: attack, repair, defend, protect;
8. priorytety, trade-offs i evidence quality;
9. outputs i Initiative Proposal Drafts;
10. review/finalize.

SWOT jest gotowy dopiero, gdy użytkownik może przejść cały golden flow na
realnych danych, przerwać/wznowić, odrzucić sugestie AI, sfinalizować, wygenerować
output i przekazać Proposal Draft bez utraty traceability.

## 10. Outputs — zatwierdzony wynik narzędzia

### Cel

Pokazać zaakceptowany, sfinalizowany rezultat metody w natywnej formie aplikacji.
Output jest dowodem tego, co uzgodniono w konkretnej wersji sesji.

Przykładowe native outputs:

- Final Source Summary;
- executive summary;
- diagram/table/model;
- SWOT matrix i correlations;
- insights, tensions i conclusions;
- recommended moves;
- Decision Brief content package;
- output-specific structured data.

Output posiada ToolSession/version, ownera, reviewer/finalization decision,
source links, accepted evidence, generated/proposed lineage, freshness,
visibility i quality review.

Po finalizacji:

- Output jest read-only;
- poprawka wymaga `Create revised session/version`, nie edycji snapshotu;
- użytkownik może otworzyć strukturę, evidence i historię;
- może utworzyć Deliverable, Proposal Draft albo oba;
- może oznaczyć wynik `Superseded`, ale nie usuwa audit history.

### 10.1 Finalizacja Session → Output

1. Session Owner uruchamia quality/readiness review.
2. Braki wracają do Processes/Tool Session jako Tasks/Suggested Changes.
3. Uprawniony reviewer/owner zatwierdza zgodnie z profilem.
4. System zapisuje immutable ToolSession snapshot.
5. Powstaje dokładnie jeden wersjonowany ToolOutput dla zatwierdzonej wersji.
6. Processes pokazuje read-back `Finalized`; Output pojawia się w Outputs.
7. Awaria materializacji pozostawia status `Finalization failed` z retry — nie
   może udawać poprawnego Outputu.

## 11. Deliverables — raporty, prezentacje i inne artefakty

### Cel

Pokazać, co zostało wygenerowane z Outputs dla konkretnego odbiorcy i celu:
przeczytać, przedstawić, podjąć decyzję, udostępnić lub pobrać.

Rekomendowana nazwa produktowa to **Deliverables**, ponieważ `Reports` nie
obejmuje prezentacji, arkuszy, diagramów ani przyszłych formatów. Jeżeli UI ma
pozostać prostsze językowo, etykieta może brzmieć `Reports & Presentations`, ale
model danych nadal jest wspólnym Deliverable/Material.

### Typy

- report/document;
- presentation/deck;
- spreadsheet/model;
- infographic/diagram;
- executive memo/Decision Pack;
- export PDF/DOCX/PPTX/XLSX;
- shareable link i presentation mode.

### Funkcje

- generator rozpoczyna od Setup/Summary: audience, purpose, scope, language,
  tone, format, assumptions i plan zawartości;
- użytkownik zatwierdza outline/założenia przed produkcją;
- wybór zatwierdzonego template i brand kit;
- status: Draft, In review, Approved, Published, Superseded, Failed;
- preview, edit, comments, compare, approval, publish, download i share;
- source panel pokazuje Output/version i evidence;
- wiele Deliverables może powstać z jednego Outputu;
- jeden Deliverable może użyć wielu Outputs, jeśli zachowuje source mapping;
- read-back do Tools po utworzeniu/publikacji;
- brak ukrytego eksportu albo publikacji przez AI.

Materials jest właścicielem artefaktu. Zakładka Deliverables w Tools jest
filtrowaną projekcją materiałów mających source relation do ToolOutput. Nie
utrzymuje kopii dokumentu, decku ani arkusza.

### Teresa

Rekomenduje format adekwatny do odbiorcy i celu, przygotowuje outline, generuje
draft przez właściwy generator, sprawdza zgodność z Outputem i wskazuje
unsupported claims. Nie może zmienić finalized Outputu, opublikować ani wysłać
materiału bez approval.

## 12. Initiatives — granica

Zakładka pokazuje tylko Proposal Drafts powstałe z Tool Sessions i ich lineage.
Nie pokazuje pełnego rejestru Initiatives.

Teresa może wygenerować zero, jeden lub kilka draftów z accepted moves. Nie
powinna na siłę tworzyć Initiative z każdego insightu. Każdy draft ma source
session/version, evidence, problem, outcome, scope, KPI proposal, assumptions,
risks i confidence.

Akcje: edit, link evidence, send to Candidates, view validation state i open
registered Initiative after handoff. Source Validation oraz dalszy lifecycle są
zgodne z `INITIATIVE_END_TO_END_LIFECYCLE.md`.

### 12.1 Relacja z Deliverables

Logiczna kolejność zakładek umieszcza Deliverables przed Initiatives, ale
utworzenie raportu lub prezentacji nie jest obowiązkową bramką. Po Output
użytkownik może:

- wygenerować tylko Deliverable;
- utworzyć tylko Proposal Draft;
- zrobić oba;
- pozostawić Output bez dalszych działań.

Proposal Draft zawsze linkuje bezpośrednio do ToolOutput/evidence. Może również
linkować Deliverable jako materiał komunikacyjny, ale raport nie zastępuje
źródła ani quality evidence.

## 13. Role i uprawnienia

- Catalog Admin — definitions, versions, availability i governance;
- Session Owner — scope, participants, review i submit to finalize;
- Contributor — edycja dozwolonych obszarów i evidence;
- Reviewer — suggested changes i final quality review;
- Observer — read/comment według policy;
- Teresa — assistant bez authority.

Project membership i App Role ograniczają dostęp. Consultant może prowadzić
sesję, ale nie otrzymuje approval authority z samej App Role.

## 14. Katalog metod i rollout

Repo posiada około 31 zasianych interactive toolTypes oraz szerszy katalog
templates, ale liczba wpisów nie oznacza gotowości produktu. Każda metoda ma
niezależny readiness:

- product/method specification;
- inputs, phases, objects i validation;
- Teresa behavior i prompts;
- knowledge/evidence pack;
- preview/example;
- output mapping;
- Proposal Draft mapping;
- permissions i governance;
- runtime implementation;
- unit/integration/E2E evidence.

MVP: Dynamic SWOT jako pełny wzorzec. Następne metody mogą być włączane dopiero
po przejściu adoption gate; niewalidowane pozycje są pilot/beta/unavailable,
nie udają gotowych.

## 15. Stan obecny

### Mamy

- DiscoveryToolsHub i powierzchnie Library/Sessions/Outputs/Initiatives;
- katalog 31 toolTypes i opisy/KB slugs;
- ToolSession, autosave/finalization fragments i output/handoff API;
- rozbudowany runtime Dynamic SWOT;
- pięciofazowy standard Strategy Tool Session;
- megatrends workspace;
- source links i część initiative generation.

### Luki i fragmentacja

- tylko Dynamic SWOT jest pełnym reference implementation;
- brak formalnego adoption gate dla pozostałych metod;
- wiele pozycji bez graphics, video, knowledge packs i output mapping;
- sesje nie mają pełnego multiplayer/version/replay;
- Tool AI nie jest wszędzie spięte z jednolitym approval/prompt/provenance spine;
- historyczne dokumenty mieszają Tools z Assessment;
- deklarowane testy funkcji nie zastępują pełnego E2E całej sesji;
- Canvas/Tool runtime może dryfować względem kanonicznego Work Canvas engine.

## 16. Golden flow staging

`Library → Teresa recommends Dynamic SWOT → Session → Mission → evidence →
SWOT build → correlations/tensions → moves → quality review → finalize →
immutable Output → optional Deliverable in Materials + optional Proposal Draft
to Candidates → read-back`

Flow musi obejmować autosave/resume, reject-no-write, accepted suggestion,
permission denial, stale evidence, failed handoff i bezpieczny retry.

## 17. Kryteria ukończenia MVP

- pięć powierzchni ma odrębny cel i nie miesza Assessment;
- Library pomaga wybrać metodę, nie tylko ją wyświetla;
- Dynamic SWOT przechodzi pełne pięć faz na realnej sesji;
- zaakceptowane i proponowane treści są rozróżnione;
- każdy insight i output ma evidence/provenance;
- Teresa pokazuje rolę, cel, braki, confidence i preview;
- autosave/resume/version/finalized snapshot działają;
- finalized sesja nie jest nadpisywana;
- finalizacja tworzy immutable Output z read-backiem;
- Deliverable jest projekcją artefaktu Materials i nie kopiuje jego danych;
- raport/prezentacja nie jest obowiązkowym warunkiem Proposal Draft;
- Initiative tworzy wyłącznie Proposal Draft i przekazuje go do Candidates;
- AI nie finalizuje, nie publikuje i nie rejestruje Initiative;
- error/degraded/empty/loading/success są jawne;
- permissions są backend-owned;
- golden E2E obejmuje happy path oraz failure/retry.

## 18. Pytania do właściciela

1. Czy zatwierdzamy pięć powierzchni: Library, Processes, Outputs, Deliverables,
   Initiatives?
2. Czy etykieta ma brzmieć `Deliverables`, `Reports & Presentations` czy
   `Materials` przy zachowaniu tego samego modelu?
3. Czy MVP odbieramy na jednym pełnym Dynamic SWOT, a pozostałe metody
   pokazujemy według faktycznego readiness?
4. Czy finalizacja sesji wymaga zawsze oddzielnego Reviewera, czy w profilu
   lightweight Session Owner może self-finalize?
5. Czy Tool Session może działać bez projektu jako prywatny draft, ale wymaga
   projektu przed wspólną pracą/output/handoff?
6. Czy Megatrends pozostaje metodą/kontekstem w Tools, zamiast odrębnej głównej
   powierzchni?
