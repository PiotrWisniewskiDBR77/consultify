# AP LAYER INVENTORY — Finance v3 (READ-ONLY)

Branch: `codex/finance-v3-complete-product-integration` @ `39b4768379ecbba5ea373096eb34291cfdb6a6c7`
(HEAD moved slightly past the caller-supplied `49071c3e2d` — that SHA is an ancestor;
`git status --short` shows a clean tree, 0 local changes made by this agent.)
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3-product`. No files touched, no tests run, no commits.

## Method

For every capability: `grep -rl` for the exact contract/service filename across `src/`, `server/src/`,
`dev-render/`, first with plain `grep -rl <name>` (catches docstring mentions too), then narrowed with
an anchored `from '...<name>'` / `^import` pattern to separate REAL imports from comment references.
This mattered: several "importers" found by the loose grep turned out to be doc-comment mentions only
(e.g. `computePinning` "used by" `artifactVersionService.ts` was a comment, not an import). All counts
below are from the ANCHORED (real-import) pass unless stated otherwise. Mount path = traced by hand
from the importing file up to its own importers until a route registration or a top-level rendered
component was found, or confirmed absent.

---

## Capability table

| # | Capability | State | Evidence (files) | Real importers (non-test) | Mount path | What's missing |
|---|---|---|---|---|---|---|
| 1 | Finance Data Grid (multi-range select, copy/paste incl. rectangular, fill down/right, paste special, bulk change, bulk clear/reset, freeze panes, hide/group columns, find/replace, jump-to-line) | KONTRAKT_BEZ_UI | `server/src/services/finance/grid/{GridSelectionModel,PasteEngine,FillEngine,BulkOpsEngine,GridViewState,FindReplaceEngine,gridCoordinates,engineContext}.ts` (AP-01). Docstrings explicitly state "no React, no DOM". "Paste special" = 3 modes (values/formulas/formats-only), confirmed in `PasteEngine.ts`. No dedicated "jump-to-line" function found — closest is `FindReplaceEngine`'s match-and-jump target, not a standalone jump primitive. | **0** in `src/`, `dev-render/`, AND **0** in `server/src/routes/**` | No mount — no `FinanceDataGrid` React component exists anywhere in the repo (confirmed by filename search, zero hits), and no HTTP route imports the grid engines either. | A `FinanceDataGrid` React component; an HTTP surface if server-side apply is intended (currently none — grid engines produce `Operation` batches but nothing calls them over HTTP) |
| 2 | Command Registry + keyboard-first (full nav/edit from keyboard, Compute/Compare/Comments shortcuts) | KONTRAKT_BEZ_UI | `server/src/services/finance/keyboard/{KeyboardCommandRegistry,CommandAvailability,CommandPaletteIndex,FocusRestoreContract,commandTypes}.ts` (AP-03). Docstrings: "does NOT attach a keydown listener". | **0** in `src/`, `dev-render/`; **0** in `server/src/routes/**` | No mount — no keyboard hook, no command-palette UI component found anywhere. | A React keydown hook wired to `KeyboardCommandRegistry.resolve()`; a command-palette UI component |
| 3 | Undo/redo (session stack, atomic bulk/paste undo), autosave, crash recovery, conflict resolution, Sync/Saved/Conflict states | KONTRAKT_BEZ_UI | `server/src/services/finance/collaboration/{operationStack,autosaveService,autosaveScheduler,conflictResolver,crashRecoveryService,computePinning}.ts` (AP-04). Internally coherent (conflictResolver imports operationStack+autosaveService; crashRecoveryService imports operationStack) but **externally orphaned**: no route, no other server service, no frontend caller imports any of the six files (verified with anchored import grep — the earlier loose-grep "hits" in `artifactVersionService.ts`/`baselineComputeService.ts` were doc-comment mentions of `computePinning.ts`, not imports). | **0** anywhere outside `collaboration/__tests__` and internal cross-imports | No mount at all — this entire AP-04 subsystem has no caller of any kind in the running product (not even a backend route). | An HTTP surface (apply-operations / checkpoint / conflict endpoints) AND a frontend consumer; today it's pure logic + 3 test files with nothing pointing at it |
| 4 | Excel/CSV round-trip (template, export data+formulas, preview diff, mapping, validation, transactional reimport, manifest w/ version/unit/source) | KONTRAKT_BEZ_UI | `server/src/services/finance/canonical/{financeExportService,financeImportService,financeExcelShared}.ts` (AP-02). | **0** real importers anywhere in `server/src` outside their own mutual references and tests (anchored grep confirmed — no route file imports either service) | No mount — **no HTTP route exposes Excel/CSV import or export** for the v3 canonical Finance artifacts. (There is a separate, older Finance/Economics Excel path unrelated to AP-02; out of this inventory's scope.) | A `finance-v2` route (e.g. `/artifacts/:id/export.xlsx`, `/artifacts/:id/import`) that actually calls these services; a frontend upload/download UI |
| 5 | Compare on 5 axes (period/period, actual/forecast, version/version, scenario/baseline, method/method) w/ absolute/Δ/%, materiality filters, synced scroll, diff export | KONTRAKT_BEZ_UI | `server/src/services/finance/canonical/financeCompareService.ts` (AP-05) — one generic `compareValues()` primitive + 6 named wrappers. Synced scroll explicitly out of scope of this file (it says so — that's a grid/UI concern, AP-01, which itself has 0 UI). | **0** real importers anywhere (only a doc-comment mention in `KeyboardCommandRegistry.ts`) | No mount — **no route calls `financeCompareService`**, no UI calls it. | A `/finance-v2/compare` route; a Compare UI (side-by-side table + synced scroll, which needs AP-01's grid too) |
| 6 | Comments/review (artifact/KPI/line/cell/period comment, mentions, assignment, resolve/reopen, blocking flag, review checklist, maker-checker) | KONTRAKT_BEZ_UI | `server/src/services/finance/canonical/commentService.ts` (AP-06, wraps `finance_comments`/`finance_comment_assignments` tables from a real migration) + `reviewChecklistService.ts` (separate file for checklists, not audited line-by-line here — EVIDENCE_MISSING on whether it has its own route). | **0** real importers of `canonical/commentService.ts` (the `commentService` found in `interview.routes.ts` is an unrelated class-based `CommentService` for a different module — confirmed by usage shape `new CommentService()`, not the finance file's named exports). | No mount — **no HTTP route for Finance comments exists** under `finance-v2/`. | A `/finance-v2/comments` route (CRUD + assign + resolve); a comment/review UI (thread panel, mentions, blocking-flag badge) |
| 7 | Filters, column management, saved views (personal/team), shareable URL | KONTRAKT_BEZ_UI | `server/src/services/finance/canonical/savedViewService.ts` (AP-07, wraps `finance_saved_views` + reuses AP-01's `GridViewState.toJSON()`/`fromJSON()`). | **0** real importers anywhere — not even a comment mention elsewhere. | No mount — no route, no UI. | A `/finance-v2/saved-views` route; a Filters/Columns manager UI panel and a "shareable URL" mechanism (URL param → saved-view id resolution) |
| 8 | Exception inbox (tie-out fail, stale, compute failed, review assigned, blocker, benchmark expired, unusual variance, import conflict) w/ owner + deep link | KONTRAKT_BEZ_UI (real API, no UI) | `server/src/services/finance/canonical/{exceptionInboxService,exceptionLedgerService}.ts` (AP-08). **This one IS wired to a real route**: `GET /api/v8/finance-v2/exceptions/open` and `GET /api/v8/finance-v2/exceptions/inbox` in `server/src/routes/v8/finance-v2/crosscutting.routes.ts` (confirmed by reading the route body — calls `listOpen`/`listExceptionInbox` directly). | Backend: 1 route file, 2 endpoints. Frontend: **0** — `src/services/api/financeV2.api.ts` has no exception-inbox method, and no component references it. | Backend mount: real, `crosscutting.routes.ts` lines ~38 (`/exceptions/open`) and ~147 (`/exceptions/inbox`). Frontend mount: none. | An Exception Inbox UI screen/panel; a frontend API client method for it |
| 9 | "Why this number?" at SINGLE-CELL level (source cells, formula, FX/unit, overrides, compute run, author/time, freshness) | BRAK | No dedicated type or service found. Searched `server/src/types/finance/*` (no `CellProvenance`/`CellExplain` type), grepped repo-wide for `whyThisNumber`/`WHY_THIS_NUMBER`/`cellExplain`/`drillDown` — zero hits. The only "provenance"-adjacent thing that exists is VERSION-level lineage (`lineageService.getAncestors/getDescendants`, exposed via `GET /versions/:id/lineage`), which returns edge metadata (`transformationKind`, `assumptionSnapshotHash`, `computeRunId`, `authorId`) between BUSINESS VERSIONS, not between individual CELLS. | n/a | n/a | Everything: a per-cell provenance/explain service, its schema, its route, and its UI (popover/panel). This is a genuine gap, not a wiring gap. |
| 10 | Lineage navigator (compact breadcrumb of ancestor chain + relations panel) | KONTRAKT_BEZ_UI | `server/src/services/finance/workspace/lineageNavigatorContract.ts` (AP-11, ~1480 lines: `buildLineageTrail`, `buildRelatedPanel`, tenant isolation, cycle detection, terminal-state badges — all pure logic, explicitly "no React, no DOM"). Wraps the real `lineageService.ts` DAG (which itself IS live — see #9's route). | **0** real importers of `lineageNavigatorContract.ts` outside `workspace/index.ts` (barrel) and its own test fixtures. | No mount — no route calls `buildLineageTrail`/`buildRelatedPanel`; no React component renders a trail or a Related panel. The version-level `GET /versions/:id/lineage` route (crosscutting.routes.ts) returns raw edges only — it does NOT go through this presentation contract (no trail collapsing, no stale badges, no tenant-anomaly reporting, no Related-panel grouping). | A route that calls `buildLineageTrail`/`buildRelatedPanel` and returns their shaped output; a React breadcrumb + Related-panel component |
| 11 | Shared Workspace Bar used across 5 modules (Statements, Analysis, Models/Baseline, Prediction, Valuation) | UI_BEZ_PODLACZENIA | Backend contract: `workspaceBarContract.ts` + `moduleAdapters.ts` (AP-09/AP-10, ~1900 lines combined, 5 adapters fully declared incl. OWN-FIN-017/019/021 view-count mandates). Frontend PORT: `src/components/Finance/shared/financeWorkspaceBar.contract.ts` (a deliberate, documented duplicate — "PORT (nie import...)" — of the backend contract, since `src/`↔`server/src/` cross-imports don't exist in this repo). Frontend COMPONENT: `src/components/Finance/shared/FinanceWorkspaceBar.tsx` (28.9 KB, real React component). | Component (`FinanceWorkspaceBar.tsx`): **0/5** production workspaces. Only importers are `dev-render/screens/finance-workspace-bar.tsx`, `dev-render/screens/finance-focus-mode.tsx`, and its own test file. | **No mount in any of the 5 real workspaces.** Confirmed by reading `FinancialModelWorkspace.tsx`, `FinancialStatementWorkspace.tsx`, `FinancialStatementPackWorkspace.tsx` import lists — none import `FinanceWorkspaceBar`. This is also stated explicitly in the flag's own docstring (`useFinanceWorkspacePlatformFlag.ts`): "żaden z pięciu istniejących workspace'ów Finance dziś ich nie montuje" (none of the five existing Finance workspaces mount it today). | Import `<FinanceWorkspaceBar>` into all 5 workspace components, replacing their bespoke headers; flip `financeWorkspacePlatformV1` after Piotr's screenshot approval (CLAUDE.md rule 7) |
| 12 | Focus mode preserving Menu 1 | UI_BEZ_PODLACZENIA | Backend: `focusModeContract.ts` (AP-09, pure logic, `enterFocusMode`/`exitFocusMode`/`handleEscapeKey`/viewport-capability policy). Frontend port: `src/components/Finance/shared/focusMode.contract.ts`. Frontend hook: `src/hooks/useFinanceFocusMode.ts` (real React hook). | Hook: importers are only `dev-render/main.tsx` and `dev-render/screens/finance-focus-mode.tsx` — **0 production components**. | No mount — same gate as #11 (`financeWorkspacePlatformV1`, default `false`). | Wire `useFinanceFocusMode` into the 5 workspaces via the same flag flip as #11 |
| 13 | Device differentiation (desktop = full edit; mobile = edit/compute/review disabled; tablet = read/review/triage only) | KONTRAKT_BEZ_UI (policy defined, not enforced anywhere) | `classifyViewport`/`viewportCapability`/`FINANCE_VIEWPORT_CAPABILITIES` in `focusModeContract.ts`, mirrored verbatim in the frontend port `focusMode.contract.ts`. | **0** — nothing in `src/` besides the port file itself calls `classifyViewport`/`viewportCapability`; grepped all 5 production `Financial*Workspace.tsx` files for `useMediaQuery`/`window.innerWidth`/`isMobile`/`isTablet` — zero hits. | No mount — the five real workspaces do no device-based capability gating of any kind today; a user on mobile gets the same (bespoke, non-standard) UI as desktop, unrestricted. | A `useMediaQuery`-style hook calling `viewportCapability(width)`, and gating on it in each production workspace |

---

## Additional capability wired all the way to a real backend route (worth flagging separately, since it wasn't in the literal list but underlies #6/#7/#8's rejection-of-sham-approve logic)

- **Controlled artifact rename** (OWN-FIN-011's "editable name = controlled operation with validation/save/readback/history"): `canRenameArtifact`/`validateWorkspaceName` from `workspaceBarContract.ts` ARE imported and used for real in `server/src/routes/v8/finance-v2/artifacts.routes.ts` (`PATCH` rename endpoint — confirmed at the call sites, lines ~266/275). This is the ONE place a workspace-bar-layer function crosses from pure contract into a live HTTP route. State: **KONTRAKT_BEZ_UI still**, because `src/services/api/financeV2.api.ts` has no `renameFinanceArtifact` method and no component calls it — the backend half works, the frontend half doesn't exist.

---

## Feature flags (Finance-related)

### AP-layer flag (Package C / "Pakiet C")

| Flag id | File | defaultValue | Production importers of the flag itself | Production importers of what it gates |
|---|---|---|---|---|
| `financeWorkspacePlatformV1` | `src/hooks/useFinanceWorkspacePlatformFlag.ts` | `false` | **0** — the hook itself has no importers anywhere (`grep -rln useFinanceWorkspacePlatformFlag` returns only the file itself) | The components it's meant to gate (`FinanceWorkspaceBar`, focus mode, `FinanceErrorBoundary`) are separately confirmed at 0 production mounts (see #11/#12). |

**Not a phantom flag** in the strict sense (`ENABLE_TERESA_NOTE_CREATE`-style: flag exists, zero implementation) — the implementation (`FinanceWorkspaceBar.tsx`, `useFinanceFocusMode.ts`, `FinanceErrorBoundary.tsx`) genuinely exists and is real, tested React code. But it IS currently a flag with **zero call sites** — nothing in the app reads `useFinanceWorkspacePlatformFlag()` to decide anything, so toggling it in prod would change nothing today. Functionally equivalent to a phantom flag from the user's perspective (flipping it does nothing) even though the code behind it is real.

### A separate, older flag system — NOT part of the AP layer, flagging for clarity only

`src/components/Economics/financeFeatureFlags.ts` — "M16 Finance cockpit" flags (`valueOffice`, `investmentAppraisal`, `valuationVisuals`, `varianceBridge`, `driverPlanner`, `modelVersioning`, `m16ValuationSuite`, `m16PlanningSuite`, `m16AdvancedSuite`, `m16ValueSuite`, `fin007PostInvestmentReview`). Nine of eleven default ON (`DEFAULT_ON` set); `varianceBridge` and `fin007PostInvestmentReview` default OFF. This is the OLD Economics/M16 module (memory: "19/20 Economics/panels files + 9/9 Economics/charts have 0 production mounts", `financeValuationApi.ts` also 0 mounts) — a DIFFERENT, pre-existing dead-code pattern, unrelated to the AP-09/10/11 contracts audited above. Did not re-verify its mount status in this pass (out of assigned scope) — reported here only because the task asked for "all finance* flags."

EVIDENCE_MISSING: did not enumerate every `finance*` flag id in the repo exhaustively beyond these two systems — a broader `grep -rn "financeV3\|finance_v3\|FINANCE_V3"` flag sweep was not run.

---

## `/api/v8/finance-v2/*` endpoint count

**Method**: `financeV2Router` (mounted at `v8Router.use('/finance-v2', financeV2Routes)` in `server/src/routes/v8/index.ts:110`) composes exactly 9 route files (`server/src/routes/v8/finance-v2/index.ts`): `models`, `artifacts`, `versions`, `compute`, `statements`, `analysis`, `baseline`, `prediction`, `crosscutting`. Counted every `router.get(`/`router.post(`/`router.put(`/`router.patch(`/`router.delete(` call in each file:

| File | Endpoints |
|---|---|
| `analysis.routes.ts` | 3 |
| `artifacts.routes.ts` | 5 |
| `baseline.routes.ts` | 4 |
| `compute.routes.ts` | 4 |
| `crosscutting.routes.ts` | 4 |
| `models.routes.ts` | 2 |
| `prediction.routes.ts` | 2 |
| `statements.routes.ts` | 5 |
| `versions.routes.ts` | 3 |
| **Total** | **32** |

**Matches the referenced count of 32 exactly.**

---

## OWN-FIN-001..022 register — which does the AP layer touch, and state

Read in full: `docs/validation/finance-v3/OWNER_REVIEW_REGISTER_2026-08-09.md` (49 lines, 22 items). Register's own status column uses `ZAAKCEPTOWANE`/`POTWIERDZONE`/`WYMAGANIE WŁAŚCICIELSKIE` — these describe the OWNER'S OBSERVATION of the OLD/current live screens, not the AP contracts' completion. None of the register's "POTWIERDZONE"/status entries were updated to reflect the AP-09/10/11 contracts because those contracts are not mounted (see table above) — the register is describing the SAME unfixed screens the AP layer was built to fix.

| OWN-FIN | Area | Touched by AP layer? | AP-layer state |
|---|---|---|---|
| 001 | Lists baseline | No (lists are a different standard — StandardTable, not AP) | n/a |
| 002 | Valuation error boundary | Yes — `FinanceErrorBoundary.tsx` (Package C) exists | UI_BEZ_PODLACZENIA (0 prod mounts) |
| 003 | Statements "Report section" naming | Partially — `moduleAdapters.ts` `statementsAdapter.more.items` splits it into 3 named actions | KONTRAKT_BEZ_UI (adapter not consumed by any mounted bar) |
| 004 | Focus mode standard | Yes — this IS AP-09's focus mode | UI_BEZ_PODLACZENIA |
| 005 | Status lines merged into bar | Yes — `workspaceBarContract.ts` lifecycle control + `FORBIDDEN_NORMAL_MODE_REGIONS` | KONTRAKT_BEZ_UI / UI_BEZ_PODLACZENIA |
| 006 | Collapsible section labeling | No | n/a |
| 007 | "Powiązane" related-artifacts section | Yes — this IS AP-11's Related panel (`buildRelatedPanel`) | KONTRAKT_BEZ_UI |
| 008 | Analysis KPI creator | No (domain/product gap, not AP) | n/a |
| 009-010 | Local/staging DB security | No | n/a |
| 011 | Shared Finance Workspace Bar | Yes — this IS AP-09 | UI_BEZ_PODLACZENIA |
| 012 | Analysis lifecycle control | Yes — `standardLifecycleControl()` in `moduleAdapters.ts` | KONTRAKT_BEZ_UI |
| 013 | Approved-version follow-up path | Yes — `new_version`/`reopen` transitions in lifecycle control | KONTRAKT_BEZ_UI |
| 014 | Analysis KPI table columns | No (StandardTable/column-manager domain, not AP-09/10/11; AP-07 saved views is adjacent but also unmounted) | KONTRAKT_BEZ_UI (via #7) |
| 015 | Baseline/no-decision model definition | No (domain/product, not AP) | n/a |
| 016 | Models bar application | Yes — `baselineModelAdapter` | UI_BEZ_PODLACZENIA |
| 017 | Models exactly-2-views mandate | Yes — `baselineModelAdapter.views` (2, OWNER_MANDATED) | KONTRAKT_BEZ_UI |
| 018 | Remove valuation from Models flow / fix Compute timeout | Partially — adapter already excludes valuation from `more` menu (only via `relatedDownstreamTypes`); the Compute-timeout bug itself is outside AP scope (compute engine, not AP) | Mixed |
| 019 | Prediction exactly-2-views mandate | Yes — `predictionAdapter.views` (2, OWNER_MANDATED) | KONTRAKT_BEZ_UI |
| 020 | Prediction bar + focus mode | Yes | UI_BEZ_PODLACZENIA |
| 021 | Valuation 7-step stepper + bar | Yes — `valuationAdapter.views` (7, stepper, OWNER_MANDATED) | KONTRAKT_BEZ_UI |
| 022 | Finance Lineage Navigator | Yes — this IS AP-11 in full | KONTRAKT_BEZ_UI |

**Net: 12 of 22 OWN-FIN items (004,005,007,011,012,013,016,017,019,020,021,022) are directly the AP-09/10/11 layer's mandate, plus partial touches on 002/003/014/018 — and every one of them is currently unmounted in the live product.** The owner's original complaints on these screens are therefore still live/reproducible today despite the contracts existing in code.

---

## Ranking: cheapest → most expensive to close the gap

1. **Cheapest — flip the existing flag + wire 5 imports**: `financeWorkspacePlatformV1` gates real, tested, finished React code (`FinanceWorkspaceBar`, focus mode hook, `FinanceErrorBoundary`). Closing #11/#12 is "import the component into 5 files + delete the bespoke header", not new engineering — contract, component, and tests are all done. Directly resolves OWN-FIN-004/005/011/012/013/016/017/019/020/021 at once (all route through the same bar/adapter mechanism). Needs Piotr's screenshot approval per CLAUDE.md rule 7 before default-flip.
2. **Cheap-ish — wire AP-11's presentation layer to a route + a breadcrumb component**: `buildLineageTrail`/`buildRelatedPanel` are pure functions with an existing DB-backed `lineageService` underneath (already live via `GET /versions/:id/lineage`). Needs: one new route handler calling the presentation functions + resolving `LineageMetadataResolver` against real artifact data, and one new React breadcrumb/panel component. Resolves OWN-FIN-007/022.
3. **Medium — expose AP-05/06/07/08's backend services via routes + build the UI**: Compare, Comments, Saved Views all have complete, tested backend services and (for Comments/Saved Views) real migrated tables, but literally zero HTTP route today. Needs a route file per capability (analogous to `crosscutting.routes.ts`) plus frontend API client methods plus UI components (compare table, comment thread panel, filter/column manager). Exception Inbox is furthest along (route exists) — just needs the frontend half.
4. **Medium-expensive — AP-02 Excel/CSV round-trip**: services exist and are non-trivial (export/import/diff-preview/manifest) but, like #3, have zero route and zero UI. More UI surface than Compare/Comments (upload wizard, diff preview, mapping UI).
5. **Most expensive — AP-01 grid + AP-03 keyboard + AP-04 collaboration**: these three are the deepest gaps. No `FinanceDataGrid` React component exists at all (this is the actual spreadsheet-like editing surface every other capability assumes), no keyboard hook, no autosave/undo wiring, and none of the three has ANY route either (grid/keyboard have literally zero HTTP surface — not even a stub). Building a real data-grid UI (virtualized rendering, cell editing, multi-range selection, paste handling) is a substantially larger frontend engineering effort than assembling already-designed panels, and it is also the prerequisite most other capabilities (Compare's synced scroll, cell-level comments/anchors, "why this number") implicitly depend on.
6. **Genuine net-new (not a wiring problem) — capability #9, "why this number" at cell granularity**: no type, no service, no route exists. This is the only item on the list that is `BRAK` rather than `KONTRAKT_BEZ_UI` — everything else already has backend logic written and tested; this one needs the logic itself designed and built first.

---

## Things that LOOK finished but are dead (the "kod jest, podłączeń nie ma" list)

- `server/src/services/finance/grid/**` (9 files, AP-01) — fully implemented, zero callers anywhere (no route, no React).
- `server/src/services/finance/keyboard/**` (6 files, AP-03) — fully implemented, zero callers anywhere.
- `server/src/services/finance/collaboration/**` (6 files, AP-04) — fully implemented and internally cross-wired (they call each other), but externally orphaned — no route, no service, no frontend touches any of the 6.
- `server/src/services/finance/canonical/financeCompareService.ts` (AP-05) — fully implemented, zero route, zero caller.
- `server/src/services/finance/canonical/commentService.ts` (AP-06) — fully implemented, backed by real migrated tables, zero route, zero caller. (Do not confuse with the unrelated class-based `CommentService` used by `interview.routes.ts` — different module, different feature, verified by reading the actual call sites.)
- `server/src/services/finance/canonical/savedViewService.ts` (AP-07) — fully implemented, zero route, zero caller anywhere, not even a doc-comment mention elsewhere.
- `server/src/services/finance/canonical/{financeExportService,financeImportService}.ts` (AP-02) — fully implemented, zero route, zero caller.
- `server/src/services/finance/workspace/lineageNavigatorContract.ts` (AP-11, ~1480 lines of carefully-reasoned logic incl. tenant isolation, cycle detection) — zero route, zero UI. The version-level lineage route that DOES exist (`GET /versions/:id/lineage`) bypasses this file entirely and returns raw, unshaped edges.
- `src/components/Finance/shared/FinanceWorkspaceBar.tsx`, `focusMode` hook, `FinanceErrorBoundary.tsx` — real, finished React components, mounted only in `dev-render/` harness screens and their own tests. Zero of the 5 production Finance workspaces import them (confirmed by reading each workspace's import list, not just grepping).
- `financeWorkspacePlatformV1` flag — real code behind it, but the flag itself has zero read sites in the app, so it currently controls nothing live.

## Things that DID make it all the way to a real, mounted/wired state

- `GET /versions/:businessVersionId/lineage`, `GET /versions/:businessVersionId/freshness-events`, `GET /exceptions/open`, `GET /exceptions/inbox` (all in `crosscutting.routes.ts`) — real routes calling real services, confirmed by reading the handler bodies.
- `canRenameArtifact`/`validateWorkspaceName` (from AP-09's `workspaceBarContract.ts`) — used for real inside `artifacts.routes.ts`'s rename endpoint. Backend-only; no frontend caller.
- `computePinning` IS real production code, but note: it is invoked internally within `canonical/` compute services via genuine logic, NOT via the collaboration-directory import path I checked for AP-04 attribution — EVIDENCE_MISSING: did not trace whether the LIVE compute-pinning behavior in `baselineComputeService.ts`/`artifactVersionService.ts` reimplements AP-04's `computePinning.ts` logic independently or is unrelated; the anchored-import grep found no cross-file import, only comment mentions, so if compute pinning is live somewhere it is NOT coming from AP-04's file.

## EVIDENCE_MISSING

- Did not open `reviewChecklistService.ts` (mentioned in `commentService.ts`'s header as the maker-checker/review-checklist piece) — its route/UI status for capability #6's "checklist review, maker-checker" sub-clause is unverified.
- Did not exhaustively enumerate every `finance*`-prefixed flag id repo-wide beyond the two systems found (`financeWorkspacePlatformV1` and the M16 `financeFeatureFlags.ts` set) — a broader flag sweep (e.g. any flags defined inline in route files or server-side env-var gates) was not performed.
- Did not verify server-side test-suite pass/fail status for any of the packages above (out of scope for a read-only inventory, and the task explicitly forbids running tests in this worktree).
- Did not check whether `financeV2.api.ts`'s minimal surface (artifact CRUD, versions, capabilities, compute jobs, approve/reopen only) is because a WIDER frontend API client exists elsewhere under a different name — searched only the one file named in the task brief.
