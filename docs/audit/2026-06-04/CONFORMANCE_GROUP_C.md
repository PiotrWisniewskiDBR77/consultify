# UI/UX Conformance Audit — Group C

**Date:** 2026-06-04
**Scope:** `Admin/**`, `settings/**` (= `Settings/**`), `ReportsAndPresentations/**`, `Chat/**` + `AIChat/**`, `Presentations/**`, `DocumentStudio/**`, `views/**`
**Standards:** `docs/ui-standards/03-modules/module-hub-standard.md`; Admin/Settings → `docs/UI_UX/24_ADMIN_AND_SETTINGS_LAYOUTS.md`; Studios → `docs/UI_UX/26`/`27` (judged by Studio class).
**Mode:** Read-only. No code changed.

> Note: on this case-insensitive macOS filesystem `src/components/settings/**` and `src/components/Settings/**` resolve to the **same files**. They are treated as one module below.

---

## Executive Summary

| Module | Verdict | Headline issue |
| ------ | ------- | -------------- |
| Admin | **NEEDS-WORK** | `crimson-*` token drift survives in sidebar; 22 raw `<table>` + 0 `RowActionsMenu`; 31 raw `<select>`; many ad-hoc banner divs |
| Settings | **NEEDS-WORK** | 37 raw `<select>` + 23 raw checkboxes despite Switch/Toggle adoption in 45 files; doc-24 ownership/no-stub rules need spot-checks |
| ReportsAndPresentations | **PASS (MINOR)** | Cleanest module — full ModuleHub + canonical Menu3 + LoadingState/ErrorState/StatusChip; only thumbnail gradient + 1 inline button spinner |
| Chat (`Chat/**`) | **PASS** | 3 tiny presentational components, all token-clean |
| AIChat | **NEEDS-WORK** | 14 raw `fixed inset-0` modals, 11 raw `<table>`, `dark:bg-[#1a1d2e]` off-token surface in 6 menus, near-zero canonical state components |
| Presentations | **MINOR (Studio class)** | Inline styles are legit (brand swatches/canvas); flag a few `bg-[#…]` + raw selects in settings sub-panels |
| DocumentStudio | **MINOR (Studio class)** | All spinners are inline button loaders (OK); raw `<select>` in intake/architect forms should be SelectField |
| views | **NEEDS-WORK (app screens only)** | `StudioView` full-area off-brand spinner; raw `fixed inset-0` modals in app views; raw select/table in operational views |

Marketing/public pages under `views/**` (PublicLandingPage, PricingLandingPage, EnterprisePage, OurStoryPage, ResourcesPage, VectorPage, AuditsShowcasePage, etc.) are **out of the module-hub standard** and are excluded from verdicts except where they leak app chrome.

---

## 1. Admin — NEEDS-WORK

Layout SSOT is `Admin/AdminLayout.tsx` (two-column 280px sidebar + scroll content). That wrapper itself is token-clean and conforms to doc 24's "separate root" model. The problems are inside the panels.

### Stray ad-hoc elements
- **0 uses of `RowActionsMenu`** anywhere in Admin, yet **22 files render raw `<table>`** and there is a local `Admin/shared/EnhancedDataTable.tsx` parallel to the canonical `ui/composed/DataTable`. Hand-rolled kebabs live in `Admin/TemplatesManagementPanel.tsx`, `Admin/compliance/DataRequestManager.tsx`, `Admin/team/LastActiveTracker.tsx` (`MoreVertical`/`MoreHorizontal`) instead of `shared/RowActionsMenu.tsx`.
- **31 files use raw `<select>`** instead of `SelectField` — e.g. `Admin/AdminMembersRolesPanel.tsx`, `Admin/AdminSecurityPolicyPanel.tsx`, `Admin/WorkspaceDefaultsPanel.tsx`, `Admin/ProjectGovernance.tsx`, `Admin/BrandingSettingsPanel.tsx`, `Admin/UnifiedSyncHub.tsx`.
- **26 files use raw `type="checkbox"`** instead of `Switch`/`Toggle`/canonical `Checkbox`.
- **Ad-hoc info/warning banner divs** (`bg-amber-50`/`bg-rose-50`/`bg-blue-50` + border) instead of `Banner` in: `Admin/AdminMembersRolesPanel.tsx`, `Admin/RolesManagementPanel.tsx`, `Admin/DataGovernancePanel.tsx`, `Admin/ProjectGovernance.tsx`, `Admin/AIMissionControl.tsx`, `Admin/V8AdminDiagnosticsPanel.tsx`, `Admin/AdminRiskSummaryPanel.tsx`, `Admin/SLADashboard.tsx`, `Admin/TeamHealthBar.tsx`, `Admin/ChatV9FlagsIndicator.tsx`.
- **Hand-rolled error button** not using `Button`: `Admin/LLMHealthPanel.tsx:317` (`bg-rose-600 text-white rounded-lg`), `Admin/PartnerCodeInput.tsx:316`, `Admin/InterviewAssignmentsPanel.tsx:273`.

### Color / token drift (Admin historically had crimson drift — STILL PRESENT)
- **`crimson-*` palette still live** in `Admin/AdminSettingsSidebar.tsx:116` and `:125` (`border-crimson-200 bg-crimson-50 text-crimson-900 …` / `bg-crimson-100 text-crimson-700 …`). This is the exact off-brand drift the standard calls out — active nav state should be the brand `primary/violet-blue` tint, not crimson.
- **Hardcoded hex** in `Admin/BrandingSettingsPanel.tsx:75-126` and `:512`, `:592-595` (`#6366F1`, `#3B82F6`, `#1E293B`, etc.). Some are defensible (a branding editor literally picks colors) but the default-theme constants and preview surfaces should reference tokens.
- Inline-style usage in `Admin/SLADashboard.tsx:565`, `Admin/ComplianceDashboard.tsx:490/515/610` is **acceptable** (dynamic `width: %`/`height: %` for bars) — not flagged.

### State correctness
- `LoadingState`/`EmptyState`/`ErrorState` are imported in only a minority of panels (~10 of 40+). Many panels likely fall back to bare text or empty-on-failure. `Admin/LLMHealthPanel.tsx:362` and `Admin/ComplianceDashboard.tsx:380` hand-roll error coloring rather than `ErrorState`.

### Layout
- Per doc 24, Admin is correctly a separate root with its own shell (`AdminLayout` + `AdminSidebar`). PASS on IA. The `fixed inset-0` at `AdminLayout.tsx:105` is the mobile sidebar scrim — **acceptable**, not a stray modal.

### Top fixes
1. Kill `crimson-*` in `AdminSettingsSidebar.tsx:116,125` → brand `primary`/violet active state.
2. Replace the 22 raw tables + hand-rolled kebabs with `ui/composed/DataTable` + `shared/RowActionsMenu` (retire `Admin/shared/EnhancedDataTable.tsx`).
3. Swap raw `<select>`/checkboxes for `SelectField`/`Switch` across the 31/26 offender files.
4. Replace ad-hoc colored banner divs with `Banner`.
5. Adopt `LoadingState`/`EmptyState`/`ErrorState` uniformly so failures don't render as empty.

---

## 2. Settings — NEEDS-WORK

Shell is `views/SettingsView.tsx` — two-column 280px sidebar + dynamic right panel, matching doc 24's "user-scoped preferences + ownership panels" intent (`SettingsOwnershipPanels` is wired). Shell conforms. Panel internals drift.

### Stray ad-hoc elements
- **37 files use raw `<select>`** instead of `SelectField` — e.g. `settings/WorkingHoursSettings.tsx:421,436`, `settings/AIModelSelectionSettings.tsx`.
- **23 files use raw `type="checkbox"`** — even though `Switch`/`Toggle` is correctly used in 45 files, the split is inconsistent within the same module (e.g. `settings/IntegrationSettings.tsx`, `settings/AISecuritySettings.tsx`, `settings/AdvancedSettings.tsx`, `settings/security/AdvancedSecuritySettings.tsx` mix both).
- 8 files carry hardcoded hex; most are **legitimate** (brand logo SVG fills in `settings/ConnectedAccounts.tsx:34-65`, theme swatch values in `settings/ThemeSettings.tsx:32-35`). Not blocking, but the `bg-[#0A66C2]` arbitrary class at `ConnectedAccounts.tsx:65` is a token-bypass.

### State correctness
- Mixed. Some panels show data without a distinct error path. `SettingsView.tsx:436` `fixed inset-0` is the mobile sidebar scrim — acceptable.

### Doc-24 specific
- **MUST NOT "stubbed save"**: panels mounted in production must not fake success. This needs a per-panel save-path audit (out of pure-static reach); flag `settings/*` panels that `setState` without an API call as a follow-up.

### Top fixes
1. Standardize on `SelectField` for the 37 raw-select files.
2. Standardize on `Switch`/`Toggle` for the 23 raw-checkbox files (module already half-migrated).
3. Replace `bg-[#0A66C2]` arbitrary value in `ConnectedAccounts.tsx:65` with a token/util.
4. Verify no stubbed saves on mounted panels (doc 24 MUST NOT).

---

## 3. ReportsAndPresentations — PASS (MINOR)

This is the reference-quality module of the group. `ReportsAndPresentationsHub.tsx` uses `ModuleHub`, `ModuleTab`/`ViewMode`/`FilterChip`, the canonical Menu3 constants (`MENU_3_CHIP_ACTIVE`, `MENU_3_BADGE_*`, `getMenu3AiButtonClass`) and `useModuleOpenDocuments`. Tabs use `LoadingState`, `ErrorState`, and `StatusChip`.

### Minor flags
- `PresentationsTabContent.tsx:87` — `bg-gradient-to-br from-slate-200 to-slate-300 …` is a **thumbnail placeholder**, low-risk but technically an ad-hoc gradient.
- `OutputsAggregateTabContent.tsx:736` — inline `<Loader2 className="animate-spin" />` inside a button; acceptable inline loader.
- `ReportsAndPresentationsHub.tsx:501` — `fixed inset-0 cursor-default` is a click-outside catcher, not a raw modal; acceptable.
- State separation is correct: `ReportsTabContent.tsx:311` distinguishes error-with-empty-list from a normal empty state (good — no empty-on-failure bug).

### Top fixes
1. (Optional) Move the thumbnail placeholder gradient to a tokenized utility class.

---

## 4. Chat (`Chat/**`) — PASS

Only three files: `ChatSmartSuggestions.tsx`, `ChatActionCard.tsx`, `ChatActionButton.tsx`. The 3 `animate-spin` hits are inline button loaders. No raw modals, tables, selects, hex, or gradients. Conformant.

---

## 5. AIChat — NEEDS-WORK

Large surface (~40 top-level files + sub-trees). The conversational canvas is a Studio-class workspace, so some bespoke chrome is expected, but it carries clear non-canon basics.

### Stray ad-hoc elements
- **14 files use raw `fixed inset-0` modals** instead of canonical `Modal`/`Drawer` — `AIChat/MoveToProjectModal.tsx:136`, `AIChat/ChatExportModal.tsx:36`, `AIChat/CloudFilePicker.tsx:179`, `AIChat/ToolsMenu.tsx:426`, `AIChat/ImageAttachment.tsx:336`, `AIChat/DiagramArtifact.tsx:105`, `AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleActions.tsx:108`, plus scrims in `ChatHistorySidebar.tsx:642`, `Messages/MessageActions.tsx:234,286`, `BranchSelector.tsx:227`. The named `*Modal.tsx` files in particular should adopt the canonical `Modal`.
- **11 files render raw `<table>`** — several are artifact renderers (`Artifacts/renderers/TableRenderer.tsx`, `ComparisonMatrixRenderer.tsx`, `PMODocumentRenderer.tsx`, `CanvasMarkdownRenderer.tsx`) where rich markdown/artifact tables are arguably content, not app DataTables. But `KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx` and `WorkCanvasShell.tsx` should be checked against the table-preview standard.
- **9 files use raw `<select>`** — `Wave5/6/7/8` admin panels, `ToolsMenu.tsx`, `V8ArtifactRunControl.tsx`, `WorkCanvasDocumentPanel.tsx`.
- Near-zero adoption of `LoadingState`/`EmptyState`/`ErrorState`/`Modal` (≈4 files total across the whole tree).

### Color / token drift
- **`dark:bg-[#1a1d2e]` off-token surface** repeated across menus: `AIChat/CoThinkerMenu.tsx:241`, `AIChat/WorkModeMenu.tsx:206`, plus `AddFilesMenu.tsx`, `ToolsMenu.tsx`, `WorkCanvasDocumentPanel.tsx`, `composer/CommandPalette.tsx`. Should be `dark:bg-navy-800/900`.
- `DiagramArtifact.tsx:69,148,189` hardcode `#cbd5e1`/`#94a3b8`/`#64748b` for canvas node/edge strokes — borderline (canvas lib styling) but should map to tokens.
- Many other "hex" hits are **false positives**: brand logo SVG fills (`AddFilesMenu.tsx` Drive/OneDrive/Dropbox) and feedback-ID comments (`#3c5b87cf` etc. in `MessageRenderer.tsx`). Not flagged.

### Top fixes
1. Migrate the named `*Modal.tsx` (`MoveToProjectModal`, `ChatExportModal`, `CloudFilePicker`) to canonical `Modal`.
2. Replace `dark:bg-[#1a1d2e]` with `dark:bg-navy-*` across the 6 menu/palette files.
3. Replace raw `<select>` in the Wave admin panels with `SelectField`.
4. Adopt `EmptyState`/`ErrorState` for conversation/list empties to avoid empty-on-failure.

---

## 6. Presentations (DeckBuilder + Wizard) — MINOR (Studio / Gamma class)

Judged by doc 27 (Presentation Studio). This is intentionally a Gamma-class editor with its own canvas chrome (`DeckBuilder/*`, `wizard/*`), so floating toolbars, command palette, and direct positioning are **on-standard for the Studio**.

### Legit, NOT flagged
- The 18 inline-style hits are appropriate: brand color swatches (`BrandKitSettings.tsx:153-158`, `wizard/ColorSetGallery.tsx:36-70`) and animation timing (`wizard/GeneratingStep.tsx:27,31`). Canvas-driven positioning is expected.
- 11 `animate-spin` are inline loaders within the wizard/generate flow.

### Flags (stray non-canon basics)
- `bg-[#…]` arbitrary surfaces appear in the DeckBuilder tree — route these to tokens where they aren't user-chosen deck colors.
- 5 files use raw `<select>` (wizard/settings sub-panels) — these are app-form controls, not canvas, so should be `SelectField`.
- 6 `fixed inset-0` overlays — most are present-mode/fullscreen (Studio-legit), but `DeckAuditLogModal.tsx` / `DeckGovernanceCardModal.tsx` style modals should use canonical `Modal`.

### Top fixes
1. Use `SelectField` in wizard/settings form selects (non-canvas).
2. Route audit-log / governance modals to canonical `Modal`.
3. Tokenize any non-user-chosen `bg-[#…]` surfaces in DeckBuilder.

---

## 7. DocumentStudio — MINOR (Studio class)

Judged by doc 26. `DocumentStudioView.tsx` is a clean tabbed Studio shell importing `LoadingState` from primitives.

### State / spinners
- **All `animate-spin` are inline button/section loaders** (`h-3.5`/`h-4`): `DocumentStudioDocumentPanel.tsx:1893,1930,1943,1959,1975`, `QaPanel.tsx:151`, `OutlinePanel.tsx:82`, `TemplateArchitectView.tsx:266`. No full-area raw spinner. Good.

### Flags
- **Raw `<select>`** (should be `SelectField`): `DocumentStudioEditorPanel.tsx:311,332`; `DocumentStudioIntakeForm.tsx:148,224,239,251,266`; `DocumentStudioTemplateArchitectView.tsx:184,224`; `DocumentStudioDocumentPanel.tsx:662,1133,1360`.
- **Raw `type="checkbox"`**: `DocumentStudioEditorPanel.tsx:372`, `DocumentStudioIntakeForm.tsx:296`, `DocumentStudioTemplateArchitectView.tsx:235` → use `Switch`/canonical checkbox.
- No hex / inline-style / gradient drift. Clean on color.

### Top fixes
1. Replace intake/architect/editor raw `<select>` with `SelectField`.
2. Replace the 3 raw checkboxes with `Switch`/canonical checkbox.

---

## 8. views/** — NEEDS-WORK (app screens only)

The directory mixes marketing pages (out of scope for module-hub standard) with real app screens. Findings limited to app screens.

### App-screen flags
- **`StudioView.tsx:151`** — full-area raw spinner with **off-brand `text-blue-500`** and **hardcoded `bg-slate-950`** background. Should use `LoadingState`. (Line 211 is an acceptable inline save spinner.)
- **Raw `fixed inset-0` modals** in app views: `ReportBuilderView.tsx:67` (`z-[80] … bg-black/50 backdrop-blur-sm`) should be canonical `Modal`. `SettingsView.tsx:436` is a mobile scrim (acceptable).
- **`InitiativeManagementView.tsx`** — raw `<select>` at `:281,296` (should be `SelectField`), but **does correctly** use `LoadingState` (`:338`) and `EmptyState` (`:340`) — good reference for the rest.
- Aggregate across `views/**`: 76 files with raw `<table>`, 109 with raw `<select>`, 77 with `fixed inset-0`, 73 with gradients, 34 with hex — but the **large majority are marketing/landing pages** (PublicLandingPage, PricingLandingPage, EnterprisePage, VectorPage, OurStoryPage, ResourcesPage, AuditsShowcasePage, PartnerApplicationView, etc.) which are not governed by the module-hub standard. Operational app views (Studio, ReportBuilder, InitiativeManagement, KnowledgeBase, ProjectIntelligence, LeadershipDashboard, ImplementationView, FullExecutionView) are the ones to bring to canon.

### Top fixes
1. `StudioView.tsx:151` → `LoadingState` (remove `text-blue-500` / `bg-slate-950`).
2. `ReportBuilderView.tsx:67` → canonical `Modal`.
3. Sweep operational app views for raw `<select>`/`<table>` → `SelectField`/`DataTable` (use `InitiativeManagementView` state handling as the local pattern).
4. Confirm marketing pages are explicitly scoped out so they don't dilute future sweeps.

---

## Cross-cutting themes

1. **`RowActionsMenu` adoption is zero in Admin** despite many record tables — biggest single systemic gap in the group.
2. **Form primitive bypass is the most common drift**: ~80+ raw `<select>` and ~50+ raw checkboxes across Admin/Settings/DocumentStudio/views where `SelectField`/`Switch` exist.
3. **Residual palette drift**: `crimson-*` in `AdminSettingsSidebar` and `dark:bg-[#1a1d2e]` across AIChat menus are the two real off-token surfaces (most other "hex" hits are brand logos or feedback-ID comments — false positives).
4. **State components under-used** outside ReportsAndPresentations and a few exemplar views — risk of empty-on-failure. ReportsAndPresentations and `InitiativeManagementView` are the in-repo good references to copy.
