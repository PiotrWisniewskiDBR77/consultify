# Harvard Color Remap Audit

**Date:** 2026-06-03
**Scope:** Read-only inventory of every NON-crimson accent/decorative color used across `src/`.
**Goal:** Identify which Tailwind/hex colors are arbitrary decorative accents (to remap to Harvard's official secondary/complementary palette — blues, greens, golds) vs. legitimate semantic status/chart/category colors (to keep).
**Method:** ripgrep over `src/` (3,114 ts/tsx files). Counts are total class-occurrences, not file counts.

---

## 0. TL;DR

- **Harvard Crimson is correctly the sole brand accent.** `crimson`, `primary` (re-pointed to crimson), `--c-accent`, focus rings, brand gradients, and `hig-primary` all resolve to `#A51C30`. No Harvard secondary palette exists yet — there is **no** `harvard-blue`, `ivy`, or any official Harvard complementary scale in `tailwind.config.js` or `src/index.css`.
- **The non-crimson color sprawl is large and overwhelmingly Tailwind-default families** (blue, amber, emerald, rose, green, indigo dominate). Most of it is split between (a) legitimate semantic status (success/warning/danger/info) and (b) arbitrary **decorative** accents that should move to a Harvard complementary palette.
- **The single biggest remap lever:** decorative gradients (`from-/to-/via-*`) and icon-chip/hero/category tints in blue/indigo/amber/emerald. ~1,900 gradient-stop occurrences alone, plus thousands of flat decorative `bg-/text-/border-` tints.
- **Chart/data-viz palettes are hardcoded Tailwind hexes** (`#3b82f6`, `#10b981`, `#f59e0b`, `#f43f5e`, `#6366f1`…) scattered across ~12 palette arrays — these are a distinct bucket; they need a Harvard-derived categorical chart palette, not the status colors.

---

## 1. Per-family usage counts

All `(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|outline|divide|placeholder|accent|caret|decoration)-{family}-{shade}` occurrences in `src/`.

| Family    | Total occurrences | Of which gradient stops (from/to/via) | Dominant bucket |
|-----------|------------------:|--------------------------------------:|-----------------|
| **amber**   | 9,903 | 282 | Status (warning) + heavy decorative |
| **rose**    | 9,693 | 99  | Status (danger/critical) + DRD axis tint + decorative |
| **blue**    | 8,721 | 517 | Status (info) + **heavy decorative** |
| **emerald** | 6,626 | 185 | Status (success) + decorative |
| **green**   | 3,729 | 66  | Status (success) |
| **indigo**  | 2,429 | 317 | **Almost entirely decorative** (legacy violet stand-in) |
| **yellow**  | 773   | 7   | Status (warning, secondary) |
| **sky**     | 602   | 17  | Decorative (info-ish) |
| **pink**    | 301   | 49  | Decorative / category |
| **fuchsia** | 86    | 4   | Decorative |
| **red**     | 63    | —   | Status (danger, error states) |
| **orange**  | 32    | 0   | Status (warning, governance) |
| **violet**  | 20    | 0   | Decorative leftover (mostly demoted) |
| **lime**    | 19    | 0   | Decorative / category |
| **purple**  | 16    | 0   | Decorative |
| **cyan**    | 6     | 0   | Decorative |
| **teal**    | 6     | 0   | Decorative |

> Note: `green` and `emerald` are redundant duplicates of the same semantic "success"; `rose` and `red` both serve danger; `blue` and `sky` both serve info. Consolidation opportunity.

### Top files per family

- **blue:** `src/components/Initiatives/sections/TimelinePlanner.tsx` (133), `src/components/InitiativeDetailModal.tsx` (63), `src/components/MyWork/IdeaRecommendationMap.tsx` (48), `src/components/MyWork/TaskDetailView.tsx` (44)
- **amber:** `src/components/MyWork/IdeaRecommendationMap.tsx` (58), `src/components/Admin/UnifiedSyncHub.tsx` (41), `src/components/Interview/InsightViewer.tsx` (40), `src/components/MyWork/TaskDetailView.tsx` (38)
- **rose:** `src/components/MyWork/IdeaRecommendationMap.tsx` (37), `src/components/Execution/ReportDocumentView.tsx` (34), `src/components/MyWork/TaskDetailView.tsx` (33), `src/components/MyWork/DecisionDetailView.tsx` (30)
- **emerald:** `src/components/MyWork/TaskDetailView.tsx` (36), `src/components/settings/AISettings.tsx` (34), `src/components/MyWork/IdeaRecommendationMap.tsx` (34), `src/components/Interview/InsightViewer.tsx` (30)
- **green:** `src/components/InitiativeDetailModal.tsx` (27), `src/components/Import/UnifiedImportWizard.tsx` (22), `src/components/Execution/BenefitsTracker.tsx` (17)
- **indigo:** `src/views/superadmin/PresentationGovernanceWatchlistView.tsx` (27), `src/views/AcceptInvitationView.tsx` (22), `src/views/PublicMiniAssessmentView.tsx` (20), `src/components/Survey/SurveyShell.tsx` (20)
- **sky:** `src/components/Admin/UnifiedSyncHub.tsx` (31), `src/components/MyWork/IdeaRecommendationMap.tsx` (13)
- **pink:** `src/components/SuperAdmin/EmailTemplateEditor.tsx` (18), `src/components/MyWork/table/distribution/DistributionManager.tsx` (16)
- **yellow:** `src/views/superadmin/customers/ContractManagementView.tsx` (8), `src/components/settings/ProfileCompleteness.tsx` (8)
- **violet:** `src/components/Presentations/DeckBuilder/DeckAuditLogModal.tsx` (7), `src/components/MyWork/Home/HomeView.tsx` (2)

---

## 2. Semantic buckets

### (a) STATUS / signal — KEEP as semantic (remap only the *palette source*, not the meaning)

Legitimate success/warning/danger/info signaling. These should be driven by the canonical `--c-success / --c-warning / --c-danger / --c-info` tokens (already defined in `src/index.css`) rather than raw Tailwind families, but the *colors* (green/amber/red/blue) are semantically correct and should NOT become crimson-complementary decorative tints.

- **success** → `green-*` / `emerald-*` (`--c-success #059669`). Active status, confirmations, completed states. Centralized in `src/config/portfolioColors.ts` (`STATUS_COLORS`, `PRIORITY_COLORS`).
- **warning** → `amber-*` / `yellow-*` / `orange-*` (`--c-warning #d97706`). At-risk, pending, governance alerts.
- **danger** → `red-*` / `rose-*` (`--c-danger #dc2626`). Errors, deletion, critical priority. `src/components/ErrorBoundary.tsx`, `src/components/shared/ModuleHub/HubWorkAreaLoadError.tsx`, `src/components/settings/AIMemorySettings.tsx`.
- **info** → `blue-*` / `sky-*` (`--c-info #2563eb`). Informational banners, hints.

> Caveat: Harvard's danger-red and Harvard Crimson are close in hue. To preserve crimson as the *brand* signal, danger states should use a distinct, more orange/scarlet red (e.g. keep `#dc2626`) rather than crimson, so "error" never reads as "brand."

### (b) CHARTS / data-viz series — distinct bucket; needs a Harvard categorical palette

Hardcoded categorical series colors. These must remain *visually distinguishable* (4-8 hues), so they should map to a **Harvard-derived multi-hue chart palette** (crimson + Harvard blue + Harvard green + gold + slate variants), NOT to status colors. See §3 for exact locations.

### (c) DECORATIVE accents — **THE REMAP TARGET → Harvard complementary**

Gradients, icon chips, hero blobs, empty-state illustrations, AI-feature accents, and category tints that carry no status meaning. These currently use arbitrary Tailwind blue/indigo/sky/amber/emerald/pink/fuchsia/violet/cyan/teal and should be remapped to Harvard's official secondary palette. Quantified list in §6.

### (d) CATEGORY coding — semantic-but-arbitrary; remap to a Harvard categorical set

Tool categories, tags, kanban columns, DRD framework axes, mind-map node types. Currently arbitrary Tailwind families. Should move to a fixed Harvard-derived categorical palette (same family of hues as the chart palette for consistency). Key central definitions:

- `src/config/portfolioColors.ts` — `AXIS_COLORS` (DRD framework axes: processes=blue, digital=primary/crimson, models=emerald, data=amber, culture=rose, cybersecurity=rose, ai=primary), `PRIORITY_COLORS`, `STATUS_COLORS`.
- `src/components/MyWork/mindmap/tagColorMapping.ts` — `TAG_COLOR_MAP` (per-tag hex: `#f43f5e`, `#22c55e`, `#6366f1`, `#3b82f6`, `#f59e0b`, `#dc2626`, `#a855f7`, `#10b981`; fallback `#94a3b8`).
- `src/components/MyWork/mindmap/MindmapInspector.tsx:51-81` — per-theme node color sets.
- `src/components/MyWork/processflow/LaneSystem.tsx:26-28` — swimlane tint palettes.

---

## 3. Chart / data-viz color palette definitions (file:line + array)

| File:line | Array | Bucket |
|-----------|-------|--------|
| `src/components/ReportBuilder/blocks/ChartRenderer.tsx:61` | `DEFAULT_COLORS = ['#3b82f6','#6366f1','#3b82f6','#10b981','#f59e0b','#f43f5e','#ec4899','#6366f1','#3b82f6','#f59e0b']` (defaults `primaryColor='#3b82f6'`, `accentColor='#6366f1'`, axis/grid `#e2e8f0`/`#64748b`/`#cbd5e1`) | chart |
| `src/components/AIAnalyticsDashboard.tsx:103` | `COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#6366f1','#3b82f6']` | chart |
| `src/components/Economics/AnalysisCompareView.tsx:41` | `ANALYSIS_COLORS = ['#3b82f6','#6366f1','#f59e0b','#10b981']` | chart |
| `src/views/admin/UsageDashboardView.tsx:93` | `COLORS = ['#64748b','#94a3b8','#475569','#334155','#1e293b','#0f172a']` (slate ramp — neutral, OK) | chart (neutral) |
| `src/components/MyWork/mindmap/CollaborationOverlay.tsx:42` | `CURSOR_COLORS = ['#f43f5e','#6366f1','#3b82f6','#22c55e','#f59e0b','#ec4899']` | category (presence) |
| `src/components/MyWork/transforms/crossToolTransform.ts:145` | `colors = ['#fef08a','#bbf7d0','#bfdbfe','#fecaca','#e9d5ff','#fed7aa']` | category (sticky tints) |
| `src/components/MyWork/processflow/LaneSystem.tsx:26-28` | `ops/workshop/strategy` lane tint arrays (blue/indigo/teal/amber/rose pastels) | category |
| `src/components/MyWork/mindmap/MindmapInspector.tsx:51-81` | 6 theme color sets (blue, teal, green, orange, indigo, gray) | category |
| `src/components/Reports/ProgressRing.tsx:38-63` | 6 gradient pairs (`#3b82f6/#60a5fa`, `#10b981/#34d399`, `#f59e0b/#fbbf24`, `#f43f5e/#f87171`, `#6366f1/#a78bfa`, `#3b82f6/#6366f1`) | chart/decorative |
| `src/components/Presentations/wizard/types.ts:299-475` | ~13 named theme `chartPalette` arrays (6 hexes each) — e.g. `['#0B3D91','#1A8A8A','#00BCD4','#4FC3F7','#80DEEA','#B2EBF2']`, `['#475569','#1E40AF','#3B82F6','#60A5FA','#93C5FD','#BFDBFE']`, etc. | chart (presentation theme — partly intentional brand themes; keep theme variety but add a Harvard theme) |
| `src/components/Landing/EpicHeroSection.tsx:363` | `['#A51C30','#851627','#3b82f6','#10b981']` (hero — mixes crimson with arbitrary blue/green) | **decorative — remap blue/green** |

> Presentation-wizard `chartPalette` themes (types.ts) are intentional user-selectable deck themes; leave most, but add/promote a "Harvard" theme using crimson + Harvard secondary as the brand default.

---

## 4. Raw hex (`#rrggbb`) outside tailwind.config / index.css

- **Total occurrences:** 2,348 across `src/` (excluding `src/index.css`, `tailwind.config.js`).
- **Top files:**
  - `src/components/Presentations/wizard/types.ts` — 108 (deck theme palettes)
  - `src/components/MyWork/table/tableTypes.ts` — 93 (cell/tag color options)
  - `src/components/MyWork/IdeaRecommendationMap.tsx` — 78
  - `src/components/MyWork/IdeaTemplateGallery.tsx` — 65
  - `src/components/settings/ConnectedAppsSettings.tsx` — 61 (3rd-party brand logos — leave as-is)
  - `src/components/Reports/Premium/Editor/PremiumEditor.css` — 52
  - `src/components/MyWork/mindmap/floating-toolbar/ColorPickerPopover.tsx` — 52 (user color picker swatches)
  - `src/components/Reports/AreaDetailCard.tsx` — 46
  - `src/components/Reports/AreaMatrixTable.tsx` — 38
  - `src/components/Reports/AxisReportSection.tsx` — 37
  - `src/components/Reports/EnterpriseReportStyles.css` — 36
  - `src/components/MyWork/NotebookContent.tsx` — 34
  - `src/components/ReportBuilder/blocks/ChartRenderer.tsx` — 30
  - `src/views/superadmin/SubscriptionPlansManager.css` — 28
  - `src/components/MyWork/table/FrameworkGenerator.tsx` — 28

> Caveats on raw-hex: (1) `ColorPickerPopover.tsx` and `tableTypes.ts` swatch grids are **user-facing color pickers** — leave the full spectrum. (2) `ConnectedAppsSettings.tsx` hexes are third-party brand colors (Slack, Google, etc.) — leave. The Reports/* and MyWork map/template hexes are the actionable decorative ones.

---

## 5. Existing color tokens (full dump)

### 5.1 `tailwind.config.js` — `theme.extend.colors`

**`c.*` canonical semantic namespace** (→ CSS vars):
```
c.bg, c.surface, c.surface-raised, c.border-subtle, c.border,
c.text, c.text-secondary, c.text-muted,
c.accent (var --c-accent), c.accent-soft, c.focus,
c.success, c.warning, c.danger, c.info
```

**`crimson` (brand canonical):**
```
DEFAULT #A51C30  50 #FDF2F3  100 #FBDDE0  200 #F6B8BE  300 #EF8A94
400 #E45868  500 #D42B3D  600 #A51C30  700 #851627  800 #651120
900 #450C16  950 #2B070D
```

**`navy` (neutral grays):**
```
950 #0A0F1E  900 #0F172A  850 #111827  800 #151E32  700 #2A3655
600 #374151  500 #475569  400 #64748B  300 #94A3B8  200 #CBD5E1
100 #E2E8F0  50 #F1F5F9
```

**`primary` (RE-POINTED to crimson — central recolor lever; was violet #7C3AED):**
```
DEFAULT #A51C30  hover #851627  light #D42B3D  surface rgba(165,28,48,0.1)
50 #FDF2F3 ... 950 #2B070D   (mirrors crimson scale)
```

**`secondary` (navy/granatowy — secondary actions, nav):**
```
DEFAULT #1E3A5F  hover #0F2744  light #2E4A6F  surface rgba(30,58,95,0.1)
900 #0F2744  800 #1E3A5F  700 #2E4A6F  600 #3E5A7F  500 #4E6A8F
400 #6E8AAF  300 #8EAACF  200 #AECAEF  100 #DEEAFF  50 #F0F5FF
```
> NOTE: `secondary` is ALREADY a Harvard-compatible blue/navy scale. Strong candidate to become (or seed) the official "Harvard secondary" complementary blue.

**`danger` (red — errors only):**
```
DEFAULT #DC2626  hover #B91C1C  light #EF4444  surface rgba(220,38,38,0.1)
900 #7F1D1D ... 50 #FEF2F2
```

**`success` (emerald — active/confirm only):**
```
DEFAULT #059669  hover #047857  light #10B981  surface rgba(5,150,105,0.1)
900 #064E3B ... 50 #ECFDF5
```

**LEGACY aliases (still defined):**
```
brand (VIOLET — #7C3AED scale, legacy; 50 #F5F3FF ... 950 #2E1065)
dbr77 { DEFAULT #0B1121, light #151E32, lighter #1E293B }
```
> `brand.*` is the old violet scale still present. Any remaining `brand-*` usages render violet — flag for removal/repoint.

**Brand-relevant non-color tokens (already crimson):**
- `boxShadow.glow` / `glow-lg` / `hig-focus` / `token-focus` → `rgba(165,28,48,…)` (crimson). OK.
- `backgroundImage.hig-primary` / `hig-primary-hover` → solid crimson gradients. OK.

### 5.2 `src/index.css` shadcn / `--c-*` vars

**`:root` (light):**
```
--background 0 0% 100%   --foreground 222.2 84% 4.9%
--card / --popover 0 0% 100%
--primary 221.2 83.2% 53.3%   (shadcn primary still BLUE — note: not crimson here)
--secondary 210 40% 96.1%   --muted 210 40% 96.1%
--accent 358 71% 38% (crimson-600)  --accent-foreground 0 0% 100%
--accent-hover 350 71% 30% (crimson-700)  --accent-surface 354 73% 97% (crimson-50)
--destructive 0 84.2% 60.2%   --border 214.3 31.8% 91.4%
--ring 358 71% 38% (crimson focus)

--c-bg #fafaf9   --c-surface #ffffff   --c-surface-raised #ffffff
--c-border-subtle #eef0f2   --c-border #e2e5e9
--c-text #0f172a   --c-text-secondary #475569   --c-text-muted #64748b
--c-accent #a51c30 (Harvard Crimson — SOLE brand accent)
--c-accent-soft rgba(165,28,48,0.08)   --c-focus rgba(165,28,48,0.35)
--c-success #059669   --c-warning #d97706   --c-danger #dc2626   --c-info #2563eb
```

**`.dark`:**
```
--background 222.2 84% 4.9%   --foreground 210 40% 98%
--primary 217.2 91.2% 59.8%  (shadcn primary still BLUE in dark too)
--accent 354 72% 62% (crimson-400)  --accent-hover 354 65% 53% (crimson-500)
--accent-surface 350 60% 13%   --destructive 0 62.8% 30.6%
--ring 354 72% 62% (crimson-400)

--c-bg #0b1220   --c-surface #0f172a   --c-surface-raised #15213b
--c-border-subtle rgba(255,255,255,0.06)   --c-border rgba(255,255,255,0.1)
--c-text #f1f5f9   --c-text-secondary #94a3b8   --c-text-muted #64748b
--c-accent #c8324a (crimson lifted)   --c-accent-soft rgba(200,50,74,0.14)
--c-focus rgba(165,28,48,0.35)
--c-success #34d399   --c-warning #fbbf24   --c-danger #f87171   --c-info #60a5fa
```

> INCONSISTENCY worth noting: shadcn `--primary` (used by base shadcn `bg-primary` components via `hsl(var(--primary))`) is still **blue** (221.2/217.2), whereas the Tailwind `primary.*` scale is crimson. Two different "primary"s. The `--c-accent` and Tailwind `primary.*` are crimson; the shadcn `--primary` var is not.

---

## 6. Decorative non-crimson usages to move to Harvard complementary colors

Prioritized actionable list. These are NOT status/chart — they are arbitrary brand/decorative accents and should be remapped to Harvard's official secondary palette (Harvard blue / Harvard green / gold, anchored by the existing `secondary` navy-blue scale).

### Highest impact (central definitions — fix once, propagate widely)
1. **`src/config/portfolioColors.ts`** — `AXIS_COLORS`: DRD framework axes use blue/emerald/amber/rose as *category* tints (processes/models/data/culture). Remap the category set to Harvard-derived hues. (category bucket — §2d)
2. **`src/components/MyWork/mindmap/tagColorMapping.ts:11-65`** — `TAG_COLOR_MAP` arbitrary per-tag hexes (`#6366f1`, `#3b82f6`, `#a855f7`, `#f59e0b`…) + fallback `#94a3b8`. Remap to Harvard categorical palette.
3. **`src/components/MyWork/mindmap/MindmapInspector.tsx:51-81`** — node theme color sets (indigo `#6366f1/#a78bfa`, teal `#0d9488/#22d3ee`, orange, etc.).
4. **`src/components/MyWork/processflow/LaneSystem.tsx:26-28`** — swimlane pastel arrays (indigo/teal/pink pastels).
5. **`src/components/MyWork/transforms/crossToolTransform.ts:145`** — sticky-note tint palette (`#e9d5ff` purple, `#fed7aa` orange…).

### Decorative gradients (`from-/to-/via-*`, non-status) — ~1,900 stops, top families blue (517), indigo (317), amber (282), emerald (185)
6. **`src/views/PublicMiniAssessmentView.tsx:288`** — hero `bg-gradient-to-br from-indigo-50 via-white to-primary-50 ... to-indigo-950`; loader `text-indigo-500`; icon chip `bg-indigo-100 ... text-indigo-600`. Pure decorative indigo → Harvard blue.
7. **`src/views/AcceptInvitationView.tsx`** (22 indigo) — invitation hero/accent decorative.
8. **`src/views/superadmin/PresentationGovernanceWatchlistView.tsx`** (27 indigo) + sibling Presentation governance views (`...OperationsHealthView`, `...AlertSubscriptionsView`) — decorative indigo/orange accents.
9. **`src/components/Survey/SurveyShell.tsx`** (20 indigo) — survey chrome decorative.
10. **`src/components/ReportBuilder/ReportEditor/BlockPalette.tsx` / `BlockCard.tsx`** — `from-blue-500`, `from-amber-500` block-type icon-chip gradients (decorative category coding).
11. **`src/components/MyWork/shared/EmptyState.tsx`** — `from-blue-500` empty-state illustration gradient.
12. **`src/components/MyWork/mindmap/*` AI overlays** (`AISentimentOverlay` from-emerald, `AIPriorityRecommender` from-amber, `DocumentToMap`/`ImportExternalMap` from-blue/sky) — AI-feature accent gradients (decorative).
13. **`src/components/MyWork/NotebookContent.tsx`** — `from-indigo-500` decorative.
14. **`src/components/Landing/EpicHeroSection.tsx:363`** — hero swatch `['#A51C30','#851627','#3b82f6','#10b981']`: remap the `#3b82f6` (blue) and `#10b981` (green) to Harvard blue/green so the hero reads as one brand family.

### Decorative flat tints (icon chips / category accents, not status) in the high-count component files
15. **`src/components/MyWork/IdeaRecommendationMap.tsx`** (top file for blue/amber/rose/sky/lime/fuchsia) — recommendation map node/category tints, many decorative.
16. **`src/components/MyWork/TaskDetailView.tsx`**, **`DecisionDetailView.tsx`**, **`NotificationDetailView.tsx`** — section icon-chip blue/amber/emerald accents (decorative, not status).
17. **`src/components/Admin/UnifiedSyncHub.tsx`** (sky 31, amber 41) — sync-source category tints.
18. **`src/components/Interview/InsightViewer.tsx`** (emerald/amber/rose) — insight category accents.
19. **`src/components/SuperAdmin/EmailTemplateEditor.tsx`** (pink 18), **`ContentAnalyticsDashboard.tsx`** (pink 9) — decorative pink.
20. **Leftover violet/purple/fuchsia/cyan/teal** (small counts, low effort, high consistency win): `src/components/Presentations/DeckBuilder/DeckAuditLogModal.tsx` (violet 7), `src/views/settings/AIPreferencesModule.tsx` (purple 3), `src/components/MyWork/Home/HomeView.tsx` (cyan/teal 3 each), `ArtifactPreviewCard.tsx`/`KimiWorkspaceShell.tsx` (fuchsia). These are the clearest "arbitrary Tailwind accent" offenders to eliminate entirely.

### Decorative raw-hex in Reports (presentation/print surfaces)
21. **`src/components/Reports/ProgressRing.tsx:38-63`** — decorative gradient pairs (blue/indigo/amber) for ring fills.
22. **`src/components/Reports/AreaDetailCard.tsx` / `AreaMatrixTable.tsx` / `AxisReportSection.tsx`** + `EnterpriseReportStyles.css` — report section accent hexes.

### Explicitly LEAVE (not remap targets)
- `src/components/MyWork/mindmap/floating-toolbar/ColorPickerPopover.tsx`, `src/components/MyWork/table/tableTypes.ts` — user-facing color-picker spectrums.
- `src/components/settings/ConnectedAppsSettings.tsx` — third-party brand logo colors.
- `src/views/admin/UsageDashboardView.tsx:93` `COLORS` — neutral slate ramp.
- Status colors per §2a (green=success, amber=warning, red=danger, blue=info) — keep meaning; optionally route through `--c-*` tokens.

---

## 7. Recommended remap targets (proposal, for the follow-up implementation phase)

Harvard's official complementary palette anchors (to be confirmed against Harvard brand guidelines before implementation):
- **Harvard Crimson** `#A51C30` — primary brand (already in place).
- **Harvard secondary blue** — the existing `secondary` scale (`#1E3A5F` family) is already a good fit; promote it as the canonical complementary blue and retire raw `blue-*`/`indigo-*`/`sky-*` decorative usage onto it.
- **Harvard green / gold / slate** — add official secondary green and gold scales to `tailwind.config.js` (e.g. `harvard-green`, `harvard-gold`) and build the categorical chart/category palette from {crimson, harvard-blue, harvard-green, harvard-gold, slate} so charts and tag/axis category coding share one Harvard-derived hue family.

Single highest-leverage edits: `src/config/portfolioColors.ts`, `src/components/MyWork/mindmap/tagColorMapping.ts`, `src/components/ReportBuilder/blocks/ChartRenderer.tsx` (DEFAULT_COLORS), and eliminating the small-count violet/purple/cyan/teal/fuchsia stragglers.
