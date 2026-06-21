# Analiza UI/UX puli Ideas (M05–M09) przeciw 5 zasadom Piotra

> Data: 2026-06-21 · Branch: Londyn · Autor: agent-analityk UI/UX
> Zakres: 4 narzędzia My Work (Mind Map / Process Flow / Table / Whiteboard) + warstwa zarządzania M05 (lista pomysłów)
> Charakter: czysto analityczny (czytanie kodu). Brak zmian w kodzie aplikacji.

---

## 1. Streszczenie

Pula Ideas jest **zunifikowana w ~65%**, nie w 50% jak zakładał brief — i to w sposób głębszy niż widać po samych hookach klawiatury. Istnieje realny **wspólny shell** (`IdeaMapWorkspace.tsx`, ~3300 linii) który hostuje wszystkie 4 narzędzia i dostarcza im wspólnie: toolbar, panel kontekstu, panel AI-sugestii, command palette, unified search, pobranie kontekstu organizacji oraz routing propozycji AI. Pod spodem istnieje **wspólny canvas-OS** (`src/components/MyWork/canvas/`) oraz **jeden, naprawdę wspólny model persystencji** — `useIdeaMapSync` (POST `/map/sync`, wersjonowanie + 409-conflict) — którego używają **wszystkie 4 narzędzia** (Table bezpośrednio, Mind Map przez `workspaceGraphRuntime`, Process Flow i Whiteboard bezpośrednio). To koryguje główną tezę briefu: persystencja NIE dywerguje.

**Gdzie dywergencja jest realna i bolesna:** (a) **klawiatura** — Process Flow i Whiteboard używają wspólnego `useCanvasKeyboard`, a Mind Map ma własny ~400-linijowy handler (`IdeaRecommendationMap.tsx:3146`), Table żadnego canvas-kontraktu (to grid); (b) **command palette** — istnieje wspólny `CommandPalette` na poziomie workspace, ale Mind Map dorobił **drugi, własny** `MindmapCommandPalette`; (c) **styl/tokeny** — Mind Map ma 70 literałów hex, Whiteboard 15, Process Flow i Table 0 (czyste klasy Tailwind); (d) **multiplayer** — bardzo nierówny (Whiteboard 45 odwołań, Table 43, Mind Map 20, Process Flow 5).

**Teresa (AI):** dociera do wszystkich 4 narzędzi spójnym kanałem zdarzeń `idea-workspace-quick-action` — każde narzędzie ma własny `use*QuickActions` (mindmap 992 lin, table 274, processflow 123, whiteboard 124). Asymetria liczbowa (Mind Map 33 odwołania vs Table 8) odzwierciedla głównie **głębokość katalogu akcji**, nie brak integracji. Jest jeden architektoniczny dług: istnieje wzorcowy hook `useIdeasTeresaBridge` (`canvas/useIdeasTeresaBridge.ts`), ale **nikt go nie używa** — narzędzia słuchają surowego eventu zamiast wspólnego bridża.

**Kontekst organizacji:** 4 narzędzia mają 0 bezpośrednich odwołań do org-context, ale to **świadomy, dobry wzorzec** — kontekst wstrzykuje **serwer** (`ideaAIGeneratorService.buildOrgContext` → `OrganizationContextService.buildResolvedContext`: profil firmy, SIRI/ADMA, inicjatywy, KPI) oraz **shell** (`IdeaMapWorkspace:1099` `Api.organizationContextGet()` → wzbogaca każdą propozycję AI). Tools nie powinny i nie muszą znać org-context bezpośrednio.

**Lekki UI:** Process Flow i Table są wzorcowo lekkie (0 hex, klasy Tailwind/tokeny). Mind Map jest najcięższy wizualnie (70 hex) i to jedyne narzędzie z realnym długiem „budżetu czerwieni" do sprawdzenia.

---

## 2. Macierz spójności (5 zasad × 5 powierzchni)

Legenda: ✅ spełnia · 🟡 częściowo / przez shell · ❌ luka

| Zasada | Mind Map | Process Flow | Table | Whiteboard | M05 (lista) |
|---|---|---|---|---|---|
| **1. Spójność (model interakcji / shell / persystencja)** | 🟡 | ✅ | 🟡 | ✅ | 🟡 |
| **2. Metody jak u konkurencji (canvas/skróty/cmd-palette/multiplayer)** | 🟡 | 🟡 | 🟡 | ✅ | ❌ |
| **3. Sterowanie Teresą (AI)** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **4. Praca na kontekście organizacji** | ✅ | ✅ | ✅ | ✅ | 🟡 |
| **5. Lekki UI (tokeny / budżet czerwieni / biały primary)** | ❌ | ✅ | ✅ | 🟡 | 🟡 |

**Dowody per komórka — patrz §4 (analiza per zasada).**

Skrócony odczyt:
- **Process Flow + Whiteboard** = wzorce referencyjne (adoptowały cały canvas-OS).
- **Mind Map** = najbogatsze funkcjonalnie, ale najbardziej zdywergowane (własna klawiatura, własny cmd-palette, 70 hex).
- **Table** = lekkie i spójne persystencyjnie, ale to grid — z natury poza canvas-keyboard; ma własny model interakcji (komórki).
- **M05** = warstwa zarządzania (CRUD list/folderów) jest poza canvas-OS i nie ma sterowania Teresą ani command-palette.

---

## 3. Mapa wspólnego canvas-OS i jego adopcji

Katalog `src/components/MyWork/canvas/` — faktyczni konsumenci (z grep):

| Wspólny moduł | Mind Map | Process Flow | Table | Whiteboard |
|---|---|---|---|---|
| `useIdeaMapSync` (persystencja, 409-safe) | ✅ (przez `workspaceGraphRuntime`) | ✅ bezpośrednio | ✅ bezpośrednio (`useTablePersistence:111`) | ✅ bezpośrednio |
| `getIdeasToolInteractionProps` (Miro-style ReactFlow) | ✅ `IdeaRecommendationMap` | ✅ | n/d (grid) | ✅ |
| `useCanvasKeyboard` (kontrakt skrótów) | ❌ własny handler `:3146` | ✅ `:1672` | n/d (grid) | ✅ `:2671` |
| `CanvasZoomControls` | ✅ | ✅ | n/d | ✅ |
| `useCanvasContextMenu` (`useIdeasToolContextMenu`) | ❌ (własne menu) | ❌ (własne `ProcessFlowContextMenu`) | ❌ | ❌ |
| `useIdeasTeresaBridge` | ❌ (surowy event) | ❌ | ❌ | ❌ |

**Wniosek architektoniczny:** wspólny canvas-OS jest **napisany, ale niedokończony w adopcji**. Persystencja i interaction-props są przyjęte szeroko. Klawiatura, context-menu i Teresa-bridge mają wspólny kod, który albo jest adoptowany połowicznie (klawiatura: 2/3 canvasów), albo wcale (context-menu i bridge: 0 konsumentów mimo gotowego API).

---

## 4. Analiza per zasada (z dowodami file:line)

### Zasada 1 — Spójność (jednolity model zarządzania i pracy)

**Stan: częściowo spełniona przez wspólny shell, dziurawa na poziomie klawiatury i menu.**

- **Wspólny shell:** `IdeaMapWorkspace.tsx` montuje wszystkie 4 narzędzia warunkowo (`activeTool === 'mindmap' | 'table' | 'process_flow' | 'whiteboard'`, linie 2822/2901/2925/2948) i otacza je tym samym toolbar/panelami (`IdeaWorkspaceToolbar:3001`, `IdeaContextPanel:3111`, `IdeaAISuggestionsPanel:3132`, `IdeaUnifiedSearch:3270`). To realna, mocna spójność na poziomie ramki.
- **Wspólna persystencja (KOREKTA briefu):** `useIdeaMapSync` (`canvas/useIdeaMapSync.ts`) jest jedynym kanałem zapisu. Table: `useTablePersistence.ts:111`. Mind Map: `useMindMapPersistence.ts` przez `externalRuntime.captureGraph` → `workspaceGraphRuntime` → `useIdeaMapSync`. Wszystkie idą na `POST /map/sync` z `baseVersion` i obsługą 409 (`useIdeaMapSync.ts:289`, `useMindMapPersistence.ts:735`). Komentarz w `useMindMapPersistence.ts:24-27` potwierdza: „same path as whiteboard, process_flow, and table".
- **Luka klawiatury (główny realny dług spójności):** Process Flow `IdeaProcessFlowTool.tsx:1672` i Whiteboard `IdeaWhiteboardTool.tsx:2671` wołają `useCanvasKeyboard` (kontrakt: Tab=child, Enter=sibling, F2=edit, Ctrl+Z/Y, Ctrl+D, Ctrl+0, Ctrl+L itd.). Mind Map ma **własny** handler `IdeaRecommendationMap.tsx:3146-3518` (rejestrowany na container + window z capture=true), który implementuje te same skróty osobno → ryzyko rozjazdu kontraktu i podwójnego utrzymania.
- **Context-menu:** wspólny `useCanvasContextMenu` + `getCommonContextMenuActions` (`canvas/useIdeasToolContextMenu.ts`) ma **0 konsumentów** — każde narzędzie renderuje własne menu.

> Werdykt: Mind Map 🟡, Process Flow ✅, Table 🟡 (grid, inny model z natury), Whiteboard ✅, M05 🟡.

### Zasada 2 — Metody jak u konkurencji (Miro/Notion/Linear)

**Stan: bazowy canvas Miro-style obecny, ale skróty/command-palette/multiplayer nierówne.**

- **Miro-style canvas:** wspólny `getIdeasToolInteractionProps` (`useIdeasToolDefaults.ts:29`) daje wszystkim 3 canvasom: `panOnDrag:[1,2]` (środkowy/prawy = pan), `selectionOnDrag`, space-hold pan (`panActivationKeyCode:'Space'`), zoom-on-scroll, minZoom 0.1 / maxZoom 3. To jest poziom Miro/FigJam. Adoptowane przez Mind Map, Process Flow, Whiteboard.
- **Command palette (luka):** istnieje wspólny `CommandPalette` + `useCommandPalette` (`MyWork/CommandPalette.tsx`) używany na poziomie `IdeaMapWorkspace:365`. ALE Mind Map dorobił **drugi** `mindmap/MindmapCommandPalette.tsx` i woła go z `IdeaRecommendationMap`. Dwa palety = ryzyko niespójnego zestawu komend i skrótu otwarcia.
- **Skróty (Linear-grade):** kontrakt w `useCanvasKeyboard` jest dobry, ale tylko 2/3 canvasów go używają (patrz Zasada 1). Mind Map ma równoległy zestaw.
- **Multiplayer (bardzo nierówny):** odwołania do collab/presence/socket: Whiteboard 45, Table 43, Mind Map 20, Process Flow **5**. Model org-scope realtime (`ideaCollabWs`, `useWhiteboardCollab`) jest najpełniej wpięty w Whiteboard; Process Flow praktycznie bez realtime. To rozjazd „klasy Miro" między narzędziami.
- **M05:** lista pomysłów (`MyIdeasListContent.tsx`) ma CRUD/foldery/bulk-delete (`:491`,`:917`), ale **brak command-palette i brak skrótów** — to klasyczna lista, nie powierzchnia Linear-grade. ❌

> Werdykt: Mind Map 🟡, Process Flow 🟡 (brak multiplayer), Table 🟡, Whiteboard ✅, M05 ❌.

### Zasada 3 — Sterowanie Teresą (AI), wszędzie spójnie

**Stan: spełniona — jeden kanał zdarzeń dla wszystkich 4 narzędzi; asymetria liczbowa to głębokość katalogu, nie brak integracji.**

- **Wspólny kanał:** Teresa → narzędzie przez `CustomEvent('idea-workspace-quick-action')`. Emiter w czacie: `AIChat/UnifiedChatPanel.tsx`. Słuchacze per narzędzie:
  - Mind Map: `mindmap/useMindMapQuickActions.ts` (992 lin; akcje `mm_add_child`, `mm_add_sibling`, `mm_fold_*`, `mm_expand_all`…, `:129+`).
  - Table: `table/useTableQuickActions.ts` (274 lin; `tbl_sort`, `tbl_filter`, `tbl_export_csv`, `tbl_autofill_from_artifact`, `tbl_link_artifact_to_row`…).
  - Process Flow: `processflow/useProcessFlowQuickActions.ts` (123 lin).
  - Whiteboard: `whiteboard/useWhiteboardQuickActions.ts` (124 lin).
- **Routing propozycji AI przez shell:** `IdeaMapWorkspace.handleGenerateCanvasAI` (`:1092`) → `generateAIProposal({ ideaId, generatorType, tool: activeTool, context })` → wspólny panel review (`setProposalBatch`, `IdeaAISuggestionsPanel`). Jeden tor dla wszystkich narzędzi.
- **Dług architektoniczny:** `useIdeasTeresaBridge` (`canvas/useIdeasTeresaBridge.ts`) został zaprojektowany jako wspólny bridge (listen + `emitIdeaToolStatus` zwrotny do czatu), ale **ma 0 konsumentów**. Narzędzia słuchają surowego `window.addEventListener('idea-workspace-quick-action')` zamiast bridża → brak spójnego statusu „started/completed/error" wracającego do Teresy.

> Werdykt: Mind Map ✅, Process Flow ✅, Table ✅, Whiteboard ✅, M05 ❌ (lista nie ma sterowania Teresą).

### Zasada 4 — Praca na kontekście organizacji

**Stan: spełniona — przez serwer i shell, nie przez tools. To poprawny wzorzec.**

- **0 bezpośrednich odwołań w tools** (potwierdzone grep: Mind Map / Process Flow / Whiteboard = 0; Table ma tylko `currentOrganization?.id` jako workspaceId, `:236`). To NIE jest luka — to separacja warstw.
- **Serwer wstrzykuje org-context do generacji AI:** `ideaAIGeneratorService.ts:656` `buildOrgContext(orgId)` → `OrganizationContextService.buildResolvedContext(orgId)` pobiera: nazwę/branżę/wielkość/lokalizację firmy (`:660-663`), wynik SIRI i ADMA z `assessments` (`:678-697`), aktywne inicjatywy (`:700`), KPI. To zasila każdą propozycję canvasowego AI realnymi danymi org.
- **Shell dokłada kontekst po stronie FE:** `IdeaMapWorkspace:1099` `Api.organizationContextGet()` → buduje `organizationContext` (summary + claims + strategy) i wkłada do `context.organizationContext` propozycji (`:1128`).

> Werdykt: Mind Map ✅, Process Flow ✅, Table ✅, Whiteboard ✅, M05 🟡 (lista nie konsumuje snapshotu, ale to nie jej rola).

### Zasada 5 — Lekki UI (OpenAI/Apple/Linear, budżet czerwieni, biały primary, tokeny)

**Stan: Process Flow i Table wzorcowe; Mind Map ma realny dług; Whiteboard pośrodku.**

Pomiar literałów koloru per narzędzie (grep):

| Narzędzie | literały hex (`#rrggbb`) | klasy czerwieni (`red-*`/`#ef4444`…) | użycia `var(--…)` |
|---|---|---|---|
| Mind Map (`IdeaRecommendationMap`) | **70** | 3 | 6 |
| Whiteboard | 15 | 1 | 0 |
| Process Flow | **0** | 0 | 0 |
| Table | **0** | 0 | 0 |

- **Mind Map** to jedyne narzędzie z poważnym długiem tokenizacji — 70 hardkodów hex. Wymaga sweepu na tokeny CSS i audytu „budżetu czerwieni".
- **Process Flow / Table** — czysto klasy Tailwind/tokeny, 0 hex. Wzorzec referencyjny.
- **Whiteboard** — 15 hex (prawdopodobnie palety sticky-notes; do weryfikacji czy świadoma paleta produktowa czy dług).

> Werdykt: Mind Map ❌, Process Flow ✅, Table ✅, Whiteboard 🟡, M05 🟡 (do osobnego sweepu wizualnego).

---

## 5. Porównanie z konkurencją

| Wzorzec konkurencji | Co pula Ideas już ma | Czego brakuje / nierówne |
|---|---|---|
| **Miro — canvas + pan/zoom** | ✅ Wspólny `getIdeasToolInteractionProps` (pan środkowy/prawy, space-pan, zoom-scroll, selekcja-boxem). Klasa Miro. | Mind Map ma własny tor klawiatury; context-menu niewspólne. |
| **Miro — multiplayer/presence** | ✅ Whiteboard (`useWhiteboardCollab`, org-scope realtime), Table dobrze wpięte. | Process Flow ~bez realtime (5 odwołań); Mind Map połowicznie (20). Brak spójnego presence/awareness w całej puli. |
| **Notion — AI inline + slash** | ✅ `IdeaSlashCommandMenu`, quick-actions per tool, propozycje AI z org-context. | Brak wspólnego Teresa-bridge (status zwrotny); akcje nie mają jednolitego katalogu. |
| **Linear — command palette + szybkość skrótów** | ✅ Wspólny `CommandPalette` na workspace; kontrakt skrótów w `useCanvasKeyboard`. | Dwa command-palety (workspace + Mind Map). Lista M05 bez palety i skrótów. Skróty nie w 100% canvasów. |
| **Linear/Apple — lekki, tokenowy UI** | ✅ Process Flow, Table (0 hex). | Mind Map 70 hex (dług). |

**Wniosek konkurencyjny:** fundament jest na poziomie Miro/Linear tam, gdzie canvas-OS został adoptowany (Process Flow, Whiteboard). Dwa narzędzia-rdzenie klientów (Mind Map, Table) ciągną w dół albo spójność interakcji (Mind Map: klawiatura/paleta/tokeny), albo nie pasują do modelu canvas z natury (Table: grid). M05 jest najdalej od standardu konkurencji (zwykła lista).

---

## 6. Plan migracji do spójności (kroki + priorytety + ryzyko)

> Reguła nadrzędna: **Mind Map i Table to żywy core klientów (VTS / Apator / Elkomtech)** — każda migracja musi być za feature-flagą lub w pełni za-pokryta testami żywymi (`tests/e2e/m06/m06-live.spec.ts`) przed wdrożeniem. Patrz [[finding_ideas_canvas_remount_on_edit]] — ten obszar już raz „nie dał się użyć" po regresji remount-on-edit.

### Priorytet P0 — niskie ryzyko, wysoka spójność (rób najpierw)

1. **Adopcja `useIdeasTeresaBridge` we wszystkich 4 narzędziach.**
   Zamiana surowego `window.addEventListener('idea-workspace-quick-action')` na hook bridża, który dodatkowo `emitStatus('started'|'completed'|'error')` z powrotem do Teresy.
   *Ryzyko: NISKIE* (addytywne, bridge tylko opakowuje istniejący event). *Korzyść: spójny feedback AI w czacie.*
   *Pliki:* `mindmap/useMindMapQuickActions.ts`, `table/useTableQuickActions.ts`, `processflow/useProcessFlowQuickActions.ts`, `whiteboard/useWhiteboardQuickActions.ts`.

2. **Tokenizacja Mind Map (zasada 5).** Sweep 70 literałów hex → tokeny CSS; audyt budżetu czerwieni (3 klasy red). Wzorzec: Process Flow/Table (0 hex).
   *Ryzyko: NISKIE–ŚREDNIE* (wizualny, łatwy do zweryfikowania screenshotami per [[rule_verify_before_claiming]]). *Plik:* `IdeaRecommendationMap.tsx`.
   Równolegle: weryfikacja 15 hex Whiteboard — czy świadoma paleta sticky, czy dług.

### Priorytet P1 — średnie ryzyko, rdzeń spójności interakcji

3. **Ujednolicenie command-palette.** Wycofać `MindmapCommandPalette` na rzecz wspólnego `CommandPalette` + rejestracja komend Mind Map jako `CommandItem[]` w workspace. Jeden palety, jeden skrót otwarcia.
   *Ryzyko: ŚREDNIE* (Mind Map ma najbogatszy katalog komend — wymaga pełnego przeniesienia, inaczej regres funkcji). Flaga + test żywy.

4. **Migracja klawiatury Mind Map na `useCanvasKeyboard`.** Zastąpić handler `IdeaRecommendationMap.tsx:3146-3518` wspólnym hookiem z callbackami; zostawić w Mind Map TYLKO akcje specyficzne (np. fold-levels) jako rozszerzenie, analogicznie do Process Flow `Shift+Enter` (`IdeaProcessFlowTool.tsx:1756`).
   *Ryzyko: WYSOKIE* (klawiatura to codzienna ścieżka klientów; capture=true handler ma subtelne zachowania). **Tylko za flagą + pełny przebieg `m06-live.spec.ts` + ręczny smoke w przeglądarce.** To największe ryzyko regresji w całym planie.

### Priorytet P2 — większe ujednolicenie, planowo

5. **Wspólne context-menu (`useCanvasContextMenu` + `getCommonContextMenuActions`).** 0 konsumentów dziś. Adopcja w Process Flow → Whiteboard → Mind Map (kolejność rosnącego ryzyka).
   *Ryzyko: ŚREDNIE.* Wspólne menu już ma API i18n (`labelPl`).

6. **Multiplayer parity dla Process Flow.** Wpiąć org-scope realtime (`ideaCollabWs`) jak w Whiteboard. Mind Map → dociągnąć do pełni.
   *Ryzyko: ŚREDNIE–WYSOKIE* (realtime + persystencja wersjonowana = ryzyko konfliktów). Osobny workstream.

7. **M05 do standardu Linear.** Dodać command-palette + skróty + (opcjonalnie) sterowanie Teresą do listy pomysłów (`MyIdeasListContent.tsx`).
   *Ryzyko: NISKIE* (nowa powierzchnia, nie dotyka canvasów).

### Czego NIE robić
- **Nie wymuszać canvas-keyboard na Table** — to grid; jego model interakcji (komórki, `onKeyDown` per-cell, `:1447`/`:1510`) jest poprawny i zgodny z Notion-database. Spójność Table = przez shell + persystencja + Teresa, nie przez canvas-OS.
- **Nie przepisywać persystencji** — `useIdeaMapSync` jest już wspólny i 409-safe. Teza briefu o dywergencji persystencji jest nieaktualna.

---

## 7. Decyzje dla Piotra

1. **Kolejność rdzenia:** czy najpierw domknąć **spójność (P0+P1: bridge, tokeny, klawiatura, paleta)**, czy najpierw **parity konkurencji (P2: multiplayer Process Flow)?** Rekomendacja: spójność najpierw — multiplayer to osobny, ryzykowny workstream.

2. **Mind Map keyboard — apetyt na ryzyko.** Migracja własnego handlera na wspólny hook (krok 4) to najwyższe ryzyko regresji w żywym core. Czy akceptujemy flagę + obowiązkowy żywy przebieg testów przed wdrożeniem, czy zostawiamy Mind Map z osobną klawiaturą i tylko kontraktowo synchronizujemy skróty (tańsze, mniej czyste)?

3. **Dwa command-palety.** Czy ujednolicamy na jeden (krok 3, koszt = przeniesienie bogatego katalogu Mind Map), czy akceptujemy `MindmapCommandPalette` jako świadomy wyjątek dla najbogatszego narzędzia?

4. **Whiteboard 15 hex** — produktowa paleta sticky-notes (świadoma) czy dług do tokenizacji? Decyzja przed sweepem z kroku 2.

5. **M05 ambicja** — czy lista pomysłów ma dostać command-palette + sterowanie Teresą (krok 7, podniesienie do standardu Linear/Notion), czy zostaje prostą listą zarządzającą?

---

### Załącznik — kluczowe pliki (ścieżki bezwzględne)

- Shell: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/MyWork/IdeaMapWorkspace.tsx`
- Canvas-OS: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/MyWork/canvas/` (`useIdeaMapSync.ts`, `useIdeasToolKeyboard.ts`, `useIdeasToolDefaults.ts`, `useIdeasTeresaBridge.ts`, `useIdeasToolContextMenu.ts`, `workspaceGraphRuntime.ts`)
- Mind Map: `…/src/components/MyWork/IdeaRecommendationMap.tsx` (handler klawiatury `:3146`), `…/mindmap/useMindMapPersistence.ts`, `…/mindmap/useMindMapQuickActions.ts`, `…/mindmap/MindmapCommandPalette.tsx`
- Process Flow: `…/src/components/MyWork/IdeaProcessFlowTool.tsx` (`useCanvasKeyboard` `:1672`), `…/processflow/useProcessFlowQuickActions.ts`
- Table: `…/src/components/MyWork/IdeaTableTool.tsx`, `…/table/useTablePersistence.ts` (`useIdeaMapSync` `:111`), `…/table/useTableQuickActions.ts`
- Whiteboard: `…/src/components/MyWork/IdeaWhiteboardTool.tsx` (`useCanvasKeyboard` `:2671`), `…/whiteboard/useWhiteboardCollab.ts`, `…/whiteboard/useWhiteboardQuickActions.ts`
- M05: `…/src/components/MyWork/MyIdeasListContent.tsx`
- Serwer org-context: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/services/ideaAIGeneratorService.ts` (`buildOrgContext` `:654`)
