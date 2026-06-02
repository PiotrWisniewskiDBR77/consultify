# UI/UX Reference Screens Registry

Status: `v0 - candidates`
Date: 2026-05-01
Parent standard: `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
Migration plan: `docs/ui-standards/UI_UX_MIGRATION_PLAN.md`

## 1. Cel

Ten rejestr wskazuje ekrany, które mają stać się praktycznymi wzorcami migracji UI/UX.

Reference screen nie oznacza, że ekran jest już idealny. Oznacza, że:

- reprezentuje ważny typ ekranu,
- ma najbliżej do standardu,
- po focused hardeningu może być kopiowany jako wzór,
- jego decyzje zostaną opisane w dokumentacji.

## 2. Statusy referencji

| Status                  | Znaczenie                                                 |
| ----------------------- | --------------------------------------------------------- |
| `CANDIDATE`             | Kandydat do oceny.                                        |
| `REFINE_REFERENCE`      | Może być wzorcem po drobnych korektach i dokumentacji.    |
| `APPROVED_REFERENCE`    | Zatwierdzony wzorzec do kopiowania.                       |
| `REJECTED_AS_REFERENCE` | Nie używać jako wzorca, tylko jako legacy/migration debt. |

## 3. Kandydaci główni

### 3.1 App Table + Preview

Status: `APPROVED_REFERENCE` for table anatomy, row color grid, metadata alignment, column resize, table view settings and action-column chrome. Preview-pane parity remains separately reviewed per module.

Primary candidate:

- `src/components/MyWork/IdeasTableContent.tsx`
- `src/components/MyWork/MyIdeasListContent.tsx`
- visual references:
  - `docs/ui-standards/assets/app-table-golden-reference-dark-2026-05-02.png`
  - `docs/ui-standards/assets/app-table-golden-reference-light-2026-05-02.png`

Secondary/legacy candidates:

- `src/components/MyWork/DecisionsPanelContent.tsx`
- `src/components/MyWork/DecisionPreviewPanel.tsx`

Dlaczego:

- `My Work > Pomysły` jest zatwierdzonym wzorcem dla App Table visual anatomy i column mechanics,
- ma zaakceptowany dark/light contrast,
- ma zaakceptowaną siatkę kolorów row states i chips,
- ma stabilny `table-fixed`/fixed column contract,
- ma excelowy boundary resize: jedna kolumna rośnie o tyle, o ile sąsiednia maleje,
- ma `Title` jako realną kolumnę z resizerem na granicy `Title -> metadata`,
- ma metadata headers/cells centrowane,
- ma icon-only prawy header corner dla ustawień widoku,
- ma mały anchored table settings popover zamiast modala,
- korzysta z `TableWithPreviewLayout`, `RowActionsMenu`, `ColumnResizer`, `FilterDropdown`.

Warunki zatwierdzenia:

- dla każdej kolejnej tabeli porównać dark/light z referencją,
- zachować excelowy boundary resize i stabilną szerokość tabeli,
- nie wracać do modalnego wyboru prostych kolumn,
- nie pokazywać tekstu `Actions/Akcje` w headerze, jeśli prawy corner ma ikonę ustawień widoku,
- preview default/parity i mutacje nadal zatwierdzać per moduł.

### 3.2 Large Module Hub / Multi-tab List

Status: `REFINE_REFERENCE`

Primary candidate:

- `src/components/Interview/InterviewHub.tsx`

Dlaczego:

- deklaruje ModuleHub / Golden Standard pattern,
- ma wiele tabów i realny problem spójności,
- używa `ModuleHub`, `GridView`, `ResizableTable`, `FilterDropdown`, `TableWithPreviewLayout`,
- ma preview components dla assignments/sessions/templates/insights.

Warunki zatwierdzenia:

- rozdzielić target pattern per tab,
- potwierdzić Command Row ownership,
- usunąć lub sklasyfikować lokalne dynamic tabs buttons,
- potwierdzić preview yes/no/later dla każdego taba,
- sprawdzić, czy wszystkie filtry należą do Module Topbar, Command Row albo header filters.

### 3.3 N-mode Artifact Detail

Status: `REFINE_REFERENCE`

Primary candidate:

- `src/components/DiscoveryTools/ToolDocumentView.tsx`

Dlaczego:

- używa `NModeShell`,
- korzysta z N-mode sections,
- ma portal/actions do Command Row,
- obejmuje AI actions i dokument/narzędzie, czyli krytyczny wzorzec przyszłych artifact views.

Warunki zatwierdzenia:

- potwierdzić, że AI actions są w Menu 3/right slot,
- sklasyfikować lokalne buttons,
- potwierdzić Save state vs Lifecycle state,
- potwierdzić lewy rail i section navigation,
- dopisać wyjątki dla specjalnych tool/document actions.

### 3.4 Tool Workspace / Guided Flow

Status: `REFINE_REFERENCE`

Primary candidates:

- `src/components/DiscoveryTools/ToolWorkspace.tsx`
- `src/components/DiscoveryTools/ToolActionBar.tsx`
- `src/components/DiscoveryTools/ToolWizardView.tsx`
- `src/components/shared/ToolWizard/*`

Dlaczego:

- tool flows będą ważne biznesowo,
- istnieje lokalny `ToolActionBar`,
- workspace może wymagać dodatkowego `View-local Toolbar`,
- to jest miejsce, gdzie łatwo powstają ad-hoc kontrolki.

Warunki zatwierdzenia:

- opisać standard `Tool Flow Control Bar`,
- zdecydować, czy `ToolActionBar` staje się approved component czy migration debt,
- zdefiniować, które akcje są navigation, które workflow, które AI,
- ustalić relację do `Workspace 3-tools strip`.

### 3.5 Admin / Control Plane Table

Status: `CANDIDATE`

Primary candidates:

- `src/views/admin/AdminSettingsModule.tsx`
- `src/components/Admin/shared/AdminTable.tsx`
- `src/components/Admin/shared/EnhancedDataTable.tsx`
- `src/components/Admin/shared/Button.tsx`
- `src/components/Admin/shared/Card.tsx`

Dlaczego:

- Admin ma lokalny mini design system,
- control plane musi być spójny i uczciwy,
- wiele ekranów ma tabele, akcje i mutation feedback,
- to obszar dużego ryzyka fake success / raw errors.

Warunki zatwierdzenia:

- zdecydować, czy `Admin/shared/*` to approved adapter czy migration debt,
- wybrać pierwszy Admin table do refactoru,
- potwierdzić App Table + actions column,
- potwierdzić empty/error/degraded states.

### 3.6 SuperAdmin Security / API / Support

Status: `CANDIDATE`

Primary candidates:

- `src/views/superadmin/security/*`
- `src/views/superadmin/iam/*`
- `src/views/superadmin/APIManagementView.tsx`
- `src/views/superadmin/support/*`

Dlaczego:

- krytyczny control plane,
- duża liczba tabel i mutacji,
- wysokie wymagania honest UI,
- destructive actions i read-back są konieczne.

Warunki zatwierdzenia:

- wybrać wąski slice, nie cały SuperAdmin,
- nie zmieniać security/governance logic w UI refactorze,
- potwierdzić in-app confirm modals,
- potwierdzić read-back i degraded states.

### 3.7 Global AI Workspace / Chat

Status: `STANDARD_NEEDED`

Primary candidates:

- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/AIChat/EnhancedChatInput.tsx`
- `src/components/AIChat/ChatHistorySidebar.tsx`
- `src/hooks/useOpenChatWithContext.ts`

Dlaczego:

- to nie jest zwykły ekran do kosmetycznego refactoru,
- obejmuje AI runtime, context passing, provider failures, trust/citations, governance,
- jest pierwszym ekranem w kolejności sidebara i powinien stać się referencją globalnego AI workspace.

Warunki zatwierdzenia:

- osobny standard/audit dla Global AI Workspace,
- zatwierdzona anatomia: chat header, context/trust strip, message canvas, composer, history drawer, auxiliary panels,
- jedna rodzina header controls i composer controls,
- `New chat` / `Nowa rozmowa` bez leading `+`,
- history drawer zostaje as-is na tym etapie,
- welcome empty state zostaje as-is na tym etapie,
- brak silent execution,
- brak hidden learning,
- provider failure UX,
- source/traceability behavior.

Decyzja 2026-05-01:

- Piotr zatwierdził ekran Chat jako bardzo dobry na teraz.
- Nie robimy szerokiego redesignu Chat w pierwszej fali.
- Jedyna korekta przed przejściem dalej: usunąć `+` z `Nowa rozmowa`.

### 3.8 Canvas Mode Intelligence Dashboard / Radar

Status: `REFINE_REFERENCE`

Primary candidates:

- `src/components/MyWork/Home/HomeView.tsx`
- `src/components/MyWork/Home/RadarTriageCard.tsx`
- parent shell: `src/components/MyWork/MyWorkHub.tsx`

Dlaczego:

- `Radar` is the first `My Work` tab and the default landing surface for the module.
- It uses `Canvas Mode`, which is explicitly allowed for Home tabs and experience-oriented surfaces.
- It combines strategic AI signals, triage cards, KPI alerts, recent insights and block-based intelligence without pretending to be an operational table.
- It is a good candidate for approving the pattern: `ModuleHub shell` outside, `Canvas Mode intelligence dashboard` inside.

Warunki zatwierdzenia:

- confirm that Radar should stay visually dark/ambient and not become an operational list surface,
- confirm that Radar intentionally has no `Menu 3` unless a real filter/preset/action row is needed,
- classify local card styles as approved Radar/Canvas cards or extract them into a documented component standard,
- ensure AI actions inside cards are secondary/contextual and do not compete with the global Chat workspace,
- keep non-UI/UX findings in `docs/ui-standards/migration-backlog/MY_WORK_RADAR.md`.

## 4. Pierwszy rekomendowany ciąg pracy

1. `Chat / Global AI Workspace` - standard needed, bo to pierwszy ekran w sidebarze i osobny typ pracy.
2. `My Work > Decisions` - pierwszy `REFINE_REFERENCE` dla App Table + Preview.
3. Na tej podstawie doprecyzować App Table + Preview examples.
4. Przejść do `InterviewHub` jako pierwszego dużego huba migracyjnego.
5. Następnie `ToolDocumentView` jako N-mode/Menu 3 reference.
6. Potem `ToolWorkspace/ToolActionBar` jako standard control bars.
7. Dopiero potem pierwszy Admin/SuperAdmin slice.

## 5. Zasada po zatwierdzeniu reference

Gdy ekran zostanie `APPROVED_REFERENCE`:

- wpisujemy go do właściwego standardu jako przykład,
- kopiujemy tylko wzorzec, nie przypadkowe implementacyjne obejścia,
- wszystkie nowe ekrany tego typu muszą wskazać reference screen,
- każde odstępstwo od reference trafia do audytu jako decyzja.
