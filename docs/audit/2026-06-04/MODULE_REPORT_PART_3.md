# MODULE REPORT — PART 3 (UI/UX, read-only)

Date: 2026-06-04 · Branch: `feat/wave1-foundations` · Scope: modules 12–15
Reflects current code after Wave-1/2 fixes (off-brand violet→crimson incl. AIChat dark surfaces & Admin crimson-drift nav→primary; `dark:text-slate-600`→`-400`).

Verification method: ripgrep over `src/components/{ReportsAndPresentations,Organization,Admin,settings}/**`. No code edited.

> Note: `src/components/Settings/**` (uppercase) and `src/components/settings/**` (lowercase) are the **same directory** — only the lowercase path is tracked in git (154 files); the uppercase listing is macOS case-insensitive aliasing. All Settings findings below cite the canonical lowercase path.

---

## 12) Outputs / Reports — `src/components/ReportsAndPresentations/**`

### a) Komponenty graficzne
Strongly canonical. Hub uses `ModuleHub` + `ModuleMenu3` (`ReportsAndPresentationsHub.tsx:28-40,1058`). Every tab uses `FilterableTable` (Reports `:449`, Presentations `:398`, Templates `:456`, OutputsAggregate `:968`) with built-in `emptyMessage` (ReportsTab `:402,458`; PresentationsTab `:349,407`; TemplatesTab `:435,468`; OutputsAggregate `:710,977`), `LoadingState variant="spinner"` (ReportsTab `:308`, PresentationsTab `:304`, TemplatesTab `:312`, OutputsAggregate `:647`), `ErrorState` + retry (OutputsAggregate `:652`), `StatusChip`/`MetaChip`, `Button variant="brand"`, and `RowAction[]` from the shared `RowActionsMenu` (OutputsAggregate `:49,464`; Templates `:32`; Presentations `:23`; Reports `:23`).
Remaining STRAY: one `fixed inset-0` — but it is a **legit click-away backdrop** for a popover (`ReportsAndPresentationsHub.tsx:501` `z-40 cursor-default`), not an ad-hoc modal. One raw `animate-spin` `Loader2` inside a refresh button (`OutputsAggregateTabContent.tsx:736`) — minor, an inline action spinner. No raw `<table>`, no raw `<select>`, no hand-rolled kebab, no ad-hoc degraded banner.

### b) Kolory (light + dark)
- Off-brand **indigo** in `previews/TemplatePreview.tsx:43-45` (`bg-indigo-500/5`, `text-indigo-500`, `text-indigo-600 dark:text-indigo-300`) — should be primary/crimson or slate.
- Dark contrast risk: `TrustStatePreviewSection.tsx:94,148,168` use `dark:text-slate-500` on `text-[10px]` labels (uppercase tracking + 10px = low legibility); should be `dark:text-slate-400`. (Lines 187/193 are `dark:text-slate-300` mono values — fine.)
- Preview components (`TemplatePreview`, `ReportPreview`, `PresentationPreview`) consistently use `text-slate-500 dark:text-slate-400` body — clean post-fix.
- No hex / `[#…]` / inline-style colors in the module.

### c) Uwagi
Best-in-class empty-vs-error discipline in `OutputsAggregateTabContent.tsx:649-688`: distinct `ErrorState` (source needs attention + retry) vs a separate **Teresa onboarding empty state** gated on `!error && rows.length===0 && no search/filter`, and it correctly uses `bg-crimson-50 / text-crimson-600 / dark:text-crimson-400` (Wave fix confirmed — no violet). Shapes/rounding consistent (`rounded-2xl`, brand button). No UX dead-ends. Only nit: the 10px trust-state captions are dense.

**Werdykt: PASS**
Top 3 fixes: (1) `TemplatePreview.tsx:43-45` indigo→primary/slate; (2) `TrustStatePreviewSection.tsx:94,148,168` `dark:text-slate-500`→`-400`; (3) replace inline `animate-spin` at `OutputsAggregateTabContent.tsx:736` with a shared spinner token (cosmetic).

---

## 13) Organization / Organizacja — `src/components/Organization/**`

### a) Komponenty graficzne
Partly canonical. `OrganizationAdminPanel.tsx` uses `LoadingState` (`:83,423`), `ErrorState` (`:429`), `MetaChip` (`:26`). `CompetencyCatalog.tsx` uses `LoadingState` (`:178`) + composed `EmptyState` (`:8,187`). `OrgContextSummaryBanner.tsx` uses `Button` (`:232`).
STRAY (ad-hoc) — this module pre-dates the ModuleHub/DataTable canon and shows it:
- Raw `<table>`: `OrganizationAdminPanel.tsx:199`, `CompetencyCatalog.tsx:384` — should be `DataTable`/`FilterableTable`.
- Raw `<select>`: `OrganizationAdminPanel.tsx:174`, `CompetencyCatalog.tsx:345` — should be `SelectField`.
- Raw `animate-spin` `Loader2`: `OrganizationAdminPanel.tsx:190,861`, `KnowledgeGraphExplorer.tsx:315` (the last is an inline search-button spinner — acceptable).
- `OrgContextSummaryBanner` is a hand-rolled banner (no `Banner` primitive import) — but it is a purpose-built context summary, borderline acceptable.

### b) Kolory (light + dark)
- Off-brand **purple chip**: `CompetencyCatalog.tsx:224,236` (`bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40`) — chrome, should map to chip-system token.
- Hardcoded hex brand-default **`#6366f1` (indigo)** as the org brand-color fallback: `OrganizationAdminPanel.tsx:767,778,790,795,816` — brand default should be crimson `#A51C30`, not indigo.
- `KnowledgeGraphExplorer.tsx:74-81,131-132` hex palette (`#6366f1` person/concept, `#0ea5e9`, `#10b981`, `#ec4899`, edge `#94a3b8`) — this is a **ReactFlow data-viz node palette**, legit as data; but `person`/`concept` defaulting to indigo `#6366f1` reads off-brand for the primary node type.
- Dark contrast: `OrganizationSidebar.tsx:204` `dark:text-slate-500` on a section label (`text-xs font-semibold tracking-wider`) — bump to `-400`. `CompetencyCatalog.tsx:406` empty-row cell `dark:text-slate-500` — bump to `-400`. Rest of sidebar/catalog body is `dark:text-slate-300/-400` — clean.

### c) Uwagi
Empty-vs-error is handled: `CompetencyCatalog` has `EmptyState` + `LoadingState`; `KnowledgeGraphExplorer.tsx:340-346` has a dedicated bilingual onboarding empty state ("Your knowledge graph is empty"); `OrganizationAdminPanel` has `LoadingState`+`ErrorState`. Main gaps are structural: two raw tables + raw selects diverge from the table/SelectField canon, and the indigo `#6366f1` brand default contradicts the crimson brand decision (v1 HBS brand). Shapes/rounding internally consistent.

**Werdykt: MINOR**
Top 3 fixes: (1) change brand-color default `#6366f1`→`#A51C30` at `OrganizationAdminPanel.tsx:767,778,790,795,816` (+ remap KG `person`/`concept` palette off indigo); (2) migrate raw `<table>`/`<select>` (`OrganizationAdminPanel.tsx:174,199`, `CompetencyCatalog.tsx:345,384`) to `DataTable`/`SelectField`; (3) `CompetencyCatalog.tsx:224,236` purple chip → chip-system token; bump `OrganizationSidebar.tsx:204` & `CompetencyCatalog.tsx:406` `dark:text-slate-500`→`-400`.

---

## 14) Admin — `src/components/Admin/**`

(Per doc 24: Admin legitimately uses settings-panel layout + Admin/shared adapters: `Button`, `Card`, `Input`, `PageHeader`, `AdminTable`, `EnhancedDataTable`, `MetricCard`, `ColumnSelector`, `PermissionMatrix`, `AdvancedFilters`, `AdminBreadcrumbs`.)

### a) Komponenty graficzne
Has a real shared kit (`Admin/shared/*`) and a canonical degraded/unavailable banner component (`AdminState.tsx:6,35-65` — `degraded`/`unavailable`/`readOnly`/`hidden`, with `role="status"`), which is the correct pattern and is used in lieu of ad-hoc banners. `AdminLayout.tsx` provides the shell + mobile backdrop (`:105` `fixed inset-0` — legit overlay).
STRAY (ad-hoc, scale of a 130-file module): raw `<table>` in **22 files**, raw `<select>` in **31 files**, raw `type="checkbox"` in **26 files**, raw `animate-spin` in **42 files**, `fixed inset-0` modals in **8 files** — of which several are genuinely ad-hoc dialogs not using a Modal/Drawer primitive: `ABTestingDashboard.tsx:634`, `AuditLogViewer.tsx:602`, `UnifiedSyncHub.tsx:4423`, `WorkModeSettings.tsx:443`, `InitiativeTemplateEditor.tsx:768,783` (`ColumnSelector.tsx:152` and `ChatV9FlagsOverlay.tsx:143` and `AdminLayout.tsx:105` are legit backdrops/overlays). Given the doc-24 latitude for Admin/shared adapters this is tolerable as chrome, but the raw `<select>`/`<table>`/checkbox spread is the dominant inconsistency.

### b) Kolory (light + dark)
- **Crimson-drift fix confirmed**: `AdminSidebar.tsx` active state now uses `bg-primary-*` / `text-primary-*` (`:495,566,573`); only a **stale comment** remains ("violet accent", `:6`).
- **`dark:text-slate-600` = 0 occurrences** module-wide (Wave-2 fix confirmed). Remaining `dark:text-slate-500` = 238 across 61 files — acceptable muted/icon tier (not the over-dark `-600`).
- Most "violet/indigo/purple" hits are **data/token names or palettes, not off-brand chrome**: `RolesManagementPanel.tsx` color field values; `AI/ModelsProvidersTab.tsx` tier config `color:'violet'`; `team/MembershipStatsCard.tsx:91` maps `violet`→`stroke-primary-500` (correctly remapped); `workspace/CustomStatusesManager.tsx:71-74` & `BrandingSettingsPanel.tsx` hex are **color-picker swatch palettes** (legit data).
- Genuine off-brand **rendered indigo chrome** (small): `InitiativeTemplateEditor.tsx:1514,2145` (`text-indigo-500`, `bg-indigo-50`), `AdminInitiativeSectionTypesPanel.tsx:716` (`text-indigo-500`), `PromptAssistantPanel.tsx:391` (full indigo chip `bg-indigo-100 … text-indigo-700`).

### c) Uwagi
Layout largely conforms to doc 24 (separate Admin root, settings-panel shell via `AdminLayout`, shared adapters). The degraded/unavailable contract is properly componentized (`AdminState`), satisfying doc-24 "no fake success / degraded surfacing." The systemic weakness is breadth of raw form controls (`<select>` 31, checkbox 26) and raw tables (22) that bypass `SelectField`/`Switch`/`AdminTable`/`EnhancedDataTable` — inconsistent control styling across panels. No crimson-drift, no over-dark text.

**Werdykt: MINOR**
Top 3 fixes: (1) remove stale "violet accent" comment `AdminSidebar.tsx:6` and convert the 4 real indigo-chrome sites (`InitiativeTemplateEditor.tsx:1514,2145`, `AdminInitiativeSectionTypesPanel.tsx:716`, `PromptAssistantPanel.tsx:391`) to primary; (2) consolidate raw `<select>` (31 files) → `SelectField` and raw checkboxes (26) → `Switch`/`Toggle`; (3) route the 6 ad-hoc `fixed inset-0` dialogs (`ABTestingDashboard`, `AuditLogViewer`, `UnifiedSyncHub`, `WorkModeSettings`, `InitiativeTemplateEditor`×2) through a Modal/Drawer primitive.

---

## 15) Settings / Ustawienia — `src/components/settings/**`

(Per doc 24: Settings = user-scoped prefs + ownership panels; settings-panel layout via shared `SettingsSection`.)

### a) Komponenty graficzne
Canonical `SettingsSection` (`shared/SettingsSection.tsx`, with `SettingsSectionSkeleton`, save-footer, dirty/loading) exists and is used in **29 of ~150** section files — adoption is partial; many older sections (Profile*, Notification*, Security*) hand-roll their own card/header.
STRAY (ad-hoc) across this large module: raw `<select>` in **37 files** (top: `WorkPreferencesSettings.tsx`×7, `OrganizationProfileForm.tsx`×6, `security/AdvancedSecuritySettings.tsx`×4, `ProfileSettings.tsx`×4) vs `SelectField`; raw `type="checkbox"` in **23 files**; **hand-rolled toggles** (`peer-checked`/`translate-x-5|6`) in **22 files** vs only **19 files** importing/using canonical `Switch`/`Toggle` — near 50/50 fragmentation of the single most common Settings control; raw `<table>` in 5 files; raw `animate-spin` in 79 files (many inline button spinners); `fixed inset-0` in 8 files.

### b) Kolory (light + dark)
- **`dark:text-slate-600` = 0** (Wave-2 fix confirmed). `dark:text-slate-500` = 231 across 79 files — acceptable muted tier.
- Legit hex (NOT findings): brand SVG logos `ConnectedAppsSettings.tsx:43-79` (Google/Slack/MS hex); Recharts axes `IntegrationAnalyticsSettings.tsx:391-405` (`#e2e8f0`/`#64748b`/`#3b82f6`); `ThemeSettings.tsx:32-44` accent-picker swatch palette which **correctly defaults to crimson `#A51C30` / `bg-primary-500`**.
- Genuine off-brand **indigo chrome (16 files)** — survived the Wave fixes: `IntegrationSettings.tsx` heavily (`:1720-2067` `bg-indigo-600` buttons, badges, `animate-spin text-indigo-600`), `AvailabilitySettings.tsx:363-369`, `AvailabilityStatusSection.tsx:330,348,398` (`bg-indigo-600` toggle/active), `AppearanceSettings.tsx:439,477,489`, `GeneralPreferencesSettings.tsx:415,448,469`, `EmailSignatureSettings.tsx:192-193`, `advanced/SettingsTemplates.tsx:213,223,265`, `ProfessionalProfileSection.tsx:367`. These are buttons/active-states/icons, not data — clear brand violations.

### c) Uwagi
Layout: partially conforms to doc-24 settings-panel via `SettingsSection`, but the ~80% of sections that don't adopt it produce inconsistent header/spacing/rounding. Biggest UX/consistency risk = control fragmentation (37 raw `<select>`, 22 hand-rolled toggles vs 19 canonical Switch) → visually divergent form rows across tabs. Color: the indigo-chrome cluster (16 files, esp. `IntegrationSettings`) is the standout off-brand debt in the whole report — these are accent buttons/toggles that should be crimson/primary. No over-dark text; data-viz/logo/swatch hex all legit.

**Werdykt: NEEDS-WORK**
Top 3 fixes: (1) eliminate off-brand **indigo chrome** in the 16 files (priority `IntegrationSettings.tsx:1742,1799,1938,2067`, `AvailabilityStatusSection.tsx:348,398`, `AppearanceSettings.tsx:477,489`, `GeneralPreferencesSettings.tsx:448,469`) → `bg-primary-600`/`text-primary-*`; (2) standardize toggles — replace the 22 hand-rolled `peer-checked`/`translate-x` switches with canonical `Switch`/`Toggle`, and 37 raw `<select>` with `SelectField`; (3) drive `SettingsSection` adoption across the remaining ~120 sections for uniform header/spacing/save-footer.

---

## Summary

| # | Module | Verdict | Headline |
|---|--------|---------|----------|
| 12 | Outputs/Reports | **PASS** | Fully on ModuleHub/FilterableTable; exemplary empty-vs-error (crimson, not violet). Nits: TemplatePreview indigo, 3× dark:text-slate-500 captions. |
| 13 | Organization | **MINOR** | Pre-canon: raw tables/selects; indigo `#6366f1` brand default contradicts crimson; purple chip. |
| 14 | Admin | **MINOR** | Crimson-drift fixed, dark-600 = 0, AdminState degraded contract solid. Breadth of raw select/checkbox/table; few real indigo-chrome + ad-hoc modals. |
| 15 | Settings | **NEEDS-WORK** | dark-600 = 0, but 16 files off-brand **indigo chrome** (IntegrationSettings worst); 22 hand-rolled toggles vs 19 canonical; 37 raw selects; partial SettingsSection adoption. |

Wave-1/2 confirmation: `dark:text-slate-600` is now **0** in Admin and Settings; AdminSidebar crimson-drift **resolved** (now `primary-*`, only a stale comment); RAP onboarding/empty states use **crimson**, not violet. Remaining off-brand debt is concentrated in **Settings indigo chrome** and **Organization's `#6366f1` brand default**.
