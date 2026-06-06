# Cross-Cutting — UI/UX & Design Consistency Audit

**Consistency grade: D — four competing shell patterns, 57+ orphaned duplicate files, 1,458 hardcoded hex colors, and no enforcement of the freeze registry anywhere in the active codebase.**

---

## Shell fragmentation (the core "bałagan")

Five distinct top-level layout/shell patterns are in active use. The approved standard (`APPROVED_COMPONENT_COMPOSITION.md`) names only `ModuleHub`, `AppTable`, `Table+Preview`, `NMode`, and `ToolWizard`. Two additional shells exist outside this list and are actively rendering.

| Shell | Files rendering it | Module coverage |
|---|---|---|
| `ModuleHub` | 14 Hub components | Benefits, Discovery, Economics, Finance, Execution, Initiatives, Interview, Meeting, Presentations, ReportBuilder, Reports, ReportsAndPresentations, Results, Assessment |
| `SplitLayout` | 17 files (views + assessment components) | Assessment (×4), ExecutiveView, FullAssessmentView, FullROIView, FullRoadmapView, FullRolloutView, ImplementationView, InterviewView, LeadershipDashboard, MyWorkView, ProjectIntelligenceView, StudioView, UserDashboard |
| `KimiWorkspaceShell` | 4 files | AIChat/KimiWorkspace: ExceleView, WordyView, PrezentacjeView, TabeleView |
| `ExecutiveModuleShell` | 3 files | TabeleMelsView (inside Kimi), DeckBuilderMelsView, DocumentStudioDocumentPanel |
| `MainLayout` (route wrapper) | ~25+ route entries | AppRoutes.tsx — wraps everything at route level, adding a 5th nesting layer |
| No approved shell | 5 Hub files | AIOSHub, UnifiedSyncHub, EnterpriseIntegrationsHub, ModelRegistryHub, NotificationsHub |

The same module area can render two different shells depending on state (e.g. `AssessmentHubDashboard` switches between `SplitLayout` at lines 76, 90, 109, 124 conditionally).

---

## Design tokens vs hardcoded styling

A proper token system exists in `tailwind.config.js` (navy-50…950, primary, secondary, danger, success, all as CSS HSL vars). It is systematically bypassed:

| Issue | Count |
|---|---|
| Hardcoded hex colors (`#rrggbb`) in component files | **1,458 occurrences across 209 files** |
| `style={{ … }}` inline style blocks | **1,288 occurrences** |
| Arbitrary Tailwind `bg-[#…]` values | **34 occurrences** |
| Raw `slate-NNN` usage (outside token system) | **36,366 occurrences** |

Representative examples:
- `src/components/Landing/AnnaAssistantWidget.tsx`: `bg-[#0E0A25]/95`, `bg-[#140D31]/95`, `hover:bg-[#19123A]`
- `src/components/Landing/EntryFooter.tsx`: `bg-[#0077B5]`, `bg-[#FF0000]`
- `src/components/settings/ConnectedAccounts.tsx`: `bg-[#0A66C2] hover:bg-[#004182]`

The Landing module is the worst offender (bespoke dark backgrounds not mapped to any token). The `slate-*` count (36k) is the deepest structural problem — it means most UI is built on Tailwind defaults instead of the navy/primary/secondary token palette.

---

## Component / primitive duplication

**3 Button implementations:**
- `src/components/ui/Button.tsx` — thin re-export (2 lines)
- `src/components/ui/primitives/Button.tsx` — 163 lines, canonical CVA implementation
- `src/components/Admin/shared/Button.tsx` — 140 lines, fully re-implemented (own variant system)

**2 Card implementations:**
- `src/components/ui/primitives/Card.tsx`
- `src/components/Admin/shared/Card.tsx`

**57 orphaned " 2.tsx" duplicate files** in source tree (not deleted after copy-paste creation):
- 30 in `src/components/AIChat/` (AIOSHub, Wave5…Wave9 panels, VoiceModeLegend, ActionCenter, etc.)
- 8 in `src/views/superadmin/`
- 8 in `src/components/settings/`
- 7 in `src/components/Admin/`
- 4 in `src/components/navigation/`
- Others in DiscoveryTools, shared, v10

These files are dead weight that confuse IDE navigation and inflate the bundle if accidentally imported.

---

## Coming-soon & placeholder UI surface

| Type | Count | Location |
|---|---|---|
| `V4ComingSoonView` full-screen | 3 route slots | `AppRoutes.tsx` lines 711, 2028, 2165, 2177 (one gated by feature flag, 3 hardcoded) |
| `isComingSoon` row-level flags | 10+ rows | `DiscoveryToolsHub.tsx` lines 2522, 2548, 2585 |
| `wkrótce` / `coming soon` toast messages | 5 | `IdeaTableTool.tsx:3663`, `IdeasTableContent.tsx:1115/1123/1131`, `GovernedModelsDashboard.tsx:860` |
| `coming_soon` connector status | 1+ | `EnterpriseIntegrationsHub.tsx:250`, `UnifiedSyncHub.tsx:1679` |
| `EconomicsViewPlaceholder.tsx` | 1 file | `src/views/EconomicsViewPlaceholder.tsx` — entire view is placeholder |

---

## Dark mode / theming consistency

`tailwind.config.js` sets `darkMode: 'class'` — correct approach. However:
- **45,917 `dark:` class occurrences across 1,722 component files** — dark mode is handled per-component, not via CSS tokens.
- Landing pages use bespoke dark backgrounds (`#0E0A25`, `#0B0A23`) that differ from the `navy-950` token (`#0A0F1E`), creating visually different "blacks".
- Some modules (older assessment views using `SplitLayout`) have little to no `dark:` coverage, meaning they break in dark mode.
- No global theme provider: each component independently decides light vs dark appearance.

---

## Icon systems

**Single library: lucide-react** — used in 1,937 import statements across 1,647 files. No heroicons, no react-icons, no custom SVG system conflicts found. This is the one consistent area. The only risk is `DynamicIcon.tsx` and `renderIconNode.tsx` in `src/components/shared/` which act as icon abstraction layers; if they diverge from lucide they become a fragmentation point.

---

## Intended standard vs reality (the gap)

The freeze registry (`_UI_COMPONENT_FREEZE_REGISTRY_2026-05-12.md`) declares strict freeze: "no new component pattern without mini-RFC and explicit approval." The unified standard (`UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md`) mandates exactly one approved shell per screen and exactly one Menu 3 / command row.

Reality:
- `SplitLayout` is not in the approved shell list but is the dominant shell in 17 files.
- `KimiWorkspaceShell` is not in the approved shell list and runs 4 lanes.
- `ExecutiveModuleShell` / MELS is flag-gated but already rendering in 3 production paths without flag checks in all cases.
- The `Admin/shared/Button.tsx` and `Admin/shared/Card.tsx` are forked visual systems with no mini-RFC.
- 57 "` 2.tsx`" files are unauthorized duplicates with no registry entry.
- The freeze registry has zero enforcement mechanism in code (no linting rule, no import checker).

---

## Prioritized fixes to make the UI uniform

1. **Delete all 57 " 2.tsx" orphan files** — pure dead code, zero risk, immediate cleanup. Start with `AIChat/` (30 files).

2. **Migrate SplitLayout → ModuleHub** in the 16 non-assessment views (start with `MyWorkView.tsx`, `LeadershipDashboardView.tsx`, `ExecutiveView.tsx`). `SplitLayout` is the most-used unapproved shell and touches the most user-facing screens.

3. **Replace `Admin/shared/Button.tsx` and `Admin/shared/Card.tsx`** with imports from `src/components/ui/primitives/`. Two forked primitives propagate inconsistency through every Admin screen.

4. **Token migration sweep — replace `slate-*` with `navy-*`** in the 10 highest-traffic components (start with whatever renders the main nav and module tops). 36k occurrences is the root of the "it looks different everywhere" feeling.

5. **Replace 3 hardcoded `V4ComingSoonView` route slots** with real components or remove the routes — they are user-visible dead ends.

6. **Add an ESLint rule banning `style={{` in `.tsx` outside `src/components/ui/`** — stops the 1,288 inline style bleed from growing further.

7. **Add `KimiWorkspaceShell` → `ExecutiveModuleShell` migration plan** — Kimi lanes are already partially on MELS (TabeleMelsView); extend to Excele, Wordy, Prezentacje to unify AI workspace lanes.
