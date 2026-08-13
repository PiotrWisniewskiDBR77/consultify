# RN-G2 UI Scope — Results Next registry shell + KPI/ROI/OKR tools

Read-only research. Worktree used for every path below:
`/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809`
branch `codex/results-vnext-g0-20260809`, HEAD `d463c32b8c`. No files were edited.

Confirmed premise: `find src/components/ResultsVNext` → nothing. No `/results/kpi|roi|okr`
routes exist. This is genuinely greenfield UI on top of a fully-mounted, fully-tested
backend (KPI 7 epics = `KPI_E001_E002/E003/E004/E005/E006/E007_DESIGN.md`, ROI 8 epics
`ROI_E001…E008_DESIGN.md`, OKR 8 epics `OKR_E001…E008_DESIGN.md`, all "APPROVED FOR
IMPLEMENTATION").

---

## A. Standard component contracts (`src/components/standard/`)

Only `src/components/standard/index.ts` is the allowed import surface. It re-exports:
`StandardModuleBar`, `StandardTable`, `StandardPreview`, `StandardGridCard`,
`StandardKanban`/`StandardKanbanCard` (list-screen triad) and
`StandardArtifactShell`/`ArtifactRightPanel`/`ArtifactPropertiesTable` (object-screen shell,
SPEC-A). `registry.ts` in the same folder is a *separate*, closed registry of the 7 canonical
full-object "Karta N" views (Tool/Notification/Interview/Decision/Insight/Task/Initiative) —
KPI/ROI/OKR full-tool screens are not in it today (see Open Questions).

### `StandardModuleBar` (`src/components/standard/StandardModuleBar.tsx`, 494 lines)
A module declares, never styles:
- **Menu 1** (optional, embedded-hub only): `breadcrumbs`, `breadcrumbCta`, `breadcrumbExtra`. App's real Menu 1 (topbar) is untouched — omit this entirely for a normal module screen.
- **Menu 2**: `tabs`/`activeTab`/`onTabChange` (pill buttons), `onSearch`/`searchValue`, exactly one `primaryCta` (dark-filled, never crimson) or the `primaryCtaContent` escape hatch for >1 CTA, `viewModes`/`viewMode`/`onViewModeChange`, `filterControls`, `categoryButtons`, `statusFilters`/`activeStatusFilter`/`onStatusFilterChange`/`statusDropdownContext` (closed enum today: `'initiatives'|'execution'|'benefits'|'assessment'|'assessment_list'|'assessment_reports'|'tools'` — adding `'kpi'|'roi'|'okr'` values, if the status-dropdown pattern is wanted, is a small typed edit to `StandardModuleBarProps` and its consumer in `ModuleNavBar`), `statusCounts`, `showTabCounts` (default **false** per KANON v3 — no counters on Menu 2 pills), `toolControl`, `aiControl`.
- **Menu 3** (three *mutually exclusive* modes in the same row): `chips`+`activeChip`+`onChipChange` (silent filter chips, counts always shown incl. 0) **or** `bulk` (`StandardBulkState`, auto-wins when `count>0`) **or** `openItems`/`activeItemId` (dynamic open-card tabs) + `menu3Right` (AI button slot) + `activeFilters`/`onRemoveFilter`/`onClearFilters` (column-filter chips, independent of the three modes).
- `children`: when passed, the bar takes over the whole `flex-col h-full` layout (drop-in replacement for legacy `ModuleHub`). **RN-G2 screens should use this mode** — it's the pattern every StandardTable-based screen in the repo uses.

### `StandardTable` (`src/components/standard/StandardTable.tsx`, 571 lines)
`columns`/`data`; optional `surfaceId?: TableSurfaceId` (see §Open Questions — do NOT assume RN-G2 must register here, it's a closed 45-item audit set, and `StandardTable` explicitly supports and does not penalize a missing `surfaceId`); `loading`/`error`/`onRetry`; `empty` (title/description/icon/action) or `emptyMessage` (ReactNode — header and column geometry are **always** preserved during loading/empty, this was a real prior bug, fixed as "R04-2C"); `selectedRowId`/`onRowClick`/`onRowDoubleClick`; `rowMenu(row) => StandardRowMenu` (preferred — 3-zone kebab: `primary`+`statusTransitions` → context zone, `universalHandlers.{preview,edit,archive}`+`timeActions`+`convertActions` → manage zone, `destructive` → danger zone, **always last**, auto-enforced) or the low-level `rowActions(row)`; `rowDescription`; `activeFilters`/`onFilterChange`; `defaultSort`; `persistKey`; `selection: {selectedIds,onChange}` (drives Menu 3 bulk mode automatically); `density`.
Nine MUSTs are baked into the facade (sticky uppercase sortable header + per-column filter funnels, hairline row dividers/no zebra, row-description toggle, **mandatory** Settings2 column popover that a module cannot swap out, zero-sum resize with persistence, the 3-zone kebab, checkbox selection driving bulk mode, contextual bulk actions, and empty/loading/error states that never blow away the header).

### `StandardPreview` (`src/components/standard/StandardPreview.tsx`, 486 lines)
Iron-order 6 blocks + 1 optional: (1) header (title/pin/`onOpenFull`("Open")/close), (2) meta card (`pills` + `trailing` deadline + `recommendation` line), (3) `details` (`text` and/or `properties: ArtifactPropertyRow[]` rendered via `ArtifactPropertiesTable` — **use `properties` for key/value entity fields, never join them into a prose paragraph**, this was a real, repeated defect: 4 screens did it wrong per the 128-screenshot review cited in the code comments), (4) `ai` hint strip, (5) `relations` — **mandatory even when empty**, renders "No relations", (6) `actions` — `resolutions`/`informational`/`time` rows of `PreviewActionButton` in a 2-col grid; a `destructive` action is auto-reordered to the end of the last non-empty row (code-enforced, was violated live on 5 screens before this fix). Optional 7th block: `whatsNext` (chips + ONE shared note, the canonical "convert to X" pattern — never a per-item note).
`standardPreviewShortcuts(actions)` wires A/R/I/G/Z keys into `TableWithPreviewLayout`.

---

## B. Exemplar screens to copy

1. **The literal SSOT, cited in every component's own docstring**: My Work Tasks/Decisions —
   `src/components/MyWork/MyTasksListContent.tsx` (3189 lines) and
   `src/components/MyWork/DecisionsPanelContent.tsx` (1709 lines). These are where
   `TRIADA_KANON.md` was written *from* (2026-07-04, on these live screens).
2. **Materials** (CLAUDE.md-named correct exemplar) is not a literal `src/components/Materials/`
   folder — it's the "Materiały" sidebar entry, backed by
   `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` (1697 lines, uses
   `StandardModuleBar` directly at L1558) with per-tab content in
   `ReportsTabContent.tsx` (597 lines — header comment literally says *"StandardTable +
   StandardPreview, 1:1 with the Assessment 'list' / Interview [pattern]"*),
   `PresentationsTabContent.tsx`, `SheetsTabContent.tsx`, `TemplatesTabContent.tsx`. Copy the
   Hub→TabContent split: Hub owns `StandardModuleBar` + tab routing, each TabContent owns its own
   `StandardTable`/`StandardPreview` wiring and column/row-menu declarations.
3. **Tools** (also CLAUDE.md-named) is
   `src/components/Discovery/DiscoveryToolsHub.tsx` (5371 lines — big, but only because it hosts
   many sub-registries; each individual `<StandardTable>` call, e.g. L3869/L4116/L4599, is a
   self-contained, small declaration). Comment at L58: *"ekrany listowe Tools = kanoniczny
   StandardTable (Triada), NIE surowy FilterableTable."*

Pattern to replicate for each RN-G2 domain: one Hub-ish component per domain (`ResultsKpiHub`,
`ResultsRoiHub`, `ResultsOkrHub` or similar) that owns `StandardModuleBar` (Menu 2/3, "My"/"Org"
perspective as `tabs` or `statusFilters`), delegates the table+preview pair to a
domain-specific list component, and the row-click preview opens a `StandardPreview` fed by the
already-loaded row plus a lazy detail fetch for the properties table.

---

## C. Backend → UI surface map

Backend is fully mounted (`server/src/Gateway.ts` L1166-1211); mount order matters everywhere
(each router file has its own "MOUNT-ORDER NOTE" comment — more specific/legacy sub-paths are
mounted before the generic `:id`-catching router in the same prefix, e.g.
`kpi/scorecards` before bare `kpi`, `kpi/legacy` before bare `kpi`, `okr/legacy` before bare `okr`).

### KPI — `/api/vnext/results/kpi*`
| Router (file) | Mount | Endpoints (method + path) | Feeds |
|---|---|---|---|
| `kpiPerspectives.routes.ts` | `/api/vnext/results/kpi` (mounted FIRST) | `GET /my`, `GET /attention`, `POST /initiative-impacts` (+`/:impactId/commit\|review\|supersede`), `GET /:kpiId/initiative-impacts` | "My" registry tab, cross-domain attention feed, initiative-impact linking sub-panel on KPI detail |
| `kpi.routes.ts` | `/api/vnext/results/kpi` (SECOND) | `POST /`, `GET /`, `GET /:kpiId`, `PUT /:kpiId/draft`, `POST /:kpiId/submit`, `POST /:kpiId/definition-versions/:versionId/approve\|reject`, `POST/GET /:kpiId/measurements`, `POST /:kpiId/measurements/:measurementId/corrections\|verify\|dispute` | Org KPI registry list, KPI create/draft/submit/approve flow, KPI detail's Measurements sub-view |
| `kpiDeviation.routes.ts` | `/api/vnext/results/kpi/deviation-cases` | `GET /`, `GET /:caseId`, `POST /:caseId/acknowledge`, `PUT /:caseId/root-cause`, `POST /:caseId/corrective-actions` (+`PATCH /:actionId`), `POST /:caseId/plan/submit\|approve`, `POST /:caseId/recovery-observation`, `POST /:caseId/effectiveness-verifications`, `POST /:caseId/close\|reopen` | Deviation Case sub-view (either a KPI-detail tab or its own registry — open question, see below) |
| `kpiScorecard.routes.ts` | `/api/vnext/results/kpi/scorecards` | `POST/GET /`, `GET /:scorecardId`, `GET/POST /:scorecardId/items` (+`DELETE /:itemId`, `PATCH /reorder`), `GET /:scorecardId/status`, `POST/GET /:scorecardId/review-snapshots` (+`/published`, `POST /:snapshotId/publish`) | **Its own registry** — matches master plan's explicit route `/results/kpi/scorecards/:scorecardId` |
| `kpiLegacyArchive.routes.ts` | `/api/vnext/results/kpi/legacy` | all `GET`, read-only: `/`, `/kpis(+id)`, `/kpi-definitions(+id)`, `/v8-kpi-definitions(+id)`, `/tp-kpi-definitions(+id)` | Archive/read-only tab, NOT a write surface — no create/edit CTA should ever point here |

### ROI — `/api/vnext/results/roi*` (largest surface, ~74 endpoints, one case aggregate)
| Router | Mount | Endpoints (grouped) | Feeds |
|---|---|---|---|
| `roiPerspectives.routes.ts` | `/api/vnext/results/roi` (FIRST) | `GET /org/benefits-realization`, `GET /org/pir-outcomes` | Org-perspective registry tab / portfolio rollup views |
| `roi.routes.ts` | `/api/vnext/results/roi` (SECOND) | Case CRUD (`POST/GET /cases`, `GET/PATCH /cases/:caseId`, `POST /cases/:caseId/archive`); Baseline (`GET/PUT .../baseline`); Calc policy (`GET/PUT .../calculation-policy`); Assumptions full CRUD; Cost lines full CRUD; Benefit lines full CRUD + `.../kpi-evidence-links` sub-resource (get/post/delete/freshness-check — **this is the KPI↔ROI evidence bridge**); Scenarios full CRUD + `.../overrides`; Calculation runs (post/get list/get detail); Lifecycle transitions (`approve/reject/request-changes/reopen-for-revision/cancel/start-pir/close`); Approval snapshots (get list/detail); Forecast versions (post/get list/detail) + `GET /compare`; Actuals (get/post list, get detail, corrections/verify/dispute); Actual snapshots (post/get list/detail); Variances (get/post list, get/patch detail, causes post/delete); `GET .../benefits-realization`; PIR (`PUT .../post-investment-review-schedule`, `POST .../transitions/start-pir`, `GET/PATCH .../post-investment-reviews(+id)`, `POST .../teresa-draft-disposition`); Finance links (get/post list, delete) + Finance reconciliations (get/post list, patch detail) | **One ROI Case = ~15 distinct sub-resource groups.** This is the richest single full-tool screen in the whole program — see work-breakdown estimate below, this alone is several packages, not one. |
| `roiLegacyArchive.routes.ts` | `/api/vnext/results/roi/legacy` | all `GET`, read-only, 8 legacy shapes (`analysis-financials`, `digitization-analyses`, `initiative-benefits`, `roi-assumptions`, `roi-realized-values`, `benefits-register`, `v8-roi-realization-entries` + `/`) | Archive/read-only tab |

### OKR — `/api/vnext/results/okr*` (~65 endpoints)
| Router | Mount | Endpoints (grouped) | Feeds |
|---|---|---|---|
| `okrLegacyArchive.routes.ts` | `/api/vnext/results/okr/legacy` (FIRST) | all `GET`, read-only: `/`, `/cycles(+id)`, `/objectives(+id)`, `/key-results(+id)`, `/check-ins(+id)` | Archive/read-only tab |
| `okr.routes.ts` | `/api/vnext/results/okr` (SECOND) | Programs (post/get list/detail, patch draft, post publish); Cycles (post/get list/detail); Sets (post/get list, `GET /company`, `GET /my`, `GET /team-health`, get detail, patch draft/visibility, submit/approve/request-changes/request-revision, approval-snapshots list/detail); Objectives (post under set/get list, get/patch detail, cancel); Key Results (post under objective, get/patch detail, cancel, check-ins get/post list + correct + suggested-next-check-in-value); Alignments (post/get under objective, `GET .../alignment-tree`, accept/reject/remove); Scoring (`POST .../final-score`, `POST .../reflection`); Reviews (self/manager submit, manager approve/request-changes, comments, get list); Closing (`POST .../close`, `POST .../carry-forward`, `GET .../history`); Recognition/support (comments, recognition, support-requests post/get, acknowledge/resolve/dismiss/request-decision, decision-link, `POST decision-links/:id/acknowledge-resolution`); `GET /attention` | `/company` and `/my` are the Org/My perspective toggle at the Sets registry level; `/team-health` feeds a manager-scoped widget; `/attention` mirrors KPI's cross-cutting attention feed pattern |

**ABAC/visibility** (from `RN_G1_PLATFORM_DESIGN.md` §B — already-approved platform design, not
yet necessarily wired per-domain): resolver returns `{allow, reason}` with a **closed set of DENY
reasons** the UI must be able to render honestly instead of a blank list: `CROSS_TENANT`,
`NO_VISIBILITY_RECORD` (fail-closed default — "no visibility row" is a DENY, not an ALLOW),
`PRIVATE_NOT_OWNER`, `OUT_OF_SCOPE`, `NOT_IN_CHAIN`, `NOT_ON_ACL`. Visibility ≠ capability — a
resource can be *visible* (shows in the list, greyed) but not *mutable* (kebab actions
disabled-with-reason), enforced as two separate checks per §B.3 point 4.

---

## D. Required states per screen

Per master plan §5.3 progressive disclosure (L0 table/cards → L1 preview → L2 full-tool
overview → L3 editors/measurements/check-ins → L4 history/lineage/audit), every level needs:

- **Loading** — `StandardTable.loading` keeps header+column geometry (no skeleton wipes the
  table shell); `StandardPreview.loading` shows the 4-line skeleton.
- **Empty** — `StandardTable.empty` (icon/title/description/CTA) for a *true* zero-row org state
  vs `StandardTable.emptyMessage` for a filtered-to-zero state (different copy: "no KPIs defined
  yet, create one" vs "no rows match these filters").
- **Error** — `StandardTable.error`+`onRetry`; a per-domain fetch failure must not blank the
  other two domains (master plan §9 Gate 2: "lokalna awaria nie wyłącza innych domen" — if KPI's
  registry hub renders KPI+ROI+OKR as sibling tabs in one shell, each tab's fetch failure is
  independent).
- **Forbidden / visibility-denied** — a row the ABAC resolver returns DENY for must never appear
  in a list (fail-closed at the query layer per §B.4 `rvnVisibilityScopedQuery`), but a *deep
  link* to a denied resource (`/results/roi/cases/:id` typed directly, or an old bookmark) needs
  an explicit "you don't have access to this ROI case" state distinct from 404 — reuse whatever
  pattern `getPilotBlockedFallbackPath`/`dispatchPilotAccessBlocked` already establishes in
  `src/utils/pilotAccess.ts` (used by `RouterSync.tsx` today for pilot-role gating) as the visual
  precedent, or the artifact-shell's existing "guard/transition" states referenced in
  `ARTIFACT_ANATOMY_STANDARD.md` §12.4 ("Strażnicy i przejścia (honest UI)").
- **Locked / lifecycle-gated** — each domain has a real, code-enforced status machine, not a
  cosmetic label:
  - KPI: definitions have a versioned approve/reject contract (`definition-versions/:id/approve|reject`); measurements have `corrections/verify/dispute`.
  - KPI Deviation Case: `open → analysis_required → plan_required → plan_submitted → approved → executing → recovery_observed → verification → closed` (9 states, `KPI_E003_DESIGN.md` L75-78) plus a non-exclusive `escalated` boolean overlay — **never a 10th state**.
  - ROI Case: `not_started → draft → modeling → ready_for_review → submitted_for_approval → changes_requested → approved → rejected → tracking → benefits_realization → post_investment_review_due → post_investment_review → closed → cancelled` (13 states, `ROI_E001_DESIGN.md` L104-109, forward-declared once so later epics never ALTER the CHECK constraint).
  - OKR Program: `draft/active/suspended/retired`; OKR Cycle: `planned/drafting/active/review/closed/cancelled` (`OKR_E001_DESIGN.md` L127-128, L234).
  Every one of these needs a **kebab-action-disabled-with-reason** treatment (TRIADA §C3: "a
  disabled item stays visible with a reason — never hidden — when disabled by product rule, only
  hidden when it's a not-yet-built stub"), not a hidden button.
- **Honest-missing values** — this is a hard, explicitly-designed program invariant, not a nice-
  to-have: KPI baseline/measurement fields, OKR progress/confidence, and ROI's IRR/NPV all use a
  3-way domain (`decimal | null | 'not_calculable'`), and the docs are emphatic that a
  degenerate/undefined calculation must **never** render as fabricated `0`
  (`EXECUTION_LEDGER.md` L132: *"progress (decimal|null|`not_calculable`, NIGDY fabrykowane
  zero)"*; `ROI_E001_DESIGN.md` L31, AC-03: *"Registry/list reads show honest missing/N/A, never a
  fabricated `0`"*; `OKR_E006_DESIGN.md` L16, IO-5: *"Never invent [a value] carrying a free
  parameter... return `not_calculable` with a reason"*). **UI implication**: a table cell or
  preview metric must render `null` as `—` (already the TRIADA convention for "empty cell") but
  render `not_calculable` as a *visibly distinct* state — e.g. a muted "n/a" chip with a tooltip
  reason, not the same em-dash — because `—` already means "no data was ever entered" while
  `not_calculable` means "data exists but the formula is structurally undefined" (e.g. divide by
  zero, degenerate KR geometry). Conflating the two silently reintroduces exactly the fabricated-
  zero risk the backend was built to prevent.

---

## E. Routing plan

Confirmed today in `src/routes/routeConfig.ts` / `AppRoutes.tsx` / `RouterSync.tsx`:
- `ROUTES.RESULTS = '/results'` (L125), `ROUTES.KPI_OKR = '/kpi-okr'` (L123), `ROUTES.BENEFITS = '/benefits'`. `/kpi-okr` and `/benefits` are **permanent redirect-only aliases** to `/results` (`AppRoutes.tsx` L2256-2260, L2417-2425, via `RedirectPreservingQuery`).
- `/results` (exact path) currently renders the **legacy V8 dashboard**, `ResultsHub` (`src/components/Results/ResultsHub.tsx`) behind `<BetaGate moduleId="MODULE_BENEFITS">` + `<ProductionModuleGate moduleName="Results">` (`AppRoutes.tsx` L2427-2438). That legacy hub embeds `ResultsThreePairsView.tsx` and ~24 other legacy components (`ResultsKPITable.tsx`, `ROITrackingView.tsx`, `ResultsOkrSetsTable.tsx`, etc.) reading OLD tables/endpoints (`v8-kpi-definitions`, `goals` API, `results-strategic/:projectId/okr`) — **do not reuse any of these for RN-G2**, they are exactly the split-truth legacy the program is retiring per master plan §12.
- `RouterSync.tsx`: `path.startsWith('/results')` (L261) is already in the global `isProtected` list, and `path.startsWith(ROUTES.RESULTS)` (L704-706, alongside `/benefits`/`/kpi-okr`) already prefix-maps to `AppView.BENEFITS_REALIZATION` for the Zustand/sidebar mirror. **`/results/kpi`, `/results/roi`, `/results/okr` are therefore already auth-protected and already resolve to the Results sidebar entry with zero RouterSync changes required.**
- Master plan §11 prescribes the exact target routes (already decided, not open):
  ```
  /results/kpi
  /results/kpi/scorecards/:scorecardId
  /results/roi
  /results/roi/cases/:roiCaseId
  /results/okr
  /results/okr/sets/:okrSetId
  ```
  These are new **exact-path** `<Route>` entries — they do not collide with the existing exact
  `path={ROUTES.RESULTS}` route for the legacy hub (React Router matches exact paths; `/results`
  and `/results/kpi` are different routes). Register as a nested object in `routeConfig.ts`,
  mirroring the existing `ROUTES.DISCOVERY_TOOLS = {ROOT, STRATEGIC, ...}` pattern, e.g.
  `ROUTES.RESULTS_KPI = {ROOT: '/results/kpi', SCORECARD: '/results/kpi/scorecards/:scorecardId'}`
  and similarly for ROI/OKR — then mount each as its own `<Route>` in `AppRoutes.tsx` alongside
  the existing `ROUTES.RESULTS` block, each wrapped in the same `<MainLayout>`/`<BetaGate
  moduleId="MODULE_BENEFITS">`/`<ProductionModuleGate moduleName="Results">` chain the legacy hub
  uses today (reuse the entitlement gate, don't invent a new one).
- API base paths already live and match the master plan's `/api/vnext/results/{kpi,roi,okr}` recommendation almost exactly (confirmed in §C above) — no server-side routing work is in scope for RN-G2, only client wiring.

**Open, undecided in any doc read**: what does bare `/results` become once RN-G2 ships? Master
plan §12 "Strategia legacy i cutover" describes a staged cutover (steps 1-8: inventory → mark
legacy write paths → additive new models → new registries on new read models → new writes only to
new aggregates → legacy goes read-only-archive or is disconnected → telemetry confirms no active
consumers → retention review) but does not specify a UI landing decision for the bare `/results`
root during the *interim* period when both legacy hub and new registries exist side by side. This
needs an explicit call from the architecture/product owner before Package 1 (see §G) — three
candidates: (a) leave `/results` as the legacy hub unchanged until full cutover, with new routes
only reachable via direct link/nav update; (b) turn `/results` into a thin chooser/landing page
linking to the three new registries; (c) redirect `/results` straight to `/results/kpi` once KPI
ships first (staggers OKR/ROI availability oddly). Not decided in any of `01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md`, `RN_G1_PLATFORM_DESIGN.md`, or the per-domain design docs.

---

## F. Feature-flag plan

Existing pattern (`src/components/Results/resultsFeatureFlags.ts`, read in full) is the direct
precedent to copy: resolution order **URL query (`?ff_x=1`) → `localStorage` (`ff.results_x`) →
Vite build env (`VITE_RESULTS_X_ENABLED`) → default `false`**, with an explicit, individually-
commented allowlist of flags promoted to "default ON outside public production" *only after*
Piotr's dev-render screenshot approval (CLAUDE.md rule #7 — every promoted flag in the file has a
dated comment citing the specific approval, e.g. *"#81/OC2 (2026-07-13): Piotr ZAAKCEPTOWAŁ
redesign na zrzucie harness 07-13"*). `isPublicProductionHost()` (`src/utils/publicProduction.ts`)
is the gate that keeps prod excluded from the default-ON promotions.

**Recommendation: one NEW flag file, not a re-use of `resultsFeatureFlags.ts`.** Reasons: (1) the
legacy file's flags are semantically about the *old* V8 cockpit (`m14Handoff`,
`valueDriverTree`, `threePairs`...) — mixing new-registry flags into the same enum invites the
exact "conflate old and new" risk the master plan's §12 cutover plan is explicitly designed to
avoid; (2) a separate file makes the eventual flag-removal-at-cutover a clean deletion.
Suggested shape: `src/components/Results/resultsVNextFeatureFlags.ts` (or under a new
`src/components/ResultsVNext/` folder root, matching where the components themselves will live),
with **one flag per domain registry** (`kpiRegistry`, `roiRegistry`, `okrRegistry`) rather than
one per screen — a domain's list/preview/full-tool are always shipped and reviewed together as one
vertical slice per master plan §9 Etap 5 ("trzy równoległe gold flows"), so a single flag per
domain is the right granularity; a finer per-screen flag only adds bookkeeping without a
corresponding independent-release need. All three default OFF; promotion to default-ON-outside-
prod happens only per-domain, only after that domain's dev-render screenshot round per rule #7 —
exactly mirroring how `threePairs` was promoted alone, not with its sibling flags, in the legacy
file.

---

## G. Work breakdown (bounded packages, ordered by dependency)

This is larger than a typical single-tool build — three domains, each with a registry + preview +
a full-tool workspace, and ROI's full-tool alone spans ~15 sub-resource groups. Honest estimate:
**~20-26 bounded packages**, not counting the backend (already done) or a final cross-cutting QA
pass. Ordering:

**P0 — Shared shell/infra (blocks everything else)**
1. Route scaffolding: `ROUTES.RESULTS_KPI/ROI/OKR` in `routeConfig.ts` + placeholder `<Route>` entries in `AppRoutes.tsx` (behind the new flags, rendering an empty/coming-soon shell) — resolves the `/results` root open question from §E first, since it changes where these routes nest.
2. `resultsVNextFeatureFlags.ts` (3 flags, OFF by default) + wiring into the new routes.
3. Shared API client module(s) for `/api/vnext/results/{kpi,roi,okr}` (typed fetch wrappers — check whether an existing `Api.*` convention/codegen is expected before hand-writing 200+ endpoint wrappers; NOT verified in this pass, flagged as open question below).
4. Decide (with the architecture owner) whether KPI/ROI/OKR full-tool screens are SPEC-A Archetyp C "Rekord" (klasa L, following the `registry.ts` Task/Decision precedent — both were corrected S→L specifically because they exceeded the 4-section klasa-S limit; KPI/ROI/OKR sub-resource counts make klasa S implausible for the full-tool level) or a new pattern — this gates whether `StandardArtifactShell`/`ArtifactRightPanel` get reused or a new shell is built. Not decided in any doc read.

**P1 — KPI vertical** (smallest domain, good first gold-flow candidate — mirrors master plan §9 Etap 5)
5. KPI registry list + preview (`GET /kpi`, `/kpi/my`, `/kpi/attention` perspectives as Menu 2 tabs or `statusFilters`).
6. KPI create/draft/submit/approve flow (`POST /kpi`, `PUT /:id/draft`, `POST /:id/submit`, definition-version approve/reject) — quick-create per master plan §9 Etap 3 ("quick create zapisujący prawdziwy Draft").
7. KPI full-tool workspace: Measurements sub-view (`POST/GET .../measurements`, corrections/verify/dispute).
8. KPI Scorecards registry (own route, own list+detail+items+review-snapshots — this is genuinely a second registry, not a KPI tab).
9. KPI Deviation Case sub-view or registry (9-state machine + escalation overlay) — **routing placement is undecided** (see below), do this after P0.4 resolves the shell question.
10. KPI Legacy Archive read-only tab.

**P2 — ROI vertical** (largest domain — budget generously)
11. ROI Case registry list + preview (Org perspective: `/org/benefits-realization`, `/org/pir-outcomes`).
12. ROI Case create/baseline/calculation-policy (initial modeling setup).
13. ROI Assumptions + Cost lines CRUD sub-views.
14. ROI Benefit lines CRUD + KPI-evidence-links sub-resource (the KPI↔ROI bridge — depends on P1 shipping first if evidence links need a live KPI to pick from).
15. ROI Scenarios + overrides + Calculation runs.
16. ROI lifecycle transitions UI (approve/reject/request-changes/reopen/cancel/start-pir/close) + approval snapshots.
17. ROI Forecast versions + compare view.
18. ROI Actuals + actual-snapshots + corrections/verify/dispute.
19. ROI Variances + causes.
20. ROI PIR (post-investment-review-schedule, reviews, Teresa draft disposition).
21. ROI Finance links + reconciliations.
22. ROI Legacy Archive read-only tab.

**P3 — OKR vertical**
23. OKR Sets registry (`/my`, `/company`, `/team-health` perspectives) + preview.
24. OKR Program/Cycle admin screens (draft/publish, planned→active→review→closed lifecycle).
25. Objectives + Key Results CRUD + check-ins (+correction, suggested-next-value).
26. Alignments (accept/reject/remove) + alignment-tree visualization.
27. Reviews (self/manager submit/approve/request-changes) + comments + closing (close/carry-forward/history) + reflection/final-score.
28. Recognition + support-requests (+decision-link bridge to formal Decisions).
29. OKR Legacy Archive read-only tab.

**P4 — Cross-cutting**
30. `/attention` cross-domain feed (KPI + OKR both expose `GET /attention` — check for a shared UI pattern rather than two bespoke implementations).
31. Consolidated visual QA pass (see §H) across all shipped screens before any default-ON flag promotion.

Note: P1-P3 package counts above assume each numbered item is independently reviewable/mergeable
(one candidate SHA + evidence packet per master plan §10.2) — a team could compress ROI's 11
packages into fewer, larger ones, but given the master plan's own repeated insistence on
per-increment cold-reopen proof and independent acceptance (§9 Gate 2, Gate 4), splitting finer is
the historically safer choice in this codebase (see `docs-presentations-templates-odbior` and
`m04-complete-mvp` memory entries — this program has repeatedly caught P0/P1 defects specifically
because increments were small enough to bisect).

---

## H. Visual QA plan

Per `TRIADA_KANON.md` Part B (40-point checklist, read in full — reproduced in essence): every
list screen needs a literal pass through 7 Menu checks, 8 Table checks, 3 Column-settings-popover
checks, 5 Kebab checks, 7 Preview checks, 2 Action-button checks, 5 Kanban checks (if applicable),
3 Color/focus checks, and 3 Keyboard/A11y checks — **at 100%, or explicit "n/a" with a reason**,
attached to the acceptance report alongside screenshots. Concretely, for each RN-G2 screen:
- **Dark + light** (checklist items 10, 14, 31-32, 40 explicitly require re-checking hairlines/
  priority-dots/action-pill colors in light separately from dark).
- **PL/EN** — this program's i18n has repeatedly broken screens silently (see
  `i18n-fala1-smoke.tsx` dev-render screen as a precedent); check both locale strings render, no
  raw translation keys leak.
- **1440/1280 widths** (repo convention per Etap 8's own QA list: "1920/1440/1280 i tablet
  review") — column resize/persistence and the `clamp(340px, 28%, 480px)` preview width (TRIADA
  §C9) need checking at the narrow end.
- **125% zoom** — not explicitly named in TRIADA but implied by the reduced-motion/focus-ring
  accessibility requirements in §41-43; treat as standard practice given this program's repeated
  focus-ring violations (crimson vs `c-focus`).
- **Keyboard/focus/ARIA**: full Tab/Shift+Tab cycle with no dead trap (menu → table/cards →
  column-settings popover → kebab → preview → actions), Esc closes the most local open layer
  first (kebab/dropdown → preview → modal, one Esc = one close), visible
  `focus-visible:ring-2 ring-[color:var(--c-focus)]` on every interactive element, **never**
  `primary-*`/crimson. Any Teresa streaming region needs `role="log"`/`role="status"` +
  `aria-live="polite"` + `aria-relevant="additions text"` (reference impl:
  `src/components/AIChat/UnifiedChatPanel.tsx`).
- **Persistence across cold reopen** — master plan Gate 2 explicitly requires this ("cold reopen
  działa na realnym ID"; "powrót zachowuje registry/filter/sort/scroll") — verify column
  order/width/visibility and the row-description toggle survive a real reload (they're
  `localStorage`-backed via `persistKey`, per `StandardTable`'s `descKey`/`readStoredFlag`), and
  that a deep link to a specific KPI/ROI-case/OKR-set opens the right record after a fresh load,
  not just client-side navigation.

**Rendering pipeline** (`dev-render/`, read `main.tsx` structure + `shot.mjs`): the harness mounts
a **real** component with mock props/data and the app's real `src/index.css` + real i18n
(`dev-render/main.tsx` header comment: *"Mounts a REAL screen component with mock data + the app's
real CSS... so the supervisor can screenshot it BEFORE the owner sees it (CLAUDE.md #7)"*), no
login required. Pattern: add a `React.lazy(() => import('./screens/<name>'))` entry near the top
of `main.tsx`, register it in the `SCREENS: Record<string, {label, render}>` map (~L251), then
screenshot via `node dev-render/shot.mjs <out.png> "http://localhost:<port>/?screen=<name>&theme=light|dark&lang=pl|en"` — `shot.mjs` blocks all non-localhost network (so CDN fonts must not be
relied on), waits for `networkidle` + a settle timeout, and supports `--click`/`--clickxy`/`--clip`/`--eval` for interacting with the mounted screen before capture. A directly relevant existing
precedent is `dev-render/screens/results-three-pairs.tsx`, which already mounts a real,
props-driven `ResultsThreePairsView` (from `src/components/Results/`) with realistic DBR77-scale
mock data — **this is a template to copy for the new registries**, not something to reuse directly
(it's the legacy component).

**Known risk, not verified fresh in this pass**: MEMORY notes record the dev-render harness
breaking for the *entire repo* repeatedly through July-August 2026 (M02-D, M03, M04, M06, M11,
M12, M13 acceptance sessions all independently hit "harness dev-render zepsuty/rozwalony" —
usually one missing file taking down all ~150 registered screens). **Do not assume the harness
currently builds** — run `?screen=results-three-pairs` (or any existing screen) through it as a
smoke check before relying on it for the first RN-G2 screenshot round, and budget time to fix it
if broken (per memory, the fix has historically been small — one missing import).

---

## Open questions (flagged, not resolved by any doc read in this pass)

1. **`/results` root during the interim**: no doc specifies what the bare `/results` route shows once RN-G2 routes exist alongside the legacy hub (§E). Needs an explicit owner decision before P0.
2. **Archetype/shell for full-tool screens**: master plan calls the L2 level "full-tool overview" and L3 "editors/measurements/check-ins/models" but never names a component contract for it. `ARTIFACT_ANATOMY_STANDARD.md` §4 classifies legacy KPI as Archetyp C "Rekord", klasa **S** — but given the real sub-resource counts uncovered in §C (KPI Scorecards has items+review-snapshots; ROI Case has ~15 sub-resource groups; OKR Set has Objectives→KRs→check-ins→alignments→reviews), klasa S (4-section limit) looks implausible by the same logic that already forced Task and Decision from S→L in `src/components/standard/registry.ts` ("korekta K1... 8/10 sekcji treści, cięcie do 4 = utrata treści, nie porządek"). Recommend treating KPI/ROI/OKR full-tool screens as klasa **L** using the same precedent, but this is a call for the architecture owner, not something to assume silently.
3. **KPI Deviation Cases: separate registry or KPI-detail tab?** Master plan §11's route list does not mention a `/results/kpi/deviation-cases` route, only `/results/kpi` and `/results/kpi/scorecards/:id`. The backend mounts deviation cases at their own sub-path (`.../kpi/deviation-cases`) with a full list+detail API, which argues for a real registry; but conceptually a deviation case only exists in the context of one KPI's out-of-band measurement, which argues for a tab. Not decided in any doc read.
4. **API client convention**: this pass did not verify whether the codebase has an existing typed-client/codegen convention (an `Api.*` facade, per the "same `Api.get` methods" pattern referenced in an unrelated memory note about dev-render patching) that RN-G2 should extend, versus hand-writing ~200 endpoint wrappers. Worth 30 minutes of dedicated lookup before P0.3.
5. **`statusDropdownContext` enum extension**: `StandardModuleBarProps.statusDropdownContext` is a closed string union (`'initiatives'|'execution'|'benefits'|'assessment'|'assessment_list'|'assessment_reports'|'tools'`) consumed inside `ModuleNavBar`. If RN-G2 wants the same left-aligned status-dropdown pattern Initiatives/Execution use (as opposed to Menu 3 chips), this union and its consumer need new members — small, but it's a shared-component edit requiring the "wspólne kontrakty zmienia wyłącznie właściciel Platform" rule from master plan §10.2, not something a domain workstream should do unilaterally.
6. **`TableSurfaceId`/`surfaceRegister.ts` participation**: this is a *closed*, hand-audited 45-item union (`T01`–`T45`, `src/contracts/tableSurface/types.ts`) tied to a specific August audit; legacy KPI/ROI/OKR tables are already registered there as `T36`/`T37`/`T38` with `persistKey`s `results.kpi-scorecards`/`results.roi-reviews`/`results.okr-sets` — **RN-G2 must not reuse those exact `persistKey` strings** (they belong to the legacy screens and a collision would corrupt both screens' column-layout localStorage). `StandardTable` explicitly and correctly supports omitting `surfaceId` entirely (100+ existing consumers do), so registering RN-G2's new tables in this closed union is optional infrastructure, not a requirement — flagged so nobody assumes it's mandatory or, conversely, silently skips picking distinct `persistKey`s.

---

## Key file citations (for quick follow-up)

- `src/components/standard/{index.ts,registry.ts,StandardModuleBar.tsx,StandardTable.tsx,StandardPreview.tsx}`
- `src/components/MyWork/{MyTasksListContent.tsx,DecisionsPanelContent.tsx}` (SSOT exemplar)
- `src/components/ReportsAndPresentations/{ReportsAndPresentationsHub.tsx,ReportsTabContent.tsx}` (Materials exemplar)
- `src/components/Discovery/DiscoveryToolsHub.tsx` (Tools exemplar)
- `src/contracts/tableSurface/{types.ts,surfaceRegister.ts}` (T01-T45 closed union; T36-T38 = legacy Results, do not collide)
- `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (L2256-2438 for existing Results routing), `src/components/RouterSync.tsx`
- `src/components/Results/resultsFeatureFlags.ts` (flag pattern to copy), `src/utils/publicProduction.ts`
- `server/src/Gateway.ts` L1160-1211 (all resultsVnext mount points)
- `server/src/routes/resultsVnext/{kpi,kpiDeviation,kpiScorecard,kpiPerspectives,kpiLegacyArchive,roi,roiPerspectives,roiLegacyArchive,okr,okrLegacyArchive}.routes.ts`
- `docs/product/results-vnext/01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md` §5 (surface architecture), §9 (8 stages/gates), §11 (routing contract), §12 (legacy/cutover)
- `docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md` §B (ABAC resolver + DENY reasons)
- `docs/product/results-vnext/{KPI,ROI,OKR}_E00X_DESIGN.md` (lifecycle CHECK constraints, honest-missing invariants)
- `docs/ui-standards/TRIADA_KANON.md` (full canon + 40-point checklist, read in full)
- `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §4/§4B (archetype classification, legacy KPI = Rekord/S; ROI/Finance = HUB, not artifact — pre-RN-G2 classification)
- `dev-render/main.tsx`, `dev-render/shot.mjs`, `dev-render/screens/results-three-pairs.tsx` (harness + closest existing precedent)
