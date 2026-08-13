# RN-G5 scopegap — design notes + ready-to-paste diffs

Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g5-scopegap`, branch `rn-g5-scopegap`,
base `35a1dee6c03b66907219b5b645e4e3ecb267f80a`. Closes four §G scope gaps
found by the RN-G2 UI-scope coverage measurement
(`docs/product/results-vnext/RN_G2_UI_SCOPE.md` §G): #30 (Attention),
#8 (KPI Scorecard writes), #11 (ROI PIR-outcomes perspective), and the
undiscoverable OKR Programs/Cycles routes.

## §1 — Task 1: `/attention` shape verification (KPI vs OKR)

Read directly from the server (not assumed):

- `listOrganizationKpiAttention` —
  `server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts:597-624`,
  route `server/src/routes/resultsVnext/kpiPerspectives.routes.ts:244-262`.
  Returns `OrganizationKpiAttention`
  (`kpiPerspectivesRepository.ts:325-332`) — **7 named buckets**:
  `processCoverage` / `ownerLoad` / `missingOwnership` (arrays) /
  `performanceDistribution` (a **single stats object**, `{onTarget, warning,
  critical, neutralOrMissing}` — NOT a list) / `overdueObligations` /
  `repeatedDeviations` / `ineffectiveCorrectiveActions` (arrays). Response
  envelope key: `{ attention: OrganizationKpiAttention }`.

- `listOrganizationOkrAttention` —
  `server/src/services/resultsVnext/okr/okrAttentionRepository.ts:262-274`,
  route `server/src/routes/resultsVnext/okr.routes.ts:2987-2995`. Returns
  `OrganizationOkrAttention` (`okrAttentionRepository.ts:129-135`) —
  **5 named buckets, all arrays**: `staleCheckins` / `lowConfidenceObjectives`
  / `openSupportRequests` / `openBlockers` / `escalatedSets`. Response
  envelope key: `{ attention: OrganizationOkrAttention }`.

- `listOrganizationOkrTeamHealth` —
  `server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts:190-231`,
  route `okr.routes.ts:948-957`. A **third, again different** aggregate:
  `countsByStatus` / `countsByScopeType` / `attentionBreakdown` (count
  breakdowns) + `sets` (a `OrganizationOkrTeamHealthSetSummary[]` list).
  Envelope key: `{ teamHealth: OrganizationOkrTeamHealth }`.

**Verdict: no shared row shape exists between KPI and OKR attention.** The
`kpiApi.ts` header comment the task brief flagged ("an aggregate-stats view,
not a KPI-row list") is correct. A single merged table is not possible
without inventing fields that don't exist. What §G #30 actually asks for
("poszukaj wspólnego wzorca UI") is achievable at the SHELL level, not the
DATA level:

- ONE screen (`ResultsAttentionPage.tsx`), ONE mechanism for picking which
  of the many named buckets is shown: Menu 2 tabs = source (`KPI`/`OKR`),
  Menu 3 chips = the bucket within that source (real counts on every chip,
  computed from the already-loaded aggregate — no per-bucket fetch).
- ONE generic per-row preview (`buildAttentionRowPreview`) instead of N
  bespoke preview builders — every bucket's small `TableColumn[]` already
  IS its full property list (these are read-models, not entities with a
  large surface), so the preview's `details.properties` is just that same
  column list rendered as key/value.
- `okr/team-health`'s `sets` list is folded in as a 6th OKR-tab bucket
  ("Zdrowie zespołu — zestawy"); its three count-breakdowns are NOT shown
  today (no natural row-shaped home for them in this pattern) — an honest
  gap, not silently dropped: a future package could surface them as a
  small stat strip above the table if a screen owner wants that.

`ResultsVNextRegistryShell` was NOT reused for this screen — its `domain`
prop is a closed `'kpi'|'roi'|'okr'` union in `../types.ts`, a file outside
this package's edit allowlist, and widening it for a view that is
explicitly NOT a fourth domain (D10) would be the wrong fix regardless.
`ResultsAttentionPage.tsx` composes `StandardModuleBar`+`StandardTable`+
`StandardPreview` directly (same three Triada components, same
Esc-to-close/focus-return behavior copied from the shell) instead.

Flag gate: **both** `kpiRegistry` AND `okrRegistry` must be enabled (no new
flag added to `resultsVNextFeatureFlags.ts`, which is outside the
allowlist — and D10/"one flag per domain" argue against a new per-screen
flag anyway, since this view reads both domains' data).

Files: `src/components/ResultsVNext/attention/attentionApi.ts`,
`attentionPresenters.tsx`, `ResultsAttentionPage.tsx`. Route:
`ROUTES.RESULTS_ATTENTION` = `/results/attention` (bare string, not a
nested object like the three real registries — D10 marker in the route
config itself). Harness: `dev-render/screens/results-vnext-attention.tsx`.

## §2 — Task 2: KPI Scorecard creation — ready-to-paste (NOT applied)

`createScorecard` (`POST /api/vnext/results/kpi/scorecards`) is wired in
`kpiScorecardApi.ts` (`createKpiScorecard`) but has **no UI entry point** in
this package — its only natural home is `ResultsKpiRegistryPage.tsx`'s
"Scorecards" Menu 2 tab (`if (tab === 'scorecards')` branch, `moduleBar`
object around L688-699, no `primaryCta` set today), which is **outside this
package's edit allowlist**. Building a modal component with zero real
callers would also fail `scripts/check-gestosc.sh`'s "component ma 0
importerów" gate (verified live — see report). The modal is therefore
**not a committed file** in this diff; paste it as
`src/components/ResultsVNext/kpiScorecards/CreateKpiScorecardModal.tsx`
when `ResultsKpiRegistryPage.tsx` is next touched:

```tsx
// src/components/ResultsVNext/kpiScorecards/CreateKpiScorecardModal.tsx
// (full source: see git history of this worktree, commit tagged
// "wip: CreateKpiScorecardModal draft (unused, not committed)" — or
// regenerate from RoiCaseCreateModal.tsx's pattern: fields = name
// (required) / description / scopeType (enum) / scopeId / reviewFrequency
// (enum) / sensitivity / reason, POST via createKpiScorecard().)
```

Integration point in `ResultsKpiRegistryPage.tsx` (L688-699, inside the
`tab === 'scorecards'` branch's `moduleBar` object):

```tsx
moduleBar={{
  tabs: [
    { id: 'my', label: isPolish ? 'Moje' : 'My' },
    { id: 'org', label: isPolish ? 'Organizacja' : 'Org' },
    { id: 'scorecards', label: isPolish ? 'Karty wyników' : 'Scorecards' },
  ],
  activeTab: tab,
  onTabChange: (id) => setTab(id === 'org' ? 'org' : id === 'scorecards' ? 'scorecards' : 'my'),
  showTabCounts: false,
  viewModes: ['table'],
  viewMode: 'table',
  // NEW:
  primaryCta: {
    label: isPolish ? 'Nowa karta wyników' : 'New scorecard',
    icon: Plus,
    onClick: () => setCreateScorecardOpen(true),
    testId: 'kpi-scorecard-new-cta',
  },
}}
```

Plus a `createScorecardOpen` state pair and a `<CreateKpiScorecardModal
open={createScorecardOpen} onSubmit={...} onClose={...} />` mounted at the
bottom of that branch's returned JSX, calling `createKpiScorecard` then
`fetchScorecardRows()`. Full write plumbing (busy/error/conflict state,
CAS via `expectedVersion`) already exists as a pattern in this same diff's
`ResultsKpiScorecardDetailPage.tsx` (`handleAddItem`/etc.) — copy that
shape.

**What IS wired in this package** (real callers, real commit): add/remove/
reorder scorecard items, create + publish review snapshots — all inside
`ResultsKpiScorecardDetailPage.tsx` (allowlisted, already has real state).
See that file + `KpiScorecardItemDialogs.tsx` / `KpiScorecardSnapshotDialogs.tsx`
/ `kpiScorecardApi.ts` / `kpiScorecardPresenters.tsx` diffs.

### D07 / OQ-UI-B — snapshot payload non-leak, restated for this package

`kpiScorecardRepository.ts`'s own header (decision #6, #6a/#6b) already
documents: `listReviewSnapshots` does **not** re-filter a snapshot's stored
`snapshot_payload` per reader — only `getPublishedSnapshot` does. This
package's NEW write paths do not change that fact and do not attempt to
work around it:

- `createKpiScorecardReviewSnapshot`'s response carries a fresh
  `KpiScorecardReviewSnapshotDto` with `snapshotPayload: null` (a brand-new
  draft has no payload yet — verified against `createReviewSnapshot`'s own
  implementation, which does not populate it at creation time).
- `publishKpiScorecardReviewSnapshot`'s response **does** carry
  `snapshot.snapshotPayload` populated (decision #6a: filtered to the
  PUBLISHER's own visibility at publish time) — `kpiScorecardApi.ts`'s doc
  comment on that function and `KpiScorecardSnapshotDialogs.tsx`'s file
  header both call this out explicitly as a "never render this field" zone.
- Neither `PublishKpiScorecardReviewSnapshotDialog` nor
  `ResultsKpiScorecardDetailPage.tsx`'s `handlePublishSnapshot` reads
  `.snapshotPayload` from the response anywhere — only `status`/
  `publishedAt`/`publishedBy`/`resultingVersion` feed local state.
  `buildKpiScorecardSnapshotPreview` (existing, untouched field list) still
  renders metadata-only properties.

Negative control: see `tests/resultsVnext/kpiScorecards/kpiScorecardD07NonLeak.test.ts`
(new test in this diff) — a unit assertion that
`buildKpiScorecardSnapshotPreview`'s returned `details.properties` never
contains an id derived from `snapshotPayload` (checked by inspecting the
built property list's `id`s against a known-forbidden set, AND by seeding
a row with a non-null `snapshotPayload.items` array containing a sentinel
value and asserting that sentinel string appears NOWHERE in the
JSON-stringified preview output). Run with the test genuinely reverted to
render the payload (one line: add a `snapshotPayload` items-count property
to the properties array) → the sentinel assertion goes RED → reverted back
→ GREEN. Actual pass/fail output is in the acceptance report, not narrated
here. This is the same protection class the orchestrator's OQ-UI-B note
describes (a real
Postgres-proven leak class), verified structurally here (mock-seeded, no
live Postgres in this worktree) rather than against a real filtered-vs-
unfiltered DB row.

## §3 — Task 3: ROI PIR-outcomes tab — hub integration point

`RoiPirOutcomesTab.tsx` (new, self-contained — owns its own fetch/loading/
error/selection state, same shape as
`ResultsKpiScorecardDetailPage.tsx`'s tabs) is ready to drop into
`ResultsRoiHub.tsx` as a THIRD Menu 2 tab, mirroring the existing
"Realizacja korzyści" (Benefits realization) tab exactly:

1. `ResultsRoiHub.tsx` L91: widen `type RoiTab = 'all' | 'benefits'` to
   `'all' | 'benefits' | 'pir-outcomes'`.
2. `ResultsRoiHub.tsx` L374-377 (`const tabs: StandardModuleTab[] = [...]`):
   add `{ id: 'pir-outcomes', label: isPolish ? 'Wyniki PIR' : 'PIR outcomes' }`.
3. `ResultsRoiHub.tsx` L420 (`if (tab === 'benefits') { ... }` block): add a
   sibling branch —
   ```tsx
   if (tab === 'pir-outcomes') {
     return <RoiPirOutcomesTab isPolish={isPolish} />;
   }
   ```
   (Import `RoiPirOutcomesTab` from `./RoiPirOutcomesTab` at the top of the
   file.) No other state wiring needed — the component is fully
   self-contained, same as `RoiCaseFullTool`'s existing `if (modelCase)`
   early-return pattern already in that file.

Until that lands, `RoiPirOutcomesTab` is reachable today at its own route
(`ROUTES.RESULTS_ROI.PIR_OUTCOMES` = `/results/roi/pir-outcomes`, via
`ResultsRoiPirOutcomesPage.tsx`) — a real production surface, not an
orphaned component.

## §4 — Task 4: OKR Programs/Cycles — undiscoverable, nav point

`ROUTES.RESULTS_OKR.PROGRAMS` (`/results/okr/programs`) and `.CYCLES`
(`/results/okr/cycles`) are mounted and functional (`AppRoutes.tsx`
L2672-2714) but have **zero links anywhere in the app** — confirmed by
grep across `src/` for both literal paths and for `RESULTS_OKR.PROGRAMS`/
`.CYCLES` outside `AppRoutes.tsx`/`routeConfig.ts` themselves: no hits.

`ResultsOkrRegistryPage.tsx` (the route entry, not in the forbidden list)
was checked as the "outside the hub" option the task brief suggests — it is
a **thin flag-gate wrapper with no slot**: `enabled ? <ResultsOkrHub /> :
<EmptyState .../>`, no children/props ResultsOkrHub accepts for extra
chrome, and `ResultsVNextRegistryShell` (which `ResultsOkrHub` uses
internally) has no header-extra slot either
(`ResultsVNextRegistryShellProps` = `domain`/`moduleBar`/`table`/`preview`/
`forbidden`/`onForbiddenBack`/`className`, checked directly). Wrapping the
rendered `<ResultsOkrHub />` with a hand-built banner/nav bar above it would
mean pasting a second, non-`StandardModuleBar` menu — exactly the R2b
"legacy menu" pattern `scripts/check-list-canon.sh` exists to block system-
wide (kanon: "Menu wyłącznie przez StandardModuleBar, zakaz klejenia
własnego"). There is therefore **no way to add this discoverably without
touching `ResultsOkrHub.tsx`** — confirmed, not assumed.

Ready-to-paste diff for `ResultsOkrHub.tsx` (its `moduleBar` object,
currently ~L327-336, has an unused `primaryCta`/`primaryCtaContent` slot —
verified by reading the whole file, neither is set anywhere today):

```tsx
// src/components/ResultsVNext/okr/ResultsOkrHub.tsx, inside the final
// `return (<ResultsVNextRegistryShell domain="okr" moduleBar={{ ... }}`
// object (currently L327-336):
moduleBar={{
  tabs,
  activeTab: tab,
  onTabChange: (id) => setTab(id as OkrTab),
  showTabCounts: false,
  viewModes: ['table'],
  viewMode: 'table',
  chips,
  activeChip: chip,
  onChipChange: (id) => setChip(id as 'all' | OkrSetStatusBucket),
  // NEW — makes /results/okr/programs and /results/okr/cycles reachable
  // from the OKR registry itself (today: direct-URL-only). A single CTA
  // can only open one destination, so this opens a tiny 2-item dropdown
  // (Programs / Cycles) via `primaryCtaContent` instead of `primaryCta`
  // (same "content overrides the built-in button" escape hatch
  // `StandardModuleBarProps.primaryCtaContent`'s own doc comment
  // describes) — reuses `useNavigate()` already imported in this file.
  primaryCtaContent: (
    <OkrAdminQuickNav
      isPolish={isPolish}
      onOpenPrograms={() => navigate(ROUTES.RESULTS_OKR.PROGRAMS)}
      onOpenCycles={() => navigate(ROUTES.RESULTS_OKR.CYCLES)}
    />
  ),
}}
```

`OkrAdminQuickNav` is a ~20-line two-button (or one small dropdown) presentational
component — build it alongside this change, in `okr/` (out of this
package's allowlist today). If a single-button CTA is preferred instead of
a 2-item picker, an equally valid minimal alternative is a plain
`primaryCta` that always navigates to `PROGRAMS`, with `CYCLES` reachable
from inside `OkrProgramsPage.tsx` itself (that file's own header/tabs, not
checked in this pass — the orchestrator should verify `OkrProgramsPage.tsx`
doesn't already cross-link to Cycles before assuming zero discoverability
end-to-end).
