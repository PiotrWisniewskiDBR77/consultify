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

| Decision | Znaczenie |
|---|---|
| `REFERENCE` | Wzorzec do kopiowania lub wzorzec po drobnym hardeningu. |
| `REFINE_REFERENCE` | Kandydat na wzorzec, ale wymaga małych korekt standardu/implementacji. |
| `REFACTOR` | Ekran ma przejść migrację do standardu. |
| `MIGRATION_DEBT` | Legacy/custom UI akceptowane tymczasowo, do wpisania w plan. |
| `STANDARD_NEEDED` | Najpierw trzeba opisać nowy komponent/wzorzec. |
| `DO_NOT_TOUCH` | Nie ruszać do czasu decyzji produktowej/technicznej. |

## 3. Skala priorytetu

| Priority | Znaczenie |
|---|---|
| `P0_REFERENCE` | Ekran wzorcowy, używany do standaryzacji innych. |
| `P1_HIGH` | Widoczny / często używany / mocno wpływa na odczucie aplikacji. |
| `P2_MEDIUM` | Ważny, ale nie pierwszy w kolejce migracji. |
| `P3_LOW` | Rzadki / legacy / do późniejszego sprzątania. |

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

| Reference area | Candidate files | Status | Dlaczego |
|---|---|---|---|
| App Table + Preview | `src/components/MyWork/DecisionsPanelContent.tsx`, `src/components/MyWork/DecisionPreviewPanel.tsx` | `REFINE_REFERENCE` | Używa `TableWithPreviewLayout`, `ResizableTable`, preview state i quick actions. To najlepszy kandydat na wzór tabeli + preview, ale wymaga sprawdzenia raw buttonów i pełnej zgodności z nowym zakazem one-off UI. |
| ModuleHub large list | `src/components/Interview/InterviewHub.tsx` | `REFINE_REFERENCE` | Ma deklarowany ModuleHub pattern, command row, preview bodies/footers i ResizableTable. Dobry pierwszy duży ekran migracyjny, bo dotyka realnego, ważnego workflow. |
| N-mode / artifact detail | `src/components/DiscoveryTools/ToolDocumentView.tsx` | `REFINE_REFERENCE` | Używa `NModeShell`, `NModeSections`, Menu 3 portal/actions. Wymaga uporządkowania lokalnych buttonów i potwierdzenia standardu dla AI actions w Menu 3. |
| Tool workspace | `src/components/DiscoveryTools/ToolWorkspace.tsx`, `src/components/DiscoveryTools/ToolActionBar.tsx` | `STANDARD_NEEDED` | Ma lokalny `ToolActionBar` i workflow toolowy. To dobry kandydat do doprecyzowania standardu dodatkowych control barów. |
| Admin / control plane | `src/views/admin/AdminSettingsModule.tsx`, `src/components/Admin/shared/*`, `src/views/superadmin/*` | `REFACTOR` | Dużo ekranów i lokalnych komponentów adminowych. Wymaga osobnej fali migracji, bo ma realne ryzyko rozjazdu tabel, action columns i control plane UX. |

## 6. Audyt modułów startowych

### 6.1 My Work / Decisions

| Field | Assessment |
|---|---|
| Current pattern | App Table + Preview candidate. |
| Target pattern | `REFERENCE` dla App Table + Preview po hardeningu. |
| Known shared components | `TableWithPreviewLayout`, `ResizableTable`, `ColumnResizer`, `FilterDropdown`, preview body/footer. |
| Main gaps | Raw `<button>` nadal istnieją w kilku miejscach; trzeba rozróżnić dopuszczalne niskopoziomowe elementy tabeli od feature-level one-off buttons. |
| Migration decision | `REFINE_REFERENCE` |
| Priority | `P0_REFERENCE` |
| Next action | Focused compliance review: buttons, action column, preview parity, read-back, Menu 3 ownership. |

### 6.2 Interview

| Field | Assessment |
|---|---|
| Current pattern | Unified ModuleHub / Golden Standard candidate. |
| Target pattern | ModuleHub + App Table + Preview where useful. |
| Known shared components | `ModuleHub`, `GridView`, `ResizableTable`, `FilterDropdown`, `TableWithPreviewLayout`, interview preview components. |
| Main gaps | Duży plik z wieloma tabami i preview states; raw buttons w dynamic tabs/close controls mogą wymagać klasyfikacji; trzeba sprawdzić, czy wszystkie lokalne row/control patterns należą do Menu 3 albo view-local toolbar. |
| Migration decision | `REFACTOR` jako pierwszy duży hub po wzorcu Decisions. |
| Priority | `P1_HIGH` |
| Next action | Rozbić audyt na tabs: Inbox/Sessions/Assigned/Templates/Insights. Dla każdego zatwierdzić target view: App Table, grid, preview, detail. |

### 6.3 Discovery Tools / Tools

| Field | Assessment |
|---|---|
| Current pattern | Mixed: N-mode detail, ToolWizard/workspace, lokalne tool actions. |
| Target pattern | NMode detail for documents, ToolWizard for guided flow, Workspace 3-tools strip for workspaces. |
| Known shared components | `NModeShell`, `NModeSections`, `EmbeddedView`, Menu 3 action button styles, PreviewPane components. |
| Main gaps | Wiele raw buttons w tool phases i tool panels; `ToolActionBar` wymaga decyzji, czy jest zatwierdzonym `View-local Toolbar`/wizard navigation, czy migration debt. |
| Migration decision | `STANDARD_NEEDED` + później `REFACTOR`. |
| Priority | `P1_HIGH` |
| Next action | Opisać standard dla tool flow control bars: bottom navigation, phase actions, AI phase actions, proposal governance cards. |

### 6.4 Admin / Settings

| Field | Assessment |
|---|---|
| Current pattern | Mixed control plane with local shared admin components. |
| Target pattern | App Table / control plane standard, shared buttons/cards/tables, no duplicate breadcrumbs/toolbars. |
| Known shared components | `src/components/Admin/shared/*`, app-level UI primitives, admin views. |
| Main gaps | Istnieją lokalne `Admin/shared/Button`, `Card`, `AdminTable`, `EnhancedDataTable`. Trzeba zdecydować, czy stają się zatwierdzonym adapterem adminowym, czy migrują do `@/components/ui`. |
| Migration decision | `REFACTOR` after Decisions/Interview baseline. |
| Priority | `P1_HIGH` |
| Next action | Osobny Admin inventory: Admin views, Admin shared components, SuperAdmin views, action column patterns, empty/error/degraded states. |

### 6.5 SuperAdmin

| Field | Assessment |
|---|---|
| Current pattern | Large control plane with many submodules. |
| Target pattern | Control plane using App Table, Preview where useful, honest degraded states, in-app confirms for destructive actions. |
| Known shared components | `src/views/superadmin/*`, `src/views/superadmin/*/*`, shared app UI. |
| Main gaps | Bardzo szeroki obszar; nie migrować hurtowo. Wiele tabel i panels wymaga priorytetyzacji według ryzyka: security, API keys, approval workflows, support. |
| Migration decision | `REFACTOR` in later high-risk slices. |
| Priority | `P1_HIGH` for security/API/support, `P2_MEDIUM` for the rest. |
| Next action | Podzielić na slices: Security/IAM, API/System, Support, Customers, Revenue, AI Platform. |

### 6.6 AIChat / UnifiedChatPanel

| Field | Assessment |
|---|---|
| Current pattern | Core AI runtime surface. |
| Target pattern | Contextual AI UX integrated with Module Topbar/Menu 3 and split chat. |
| Known shared components | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/hooks/useOpenChatWithContext.ts`. |
| Main gaps | Nie traktować jako zwykły ekran tabelaryczny. Wymaga osobnego UX contract: context, no silent execution, no hidden learning, honest provider failure, trust/citations. |
| Migration decision | `DO_NOT_TOUCH` for visual refactor until chat-specific audit. |
| Priority | `P1_HIGH` but separate from generic UI cleanup. |
| Next action | Osobny AI UX audit, powiązany z governance i Chat V9 docs. |

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
