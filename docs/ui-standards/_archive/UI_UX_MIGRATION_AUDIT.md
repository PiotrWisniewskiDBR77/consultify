# UI/UX Migration Audit

Status: `v0 - baseline for migration`
Date: 2026-05-01
Scope: Consultify UI/UX stabilization
Parent standard: `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`

## 1. Cel audytu

Ten dokument jest mapą migracji UI/UX. Nie jest listą życzeń estetycznych. Każdy wpis ma odpowiedzieć:

- jaki typ ekranu mamy teraz,
- jaki typ ekranu powinien być docelowo,
- które komponenty są kanoniczne,
- gdzie istnieje migration debt,
- co wymaga decyzji przed refactorem.

Audyt jest wykonywany przed przebudową ekranów. Implementacja bez wpisu audytowego jest wyjątkiem i wymaga zatwierdzenia.

## 2. Skala decyzji

| Decision           | Znaczenie                                                              |
| ------------------ | ---------------------------------------------------------------------- |
| `REFERENCE`        | Wzorzec do kopiowania lub wzorzec po drobnym hardeningu.               |
| `REFINE_REFERENCE` | Kandydat na wzorzec, ale wymaga małych korekt standardu/implementacji. |
| `REFACTOR`         | Ekran ma przejść migrację do standardu.                                |
| `MIGRATION_DEBT`   | Legacy/custom UI akceptowane tymczasowo, do wpisania w plan.           |
| `STANDARD_NEEDED`  | Najpierw trzeba opisać nowy komponent/wzorzec.                         |
| `DO_NOT_TOUCH`     | Nie ruszać do czasu decyzji produktowej/technicznej.                   |

## 3. Skala priorytetu

| Priority       | Znaczenie                                                       |
| -------------- | --------------------------------------------------------------- |
| `P0_REFERENCE` | Ekran wzorcowy, używany do standaryzacji innych.                |
| `P1_HIGH`      | Widoczny / często używany / mocno wpływa na odczucie aplikacji. |
| `P2_MEDIUM`    | Ważny, ale nie pierwszy w kolejce migracji.                     |
| `P3_LOW`       | Rzadki / legacy / do późniejszego sprzątania.                   |

## 4. Baseline: znane komponenty i shelle

### Zatwierdzone źródła komponentów

- `src/components/ui/primitives`
- `src/components/ui/composed`
- `src/components/ui/ResizableTable`
- `src/components/shared/ModuleHub`
- `src/components/shared/NModeLayout`
- `src/components/shared/PreviewPane`
- `src/components/shared/ToolWizard`

### Zatwierdzone typy ekranów

- `ModuleHub`
- `App Table`
- `Table + Preview Pane`
- `N-mode detail / artifact view`
- `ToolWizard`
- `Workspace + 3-tools strip`
- `Admin / control plane table`
- `Canvas / board / timeline view` jako osobny view mode, nie jako custom page shell.

## 5. Ekrany referencyjne - kandydaci

| Reference area           | Candidate files                                                                                      | Status             | Dlaczego                                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App Table + Preview      | `src/components/MyWork/DecisionsPanelContent.tsx`, `src/components/MyWork/DecisionPreviewPanel.tsx`  | `REFINE_REFERENCE` | Używa `TableWithPreviewLayout`, `ResizableTable`, preview state i quick actions. To najlepszy kandydat na wzór tabeli + preview, ale wymaga sprawdzenia raw buttonów i pełnej zgodności z nowym zakazem one-off UI. |
| ModuleHub large list     | `src/components/Interview/InterviewHub.tsx`                                                          | `REFINE_REFERENCE` | Ma deklarowany ModuleHub pattern, command row, preview bodies/footers i ResizableTable. Dobry pierwszy duży ekran migracyjny, bo dotyka realnego, ważnego workflow.                                                 |
| N-mode / artifact detail | `src/components/DiscoveryTools/ToolDocumentView.tsx`                                                 | `REFINE_REFERENCE` | Używa `NModeShell`, `NModeSections`, Menu 3 portal/actions. Wymaga uporządkowania lokalnych buttonów i potwierdzenia standardu dla AI actions w Menu 3.                                                             |
| Tool workspace           | `src/components/DiscoveryTools/ToolWorkspace.tsx`, `src/components/DiscoveryTools/ToolActionBar.tsx` | `STANDARD_NEEDED`  | Ma lokalny `ToolActionBar` i workflow toolowy. To dobry kandydat do doprecyzowania standardu dodatkowych control barów.                                                                                             |
| Admin / control plane    | `src/views/admin/AdminSettingsModule.tsx`, `src/components/Admin/shared/*`, `src/views/superadmin/*` | `REFACTOR`         | Dużo ekranów i lokalnych komponentów adminowych. Wymaga osobnej fali migracji, bo ma realne ryzyko rozjazdu tabel, action columns i control plane UX.                                                               |

## 6. Audyt modułów startowych

### 6.1 My Work / Decisions

| Field                   | Assessment                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Current pattern         | App Table + Preview candidate.                                                                                                                  |
| Target pattern          | `REFERENCE` dla App Table + Preview po hardeningu.                                                                                              |
| Known shared components | `TableWithPreviewLayout`, `ResizableTable`, `ColumnResizer`, `FilterDropdown`, preview body/footer.                                             |
| Main gaps               | Raw `<button>` nadal istnieją w kilku miejscach; trzeba rozróżnić dopuszczalne niskopoziomowe elementy tabeli od feature-level one-off buttons. |
| Migration decision      | `REFINE_REFERENCE`                                                                                                                              |
| Priority                | `P0_REFERENCE`                                                                                                                                  |
| Next action             | Focused compliance review: buttons, action column, preview parity, read-back, Menu 3 ownership.                                                 |

### 6.2 Interview

| Field                   | Assessment                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current pattern         | Unified ModuleHub / Golden Standard candidate.                                                                                                                                                                           |
| Target pattern          | ModuleHub + App Table + Preview where useful.                                                                                                                                                                            |
| Known shared components | `ModuleHub`, `GridView`, `ResizableTable`, `FilterDropdown`, `TableWithPreviewLayout`, interview preview components.                                                                                                     |
| Main gaps               | Duży plik z wieloma tabami i preview states; raw buttons w dynamic tabs/close controls mogą wymagać klasyfikacji; trzeba sprawdzić, czy wszystkie lokalne row/control patterns należą do Menu 3 albo view-local toolbar. |
| Migration decision      | `REFACTOR` jako pierwszy duży hub po wzorcu Decisions.                                                                                                                                                                   |
| Priority                | `P1_HIGH`                                                                                                                                                                                                                |
| Next action             | Rozbić audyt na tabs: Inbox/Sessions/Assigned/Templates/Insights. Dla każdego zatwierdzić target view: App Table, grid, preview, detail.                                                                                 |

### 6.3 Discovery Tools / Tools

| Field                   | Assessment                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current pattern         | Mixed: N-mode detail, ToolWizard/workspace, lokalne tool actions.                                                                                                 |
| Target pattern          | NMode detail for documents, ToolWizard for guided flow, Workspace 3-tools strip for workspaces.                                                                   |
| Known shared components | `NModeShell`, `NModeSections`, `EmbeddedView`, Menu 3 action button styles, PreviewPane components.                                                               |
| Main gaps               | Wiele raw buttons w tool phases i tool panels; `ToolActionBar` wymaga decyzji, czy jest zatwierdzonym `View-local Toolbar`/wizard navigation, czy migration debt. |
| Migration decision      | `STANDARD_NEEDED` + później `REFACTOR`.                                                                                                                           |
| Priority                | `P1_HIGH`                                                                                                                                                         |
| Next action             | Opisać standard dla tool flow control bars: bottom navigation, phase actions, AI phase actions, proposal governance cards.                                        |

### 6.4 Admin / Settings

| Field                   | Assessment                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current pattern         | Mixed control plane with local shared admin components.                                                                                                                                  |
| Target pattern          | App Table / control plane standard, shared buttons/cards/tables, no duplicate breadcrumbs/toolbars.                                                                                      |
| Known shared components | `src/components/Admin/shared/*`, app-level UI primitives, admin views.                                                                                                                   |
| Main gaps               | Istnieją lokalne `Admin/shared/Button`, `Card`, `AdminTable`, `EnhancedDataTable`. Trzeba zdecydować, czy stają się zatwierdzonym adapterem adminowym, czy migrują do `@/components/ui`. |
| Migration decision      | `REFACTOR` after Decisions/Interview baseline.                                                                                                                                           |
| Priority                | `P1_HIGH`                                                                                                                                                                                |
| Next action             | Osobny Admin inventory: Admin views, Admin shared components, SuperAdmin views, action column patterns, empty/error/degraded states.                                                     |

### 6.5 SuperAdmin

| Field                   | Assessment                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current pattern         | Large control plane with many submodules.                                                                                                                |
| Target pattern          | Control plane using App Table, Preview where useful, honest degraded states, in-app confirms for destructive actions.                                    |
| Known shared components | `src/views/superadmin/*`, `src/views/superadmin/*/*`, shared app UI.                                                                                     |
| Main gaps               | Bardzo szeroki obszar; nie migrować hurtowo. Wiele tabel i panels wymaga priorytetyzacji według ryzyka: security, API keys, approval workflows, support. |
| Migration decision      | `REFACTOR` in later high-risk slices.                                                                                                                    |
| Priority                | `P1_HIGH` for security/API/support, `P2_MEDIUM` for the rest.                                                                                            |
| Next action             | Podzielić na slices: Security/IAM, API/System, Support, Customers, Revenue, AI Platform.                                                                 |

### 6.6 AIChat / UnifiedChatPanel

| Field                   | Assessment                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current pattern         | Core AI runtime surface.                                                                                                                                                                                                                                                                                                                                                                                 |
| Target pattern          | Global AI Workspace: full-screen chat surface in `MainLayout`, with own chat header, history drawer, context badge, message canvas, input composer and auxiliary AI panels. It is not a `ModuleHub`, not an App Table and not `N-mode`.                                                                                                                                                                  |
| Known shared components | `src/components/AIChat/UnifiedChatPanel.tsx`, `EnhancedChatInput.tsx`, `ChatSlidingPanel.tsx`, `ChatHistorySidebar.tsx`, `ConversationItem.tsx`, `ConversationActions.tsx`, `ContextBadge.tsx`, `ChatSignalsPanel.tsx`, `src/hooks/useOpenChatWithContext.ts`.                                                                                                                                           |
| Main gaps               | Requires a chat-specific UI contract before visual refactor. The current UI has several different button sizes/radii in the chat header/input/sidebar, visible plus icon for New Chat, some strong shadows/gradients in operational controls, raw local action menus, color-coded entity icons that must be checked against artifact identity, and side panels/drawers that need one family of surfaces. |
| Migration decision      | `REFINE_REFERENCE`: approved visually for now, with one required correction: remove leading `+` from `Nowa rozmowa` / `New chat`.                                                                                                                                                                                                                                                                        |
| Priority                | `P0_REFERENCE` for global AI workspace.                                                                                                                                                                                                                                                                                                                                                                  |
| Next action             | Create and approve `Global AI Workspace / Chat` standard: header control family, history drawer, conversation item/menu, input composer, context/trust strip, welcome empty state, state banners, side panels and verification checklist.                                                                                                                                                                |

#### 6.6.1 Chat screen scope for first migration pass

Route:

- `/chat`
- `/chat/:conversationId`

Primary screen:

- `src/components/AIChat/UnifiedChatPanel.tsx`

Screen type:

- `Global AI Workspace`
- full-screen AI runtime inside `MainLayout`
- no `Menu 2` / `Menu 3` unless a future AI OS submodule explicitly adopts module shell

What must be preserved:

- conversation routing and `ConversationRouteSync`,
- message sending / streaming / abort behavior,
- voice and dictation runtime,
- attachments and tools menus,
- context passing from non-chat screens,
- provider failure and retry behavior,
- permissions for archived/deleted/not-found/permission-denied conversations.

What can be modernized visually:

- header button family and density,
- history/sidebar surface,
- conversation item and kebab menu,
- input composer surface and action bar,
- welcome empty state cards,
- trust/context strip,
- state banners,
- panel surfaces such as signals/history/details.

#### 6.6.2 Target Chat anatomy

The approved target anatomy should be:

1. Global app shell from `MainLayout`.
2. Chat workspace root surface, full height, no competing module topbar.
3. Chat header:
   - left: `New chat`, `History`, optional workspace/business/signals controls,
   - right: run/context/private/voice controls,
   - all controls one family: `h-8` or `h-9`, `rounded-hig-full` or approved compact icon pill,
   - no mixed square/rounded controls.
4. Context/trust strip:
   - shows what AI sees,
   - collapsible,
   - not visually heavier than the message canvas.
5. Message canvas:
   - empty/welcome state,
   - loading/streaming state,
   - message list,
   - degraded/provider failure state.
6. Composer:
   - textarea surface,
   - left actions: attach/tools/co-thinker/model/context counters,
   - right actions: voice/send/stop,
   - no gradients in operational control surfaces.
7. History drawer:
   - search,
   - folders,
   - conversations,
   - archive,
   - one consistent row/action menu family.
8. Auxiliary panels:
   - signals,
   - history,
   - export/details,
   - all as Layer 3 floating surfaces with consistent close/header/body/footer anatomy.

#### 6.6.3 First visual issues to review with Piotr

Before implementation, review these exact places on `/chat`:

- Top chat header, especially `New chat`, `History`, `Business actions`, `Important signals`, auto-read and context buttons.
- Welcome empty state: Teresa label, headline, prompt composer, quick prompt chips, four capability cards and DBR77 logo area.
- Input composer: attachment/tools/co-thinker/model controls on the left and voice/send/stop controls on the right.
- History drawer: folder headers, folder rows, conversation rows, `...` menu and `New chat`.
- Conversation state banners: archived, deleted, permission denied, not found.
- Signals panel if enabled: header, refresh button, signal cards and quick actions.

Decision 2026-05-01:

- Piotr approved the current Chat screen as visually very good for this migration stage.
- Do not redesign Chat broadly now.
- Required correction: remove the leading `+` from `Nowa rozmowa` / `New chat`.
- History drawer can remain as-is for now.
- Welcome state can remain as-is for now.
- After this correction, move to `My Work` in sidebar order.

### 6.7 My Work

| Field                   | Assessment                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current pattern         | Large multi-surface module using a custom `MyWorkHub` with ModuleHub-like topbar, Command Row, dynamic tabs, list views, workspaces and N-mode/detail views.                                                                                                                                                                                                                                     |
| Target pattern          | `ModuleHub` family for the module shell, with tab-specific target patterns: Home/Radar as operational dashboard, Ideas as workspace/list hybrid, Notebook as workspace, Inbox/Tasks/Decisions as App Table/list surfaces, Calendar as view-local calendar surface, Manager as executive dashboard/control surface.                                                                               |
| Known shared components | `MyWorkHub.tsx`, `Home/HomeView.tsx`, `MyIdeasListContent.tsx`, `NotebookContent.tsx`, `InboxContent.tsx`, `Calendar/CalendarView.tsx`, `MyTasksListContent.tsx`, `DecisionsPanelContent.tsx`, `TaskDetailView.tsx`, `DecisionDetailView.tsx`, `NotificationDetailView.tsx`, `WorkspacePanelStrip`.                                                                                              |
| Main gaps               | Primary CTA actions in `MyWorkHub` still use leading `+` icons and gradient fills; this conflicts with the current Golden Standard for Module Topbar. The module mixes many screen types, so migration must be per tab, not one large refactor. Need to confirm each tab's target pattern and which controls belong to `Menu 2`, `Menu 3`, view-local toolbar, workspace strip or detail header. |
| Migration decision      | `REFACTOR_BY_TAB`, starting from top-level shell and then each tab.                                                                                                                                                                                                                                                                                                                              |
| Priority                | `P0_REFERENCE` because My Work is second in sidebar and contains the most reused working patterns.                                                                                                                                                                                                                                                                                               |
| Next action             | Review My Work topbar and then each tab in order: Home/Radar, Ideas, Notebook, Inbox, Calendar, Tasks, Decisions, Manager.                                                                                                                                                                                                                                                                       |

#### 6.7.1 My Work shell

Route:

- `/my-work`

Primary files:

- `src/views/MyWorkView.tsx`
- `src/components/MyWork/MyWorkHub.tsx`

Current shell:

- `MainLayout`
- `SplitLayout`
- custom `MyWorkHub` navigation row
- custom command row implementation
- dynamic document tabs
- contextual side chat / AI context behavior

Target shell:

- keep as ModuleHub-compatible shell if it visually matches Golden Standard,
- do not force generic `ModuleHub` if it would break existing My Work runtime,
- enforce the same visual laws: `Menu 2`, one `Menu 3`, segmented view controls, no Help in module topbar, no leading `+` in primary CTA, no gradient operational CTA.

First topbar corrections to review:

- `Nowe zadanie`,
- `Nowy pomysł`,
- `Nowa decyzja`,
- `Nowa notatka`,
- `Dodaj wydarzenie`.

All above are primary CTAs in `Menu 2` context and should not use a leading `+`. They should also move away from gradient-heavy operational chrome.

#### 6.7.2 Tab target matrix

| Tab          | Current files                                                                                                  | Target pattern                                          | Decision                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Home / Radar | `Home/HomeView.tsx` and Home blocks                                                                            | Operational dashboard / AI briefing surface             | `REVIEW_FIRST` after topbar. Needs dashboard-specific density and card rules.                                                            |
| Ideas        | `MyIdeasListContent.tsx`, `IdeaMapWorkspace.tsx`, whiteboard/process/table tools                               | List + workspace hybrid                                 | `STANDARD_NEEDED_PARTIAL`: list should follow App Table/Grid rules; opened idea workspace should follow Workspace/N-mode-adjacent rules. |
| Notebook     | `NotebookContent.tsx`, notebook panels                                                                         | Workspace + 3-tools strip                               | `REFINE_REFERENCE`: already uses `WorkspacePanelStrip`; verify no duplicate context/AI panels.                                           |
| Inbox        | `InboxContent.tsx`                                                                                             | App list/table + triage command row                     | `REFINE_REFERENCE`: likely good for command row and bulk mode; verify preview/detail decisions.                                          |
| Calendar     | `Calendar/CalendarView.tsx`                                                                                    | Calendar view-local surface                             | `STANDARD_NEEDED_PARTIAL`: not App Table; needs view-local toolbar/calendar state standard.                                              |
| Tasks        | `MyTasksListContent.tsx`, `TasksKanbanBoard.tsx`, `TasksCalendarView.tsx`, `TaskDetailView.tsx`                | App Table/list + kanban/calendar + N-mode/detail        | `REFINE_REFERENCE`: verify view switcher, command row, bulk row and detail view.                                                         |
| Decisions    | `DecisionsPanelContent.tsx`, `DecisionsKanbanBoard.tsx`, `DecisionsTimelineView.tsx`, `DecisionDetailView.tsx` | App Table + Preview / kanban / timeline / N-mode detail | `P0_REFERENCE_CANDIDATE`: already identified as App Table + Preview reference after hardening.                                           |
| Manager      | `Executive/ExecutiveDashboard.tsx` and executive cards                                                         | Executive dashboard/control surface                     | `REVIEW_LATER`: role-gated; should not block first My Work standardization.                                                              |

#### 6.7.2b My Work > Pomysły Detailed Pass

| Field                        | Assessment                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current code                 | `src/components/MyWork/MyIdeasListContent.tsx`, `src/components/MyWork/IdeasTableContent.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx`.                                                                                                                                                                                                     |
| Current pattern              | App Table/Grid list + Idea workspace hybrid.                                                                                                                                                                                                                                                                                                     |
| Target pattern               | App Table/Grid for the list, canonical `RowActionsMenu` for row actions, Workspace/N-mode-adjacent standards for opened idea workspace.                                                                                                                                                                                                          |
| Decision                     | `REFINE_REFERENCE`                                                                                                                                                                                                                                                                                                                               |
| Priority                     | `P0_REFERENCE`                                                                                                                                                                                                                                                                                                                                   |
| First adoption               | `IdeasTableContent.tsx` becomes the first implementation of the canonical sectioned row action menu.                                                                                                                                                                                                                                             |
| Required row menu order      | Open → Tool Shortcut → Context actions → AI → Convert To → Create Output → Manage → Danger.                                                                                                                                                                                                                                                      |
| Table polish recommendations | Accepted as the App Table golden reference for visual anatomy, row colors, chip readability, metadata alignment, Excel-like boundary resize, stable table width, icon-only action/settings corner, and compact anchored table settings. Future tables must migrate toward this exact standard; non-matching legacy mechanics are migration debt. |
| Non-UI/UX handling           | Product logic, conversion runtime gaps, output canvas availability and AI-generated insights quality go to `docs/ui-standards/migration-backlog/MY_WORK_IDEAS.md`.                                                                                                                                                                               |

#### 6.7.2a My Work > Radar Detailed Pass

| Field                         | Assessment                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current code                  | `src/components/MyWork/MyWorkHub.tsx` renders tab `home` with label `Radar`; content is `src/components/MyWork/Home/HomeView.tsx`; triage cards use `src/components/MyWork/Home/RadarTriageCard.tsx`.                                                               |
| Current pattern               | `ModuleHub` shell + `Canvas Mode` intelligence dashboard content.                                                                                                                                                                                                   |
| Target pattern                | Keep `MyWorkHub` as `ModuleHub`; treat `Radar` content as a `Canvas Mode / intelligence dashboard` reference candidate for Home-like surfaces.                                                                                                                      |
| Decision                      | `REFINE_REFERENCE`                                                                                                                                                                                                                                                  |
| Priority                      | `P0_REFERENCE`                                                                                                                                                                                                                                                      |
| Shared/approved standards     | `03-modules/module-hub-standard.md`, `00-foundation/canvas-mode.md`, `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`.                                                                                                                                                         |
| UI/UX strengths               | Clear ambient dashboard direction, compact top status strip, strong card-based intelligence layout, no primary create CTA competing with the Radar surface.                                                                                                         |
| UI/UX gaps to review visually | Module topbar may still feel heavier than the Radar canvas; Radar has no Command Row by design, but any future filters/presets must not become a second ad-hoc toolbar; local card/button treatments need approval or extraction into a Radar/Canvas card standard. |
| Non-UI/UX handling            | Bugs, data truth, ranking logic, permission gaps and product ideas discovered during Radar review go to `docs/ui-standards/migration-backlog/MY_WORK_RADAR.md`, not into the UI/UX refactor scope.                                                                  |
| First approval question       | Does Piotr approve Radar as a dark Canvas Mode intelligence dashboard inside the My Work ModuleHub, or should Radar be visually closer to operational lists?                                                                                                        |

#### 6.7.3 First My Work inspection order for Piotr

Inspect in the app:

1. `/my-work` default Home/Radar tab.
2. Topbar right cluster across `Ideas`, `Notebook`, `Calendar`, `Tasks`, `Decisions`.
3. `Menu 3` on `Inbox`, `Tasks`, `Ideas`, `Decisions`.
4. `Decisions > table` because it is the App Table + Preview reference candidate.
5. `Tasks > table/kanban/calendar`.
6. `Notebook` because it uses the workspace strip.

First likely implementation batch after approval:

- remove leading `+` from My Work primary CTAs,
- replace gradient operational CTA styling with the approved primary CTA treatment,
- keep segmented view controls as-is where already correct,
- ensure `Menu 3` remains one row and does not get duplicate AI/selection rows.

## 7. Pierwsza kolejność audytu szczegółowego

1. `My Work > Decisions` - zatwierdzić jako reference App Table + Preview.
2. `InterviewHub` - pierwszy duży hub/list migration plan.
3. `DiscoveryTools > ToolDocumentView` - N-mode/Menu 3 reference.
4. `DiscoveryTools > ToolWorkspace/ToolActionBar` - standard dodatkowego control baru.
5. `Admin/shared` - decyzja: adapter adminowy czy migracja do global UI.
6. `SuperAdmin security/API/support` - kontrolowany control plane refactor slices.
7. `AIChat/UnifiedChatPanel` - osobny AI UX governance audit.

## 8. Kryteria ukończenia audytu modułu

Audyt modułu jest kompletny, gdy:

- wszystkie ekrany w module mają target pattern,
- wiadomo, które komponenty są shared, local, migration debt lub do usunięcia,
- każda tabela ma decyzję: App Table / board / grid / cards / do-not-touch,
- każda lista ma decyzję: preview pane tak/nie/później,
- każdy toolbar ma klasę: App Topbar, Module Topbar, Command Row, View-local Toolbar, Workspace Strip, Bulk Action Bar, Preview Footer,
- brakujące komponenty są wpisane do planu standardu,
- zakres refactoru nie dotyka API/routingu/logiki bez osobnej decyzji.

## 9. Ryzyka

- Migracja bez audytu może pogłębić chaos.
- Masowe zastępowanie raw `<button>` bez rozróżnienia low-level vs feature-level może popsuć tabelę, tabs lub dostępność.
- Admin/SuperAdmin są zbyt szerokie na jeden refactor.
- Preview pane nie powinien być wciskany do list bez realnych quick actions.
- Tool/workspace flows wymagają doprecyzowania control bars, zanim zacznie się refactor.

## 10. Następny dokument

Szczegółową kolejność działań i fale refactoru opisuje:

- `docs/ui-standards/UI_UX_MIGRATION_PLAN.md`
- `docs/ui-standards/UI_UX_AUDIT_EXECUTION_BOARD.md`

## 11. Plan audytu wszystkich kart (DBR77 2027)

Status: `ACTIVE / EXECUTION BASELINE`
Date: 2026-05-03

### 11.1 Cel

Wykonać pełny audyt wszystkich kart i ekranów modułowych w Consultify według jednego procesu, tak aby dla każdej karty było jednoznacznie wiadomo:

- czy jest zgodna ze standardem,
- gdzie są odchylenia,
- jaki jest priorytet napraw,
- w jakiej fali migracji karta zostanie poprawiona.

### 11.2 Procedura audytu dla każdej karty (obowiązkowa)

1. **Inwentaryzacja karty**
   - plik główny i pliki pomocnicze,
   - typ ekranu: `ModuleHub` / `App Table` / `Workspace` / `N-mode` / `Control Plane`.
2. **Kontrola shella i menu**
   - zgodność `Menu 2` i `Menu 3`,
   - brak ad-hoc pasków między topbarem i treścią,
   - CTA bez `+` i bez gradientów w operacyjnym chrome.
3. **Kontrola tabel i list**
   - zgodność z App Table standardem,
   - kontrola column settings / resizer / actions column,
   - checkbox reveal, row description i stany selected/focused/checked.
4. **Kontrola kolorystyki (DBR77 2027 Color Contract)**
   - jedna mapa semantyczna statusów (`slate/blue/amber/emerald/rose`),
   - `primary/violet` tylko dla selection/focus/CTA,
   - neutralne `MetaChip` i `ToolChip`,
   - spójność table/list/card/preview w tym samym module.
5. **Kontrola stanów UX**
   - loading/empty/error/degraded,
   - read-back po mutacjach,
   - brak fake success i raw backend internals.
6. **Wynik audytu**
   - `REFERENCE` / `REFINE_REFERENCE` / `REFACTOR` / `STANDARD_NEEDED` / `DO_NOT_TOUCH`,
   - priorytet `P0_REFERENCE` / `P1_HIGH` / `P2_MEDIUM` / `P3_LOW`,
   - lista konkretnych zmian do wdrożenia.

### 11.3 Dowody wymagane przy audycie

- screenshot light mode,
- screenshot dark mode,
- screenshot z aktywnym `Menu 3`,
- screenshot tabeli z zaznaczeniem i checkbox reveal,
- screenshot stanów empty/error/degraded (gdy dotyczy),
- krótki diff/fragment kodu miejsca, gdzie występuje odchylenie.

## 12. Raport: gdzie musimy dokonać zmian

Legenda:

- `Decision`: decyzja migracyjna.
- `Priority`: kolejność wykonania.
- `Wymagane zmiany`: skrót najważniejszych poprawek UI/UX.

| Obszar | Karta / ekran | Decision | Priority | Wymagane zmiany |
|---|---|---|---|---|
| `My Work` | `Home/Radar` | `REFINE_REFERENCE` | `P1_HIGH` | Potwierdzić brak lokalnych ad-hoc pasków, dopiąć spójną rodzinę kontrolek i gęstość dashboardu. |
| `My Work` | `Pomysły` | `REFINE_REFERENCE` | `P0_REFERENCE` | Utrzymać jako referencję tabeli; audyt regresji Menu 3, checkbox reveal i Color Contract przy każdej zmianie. |
| `My Work` | `Notebook` | `REFINE_REFERENCE` | `P1_HIGH` | Upewnić się, że `WorkspacePanelStrip` nie dubluje akcji z `Menu 3`; spójne CTA i kontrolki. |
| `My Work` | `Inbox` | `REFACTOR` | `P1_HIGH` | Pełna zgodność App Table + Menu 3 + Color Contract + bulk/select UX. |
| `My Work` | `Calendar` | `STANDARD_NEEDED` | `P2_MEDIUM` | Dookreślić standard `View-local Toolbar` dla kalendarza bez łamania zasad Menu 2/3. |
| `My Work` | `Tasks` | `REFACTOR` | `P1_HIGH` | Ujednolicić list/kanban/calendar pod jedną semantyką kolorów i jedną logiką command row. |
| `My Work` | `Decisions` | `REFINE_REFERENCE` | `P0_REFERENCE` | Dotrzymać roli referencji dla Menu 3; usunąć pozostałe lokalne odstępstwa wizualne. |
| `My Work` | `Manager` | `REFACTOR` | `P2_MEDIUM` | Audyt dashboard cards i kolorystyki semantycznej, bez dekoracyjnych akcentów. |
| `Interview` | `My Assignments` | `REFINE_REFERENCE` | `P1_HIGH` | Potwierdzenie po migracji: chips/statusy/due/progress zgodnie z Color Contract. |
| `Interview` | `Sessions` | `REFINE_REFERENCE` | `P1_HIGH` | Walidacja status map i menu akcji; brak lokalnych map równoległych. |
| `Interview` | `Managed` | `REFINE_REFERENCE` | `P1_HIGH` | Spójność z Assignments (ta sama semantyka i anatomia tabeli). |
| `Interview` | `Templates` | `REFINE_REFERENCE` | `P1_HIGH` | Utrzymać neutralne meta/tool chips, spójne settings i row behavior. |
| `Interview` | `Insights` | `REFINE_REFERENCE` | `P1_HIGH` | Kontrola modal + tabela: monochromatyczny chrome i semantyczne statusy. |
| `Interview` | `Initiatives` | `REFINE_REFERENCE` | `P1_HIGH` | Potwierdzić status/priority/source zgodnie z mapą globalną. |
| `Discovery Tools` | `Library/Sessions/Outputs/Initiatives` | `REFACTOR` | `P1_HIGH` | Usunąć lokalne mapy statusów/chipów; pełna zgodność command row i tabel. |
| `Discovery` | `Consultant View` | `STANDARD_NEEDED` | `P2_MEDIUM` | Ustalić docelowy shell i zasady toolbarów dla widoku discovery spoza ModuleHub. |
| `Assessment` | `Assessment/Reports/Initiatives` | `REFACTOR` | `P1_HIGH` | Zastąpić dynamiczne lokalne klasy kolorów stabilną mapą semantyczną DBR77. |
| `Initiatives` | `List/Portfolio Analysis` | `REFACTOR` | `P1_HIGH` | Dopiąć jedną implementację command row i spójną semantykę statusów między widokami. |
| `Execution` | `List/Reports/People & Change` | `REFACTOR` | `P1_HIGH` | Skontrolować brakujące/wyłączane command row i spójność akcji kontekstowych. |
| `Results` | `Initiatives/KPI/ROI/Reports` | `REFACTOR` | `P1_HIGH` | Uprościć rozgałęzione local patterns; jedna rodzina toolbar/table/chip semantics. |
| `Economics` | `Catalog/Results/Compare` | `REFACTOR` | `P1_HIGH` | Usunąć lokalne mapy statusów i progów kolorystycznych niespójnych z kontraktem. |
| `Finance` | `Statements/Models/Analysis/...` | `REFACTOR` | `P1_HIGH` | Potwierdzić App Table controls i semantic colors na wszystkich tabach finansowych. |
| `Reports & Presentations` | `Outputs/Documents/Decks/Sheets/Templates` | `REFACTOR` | `P1_HIGH` | Ujednolicić zachowanie kart list i stanów UX między tabami. |
| `Presentations` | `All/Recent` | `REFACTOR` | `P2_MEDIUM` | Zmigrować lokalne source-type color maps do canonical chip semantics. |
| `Meeting` | `Meetings` | `REFACTOR` | `P1_HIGH` | Zastąpić lokalne status pills wspólną mapą statusów i chip contract. |
| `Benefits` | `Completed/KPI/ROI/...` | `REFACTOR` | `P2_MEDIUM` | Spiąć wielotabowy moduł jedną semantyką kolorów i zasadami command row. |
| `Report Builder` | `My Reports/R1-R4/Templates/Schedules` | `REFACTOR` | `P2_MEDIUM` | Usunąć lokalne report-type palettes, podpiąć pod globalny kontrakt. |
| `Decisions (standalone)` | `DecisionsHub` | `REFACTOR` | `P2_MEDIUM` | Dociągnąć do pełnego ModuleHub/App Table standardu lub formalnie oznaczyć jako interim. |
| `AI OS` | `AIOSHub` | `DO_NOT_TOUCH` | `P3_LOW` | Landing cards poza zakresem App Table; tylko sanity-check zgodności bazowej. |
| `Megatrends` | `MegatrendsWorkspace` | `STANDARD_NEEDED` | `P2_MEDIUM` | Ustalić standard workspace toolbarów i semantyki akcji. |
| `Admin` | `UnifiedSync/Admin surfaces` | `REFACTOR` | `P1_HIGH` | Kontrola control-plane UX: tabele, mutacje, potwierdzenia, degraded states. |
| `SuperAdmin` | `ModelRegistry/Integrations/...` | `REFACTOR` | `P1_HIGH` | Audyt bezpieczeństwa i spójności UI, eliminacja lokalnych wzorców driftujących od kanonu. |

## 13. Kolejność wykonania audytu (fale operacyjne)

1. **Fala A (P0/P1 krytyczne):**
   - `My Work` (`Pomysły`, `Decisions`, `Inbox`, `Tasks`),
   - cały `Interview`,
   - `Discovery Tools`,
   - `Assessment`.
2. **Fala B (P1 systemowe):**
   - `Execution`, `Results`, `Economics`, `Finance`, `Meeting`,
   - `Reports & Presentations`.
3. **Fala C (P2/P3 + standard needed):**
   - `Benefits`, `Report Builder`, `Decisions standalone`,
   - `Megatrends`, `Discovery legacy`, wybrane powierzchnie `AI OS`.
4. **Fala D (Control plane governance):**
   - `Admin` i `SuperAdmin` w cięciach ryzyka (`security`, `api`, `support`, potem reszta).

Warunek zamknięcia fali:

- wszystkie karty z fali mają wpis `Decision + Priority + Required changes`,
- wszystkie P1 z fali mają gotowe taski migracyjne,
- brak nieopisanych wyjątków od Color Contract i Menu 3 standardu.
