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

| Status | Znaczenie |
|---|---|
| `CANDIDATE` | Kandydat do oceny. |
| `REFINE_REFERENCE` | Może być wzorcem po drobnych korektach i dokumentacji. |
| `APPROVED_REFERENCE` | Zatwierdzony wzorzec do kopiowania. |
| `REJECTED_AS_REFERENCE` | Nie używać jako wzorca, tylko jako legacy/migration debt. |

## 3. Kandydaci główni

### 3.1 App Table + Preview

Status: `REFINE_REFERENCE`

Primary candidate:

- `src/components/MyWork/DecisionsPanelContent.tsx`
- `src/components/MyWork/DecisionPreviewPanel.tsx`

Dlaczego:

- używa table + preview flow,
- ma preview state i quick actions,
- korzysta z `TableWithPreviewLayout`,
- korzysta z `ResizableTable`, `ColumnResizer`, `FilterDropdown`,
- jest najlepszym punktem startowym dla App Table + Preview.

Warunki zatwierdzenia:

- sklasyfikować wszystkie raw `<button>`: low-level table/tab control vs one-off feature button,
- potwierdzić action column/kebab pattern,
- potwierdzić preview default OFF,
- potwierdzić preview action parity,
- potwierdzić read-back po approve/reject/snooze/remind,
- dopisać ewentualne wyjątki do standardu.

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

Status: `STANDARD_NEEDED`

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

### 3.7 Contextual AI UX

Status: `DO_NOT_TOUCH_FOR_GENERIC_REFACTOR`

Primary candidates:

- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/hooks/useOpenChatWithContext.ts`

Dlaczego:

- to nie jest zwykły ekran do kosmetycznego refactoru,
- obejmuje AI runtime, context passing, provider failures, trust/citations, governance,
- wymaga osobnego AI UX audit.

Warunki zatwierdzenia:

- osobny standard/audit dla AI UX,
- brak silent execution,
- brak hidden learning,
- provider failure UX,
- source/traceability behavior.

## 4. Pierwszy rekomendowany ciąg pracy

1. Zatwierdzić `My Work > Decisions` jako pierwszy `REFINE_REFERENCE`.
2. Na tej podstawie doprecyzować App Table + Preview examples.
3. Przejść do `InterviewHub` jako pierwszego dużego huba migracyjnego.
4. Następnie `ToolDocumentView` jako N-mode/Menu 3 reference.
5. Potem `ToolWorkspace/ToolActionBar` jako standard control bars.
6. Dopiero potem pierwszy Admin/SuperAdmin slice.

## 5. Zasada po zatwierdzeniu reference

Gdy ekran zostanie `APPROVED_REFERENCE`:

- wpisujemy go do właściwego standardu jako przykład,
- kopiujemy tylko wzorzec, nie przypadkowe implementacyjne obejścia,
- wszystkie nowe ekrany tego typu muszą wskazać reference screen,
- każde odstępstwo od reference trafia do audytu jako decyzja.
