---
document_id: TOOL-SESSION-WORKSPACE-STANDARD
module: Tools
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
reference_tool: Dynamic SWOT
---

# Tool Session Workspace — wspólny standard wszystkich narzędzi

## 1. Cel

Tool Session Workspace jest najważniejszym środowiskiem Tools. Prowadzi osobę,
która nie musi być konsultantem, przez metodę na poziomie jakości oczekiwanym od
doświadczonego zespołu doradczego. System nie udaje marki ani certyfikacji
Harvard/McKinsey; ma osiągać **consulting-grade quality** przez właściwą metodę,
wiedzę, evidence, challenge, review i traceability.

Standard zamraża to, czego użytkownik uczy się raz i potem rozpoznaje w każdym
narzędziu. Zmienna jest logika metody oraz zawartość Canvas, nie podstawowy
sposób pracy.

Kanoniczny model Tool jako typu artefaktu i kontrakt wszystkich templates
opisuje [`TOOL_ARTIFACT_TYPE_CONTRACT.md`](TOOL_ARTIFACT_TYPE_CONTRACT.md).

## 2. AS-IS — co już mamy

### Fundamenty

- `ToolDocumentView` jako główny runtime sesji;
- N-mode shell, header/properties/actions i sekcje utility;
- pięć faz Dynamic SWOT;
- osobne komponenty Mission/Input/SWOT/Insights/Outputs;
- centralny Tool Canvas oraz prawy `ToolContextPanel`;
- fazowe akcje AI i kontekstowy chat;
- jawne stany `ai-proposed`, `accepted`, `rejected`, `rethinking`;
- readiness faz i całej sesji;
- autosave/load, progress, comments, activity/history;
- source/evidence, final summary, outputs i initiative generation fragments;
- struktury kolejnych strategicznych i operacyjnych narzędzi;
- backendowe blokady współpracy dla ToolSession.

### Fragmentacja

- `ToolDocumentView`, `ToolWorkspace`, `GenericToolDocumentView` i starszy
  `ToolWizardView` częściowo konkurują o rolę runtime;
- `ToolDocumentView` jest bardzo dużym orkiestratorem łączącym shell, metodę,
  komentarze, AI, outputy i handoffy;
- nie wszystkie narzędzia korzystają z pięciofazowego kontraktu;
- część metod ma własne wizualne/stanujące konwencje;
- prawy panel bywa informacyjny zamiast prowadzić realną rozmowę i proposal loop;
- statusy proposal występują w kilku polach/kształtach danych;
- generic tool może wyglądać na gotowe mimo braku knowledge/method/output pack;
- brak jednego formalnego testu adopcji shellu i jakości metody.
- istnieją manual save i opóźniony autosave oraz `onClose`, ale brak jednego
  udowodnionego kontraktu zachowania dla wszystkich dróg wyjścia, browser Back,
  route change, refresh, offline i nieudanego zapisu;
- starszy `ToolHeader` pokazuje poziome kroki, a aktywny N-mode używa sekcji,
  przez co mentalny model nawigacji może zależeć od ścieżki wejścia.

Wniosek: nie budujemy nowego runtime od zera. Konsolidujemy istniejące elementy
w jeden `ToolSessionShell` i wydzielamy tool-specific plugins.

## 3. Niezmienne elementy każdego Workspace

Każde narzędzie posiada ten sam układ:

```text
Tool Header
Properties Strip
One Command Row
┌────────────────┬──────────────────────────────┬────────────────────┐
│ Phase Navigator│ Main Method Canvas           │ Teresa Collaboration│
│                │                              │ Panel              │
└────────────────┴──────────────────────────────┴────────────────────┘
Bottom status: save · version · participants · evidence freshness
```

### Header

- nazwa narzędzia i sesji;
- project, owner i status;
- tryb pracy `Guided Manual` / `Teresa-led`;
- save/freshness;
- review/finalize oraz Menu 3.

### Properties Strip

Stałe pola: Session ID, project, owner, participants, methodology version,
current phase, overall readiness, visibility i last saved. Tool-specific
parametry są dostępne w Setup/Canvas, nie rozpychają wspólnego headera.

### Command Row

Jedna linia akcji aktualnej fazy. Primary action jest jedna. AI actions są
opisane wynikiem (`Analyze evidence`, `Challenge matrix`, `Draft moves`), nie
ogólnym `AI`.

### Phase Navigator

Zawsze pięć głównych faz, w tej samej kolejności i lokalizacji. Każda pokazuje:

- nazwę i numer;
- not started / in progress / needs input / ready / approved / blocked;
- liczbę blockerów/warnings/proposals;
- accountable role;
- kliknięcie otwiera fazę bez utraty danych.

### Main Method Canvas

Jedyne miejsce edycji merytorycznej. Wspiera tekst, karty, tabele, macierze,
diagramy, wykresy, boardy, linki evidence i tool-specific native blocks.
Każdy blok ma source, owner, state, comments, AI proposal state i history.

### Teresa Collaboration Panel

Stała prawa kolumna; opis w rozdziale 8. Nie dubluje Canvas ani całego summary.

## 4. Pięć wspólnych faz

### 4.1 Mission & Context

**Cel:** ustalić, jaką decyzję/problem obsługuje sesja i czy metoda jest
adekwatna.

Stałe obiekty:

- decision question;
- business context i trigger;
- scope/out-of-scope;
- time horizon;
- success signal;
- participants/stakeholders;
- assumptions, constraints i known unknowns;
- method fit oraz kiedy nie używać narzędzia.

Gate: pytanie jest konkretne, metoda adekwatna, scope i owner zaakceptowane.

### 4.2 Input & Exploration

**Cel:** zbudować evidence workbench zamiast polegać na pamięci lub AI.

Stałe obiekty:

- source groups;
- signals/claims;
- fact / observation / hypothesis / opinion;
- provenance, freshness, confidence i access;
- accepted/proposed/needs-evidence/contradicted;
- missing evidence i research questions.

Gate: wystarczająca jakość i pokrycie źródeł dla metody; blockerów nie ukrywa
liczba sygnałów.

### 4.3 Tool Build

**Cel:** zastosować logikę konkretnej metody do zaakceptowanego evidence.

Stały shell i proposal semantics; zmienny tool-specific Canvas. Przykłady:
SWOT matrix, Value Chain, Five Forces, A3, BCG/portfolio matrix, process map.

Gate: metoda została zastosowana poprawnie, elementy są evidence-linked,
deduplicated i zaakceptowane na poziomie wymaganym do syntezy.

### 4.4 Synthesis & Insights

**Cel:** wygenerować nową wartość poznawczą, a nie streścić Tool Build.

Stałe obiekty:

- patterns/tensions;
- causal interpretation;
- contradictions i disconfirming evidence;
- implications;
- options/recommended moves;
- trade-offs i `what not to do`;
- confidence i applicability conditions.

Gate: insights są konkretne, wspierane evidence, mają konsekwencje i zostały
zaakceptowane/challenged przez człowieka.

### 4.5 Outputs & Actions

**Cel:** zamknąć merytorykę sesji oraz przygotować finalizację i downstream.

Stałe obiekty:

- final source summary;
- accepted insights/moves;
- quality/readiness review;
- output candidates;
- Deliverable candidates;
- Initiative Proposal Draft candidates;
- Decisions/Tasks/further research;
- unresolved limitations i exceptions.

Gate: review zakończony, blockerów brak lub wyjątki zatwierdzone; użytkownik
wykonuje `Finalize Session`, po czym powstaje immutable Output.

## 5. Dwa równorzędne tryby pracy

### 5.1 Guided Manual

Użytkownik sam przechodzi fazy, tworzy i edytuje elementy. Teresa:

- pokazuje instrukcję i przykłady;
- odpowiada na pytania;
- wykonuje akcję AI dopiero po wywołaniu;
- sygnalizuje braki i jakość w tle bez ukrytych zapisów;
- proponuje następny krok, ale nie przejmuje sesji.

Tryb jest dobry dla konsultanta, eksperta albo osoby chcącej pełnej kontroli.

### 5.2 Teresa-led

Teresa prowadzi rozmowę i aktywnie zarządza rytmem:

1. wyjaśnia cel aktualnej fazy;
2. zadaje jedno lub małą grupę pytań z uzasadnieniem;
3. korzysta z dozwolonych źródeł i knowledge pack;
4. materializuje odpowiedzi jako proposal cards na Canvas;
5. prosi o accept/edit/reject/rethink;
6. challenge'uje słabe lub ogólne odpowiedzi;
7. proponuje research/Task, gdy brakuje evidence;
8. podsumowuje fazę i pyta o zatwierdzenie gate;
9. przechodzi dalej dopiero po decyzji użytkownika.

Tryb jest dobry dla osoby bez wiedzy konsultingowej. Teresa nie generuje całej
sesji jednym promptem i nie ukrywa metody.

### 5.3 Wspólna prawda

- oba tryby używają tych samych obiektów, metod, gates i quality rubric;
- można przełączyć tryb w dowolnym momencie bez migracji/forka;
- przełączenie zapisuje event, ale nie zmienia zaakceptowanych danych;
- wynik nie jest oznaczany jako gorszy/lepszy ze względu na tryb;
- AI-generated i human-authored provenance pozostaje widoczne.

## 6. Nawigacja i ergonomia do powtarzania

### Główna nawigacja

- fazy zawsze po lewej;
- kolejność nigdy nie zależy od narzędzia;
- narzędzie może dodać kroki wewnętrzne, widoczne po rozwinięciu fazy;
- Comments, Activity, History, Relations i Used In są utilities, nie fazami;
- Review/Finalize jest akcją lifecycle, nie szóstą fazą;
- back prowadzi do Sessions z zachowaniem filtrów i selekcji.

### Praca na Canvas

- click wybiera; double-click/Enter edytuje;
- `+ Add` tworzy ręczny element;
- AI proposal nigdy nie jest wizualnie identyczne z accepted content;
- multi-select umożliwia merge, move, classify, accept/reject i ask Teresa;
- każda transformacja pokazuje preview/diff;
- undo dotyczy bieżącej wersji draftu;
- finalized content jest read-only i wymaga revised session;
- keyboard/focus i screen-reader semantics są częścią standardu.

### Mobile/narrow

Phase Navigator staje się drawerem, Teresa panelem otwieranym przyciskiem, ale
Canvas i stan pracy pozostają te same. Nie powstaje uproszczony drugi runtime.

### 6.1 Kontrakt wejścia i adresu

Każda sesja ma stabilny deep link:

`/tools/sessions/:sessionId?phase=:phaseId&focus=:objectId`

Wejście z Library tworzy Session Draft i dopiero po potwierdzonym zapisie
przechodzi do URL sesji. Wejście z Sessions otwiera ostatnią aktywną fazę albo
fazę wskazaną linkiem. Link do obiektu respektuje permissions i po załadowaniu
ustawia focus bez utraty kontekstu fazy.

Breadcrumb:

`Tools / Sessions / [Tool name] / [Session name]`

Kliknięcie `Tools` albo `Sessions` wykonuje ten sam bezpieczny leave flow co
Close. Logo/global menu nie może omijać zapisu.

### 6.2 Stałe akcje nawigacyjne

W Header zawsze widoczne są:

- **`Wyjdź / Wróć do sesji`** — pierwszy, stale widoczny przycisk z etykietą i
  ikoną, nie anonimowa strzałka ani funkcja ukryta w Menu 3;
- stan zapisu: `Saving…`, `Saved [time]`, `Unsaved changes`, `Save failed`;
- `Save now` dostępne także przy autosave;
- `Resume later` — save + wyjście do Sessions z filtrem `My active`;
- Menu 3: duplicate as new, version history, share/copy link, archive;
- Review/Finalize tylko gdy readiness i permissions pozwalają.

Phase Navigator nie zastępuje Back/Close. Previous/Next przemieszcza między
fazami, ale nigdy nie jest jedynym sposobem opuszczenia Workspace.

### 6.2.1 Pasek poruszania się po pracy

Na dole lub w sticky command area każdej fazy znajdują się zawsze:

- `Poprzednia faza`;
- `Następna faza`;
- `Zapisano / Zapisz teraz`;
- `Oznacz fazę jako gotową` albo `Wyślij do review`, jeśli ma zastosowanie;
- informacja `Faza X z 5` i liczba nierozstrzygniętych proposals/blockers.

Użytkownik może kliknąć dowolną rozpoczętą lub wcześniejszą fazę, cofać się,
oglądać i edytować ją bez utraty kolejnych części. Zmiana danych we wcześniejszej
fazie uruchamia impact analysis: późniejsze fazy mogą otrzymać `stale/needs
review`, ale nie są automatycznie kasowane.

Następna faza może być otwarta w trybie podglądu nawet przy brakach, jeżeli
policy pozwala, lecz readiness jasno pokazuje blokery. Bramka ogranicza
zatwierdzenie/finalizację, nie powinna bez potrzeby więzić użytkownika w jednym
ekranie.

### 6.2.2 Cztery różne czynności

UI konsekwentnie rozdziela:

1. **Edit** — zmiana roboczej treści;
2. **Accept/Reject AI proposal** — decyzja o pojedynczej sugestii;
3. **Mark phase ready / Phase review** — ocena kompletności fazy;
4. **Finalize Session** — zamrożenie całej wersji i utworzenie Outputu.

Akceptacja karty AI nie zatwierdza fazy. Zatwierdzenie fazy nie finalizuje sesji.
Przejście `Next` nie jest approval. Każda akcja ma osobną etykietę i feedback.

### 6.3 Save i bezpieczne wyjście

Stan zapisu jest jawna maszyną:

`CLEAN → DIRTY → SAVING → SAVED` albo `SAVE_FAILED/OFFLINE_PENDING`.

Reguły:

1. każda edycja natychmiast ustawia `DIRTY`;
2. autosave jest debounce, ale manual `Save now` działa natychmiast;
3. zapis ma idempotency key, optimistic concurrency/version i read-back;
4. `Saved` pokazujemy dopiero po potwierdzeniu backendu;
5. zmiana fazy nie wymaga zapisu zakończonego, ale nie gubi lokalnego draftu;
6. każde wyjście próbuje flush pending save;
7. przy `SAVE_FAILED` użytkownik wybiera Retry, Stay albo bezpieczny Local Draft
   (jeżeli policy pozwala); zwykłe wyjście bez ostrzeżenia jest blokowane;
8. browser Back, refresh, zamknięcie karty, global navigation i session switch
   korzystają z tego samego leave guard;
9. po crash/reload system proponuje recovery, porównuje local/server version i
   nigdy nie nadpisuje nowszej wersji bez diff;
10. finalized Session nie przyjmuje autosave — `Revise` tworzy nową wersję.

### 6.4 Return/Resume

Po wyjściu Sessions pokazuje:

- ostatnią fazę i konkretny następny krok;
- save/freshness/recovery state;
- kto i kiedy ostatnio pracował;
- blockers, pending AI proposals i comments/mentions;
- `Resume` otwierające dokładnie ostatni kontekst;
- `Start from review request`, jeśli użytkownik wraca jako Reviewer.

Teresa po powrocie daje krótkie `Since your last visit`: zmiany, decyzje,
nowe evidence, konflikty i rekomendowany następny krok. Nie powtarza całej sesji.

### 6.5 Nawigacyjne stany błędów

- session deleted/revoked → wyjaśnienie i powrót do Sessions;
- permission changed → zachowanie niesave'owanych danych do bezpiecznego exportu
  lub kontaktu z ownerem, bez ujawniania niedozwolonego kontekstu;
- method version deprecated → sesja otwiera historyczną wersję read-compatible,
  a migracja jest oddzielną akcją z preview;
- conflict → porównanie wersji, merge/reapply albo zachowanie obu draftów;
- offline → wyraźny badge, kolejka zmian i zakaz finalizacji/publikacji.

### 6.6 Testy nawigacji obowiązkowe

- edit → autosave → Back → Resume;
- edit → natychmiast Back przed debounce → flush → Resume;
- save failure → Back blocked → Retry success;
- browser Back, refresh i close tab z dirty state;
- deep link do fazy/obiektu i brak uprawnień;
- dwie karty/konflikt wersji;
- offline edit/reconnect;
- finalized → attempted edit → revised version;
- powrót zachowuje fazę, scroll/focus, panel mode i selection tam, gdzie bezpieczne.

## 6A. Dwa poziomy pomocy AI

### Poziom 1 — Teresa jako prowadząca

Teresa prowadzi rozmowę obejmującą całą fazę lub sesję, pamięta cel, zadaje
pytania, buduje proposals i pilnuje jakości. W trybie Teresa-led wybiera rytm i
następne pytanie. W Guided Manual pozostaje konsultantem dostępnym na żądanie.

### Poziom 2 — lokalne akcje AI

Na Canvas i w Command Row dostępne są małe, deterministycznie nazwane akcje:

- `Sharpen question`;
- `Extract signals from selected sources`;
- `Find duplicates`;
- `Challenge selected item`;
- `Find missing evidence`;
- `Suggest alternatives`;
- `Build correlations`;
- `Draft implications`;
- `Propose moves`;
- `Check phase quality`;
- `Prepare final summary`.

Akcja lokalna zna zaznaczenie, fazę i expected output. Pokazuje source scope,
preview oraz proposal cards. Nie otwiera równoległego chatu i nie wykonuje
ukrytego zapisu.

### Zasada antyduplikacyjna

Teresa może zaproponować uruchomienie tej samej capability w rozmowie, ale
wynik materializuje się w tej samej proposal queue i na tym samym Canvas.
Przycisk i rozmowa nie tworzą dwóch implementacji, promptów ani prawd. Każda
capability ma jedno ID, schema, policy, telemetry i handler.

UI zawsze wyjaśnia różnicę:

- `Ask Teresa` — omów, poprowadź, wyjaśnij lub wybierz podejście;
- lokalny przycisk — wykonaj konkretną analizę na określonym zakresie.

## 7. Kolory i semantyka wizualna

Narzędzie może mieć subtelny kolor identyfikacyjny w ikonie/coverze, ale nie
zmienia globalnej semantyki stanu.

| Znaczenie | Stała semantyka |
| --- | --- |
| Neutral/human accepted content | neutralne powierzchnie i standardowy tekst |
| Active selection / primary action | primary brand color |
| AI proposal / Teresa action | indigo/violet accent + jawna etykieta AI proposal |
| Accepted / ready / verified | green, zawsze z tekstem/ikoną |
| Needs evidence / warning / due soon | amber |
| Blocker / rejected / destructive / error | red wyłącznie dla tej semantyki |
| Draft/in progress/informational | blue/slate zależnie od wspólnego status canon |
| Stale/degraded | amber/slate z freshness label |

Kolor nie może być jedynym nośnikiem informacji. Quadrant colors (np. SWOT)
są metodologiczną wizualizacją wewnątrz Canvas, nie zastępują status colors.
Niski score nie jest czerwony, jeżeli nie oznacza blockera.

### 7.1 System wizualizacji narzędzi

HTML daje nam przewagę: narzędzia nie powinny kończyć jako formularze z tekstem.
Każda metoda otrzymuje zestaw semantycznych `Tool Visual Blocks`, np.:

- matrix/quadrants;
- relationship/correlation map;
- force/radar chart;
- priority bubble/portfolio matrix;
- value chain/process flow;
- issue/logic tree;
- scenario/uncertainty map;
- heatmap;
- timeline/roadmap;
- comparison table;
- insight, tension, move i evidence card.

Bloki są budowane jako responsywne HTML/SVG/Canvas-native komponenty z danymi,
nie jako zapisany screenshot. Muszą wspierać:

- light/dark oraz presentation theme;
- responsive resize i content density rules;
- zoom/pan/focus oraz fullscreen/presentation mode;
- keyboard, text alternatives i dostępność;
- selection, comments, source hover i drill-down;
- empty/loading/error/degraded/overflow states;
- kontrolę długiego tekstu i automatyczne rekomendacje skrótu;
- export-safe fonts, kolory, line weights i contrast;
- deterministic render z tej samej wersji danych.

### 7.2 Visual grammar wspólna i tool-specific

Wspólne są: typography, spacing, card shell, legend, source/confidence badges,
status semantics, selection, AI proposal treatment, comments i export rules.

Tool-specific jest znaczenie geometrii: cztery kwadranty SWOT, pięć sił Portera,
łańcuch wartości, drzewo problemu itd. Każda geometria ma opis semantyczny,
minimalny/maksymalny zakres danych, layout variants i fallback do czytelnej
tabeli dla accessibility/export.

Dekoracja bez wartości analitycznej jest drugorzędna. Każda grafika powinna
pomagać zobaczyć relację, priorytet, napięcie, wzorzec albo decyzję.

## 7A. Przenoszenie elementów Tool do prezentacji

### Zasada

Prezentacja nie dostaje screenshotu Workspace. Dostaje semantyczny, wersjonowany
`PresentationSourceBlock` z ToolOutput:

```text
PresentationSourceBlock {
  sourceToolOutputId, sourceVersion, blockType, blockId,
  dataSnapshot, title, keyMessage, evidenceRefs,
  visualIntent, preferredLayouts, density,
  themeTokens, confidentiality, freshness, provenance
}
```

Generator prezentacji wybiera layout zgodny z intencją, np. comparison,
quadrant, flow, hierarchy, evidence, recommendation lub decision. Ten sam
snapshot może zostać wyrenderowany inaczej na slajdzie, ale nie może zmienić
znaczenia ani danych.

### Akcje w Workspace/Output

- `Send selected block to presentation`;
- `Create presentation outline from Output`;
- `Add to existing deck`;
- `Create executive slide`;
- `Preview slide variants`;
- `Open in Presentation Studio`.

Przed zapisem Teresa podsumowuje:

- co zostanie przeniesione;
- jaki jest key message;
- które evidence i limitations muszą pozostać;
- czy treść jest zbyt gęsta;
- rekomendowane layout variants;
- czy blok zawiera stale/proposed/unapproved content.

Tylko zaakceptowany content może domyślnie trafić do zatwierdzanego decku.
Proposed/needs-evidence może wejść wyłącznie jako jawny draft z oznaczeniem.

### Synchronizacja i wersje

- slajd przechowuje source link i immutable source snapshot;
- nowszy Output pokazuje `source update available`, nie nadpisuje slajdu;
- użytkownik wybiera refresh, compare/diff albo keep historical snapshot;
- ręczna edycja slajdu jest zachowana; refresh pokazuje konflikt semantyczny;
- source access/confidentiality obowiązuje również po share/export;
- usunięcie/archiwizacja source nie usuwa audytowanego snapshotu prezentacji,
  ale może ograniczyć jego dalsze udostępnianie.

### Dynamic SWOT → Presentation

Minimalny pack slajdowy może zawierać:

1. decision question i scope;
2. evidence landscape;
3. czytelną macierz SWOT;
4. najważniejsze correlations/tensions;
5. strategic implications;
6. recommended moves i `what not to do`;
7. next decisions/Initiative candidates;
8. assumptions, limitations i sources appendix.

Generator nie musi tworzyć wszystkich slajdów. Dobiera pakiet do audience i
purpose, a użytkownik zatwierdza outline przed generacją.

## 8. Teresa Collaboration Panel

Panel zawsze odpowiada na sześć pytań:

1. **Where are we?** — cel fazy i zaakceptowany stan.
2. **What matters now?** — najważniejsza kwestia, nie lista wszystkiego.
3. **Why?** — dlaczego Teresa pyta/rekomenduje.
4. **What is missing?** — evidence, decision, owner lub quality gap.
5. **What does Teresa propose?** — kolejka propozycji z preview.
6. **What is the next safe action?** — jednoznaczna akcja użytkownika.

Funkcje:

- rozmowa w kontekście fazy i zaznaczonego elementu;
- proposal queue: accept/edit/reject/rethink indywidualnie i kontrolowane batch;
- citations/source drawer;
- quality/readiness i blocker explanation;
- ask for alternative/counterargument;
- create research question/Task/Decision proposal;
- `Take the lead` / `Let me work manually` przełącza tryb;
- summarize changes since last visit;
- explain method i show example bez kopiowania przykładu do sesji.

Panel nie może być dashboardem statystyk, powtórzeniem Canvas, reklamą AI ani
monologicznym chatem bez materializacji wyników.

## 9. Method Knowledge Pack — warunek poziomu eksperckiego

Każde narzędzie ma wersjonowany, reviewowany Method Knowledge Pack:

- purpose, decision jobs i boundaries;
- when to use / when not to use;
- prerequisites, participants, time i expected outputs;
- canonical method steps i object schema;
- definitions i scoring/calculation rules;
- question bank z intencją pytania i follow-ups;
- evidence requirements i source quality rules;
- synthesis patterns i reasoning checks;
- common mistakes, biases i anti-patterns;
- counterexamples i disconfirming questions;
- anonymized worked examples oraz expected quality;
- industry/context adaptations;
- output mapping do native Output/Deliverables/Proposal Drafts;
- Teresa roles, prompts, tools i structured outputs;
- quality rubric i gates;
- citations, licenses, owner, reviewer, version i valid-from/deprecation.

Publiczne frameworki można opisać własnymi słowami. Nie kopiujemy chronionych
materiałów, proprietary playbooks ani nie używamy oznaczeń sugerujących
certyfikację. Wiedza własna organizacji i case knowledge przechodzi
propose→review→publish, nie trafia automatycznie do wspólnego packa.

## 10. AI runtime

AI nie jest jednym monolitycznym promptem. Standardowe capabilities:

- Method Fit Advisor;
- Mission Framer;
- Evidence Extractor/Classifier;
- Missing Evidence Researcher;
- Method Builder;
- Deduplicator/Normalizer;
- Challenger/Red Team;
- Synthesis Engine;
- Options/Move Designer;
- Quality Verifier;
- Output/Proposal Draft Architect.

Każde wywołanie zna session/method/phase/version/selection, permissions, source
scope, expected schema, risk level, approval level i idempotency key. Wynik ma
citations, assumptions, confidence, warnings i proposed operations. Zapis
przechodzi przez wspólny preview/approval/write/read-back spine.

## 11. Statusy i lifecycle

Session:

`DRAFT → ACTIVE → NEEDS_INPUT → READY_FOR_REVIEW → IN_REVIEW → FINALIZED →
SUPERSEDED → ARCHIVED`

Dodatkowe `BLOCKED` i `FINALIZATION_FAILED` są jawne. Faza posiada własny stan,
ale nie zmienia lifecycle sesji bez eventu.

Element Canvas:

`DRAFT_MANUAL`, `AI_PROPOSED`, `NEEDS_EVIDENCE`, `ACCEPTED`, `REJECTED`,
`RETHINKING`, `STALE`, `SUPERSEDED`.

Status `FINALIZED` tworzy immutable Output. Powrót do pracy tworzy Revised
Session/version i zachowuje lineage.

## 12. Quality standard

Każde narzędzie ocenia wspólne wymiary:

1. method fit i decision clarity;
2. evidence coverage, quality, freshness i provenance;
3. poprawność zastosowania metody;
4. separation of fact/observation/hypothesis/interpretation;
5. contradiction, alternatives i bias challenge;
6. insight depth i causal logic;
7. actionability oraz realność moves;
8. traceability evidence→analysis→insight→output/action;
9. limitations, confidence i applicability;
10. downstream readiness.

Tool-specific rubric rozszerza, ale nie zastępuje wspólnej. Wynik:
PASS/WARNING/BLOCKER/N/A. Blocker nie znika w średniej. Teresa tworzy Quality
Review z evidence, lukami, suggested fixes, ownerem i next action.

## 13. Dynamic SWOT jako reference implementation

| Wspólna faza | SWOT Canvas | Rola Teresy | Gate |
| --- | --- | --- | --- |
| Mission | strategic question, scope, horizon, success | sharpen, challenge fit, surface assumptions | usable decision brief |
| Input | source groups i signals | interview, extract, classify, find gaps/contradictions | enough credible signal coverage |
| Build | matrix S/W/O/T | dedup, challenge placement, source cards, propose missing items | meaningful accepted quadrants |
| Synthesis | SO/WO/ST/WT, tensions, implications, moves | correlate, challenge generic logic, propose alternatives/what not to do | accepted insights and moves |
| Outputs | summary, quality, output/action candidates | verify traceability, draft Output/Deliverable/Proposal candidates | ready to finalize or explicit blockers |

SWOT-specific są quadrants i correlation logic. Cała reszta — shell, fazy,
proposal loop, evidence, Teresa panel, quality, versioning i handoff — musi zostać
skopiowana systemowo, nie ręcznie, do następnych narzędzi.

## 14. Przebieg Guided Manual

1. Użytkownik wybiera narzędzie i startuje sesję.
2. Wypełnia Mission z inline help; Teresa sygnalizuje niejasności.
3. Dodaje źródła/signals ręcznie i opcjonalnie uruchamia ekstrakcję.
4. Buduje tool-specific Canvas przez add/edit/drag/classify.
5. Wywołuje wybrane akcje AI: dedup, challenge, alternatives.
6. Akceptuje/edytuje/odrzuca proposal cards.
7. Tworzy syntezę i moves; Teresa wykonuje quality check.
8. Naprawia blocker gaps albo prosi o wyjątek.
9. Review/Finalize tworzy immutable Output.

## 15. Przebieg Teresa-led

1. Teresa potwierdza cel i proponuje plan sesji.
2. Prowadzi krótkie rundy pytań i materializuje odpowiedzi na Canvas.
3. Prosi o akceptację, correction lub challenge po każdym znaczącym bloku.
4. Wskazuje brak evidence i proponuje źródła/research Tasks.
5. Buduje metodę etapami; użytkownik widzi każdy krok.
6. Przeprowadza red-team/challenge i pokazuje kontrdowody.
7. Proponuje insights/moves i `what not to do`.
8. Przygotowuje Quality Review i plan naprawczy.
9. Użytkownik zatwierdza fazy oraz finalizację.

## 16. Adoption Gate dla kolejnego narzędzia

Narzędzie nie jest production-ready, dopóki nie ma:

- zatwierdzonego ToolDefinition i Method Knowledge Pack;
- mapowania pięciu faz oraz tool-specific objects;
- jednego wspólnego shellu bez forka;
- obu trybów pracy na tej samej prawdzie;
- Teresa actions i structured proposal schemas;
- wspólnej oraz tool-specific quality rubric;
- accepted/proposed/evidence/provenance semantics;
- Output, Deliverable i Proposal Draft mapping;
- permissions, autosave, resume, version i finalize;
- empty/loading/error/degraded/success states;
- example session i quality benchmark;
- unit/integration/E2E wraz z reject-no-write i failure/retry;
- ręcznego odbioru spójności nawigacji, kolorów i dostępności.

## 17. Kryteria odbioru standardu na Dynamic SWOT

- użytkownik bez konsultingowego doświadczenia rozumie cel każdej fazy;
- osoba ucząca się SWOT nie musi znać kolejności ani terminologii przed startem;
- Guided Manual i Teresa-led można przełączać bez utraty stanu;
- Teresa nie generuje monolitycznej „gotowej odpowiedzi”;
- każdy zaakceptowany SWOT item linkuje do evidence albo ma needs-evidence;
- synteza zawiera correlations, tensions, implications i realne moves;
- UI rozróżnia human/AI, proposed/accepted, warning/blocker i stale;
- phase navigation, command row i Teresa panel są stabilne;
- finalize jest blokowane przy krytycznych lukach albo wymaga jawnego wyjątku;
- immutable Output odtwarza dokładnie zatwierdzoną wersję;
- ten sam shell przyjmuje drugie narzędzie bez redesignu.

## 18. Otwarte decyzje do wspólnego uzgodnienia

1. Czy tryb nazywamy `Guided Manual` / `Teresa-led`, czy prostszymi etykietami
   `Pracuję samodzielnie` / `Prowadzi Teresa`?
2. Czy Teresa-led może automatycznie przechodzić między pytaniami w fazie, ale
   zatrzymuje się zawsze przed gate, czy potwierdzamy również większe bloki?
3. Czy Session Owner może self-finalize w profilu lightweight po Quality Review?
4. Czy użytkownik może ominąć fazę jako N/A, podając reason, czy wymaga review?
5. Czy prawy panel jest stale otwarty na desktopie, czy może być zwijany z
   pamiętaniem preferencji?
