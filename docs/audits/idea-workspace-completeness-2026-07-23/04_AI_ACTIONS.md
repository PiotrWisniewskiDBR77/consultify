# 04 — Akcje AI w Idea Workspace (audyt kompletności)

**Data:** 2026-07-23
**Metoda:** analiza kodu (grep-first), tryb czysto kodowy, bez uruchamiania aplikacji.
**Zakres:** wszystkie akcje AI dostępne z poziomu Idea Workspace (Mind Map, Whiteboard, Process Flow, Table) — powłoka, popovery, kontekst, panel AI, tabela.

---

## 0. Skrót wykonawczy — co trzeba wiedzieć w 60 sekund

1. **Trzy niezależne "silniki" AI współistnieją w Idea Workspace**, o różnej dojrzałości:
   - **A. `mm_ai_*` (Mind Map)** — najstarszy, największy zestaw (14 akcji), obsługiwany WYŁĄCZNIE przez `useMindMapQuickActions.ts` montowany tylko w `IdeaRecommendationMap.tsx`. Poza Mind Mapą te akcje **nie robią nic** (potwierdzone w `_INPUT_CONTEXT.md`, tu rozwinięte per-akcja niżej).
   - **B. `wb_ai_*` (Whiteboard) i `pf_*`/`process_coach` (Process Flow)** — nowszy, realny pipeline `generateAIProposal()` → `POST /ai-generate` → `AIProposalBatch` → widżet `IdeaProposalReview` (accept/reject per-item + accept/reject-all). Whiteboard i Process Flow mają **własne, osobne kopie** stanu `proposalBatch`/`IdeaProposalReview` (nie jest to jeden współdzielony komponent — patrz §5).
   - **C. Table (`tbl_*`)** — najsłabiej zintegrowana: **żadna** akcja AI w tabeli nie przechodzi przez `IdeaProposalReview`/`generateAIProposal`. Każda ma własną, jednorazową implementację (modal, auto-apply albo prompt-JSON-parsing hack).
2. **Odkryty NOWY martwy kod (poza już znanym `mm_*`-tylko-w-mapie):**
   - `IdeaCanvasDiscovery.tsx` (cały plik, ~700+ linii, "Canvas OS" — generic action rail z `generate_ai`/`onGenerateAI`) — **zero importów w całym `src/`**, całkowicie niepodłączony.
   - `handleGenerateCanvasAI()` w `IdeaMapWorkspace.tsx` (linia 1139) — zdefiniowany, ale **nigdy nie wywołany** (jedyne wystąpienie nazwy w pliku to jego własna definicja). Miał być cross-tool odpowiednikiem `handleAIExpand`, ale nie jest nigdzie przekazany jako prop.
3. **Mislabeling w `IdeaAISuggestionsPanel.tsx` (workspace-level panel "AI generators" dla Whiteboardu):** przyciski podpisane "Auto-clustering (AI)" / "Extract themes (AI)" / "Identify outcomes" dispatch'ują `wb_add_cluster` / `wb_add_theme` / `wb_add_outcome` — czyli zwykłe **wstawienie pustego bloku** (`handlers.addElement(...)`), NIE prawdziwe generatory `wb_ai_find_themes`/`wb_ai_name_clusters`. Realne AI-generatory whiteboardu (`wb_ai_*`) nie są w ogóle wystawione w tym panelu.
4. **Konwersja na nowy artefakt (`convert_initiative`/`convert_decision`/`convert_task_set`/`convert_report`/`convert_presentation`) NIE jest wywołaniem LLM w momencie konwersji** — to mapowanie pól już istniejących w rekordzie idei (`title`/`body`/`ai_expansion`/`summary_data`) na nowy rekord (Initiative/Decision/Task/Report). Tworzy realny nowy obiekt **natychmiast, bez podglądu/akceptacji** (jedyne zabezpieczenie: nowy rekord da się skasować ręcznie — nie ma dedykowanego „cofnij").
5. **Auto-apply bez podglądu (ryzyko):** `tbl_autofill_from_artifact`, `tbl_refresh_artifact_data` (tabela) oraz cały mechanizm `convert_*` zmieniają dane od razu, zabezpieczone wyłącznie ogólnym stosem undo danego narzędzia (Ctrl+Z), nie dedykowanym flow accept/reject.
6. **`mm_ai_rewrite_node`** (jedyna akcja "rewrite" w Mind Mapie) używa natywnego **`window.prompt()`** przeglądarki do zebrania instrukcji — brzydki, niestandaryzowany UX, ale funkcjonalnie działa i idzie przez realny Propose→Accept.
7. **"AI transform to mind map" (`wb_to_map_branches`) i "AI transform to table" (`wb_to_table`) z Whiteboardu NIE przełączają narzędzia ani nie tworzą nowego artefaktu** — po akceptacji propozycji nowe węzły (branch/leaf/idea) lądują jako zwykłe **sticky notes na tej samej tablicy** (`toWbNodeKind` mapuje `branch|leaf|idea → sticky`), a `resultSummary` tylko *informuje* usera, żeby ręcznie przełączył się na docelowe narzędzie. Oznaczone w kodzie jako `generatorStatus: 'cross-tool'` — świadomy, udokumentowany kompromis, nie bug, ale realna funkcjonalność jest węższa niż nazwa sugeruje.
8. **"AI validate" nie istnieje jako osobna akcja AI** — walidacja (`Waliduj` w Process Flow, `validateFlow.ts`) jest czystą heurystyką bez LLM (potwierdza ustalenie #6 z `_INPUT_CONTEXT`).
9. **"AI find gaps" (`mm_ai_gap_analysis`) istnieje tylko w Mind Mapie** i nie jest wywołaniem structured-proposal — tylko wysyła gotowy prompt do czatu Teresy (`onOpenChat`), licząc na to, że czat sam coś z tym zrobi. To samo dotyczy `mm_ai_suggest`, `mm_ai_summarize`, `mm_ai_auto_connect`, `mm_ai_deepen` (gdy `onOpenChat` jest dostępny) — są to **delegacje do czatu**, nie bezpośrednie wywołania backendu.

---

## 1. Trzy mechanizmy backendowe (SSOT)

| Endpoint | Klient (`src/services/api.ts`) | Wywoływany z | Kształt odpowiedzi | Auto-apply czy proposal? |
|---|---|---|---|---|
| `POST /my-work/my-ideas/:id/map/expand` | `expandMyIdeaMap()` | `IdeaRecommendationMap.handleAIExpand` (mindmap only) | `{ proposal: { add: { nodes, edges } } }` | **Proposal** — modal `AIProposalDiffModal`, checkbox per node, Apply/Reject |
| `POST /my-work/my-ideas/:id/ai-generate` | `generateIdeaAI()` → wrapper `generateAIProposal()` (`src/services/ideaAIGenerator.ts`) | mindmap (rewrite/suggest-links), whiteboard (`wb_ai_*`), process flow (`flow_generator`/`node_expand`/`edit_step`/`process_coach`/`process_summary`), table (`ai_autofill_mappings` — ale auto-appl., patrz niżej) | `AIProposalBatch` (`{id, tool, generatorType, proposals:[{patch,rationale,confidence,status}]}`) | **Zależy od wywołującego** — mindmap/whiteboard/process_flow: proposal review (accept/reject); tabela `ai_autofill_mappings`: **auto-apply** natychmiast po odpowiedzi |
| `POST /my-work/my-ideas/:id/ai-suggestions` | `getIdeaAISuggestions()` | `IdeaAISuggestionsPanel` (lista sugestii tekstowych), `AICategorizeTool` (parsuje JSON z pola `text` — hack, nie structured API) | `{ suggestions: [...] }` (luźna lista, nie graph_patch) | Prezentacja + `Apply`/`Apply all` per item (samodzielna logika w komponencie wywołującym, nie wspólny widget) |
| `POST /my-work/my-ideas/:id/convert` | `convertMyIdea()` | powłoka workspace (`CONVERT_PREFIX_MAP` → `handleConvert`) | `{ outputId, sourceSessionId }` | **Auto-apply, natychmiastowe utworzenie nowego rekordu** (Initiative/Decision/Task/Report/Presentation) — brak LLM w tym wywołaniu, tylko field-mapping z już zapisanych danych idei |
| Teresa chat: `generateDeliverable.ts` → `canvasGraphLlm.ts` | `Api.chatWithAIStream` / narzędzie czatu | Tworzenie **całkiem nowego** artefaktu (Mind Map/Process Flow/Whiteboard/Note) z poziomu czatu (nie z wnętrza już otwartego canvasu) | Cały graf (nodes+edges) lub prozy markdown | Real LLM pass z fail-soft fallback do deterministycznego szkieletu |

Backend `generateIdeaAI` (`server/src/services/ideaAIGeneratorService.ts`, 2533 linie) implementuje **~40 `generatorType`** rozgałęzień (`if (generatorType === '...')`) — realna logika (nie stub) dla większości, z jawną mapą dojrzałości w `src/services/ideaAIGenerator.ts`:

| Status | generatorType |
|---|---|
| `real` | lane_generator, flow_generator, suggestions, mindmap_expand, table_columns, table_views, whiteboard_clusters, whiteboard_brainstorm, whiteboard_organize, summary, auto_cluster, next_step, process_summary, edit_step, vsm_generator, sticky_summarize, vsm_future_state, wb_find_themes, wb_name_clusters, wb_extract_actions, table_rows, table_simplify, ai_build_linked_table, bottleneck |
| `partial` | enrichment, node_context, node_expand, process_coach, process_brief, process_savings, ai_retrieve_artifacts, ai_propose_attachments, ai_autofill_mappings |
| `cross-tool` | wb_to_map_branches, wb_to_table |

---

## 2. Akcje AI wg 8 kategorii zlecenia

### 2.1 AI całego workspace

| Akcja / punkt wejścia | Handler | Endpoint | Preview czy auto | Działa w narzędziach | Status |
|---|---|---|---|---|---|
| Tworzenie nowego artefaktu z czatu Teresy ("stwórz mapę myśli o X" itp.) | `generateDeliverable.ts` → `canvasGraphLlm.ts` | wewnętrzny LLM call (nie REST z FE) | Tworzy cały nowy graf/dokument od razu (to jest akt tworzenia, nie edycji) | Mind Map, Process Flow, Whiteboard, Table (row nodes), Note | **Działa** — realny LLM pass, fail-soft fallback do skeletonu |
| `IdeaAISuggestionsPanel` — panel boczny "AI Generators" (workspace shell, per `activeTool`) | `getGeneratorActions(activeTool)` → dispatch `idea-workspace-quick-action` | zależy od akcji (patrz niżej) | Mieszane | Mind Map: realne (dispatch do `mm_ai_*`, patrz §2.4). Whiteboard: **mislabeled** — dispatch'uje `wb_add_*` (element insert), NIE `wb_ai_*` | **Częściowo zepsute** dla Whiteboardu (§0 pkt 3) |
| `IdeaCanvasDiscovery.tsx` + `handleGenerateCanvasAI` — cross-tool "Canvas OS" generator rail | `onGenerateAI(generatorType)` → `generateAIProposal` | `/ai-generate` | Proposal (gdyby działało) | **Żaden — komponent nigdzie niezamontowany** | **Martwy kod** (zero importów) |
| `mm_create` (chat intent "stwórz mapę o X" gdy narzędzie już otwarte) | `useMindMapQuickActions.ts` — zapisuje `body` idei, potem `handleAIExpand()` | `PUT my-ideas/:id` + `/map/expand` | Proposal (przez `handleAIExpand`) | Mind Map only | Działa (workaround, udokumentowany w komentarzu `#DEAD-ACTIONS`) |
| `pf_create` (chat "stwórz proces X") | `createFromPrompt` → `useProcessFlowAIProposal.createProposal` (`flow_generator`) | `/ai-generate` | Proposal z before/after (walidacja + readback) | Process Flow only | Działa, real |

### 2.2 AI aktualnego widoku (aktywne narzędzie, cały canvas/tabela)

| Akcja | Etykieta UI | Handler | Endpoint | Preview/auto | Narzędzia |
|---|---|---|---|---|---|
| `mm_ai_expand` | "Expand map (AI)" | `handleAIExpand()` bez anchora (root/selected) | `/map/expand` | Proposal (`AIProposalDiffModal`) | **Mind Map only** |
| `mm_ai_summarize` | "Map summary" | deleguje do czatu (`onOpenChat`, prompt z etykietami do 30 węzłów) | brak bezpośredniego endpointu — czat | n/d (delegacja) | **Mind Map only** |
| `mm_ai_auto_connect` | "Auto cross-links" | deleguje do czatu | brak | n/d (delegacja) | **Mind Map only** |
| `wb_ai_find_themes` (`wb_find_themes`) | "AI: Find themes" | `runWhiteboardAIAction('wb_find_themes')` | `/ai-generate` | Proposal (frame per temat, per-item accept) | **Whiteboard only** |
| `wb_ai_extract_actions` | "AI: Extract actions" | `runWhiteboardAIAction` | `/ai-generate` | Proposal | **Whiteboard only** |
| AI Coach | "AI Coach" (toolbar Process Flow) | `handleAICoach()` → `runProcessCoach` (`process_coach`) | `/ai-generate` | **Tylko odczyt** — lista insightów w panelu, NIE modyfikuje canvasu | **Process Flow only** |
| Process Summary | (przycisk w toolbarze) | `handleProcessSummary()` → `generateProcessSummary` | `/ai-generate` | Tylko odczyt (podsumowanie tekstowe) | **Process Flow only** |
| `tbl_ai_assistant` | "AI Assistant" | `setShowAIAssistant(true)` | zależy od wnętrza modala (niepotwierdzone dalej — poza zakresem grep tego przebiegu) | niepotwierdzone (kod) | Table |
| `tbl_copilot` | "AI Copilot" | `setShowCopilot(true)` → `AICopilotMode.tsx` | niepotwierdzone (kod, nie analizowano treści pliku w tym przebiegu) | niepotwierdzone (kod) | Table |
| `tbl_framework` | "Framework Generator" | `setShowFrameworkGen(true)` → `FrameworkGenerator.tsx` | niepotwierdzone (kod) | niepotwierdzone (kod) | Table |

### 2.3 AI zaznaczenia (multi-select)

- **Brak realnej, wspólnej dla wielu-zaznaczonych-elementów akcji AI.** Wszystkie żywe akcje "dla zaznaczenia" w praktyce operują na **jednym, głównym** zaznaczonym węźle (`handlers.getSelectedNode()` w Mind Mapie zwraca pojedynczy węzeł nawet gdy wiele jest zaznaczonych na canvasie).
- Jedyny kod, który realnie buduje strukturę `selection: {type, count, ids, primaryId}` z **wieloma** id naraz, to `runWhiteboardAIAction` w `IdeaWhiteboardTool.tsx` (`selectedNodeIds` przekazywane do kontekstu generatora `wb_ai_*`) — ale **czy backend faktycznie zawęża wynik do tej selekcji, a nie do całej tablicy, jest niepotwierdzone (kod)** (formattery `wb_find_themes`/`wb_name_clusters` w `ideaAIGeneratorService.ts` nie filtrują jawnie po `context.selection` w kodzie przejrzanym w tym przebiegu).
- `handleGenerateCanvasAI` w `IdeaMapWorkspace.tsx` miał obsługiwać `selection.type/count/ids/primaryId` cross-tool — **martwy kod** (§0 pkt 2), więc to zaprojektowane, ale niedziałające.
- Grupowanie (`mm_group`/Ctrl+G) tworzy ramkę wokół zaznaczenia — to NIE jest akcja AI, tylko wizualne pogrupowanie (dla porządku wykluczone z tej tabeli, ale mogło zostać pomylone z "AI dla zaznaczenia" przy pobieżnym audycie).

### 2.4 AI pojedynczego elementu (węzeł/wiersz)

| Akcja | Etykieta UI | Handler | Endpoint | Preview/auto | Narzędzia |
|---|---|---|---|---|---|
| `mm_ai_expand_node` | "Expand this node" | `handleAIExpand(nodeId)` z kontekstem przodków (do 5 poziomów) | `/map/expand` | Proposal | **Mind Map only** |
| `mm_ai_rewrite_node` | "AI: Rewrite this node" | `window.prompt()` → `Api.chatWithAIStream` (raw system prompt) → `AIProposalBatch` lokalnie zbudowany | `chatWithAIStream` (surowy czat, NIE `/ai-generate`) | Proposal (`IdeaProposalReview`, `patch.updateNodes`) | **Mind Map only** |
| `mm_ai_deepen` | "Deepen topic" | deleguje do czatu z kontekstem (tagi, typ semantyczny) | brak (delegacja) | n/d | **Mind Map only** |
| `mm_ai_summarize_branch` | "Summarize branch" | `dispatchEvent('idea-mindmap-summarize-branch')` → nieprzeanalizowany dalej w tym przebiegu (niepotwierdzone, gdzie dokładnie ląduje) | niepotwierdzone (kod) | niepotwierdzone | **Mind Map only** |
| `mm_ai_what_if` | "What-if analysis" | `setShowWhatIf(true)` — osobny modal | niepotwierdzone (kod, treść modala poza zakresem tego przebiegu) | niepotwierdzone | Mind Map only |
| `mm_chat_about_node` / "Ask AI about this node" | otwiera czat z kontekstem węzła | `handlers.onOpenChat(prompt)` | brak (delegacja) | n/d | Mind Map only |
| `edit_step` (proces) | "AI rewrite step" — J26 kanał 2 | `createStepRewriteProposal({nodeId, instruction})` | `/ai-generate` (`edit_step`) | Proposal z before/after walidacją i readback | **Process Flow only** |
| `node_expand` (proces, gdy dokładnie 1 węzeł zaznaczony) | (brak dedykowanego przycisku — automatyczny wybór generatora w `createProposal`) | `useProcessFlowAIProposal.createProposal` | `/ai-generate` | Proposal | Process Flow only |
| `ai_suggest_links` / `mm_ai_suggest_links_execute` | "Suggest links" | dispatch → `IdeaMapWorkspace` handler → `generateAIProposal({generatorType:'ai_propose_attachments'})` | `/ai-generate` | Proposal (`IdeaProposalReview`, `setActivePanel('tools')`) | **Mind Map only** (event nazwany `idea-mindmap-*`, wywoływany tylko z `FloatingAIPopover`/`AIActionsPopover`) |
| `wb_name_clusters` | "AI: Name clusters" | `runWhiteboardAIAction` | `/ai-generate` | Proposal (`updateNodes` — rename istniejących) | **Whiteboard only** |

### 2.5 AI edge

- **Brak dedykowanej akcji AI operującej wprost na krawędzi** (żaden `EdgeContextMenu`/`EdgeStylePopover` w żadnym z 4 narzędzi nie ma pozycji AI — potwierdzone grepem, tylko manualne: dodaj/edytuj etykietę, wstaw węzeł na krawędzi, odwróć kierunek, zmień styl, usuń).
- Najbliższe substytuty, które **tworzą** krawędzie (ale nie operują na już istniejącej):
  - `mm_ai_auto_connect` — deleguje do czatu, ma tworzyć "cross-links" w całej mapie (Mind Map only, brak strukturalnego proposal).
  - `AIDependencyDetector.tsx` (`mm_dependency_detect`) — wykrywa zależności międzygałęziowe i proponuje nowe krawędzie z etykietą relacji (`depends_on`/`enables`/`conflicts_with`/`related_to`), z UI Add pojedynczo / Add All. **Mind Map only.**
  - `wb_to_map_branches`/cross-tool patche zawierają `addEdges`, ale to efekt uboczny transformacji struktury, nie "AI dla konkretnej krawędzi".
- **Wniosek:** kategoria "AI edge" w praktyce nie istnieje jako samodzielna funkcja — jest pokryta tylko pośrednio przez generatory tworzące nowe krawędzie.

### 2.6 AI tabeli

| Akcja | Etykieta UI | Handler | Endpoint | Preview/auto | Ryzyko |
|---|---|---|---|---|---|
| `tbl_categorize` | "AI Categorize" | `AICategorizeTool.handleAnalyze()` → `Api.getIdeaAISuggestions` z promptem żądającym surowego JSON w polu `text`, parsowanym regexem `/\{[\s\S]*\}/` | `/ai-suggestions` (hack: structured JSON wciśnięty w pole przeznaczone na tekst) | **Proposal-per-item** (`Apply`/`Apply all` per klaster, `Merge` dla duplikatów) | Fallback lokalny (keyword-matching) gdy parsowanie JSON zawiedzie — cichy, degraduje jakość bez ostrzeżenia usera |
| `tbl_autofill_from_artifact` | (brak widocznego przycisku w tym przebiegu — akcja z eventu, prawdopodobnie z menu wiersza) | bezpośrednio w `useTableQuickActions.ts` | `/ai-generate` (`ai_autofill_mappings`, status `partial`) | **AUTO-APPLY natychmiastowe** — `nodesUndo.push(...)` od razu nadpisuje pola wybranych wierszy | **RYZYKO** — brak accept/reject, jedyna siatka bezpieczeństwa to ogólny undo-stack tabeli |
| `tbl_refresh_artifact_data` | "Refresh from artifacts" | jw. | `/ai-generate` (`ai_autofill_mappings`) | **AUTO-APPLY natychmiastowe** | **RYZYKO** — jak wyżej |
| `tbl_framework` | "Framework Generator" | `setShowFrameworkGen(true)` | niepotwierdzone (kod, `FrameworkGenerator.tsx` nie analizowany w tym przebiegu) | niepotwierdzone | niepotwierdzone |
| `tbl_copilot` | "AI Copilot" | `setShowCopilot(true)` → `AICopilotMode.tsx` | niepotwierdzone (kod) | niepotwierdzone | niepotwierdzone |
| Inline AI fill (kolumna typu `ai_generated`) | komórka tabeli | `InlineAIFill.tsx` | wzmianka w `my-work.routes.ts` (~linia 9986 "AI auto-fill for ai_generated column type") — endpoint nieprzeanalizowany w tym przebiegu | niepotwierdzone (kod) | niepotwierdzone |
| `ai_build_linked_table` (backend generator, status `real`) | brak zidentyfikowanego wywołania z UI Table w tym przebiegu — może być wywoływany z Mind Mapy/Whiteboardu przy tworzeniu połączonej tabeli | — | `/ai-generate` | niepotwierdzone (kod) | — |

**Wniosek dla tabeli:** to jedyne z 4 narzędzi, gdzie znaleziono **potwierdzony auto-apply bez żadnego kroku akceptacji** (`tbl_autofill_from_artifact`, `tbl_refresh_artifact_data`) — inaczej niż w Mind Mapie/Whiteboardzie/Process Flow, gdzie każda żywa ścieżka AI-generate przechodzi przez jakiś ekran podglądu.

### 2.7 AI tworzące nowy artefakt

| Akcja | Mechanizm | LLM w momencie akcji? | Preview/auto | Cofnięcie |
|---|---|---|---|---|
| `convert_initiative`/`convert_decision`/`convert_task_set`/`convert_report`/`convert_presentation` (+ warianty `wb_convert_*`, `pf_convert_*`, `tbl_convert_*`) | `handleConvert()` → `POST /my-ideas/:id/convert` | **NIE** — field-mapping z `title`/`body`/`ai_expansion`/`summary_data` już zapisanych wcześniej (te pola MOGŁY powstać z AI, ale sama konwersja to nie jest wywołanie LLM) | **Auto-apply natychmiastowe** — tworzy realny rekord Initiative/Decision/Task/Report i toastuje sukces | Brak dedykowanego cofnięcia — trzeba ręcznie skasować nowo utworzony rekord w jego module |
| Teresa chat → `generateDeliverable.ts`/`canvasGraphLlm.ts` | Prawdziwy LLM pass tworzący cały graf/dokument | **TAK** | Tworzy nowy artefakt od razu (to jest sam akt "stwórz") | n/d — to jest tworzenie, nie edycja istniejącego |
| `wb_to_map_branches` / `wb_to_table` (whiteboard "transform to…") | `generateAIProposal` → proposal `generatorStatus:'cross-tool'` | TAK (LLM generuje strukturę branches/columns) | Proposal (accept/reject) — ALE po akceptacji ląduje jako sticky notes na TEJ SAMEJ tablicy, **nie tworzy** faktycznego nowego artefaktu innego typu | Reject = nic się nie dzieje; accept = trzeba ręcznie posprzątać na docelowym narzędziu |

### 2.8 AI tworzące propozycje do akceptacji

To najliczniejsza i najlepiej zaprojektowana kategoria — patrz §1 (mechanizmy) i §5 (proposal-based vs auto-apply) dla pełnej listy. Skrót: `mm_ai_expand(_node)`, `mm_ai_rewrite_node`, `ai_suggest_links`, `mm_dependency_detect` (Mind Map); `wb_ai_find_themes`, `wb_ai_name_clusters`, `wb_ai_to_map`, `wb_ai_to_table`, `wb_ai_extract_actions` (Whiteboard); `flow_generator`/`node_expand`/`edit_step` przez `pf_create`/selekcja/`edit_step` (Process Flow); `tbl_categorize` (Table, ale własny UI, nie wspólny widget).

---

## 3. Nazwane akcje ze zlecenia — tabela zbiorcza

| Nazwana akcja | Czy istnieje? | Gdzie (narzędzia) | Preview/auto | Status |
|---|---|---|---|---|
| **AI expand** | Tak | Mind Map (`mm_ai_expand`, `mm_ai_expand_node`) | Proposal | Działa |
| **AI Coach** | Tak | Process Flow (toolbar "AI Coach" → `process_coach`) | Read-only insighty, nie modyfikuje canvasu | Działa |
| **AI Proposal** (mechanizm Propose→Accept) | Tak, ale **dwie niezależne implementacje** komponentu `IdeaProposalReview` (workspace-level w `IdeaMapWorkspace.tsx` i osobna w `IdeaWhiteboardTool.tsx`) + osobny `AIProposalDiffModal` tylko dla `map/expand` | Mind Map, Whiteboard, Process Flow (własny panel `AIProposalPanel`/`useProcessFlowAIProposal`, nie `IdeaProposalReview`) | Proposal | Działa, ale **rozdrobniony na 3 różne UI** zamiast jednego wspólnego (ryzyko niespójności wizualnej — zbieżne z doktryną SPEC-A o jednym standardzie) |
| **AI summarize** | Tak (`mm_ai_summarize` — mapa; `process_summary` — proces) | Mind Map (delegacja do czatu), Process Flow (`generateProcessSummary`, real) | Mind Map: n/d (czat). Process Flow: read-only wynik | Częściowo — Mind Map to tylko prompt-forwarding, nie strukturalne wywołanie |
| **AI categorize/cluster** | Tak | Mind Map: `mm_ai_cluster` (heurystyka klient-side, **NIE LLM** — zablokowane za flagą `mindmapHeuristicAiOverlays`, domyślnie "Coming soon"), `mm_auto_cluster` (czysta heurystyka lokalna, keyword matching, zero AI); Whiteboard: `wb_ai_find_themes`/`wb_ai_name_clusters` (real LLM); Table: `tbl_categorize` (real LLM przez `/ai-suggestions` hack) | Mieszane | Mind Map "AI cluster" to **fałszywe AI** (etykieta "AI" ale silnik to reguły `if/else` po słowach kluczowych — patrz `mm_auto_cluster` w `useMindMapQuickActions.ts` linia ~785) |
| **AI validate** | **Nie istnieje** jako akcja AI | — | — | Walidacja (`validateFlow.ts`, "Waliduj" w Process Flow) to czysta heurystyka bez LLM (potwierdzone) |
| **AI suggest links** | Tak | Mind Map only (`ai_suggest_links`/`mm_ai_suggest_links_execute`) | Proposal (`ai_propose_attachments`, status `partial`) | Działa tylko w Mind Mapie |
| **AI find gaps** | Tak | Mind Map only (`mm_ai_gap_analysis`) | Delegacja do czatu — brak structured proposal | Działa jako prompt-forward, nie jako pełny generator |
| **AI transform to table** | Tak | Whiteboard only (`wb_ai_to_table` → `wb_to_table`, `generatorStatus:'cross-tool'`) | Proposal, ale ląduje jako sticky notes na tej samej tablicy (nie realna tabela) | Działa częściowo — nazwa myląca względem efektu |
| **AI transform to mind map** | Tak | Whiteboard only (`wb_ai_to_map` → `wb_to_map_branches`) | jw. — sticky notes na tablicy, brak przełączenia narzędzia | Działa częściowo — jw. |
| **AI rewrite step** | Tak | Process Flow only (`edit_step` przez `createStepRewriteProposal`, J26 kanał 2) | Proposal z before/after walidacją | Działa, dobrze zaprojektowane (jedyne miejsce z pełnym before/after) |
| **AI for selected item** | Tak, ale **tylko pojedynczy element** mimo wielokrotnego zaznaczenia (patrz §2.3) | Mind Map (`getSelectedNode()` = 1 węzeł), Whiteboard (`selectedNodeIds` — wieloelementowe, ale zawężenie po stronie backendu niepotwierdzone) | Zależnie od akcji | Ograniczone — brak prawdziwej AI-dla-wielu-zaznaczonych poza whiteboardem (niepotwierdzone czy działa) |

---

## 4. "Czy da się cofnąć?" / historia — przegląd

| Ścieżka | Undo dedykowany dla akcji AI? | Historia/log akcji AI? |
|---|---|---|
| Mind Map — `map/expand` proposal | `pushUndo()` wywołane PRZED `applyAIProposal` → wchodzi w globalny stos undo/redo mapy (Ctrl+Z cofa całą aplikację propozycji jako jedną operację) | `aiExpansionHistory` per-node (dopisywane do `data.aiExpansionHistory` przy każdej ekspansji) + globalny `SnapshotHistory` (per-idea, łapie extensions) |
| Mind Map — `mm_ai_rewrite_node` | Idzie przez `IdeaProposalReview` → `applyProposalPatches` → prawdopodobnie też `pushUndo` (niepotwierdzone bezpośrednio w tym przebiegu, ale wzorzec spójny z resztą pliku) | Brak dedykowanego logu poza ogólnym undo-stackiem |
| Whiteboard — `wb_ai_*` proposals | `pushUndoSnapshot()` wywołane w `insertProposalGraph` PRZED zmianą | `appendActivity(createWhiteboardActivityEntry('ai', ...))` — **jest dedykowany log aktywności AI** (generated/accepted/rejected/accepted-all/rejected-all), najlepszy z czterech narzędzi pod tym względem |
| Process Flow — proposal (`flow_generator`/`edit_step`/`node_expand`) | `resolveProposal('accept')` → `onApply` → host robi `pushUndo` (zgodnie z komentarzem w kodzie) | Niepotwierdzone (kod) czy jest dedykowany log aktywności AI analogiczny do whiteboardu |
| Table — `tbl_autofill_from_artifact`/`tbl_refresh_artifact_data` | **TAK, ale tylko generyczny** `nodesUndo.push(...)` (Ctrl+Z) — brak dedykowanego potwierdzenia przed zmianą | **Brak logu** — żadnego śladu poza samym undo-stackiem |
| Table — `tbl_categorize` (`AICategorizeTool`) | Niepotwierdzone czy `onApplyTags`/`onApplyCluster` w wywołującym komponencie owijają w `nodesUndo.push` | Brak widocznego logu w samym `AICategorizeTool.tsx` |
| `convert_*` (nowy artefakt) | **Brak** — nowy rekord trzeba ręcznie skasować w jego własnym module | Link graph (`createLinkGraphEdge`) tworzy ślad powiązania idea→artefakt, ale to nie jest "historia AI", tylko relacja |

---

## 5. Proposal-based (bezpieczne, accept/reject) vs Auto-apply (ryzyko)

### 5.1 Proposal-based — wymaga jawnej akceptacji, ma podgląd
- Mind Map: `mm_ai_expand`, `mm_ai_expand_node`, `mm_create`, `mm_ai_rewrite_node`, `ai_suggest_links`, `mm_dependency_detect`
- Whiteboard: wszystkie `wb_ai_*` (`wb_find_themes`, `wb_name_clusters`, `wb_to_map_branches`, `wb_to_table`, `wb_extract_actions`)
- Process Flow: `pf_create`(`flow_generator`), `node_expand` (auto przy 1 zaznaczonym węźle), `edit_step` (`pf_analyze`→AI Coach jest read-only, nie w tej kategorii)
- Table: `tbl_categorize` (per-item Apply/Apply all, ale własny UI zamiast wspólnego widgetu)

### 5.2 Auto-apply — zmienia dane natychmiast, bez ekranu akceptacji
- **Table:** `tbl_autofill_from_artifact`, `tbl_refresh_artifact_data` — jedyne bezpieczeństwo to ogólny undo-stack (Ctrl+Z), zero jawnego potwierdzenia przed nadpisaniem pól
- **Konwersja artefaktów:** `convert_initiative`/`convert_decision`/`convert_task_set`/`convert_report`/`convert_presentation` (i warianty `wb_/pf_/tbl_convert_*`) — tworzy realny nowy rekord natychmiast po kliknięciu, zero podglądu, zero potwierdzenia ("czy na pewno?")
- **Mind Map heurystyki fałszywie oznaczone jako AI:** `mm_auto_cluster` (czysta logika `if/else` po słowach-kluczowych, zero LLM) modyfikuje graf od razu (dodaje węzły-branch, przepina krawędzie) bez żadnego kroku akceptacji — ale to nie jest prawdziwe AI, więc ryzyko jest niższe (błąd = zła heurystyka klastrowania, nie halucynacja LLM)

### 5.3 Brak undo/historii — miejsca do poprawy
1. **Table** — zarówno auto-apply (`tbl_autofill_from_artifact`/`tbl_refresh_artifact_data`) jak i proposal-based (`tbl_categorize`) nie mają żadnego dedykowanego logu aktywności AI (whiteboard ma `createWhiteboardActivityEntry('ai', ...)` — dobry wzorzec do skopiowania).
2. **`convert_*`** — brak jakiegokolwiek cofnięcia poza ręcznym skasowaniem nowego rekordu w docelowym module; brak nawet potwierdzenia przed utworzeniem.
3. **Duplikacja `IdeaProposalReview`** (Mind Map/workspace-level vs Whiteboard-level, osobne instancje state) — z perspektywy przyszłego utrzymania warto rozważyć jeden współdzielony provider zamiast dwóch kopii tej samej logiki accept/reject/acceptAll/rejectAll.

---

## 6. Pliki źródłowe (referencja)

- `src/components/MyWork/mindmap/toolbar-popovers/AIActionsPopover.tsx` — popover AI (kontekst: cały map + węzeł), 6 generatorów ogólnych + 4 node-specific
- `src/components/MyWork/mindmap/floating-toolbar/FloatingAIPopover.tsx` — pływający popover przy zaznaczonym węźle, 6 akcji
- `src/components/MyWork/mindmap/useMindMapQuickActions.ts` (1246 linii) — jedyny handler `mm_*`, montowany tylko w Mind Mapie
- `src/components/MyWork/IdeaRecommendationMap.tsx` — `handleAIExpand`, `applyAIProposal`, `AIProposalDiffModal`
- `src/components/MyWork/IdeaMapWorkspace.tsx` (~3900 linii) — powłoka; `handleConvert`, `handleGenerateCanvasAI` (martwy), `proposalBatch`/`IdeaProposalReview` (workspace-level), listener `idea-mindmap-rewrite-node`
- `src/components/MyWork/aiProposalRuntime.ts` — `applyAIProposalRuntime` (silnik patchowania nodes/edges/extensions, wspólny dla wielu ścieżek)
- `src/components/MyWork/IdeaProposalReview.tsx` — widget UI accept/reject/acceptAll/rejectAll (2 niezależne instancje w kodzie)
- `src/components/MyWork/IdeaAISuggestionsPanel.tsx` — panel workspace-level, sekcja "AI generators" (mislabeled dla whiteboardu — §0.3)
- `src/components/MyWork/IdeaCanvasDiscovery.tsx` — **martwy kod**, "Canvas OS" generic rail z `onGenerateAI`
- `src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts` + `IdeaWhiteboardTool.tsx` — `wb_ai_*`, `runWhiteboardAIAction`, własna kopia proposal review
- `src/components/MyWork/whiteboard/whiteboardProposalPatch.ts` — `toWbNodeKind` (normalizacja cross-tool node types → sticky)
- `src/components/MyWork/processflow/useProcessFlowQuickActions.ts` + `useProcessFlowAIProposal.ts` — `pf_create`, `pf_analyze`, `edit_step`, before/after walidacja
- `src/components/MyWork/mindmap/AIDependencyDetector.tsx` — `mm_dependency_detect`, cross-branch edges
- `src/components/MyWork/table/useTableQuickActions.ts` — `tbl_autofill_from_artifact`/`tbl_refresh_artifact_data` (auto-apply!), `tbl_categorize`
- `src/components/MyWork/table/AICategorizeTool.tsx` — JSON-w-tekście hack przez `/ai-suggestions`
- `src/services/ideaAIGenerator.ts` — `GeneratorType` union + `GENERATOR_STATUS_MAP` (SSOT dojrzałości backendu)
- `src/services/api.ts` — `expandMyIdeaMap`, `generateIdeaAI`, `getIdeaAISuggestions`, `convertMyIdea`
- `server/src/routes/my-work.routes.ts` (linie ~5891-6021 `ai-generate`, ~6982-7068+ `convert`) — walidacja Zod, guard własności idei
- `server/src/services/ideaAIGeneratorService.ts` (2533 linie) — ~40 gałęzi `generatorType`
- `server/src/services/ai/canvasGraphLlm.ts` + `server/src/services/ai/tools/generateDeliverable.ts` — silnik tworzenia całych nowych artefaktów z czatu

---

## 7. Otwarte niepewności (niepotwierdzone (kod) — do doprecyzowania przy dalszym audycie)

- Czy `wb_find_themes`/`wb_name_clusters` na backendzie faktycznie zawężają analizę do `context.selection`, czy zawsze biorą całą tablicę (kod formatterów przejrzany, ale filtrowanie wejścia po stronie promptu/LLM nie było w zakresie tego przebiegu).
- Treść i mechanizm `tbl_ai_assistant`, `tbl_copilot` (`AICopilotMode.tsx`), `tbl_framework` (`FrameworkGenerator.tsx`), `InlineAIFill.tsx`, `mm_ai_summarize_branch` (`idea-mindmap-summarize-branch` listener), `mm_ai_what_if` (`WhatIfAnalysis` modal) — zidentyfikowane jako punkty wejścia, ale zawartość docelowa nie była czytana linia-po-linii w tym przebiegu.
- Czy `pf_create`/`useProcessFlowAIProposal` ma dedykowany log aktywności AI analogiczny do whiteboardowego `createWhiteboardActivityEntry`.
- Czy `AICategorizeTool`'s `onApplyTags`/`onApplyCluster`/`onMergeNodes` (przekazywane z rodzica) owijają zmiany w undo-stack tabeli.
