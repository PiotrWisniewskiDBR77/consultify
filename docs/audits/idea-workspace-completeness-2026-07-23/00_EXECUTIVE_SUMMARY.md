# 00 — Executive Summary: Audyt kompletności Idea Workspace

**Data:** 2026-07-23 · **Tryb:** read-only, bez implementacji. · **Zakres:** Mind Map · Whiteboard · Process Flow · Table + wspólna powłoka.
**Metoda:** 12 zweryfikowanych dokumentów powierzchni (część live) + 6 audytów wymiarowych czysto-kodowych (endpointy, AI, convert, flagi, martwy kod, łańcuchy, duplikaty). Pliki 01–10 w tym katalogu.

---

## 15 najważniejszych ustaleń

1. **JEDEN root-cause psuje trzy powierzchnie naraz.** Powłoka współdzielona (Menu 3 `buildIdeaMenu3Actions`, lewy rail popovery AI/Import/Więcej, prawy panel) reużywa akcje **Mind Mapy** (`mm_*`, `add_node`, zdarzenie `idea-mindmap-node-quick-action`) dla wszystkich 4 narzędzi. Obsługuje je tylko `useMindMapQuickActions.ts`, montowany wyłącznie w Mind Mapie. Skutek: martwe kliki w Whiteboard/Process/**Table** (Dodaj kształt/wiersz/karteczkę, AI rozwiń, Auto-układ). Jedna naprawa architektoniczna (rozgałęzienie per `activeTool`) zamyka wszystkie trzy.

2. **Prawy panel: 5 ikon-zakładek nie przełącza treści.** `renderMelsCanvasRightRailPanel(_activeToolId)` ignoruje id (podkreślnik) → każda ikona pokazuje ten sam pełny `IdeaWorkspaceTools`. Host nie przekazuje `activeRightToolId`/`onSelectRightTool`.

3. **Prawy panel nie ma kanonicznych sekcji Powiązania i Komentarze** (SPEC-A je wymaga jako first-class). Dane pod nie ISTNIEJĄ (`link-graph/*`, `NodeCommentThread`) — brakuje tylko UI.

4. **Trzy niezależne silniki AI, nierówne dojrzałością.** `mm_ai_*` (14 akcji, tylko Mind Map) · `wb_ai_*`/`pf_*` (realny `generateAIProposal`→`POST /ai-generate`→`IdeaProposalReview` accept/reject, ale WB i Process mają OSOBNE kopie) · `tbl_*` (najsłabszy, żaden nie idzie przez proposal-review).

5. **Przyciski „AI", które nie wołają LLM.** `IdeaAISuggestionsPanel` „AI Generators" dla Whiteboardu dispatch'uje `wb_add_cluster/theme/outcome` (puste wstawki), zamiast realnych generatorów `wb_ai_find_themes`. Etykieta myli.

6. **„Utwórz z mapy" (Menu 3) to dziś martwy klik** pod domyślną flagą `ff_melsCanvas` — woła panel renderowany tylko gdy flaga OFF. Nazwa sugeruje generowanie reprezentacji; faktycznie to alternatywne wejście do Convert.

7. **Trzy różne mechanizmy „Convert" pod tą samą nazwą** (workspace `Api.convertMyIdea`, lista M05 `conversionService`, martwy `shared/ConvertToMenu`). Te same targety są „soon" w workspace, a działają w liście — rozjazd.

8. **Backend `promote()` nadpisuje `promoted_to`/`stage` CAŁEJ idei bezwarunkowo** — konwersja 2 z 40 węzłów oznacza całą ideę jako promowaną i gubi ślad poprzedniej konwersji. Poważne dla integralności danych.

9. **„Convert element" i „Convert branch" (Mind Map) wołają identyczny kod** (zawsze cała gałąź `collectDescendants`) — nazwa „pojedynczy element" jest myląca. Whiteboard robi to poprawnie 1:1.

10. **Import destrukcyjny bez potwierdzenia.** draw.io/BPMN/pakiet ZASTĘPUJE cały graf bez dialogu. Kontrast: Templates (ta sama operacja) MA confirm — jedyny poprawny guard-rail w całym audycie.

11. **Export miesza dwie rzeczy.** Dropdown „Eksport" zawiera „Raport" i „Prezentacja", które NIE eksportują pliku — to zamaskowany Convert (tworzy trwały rekord). Realny eksport pliku jest w 100% client-side; serwerowy wyłączony flagą.

12. **Table = dwa światy.** Legacy (`IdeaTableTool.tsx`) vs platform P15 (`ViewRouter`/`TableToolbar`), flaga `usePlatform`. Różne menu wiersza/nagłówka, brak menu komórki w obu, menu nagłówka tylko legacy, moduły Data/Forms/Interfaces/Models/Workflow tylko P15. Obiekt testowy renderuje legacy.

13. **Persystencja rozjechana.** Mind Map/Process/Table dzielą `useWorkspaceGraphRuntime`; **Whiteboard jako jedyny** działa na osobnym legacy `useIdeaMapSync`. Ryzyko rozjazdu zapisu/historii.

14. **Trzy nieujednolicone mechanizmy realtime.** WebSocket `/ws/collab/:ideaId` (MM/Process/WB), Socket.IO `/table-platform` (Table P15), REST-polling `/presence` (Table legacy+P15 równocześnie — możliwa duplikacja prezencji).

15. **Sporo kompletnego kodu bez UI + martwych eventów/endpointów.** Kod bez przycisku: `tbl_autofill_from_artifact`/`refresh`/`link` (pełne, z i18n/undo), `wb_group/ungroup/distribute`, cały rail `IdeaCanvasDiscovery`, `handleGenerateCanvasAI`, typy węzłów `kpi_badge/score/progress/summary`. Martwe eventy: `idea-workspace-add-edge`/`-link-artifact` (przyciski „Dodaj powiązanie" w panelu wiersza tabeli). Martwe endpointy: cluster/outcome, `v8/mindmap/*`, facilitacja end/outcomes.

---

## 10 największych ryzyk

| # | Ryzyko | Waga | Dlaczego |
|---|---|---|---|
| R1 | Martwe kliki w 3 narzędziach (root-cause #1) | Wysoka | Użytkownik klika „AI/Dodaj" i nic się nie dzieje — wrażenie zepsutego produktu |
| R2 | `promote()` nadpisuje całą ideę | Wysoka | Cicha utrata śladu konwersji + błędny status; nieodwracalne bez ręcznej naprawy |
| R3 | Import destrukcyjny bez confirm | Wysoka | Jeden klik kasuje całą pracę na płótnie, brak undo w draw.io/BPMN |
| R4 | Prawy panel nie przełącza sekcji | Średnia | 5 ikon udających zakładki = dezorientacja; nie da się dojść do konkretnej sekcji |
| R5 | „AI" bez LLM + auto-apply bez preview | Średnia | Table autofill/refresh nadpisują pola natychmiast; convert tworzy rekord bez podglądu |
| R6 | Dwie implementacje Table (legacy/P15) | Średnia | Różne menu/zachowania w zależności od flagi — niespójny UX, podwójne utrzymanie |
| R7 | Rozjazd persystencji Whiteboard | Średnia | Osobny pipeline zapisu → ryzyko utraty/desync historii i extensions |
| R8 | 3 mechanizmy realtime | Średnia | Trudne w utrzymaniu; prezencja w Table może się dublować |
| R9 | Nomenklatura Convert/Create/Export myli | Średnia | Te same słowa = różne operacje i scope; trudno zbudować spójny standard |
| R10 | Martwy kod/endpointy jako dług | Niska-Średnia | Myli przyszłych implementujących; „AI Generators" sugeruje gotowe funkcje |

---

## Obszary NIEPOTWIERDZONE (wymagają żywej weryfikacji lub decyzji)

- **Moduły platformowe Table** (Data/Forms/Interfaces/Models/Workflow + Tools) — opisane tylko z kodu; obiekt testowy renderuje legacy, więc P15 nie potwierdzony wzrokiem.
- **Czy snapshot importu łapie stan PRZED czy PO** nadpisaniu grafu (undo importu).
- **Czy AI „dla zaznaczenia" realnie scopuje backend do zaznaczenia** (poza częściowym Whiteboardem).
- **Realny efekt „AI transform to table/mind map"** — kod sugeruje, że ląduje jako karteczki na TYM SAMYM whiteboardzie (`generatorStatus:'cross-tool'`), nie tworzy/przełącza narzędzia.
- **Faktyczne zachowanie 3 kanałów realtime pod obciążeniem** (duplikacja prezencji Table).
- **Czy „usePlatform" gdziekolwiek na demo jest ON** dla realnych tabel (jeśli nie — cały P15 to martwa ścieżka dla userów).

---

## Rekomendacja: czy mamy dość danych do finalnego standardu?

**TAK — dla warstwy funkcjonalnej i architektonicznej.** Mamy pełny inwentarz powierzchni, macierz akcji ze statusami, mapę endpointów/eventów (z martwymi), pełny obraz AI, Convert/Export/Import, flag, martwego kodu i duplikatów. Root-cause większości defektów jest zidentyfikowany i wspólny — to wystarcza, by napisać standard „jak Idea Workspace ma działać" i plan naprawczy.

**NIE — dla dwóch decyzji, które MUSZĄ zapaść przed standardem** (to nie brak danych, to wybory właściciela):
1. **Table: legacy vs P15** — który jest docelowy? Standard nie może opisać obu. Trzeba wybrać jeden i zdeprecjonować drugi.
2. **Kanon prawego panelu** — czy Idea dochodzi do SPEC-A (Akcje·Właściwości·Powiązania·Komentarze·Historia/AI), czy zostaje przy własnym schemacie (Problem·Status·Inspektor·Convert·Zdrowie)? To determinuje, co pod ikonami.

Plus warto domknąć 6 obszarów niepotwierdzonych powyżej jednym czystym przebiegiem live (bez równoległych sesji).

**Wniosek:** dane wystarczają do napisania standardu i planu; przed startem potrzebne są 2 decyzje kierunkowe (Table, prawy panel) i 1 krótka weryfikacja live P15. Kolejność naprawy powinna zacząć się od root-cause #1 (jedna zmiana, trzy powierzchnie) i R2/R3 (integralność danych — `promote` i destrukcyjny import).
