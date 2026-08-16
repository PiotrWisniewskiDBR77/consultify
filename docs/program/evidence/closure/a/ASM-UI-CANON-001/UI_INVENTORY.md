# ASM-UI-CANON-001 — UI inventory: every mounted Assessment route/tab/modal/drawer

Captured against the real, signed-in browser harness described in
`BROWSER_HARNESS.md` (real Postgres, sandbox `consultify-closure-a-34914`,
no mocks). Flags used are called out per surface.

## Routes that mount into the Assessment module

| Route | Component | Notes |
|---|---|---|
| `/assessment` (`index`), `/assessment/overview`, `/assessment/summary`, `/assessment/drd`, `/assessment/siri`, `/assessment/adma`, `/assessment/cmmi`, `/assessment/lean` | `AssessmentHub` | The five-surface Hub. All aliases render the same component (`src/routes/AppRoutes.tsx:2169-2178`). |
| `/assessment/:framework/:assessmentId` | `AssessmentSessionEditorView` (legacy editor) or `DrdMethodWorkspaceScreen`→`DrdHttpMethodWorkspaceScreen` when `framework==='drd'` and `drdMethodWorkspaceSliceV1` is ON | See the blocker below — this gate is currently unreachable for a **real** method-core session id. |
| `/assessment-reports/:reportId` | `LegacyAssessmentReportRedirect` | Not covered by this evidence pass (legacy alias). |

`AssessmentHub` is gated by `assessmentFiveSurfacesV1` (default **TRUE**, not
overridden for any capture in this pass — every capture below has it ON).

## The five surfaces (AssessmentHub tabs, `?tab=` URL-synced)

Tab bar: `role="tablist" aria-label="Module sections"`
(`src/components/shared/ModuleHub/ModuleNavBar.tsx:388`), each tab
`role="tab"` + `aria-selected`, **no `data-testid`** — selected by accessible
role+name in the extended spec.

| Tab id | Label | Component | Default-state reached | Empty state reached | Loading | Error |
|---|---|---|---|---|---|---|
| `library` | Library | `AssessmentLibraryTab` | Yes | N/A (static catalog: DRD/SIRI/ADMA/CMMI/LEAN rows) | Yes (real network race on mount, `isLoading` → "Checking…" status chip) | Yes — "DRD definition catalog … No published DRD definition found yet" banner, real (legacy V8 definitions endpoint returns none for a fresh org) |
| `processes` | Processes | `AssessmentHub` (StandardTable+StandardPreview, `activeTab==='list'\|\|'processes'`) | Yes | Yes, genuine — fresh test-support org has 0 assessments → "No assessments yet / No assessments found. Create your first assessment to get started." + "Create First Assessment" CTA | Yes (`SharedLoadingState` template="list" while `assessments` loads) | Reachable via `ErrorState` + Retry when the load call itself fails (not exercised — needs a real backend 5xx, see Known gaps) |
| `outputs` | Outputs | `AssessmentOutputsTab` (org-wide, no assessment selected) or `AssessmentQualityReviewPanel` (assessment selected) | Yes (org-wide default) | Yes, genuine — "No outputs yet / Outputs frozen from a completed assessment session will appear here." Has its OWN nested `Outputs/Reports/Initiatives` sub-tablist (not the Hub's Menu-2 tablist — see selector note below) | `AssessmentQualityReviewPanel` has real `loading`/`loadError` state (`src/components/assessment/AssessmentQualityReviewPanel.tsx:30-31,179,188`) — only reachable with an assessmentId, not exercised this pass | `AssessmentQualityReviewPanel`'s `loadError` banner is real but needs a selected assessment; not exercised |
| `reports` | Reports | `AssessmentHub` (StandardTable+StandardPreview, `activeTab==='reports'`) | Yes | Yes, genuine — "No reports yet" + "Generate Report" CTA | Yes | Same ErrorState/Retry pattern as `processes` |
| `initiatives` | Initiatives | `AssessmentHub` (StandardTable+StandardPreview, `activeTab==='initiatives'`) | Yes | Yes, genuine — "No initiatives yet" + "Initiative Pack" CTA | Yes | Same ErrorState/Retry pattern as `processes` |

All five captured at 1440×900 / 768×1024 / 390×844, light+EN; dark+EN and
light+PL captured at 1440×900. See `BROWSER_EVIDENCE` below for exact file
list. **Empty states above are not fabricated** — every fresh
`test-support/bootstrap` run creates a brand-new organization with zero
assessments/reports/initiatives/outputs, so these are the real, default,
first-run product experience, not a synthetic zero-data harness.

## Modals / drawers

| Trigger | Component | Reached | Keyboard / focus |
|---|---|---|---|
| "New Assessment" (Processes tab module bar) | `NewAssessmentModal` (`role="dialog"`) | Yes | Real Tab-order traversal from page load to the trigger, Enter opens it, focus moves inside `[role="dialog"]`, Escape closes it, focus returns to the trigger — all asserted in the extended spec, not just clicked-and-hoped |
| "New Report" / "Generate Report" (Reports tab) | `NewAssessmentReportModal` | Not exercised this pass (same StandardPreview/modal pattern as above; time-boxed out) |
| Initiatives generation | `InitiativesGenerationWizardModal` (behind `assessmentInitiativesWizard`) | Not exercised this pass |
| DRD workspace: conflict / recovery / offline / error views | `DrdHttpMethodWorkspaceScreen` sub-views (`drd-http-conflict-view`, `drd-http-recovery-view`, `drd-http-offline-banner`, `drd-http-error-view`, `freeze-button`, `drd-http-frozen-output-view`) | **Blocked** — see below | — |

## THE BLOCKER: DRD method-core create → freeze → readback is currently unreachable via the real browser UI

This is the single most important finding of this pass. Chased down to a
precise root cause, not asserted from a hunch:

1. **Bug 1 (fixed in this lane, in-lease):**
   `src/components/assessment/library/AssessmentLibraryTab.tsx` called the
   bare `useFeatureFlags()` hook (`@/hooks/useFeatureFlags`) instead of
   `useFeatureFlagsContext()` (`@/contexts/FeatureFlagsContext`). The bare
   hook creates its **own independent** flag-resolution state with
   `enableLocalOverrides` defaulted to `false`, so
   `VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true` +
   `localStorage['consultify_feature_flags']` (the mechanism this task's brief
   describes, and the one `AssessmentHub.tsx` and every other Assessment
   surface actually use via context) **could never reach this component**,
   even though both `drdMethodWorkspaceSliceV1` and `drdHttpSourceOfTruthV1`
   declare `allowLocalOverride: true`. **Fixed** — swapped to
   `useFeatureFlagsContext()` (identical `UseFeatureFlagsReturn` shape, pure
   fix, no default-value change). Verified in-browser: DRD row now shows
   "Method Core (pilot)" and Start becomes clickable once the flags are on.

2. **Bug 2 (NOT fixed — file is outside lane A's lease, reported below):**
   `src/views/AssessmentSessionEditorView.tsx` has the *exact same* pattern —
   `const { isEnabled } = useFeatureFlags();` (line 362, bare hook) — but that
   alone isn't fatal by itself. The real blocker is **ordering**: this
   component's `load()` (triggered unconditionally on mount for *any*
   `:assessmentId`, `src/views/AssessmentSessionEditorView.tsx:704-731`) calls
   `loadCoreAssessmentSession()`
   (`V8AssessmentApi.getAssessment(assessmentId)`, falling back to
   `/assessment-workflow-v2/:id`) — both of which are the **legacy**
   assessment tables. A real method-core session id (created via
   `POST /api/method/sessions`, the row lives in `method_sessions`, not
   `assessments`) 404s on **both**, `load()` catches that and calls
   `setError('Assessment not found')`, and the component's `if (error)` early
   return at **line 1745** fires and renders that message —
   **before** the `shouldMountDrdMethodWorkspace(...)` flag-gate at
   **line 1766** is ever evaluated. The DRD-method-core-workspace branch is
   live code, not dead by intent, but it is **unreachable in practice for any
   session actually created through the Library "Start" button**, regardless
   of flag state, because the id it navigates to
   (`/assessment/drd/<method_sessions.id>`) always fails the legacy lookup
   first.

   Reproduced live, end-to-end, in the real browser against the real
   sandbox DB: `Start` → real `POST /api/method/sessions` succeeds (200,
   real row in `method_sessions`) → toast "Digital Readiness Diagnosis
   started" → navigate to `/assessment/drd/<real-uuid>` → screen renders
   **"Assessment not found" / "Back to Assessment"** (this exact string only
   exists in `src/views/PublicMiniAssessmentView.tsx:112` in the whole
   codebase; `AssessmentSessionEditorView.tsx`'s own generic `{error}` banner
   at line 1749 is what's actually painting it, using that message string
   from the caught legacy-lookup rejection).

3. **Consequence for this evidence pass:** freeze/readback (`freeze-button`,
   `drd-http-frozen-output-view`, `output-panel`/`report-panel`/
   `initiative-panel`/`reopen-panel`), and the runtime's conflict/recovery/
   offline views, could **not** be captured through real user interaction,
   because the screen that would show them never mounts. I did **not**
   fabricate these with the component's own `forceState`/`seedTo` dev-only
   props (`DrdHttpMethodWorkspaceScreen.tsx`'s `forceState:
   'offline'|'conflict'|'recovery'|'loading'`) — those exist explicitly for
   harness/unit-test use, not for producing gate evidence, and using them
   here would be indistinguishable from faking the state the brief's rule 5
   prohibits faking.

4. **What I verified IS real and would work once Bug 2 is fixed:**
   - The permission model is real and testable: `MethodSessionService.ts:625`
     returns `missing_permission` for `active→in_review→frozen` unless the
     actor holds the `approver` role, and `method_session_roles` is a plain
     table (`id, organization_id, session_id, user_id, role, created_at`,
     `UNIQUE(session_id,user_id,role)`) — the repo's own integration tests
     (`server/src/method-core/__tests__/freezeOutputFlow.integration.test.ts`)
     grant it with a direct insert. I confirmed this table exists and is
     insertable on the sandbox DB.
   - The DB-backed flag path also works and is a **stronger** fix than a
     localStorage override for reaching flag-gated code that a lane can't
     edit: `GET /api/feature-flags/runtime` (`server/src/routes/
     featureFlags.routes.ts:212-243`) merges a `feature_flags` table (keyed by
     `flag_key`, `boolean` type ⇒ `enabled` wins outright) into the SAME
     `useFeatureFlags()` hook's `remoteFlags`, **independent of
     `enableLocalOverrides`** — so it reaches every call site, including the
     ones with Bug 1's pattern. I inserted `drdMethodWorkspaceSliceV1` and
     `drdHttpSourceOfTruthV1` as globally-enabled boolean rows on the sandbox
     DB (`environment='production'`, `organization_id=NULL`) and confirmed
     `GET /api/feature-flags/runtime` returns both `true` for the
     test-support token. This is what got the Library Start button working at
     all — Bug 2 in the unleased file is the only remaining blocker.

## Integrator change request

**File:** `src/views/AssessmentSessionEditorView.tsx` (confirmed NOT in lane
A's lease — `jq -e --arg f "src/views/AssessmentSessionEditorView.tsx" '.files
| index($f)' docs/cleanup/agents/generated/CLAUDE_LANE_A_PATH_LEASE.json`
returns `null`).

**Ask:** move the `shouldMountDrdMethodWorkspace(...)` early return (currently
line 1766) so it is evaluated **before** `load()`'s legacy-lookup `error`
short-circuits (currently line 1745) — or, more precisely, don't run the
legacy `loadCoreAssessmentSession()` fetch at all when the DRD-method-core
gate is going to apply for this `framework`/flag combination. Also swap this
file's own `const { isEnabled } = useFeatureFlags();` (line 362) for
`useFeatureFlagsContext()`, for the same reason as the
`AssessmentLibraryTab.tsx` fix in this lane (Bug 1) — belt-and-suspenders,
since Bug 2's fix alone would still leave this file's flag read decoupled
from the app-level provider/local-override switch.

**Why it matters beyond ASM-UI-CANON-001:** with both bugs is why the task
brief's own description ("Library tab's Start button now creates a real
method-core session … use `VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true` to
exercise that path") does not currently hold end-to-end — session creation
works, but the very next screen the user lands on can't show it. This is a
correction to the brief, made with reproduction evidence above, not just a
disagreement.

## Selector/canon notes worth propagating

- Tab pills (`ModuleNavBar.tsx`) have **no `data-testid`** — only
  `role="tab"` + `aria-selected` + visible label text. Fine for
  accessible-name-based selectors, but any future spec must scope to
  `role="tablist" aria-label="Module sections"` first: the Outputs surface
  nests its own `Outputs/Reports/Initiatives` sub-tablist with an
  **overlapping "Outputs" label**, so an unscoped
  `page.getByRole('tab', {name: /outputs/i})` is ambiguous (Playwright throws
  a strict-mode violation — this is what happened on the first run of the
  extended spec in this pass, fixed by scoping to the named tablist).
- `NewAssessmentModal` uses `role="dialog"` with real `aria-labelledby`, is
  reachable purely by keyboard from page load, traps focus inside itself, and
  returns focus to its own trigger on `Escape` — all verified for real in
  this pass (see BROWSER_EVIDENCE).

## What I could NOT reach, and why (per state)

| Required state | Reached? | Reason |
|---|---|---|
| default | Yes, all 5 surfaces, all 3 viewports | — |
| loading | Partial — natural transient captured for Library/Processes/Reports/Initiatives (StandardTable's shared loading template); Outputs' `AssessmentQualityReviewPanel` loading only fires with a selected assessment (not reached) | Best-effort race, not deterministic |
| empty | Yes, all 5 surfaces (genuine — fresh org has zero data everywhere) | — |
| error | Partial — Library's "no published DRD definition" banner is real; Processes/Reports/Initiatives `ErrorState`+Retry needs a real backend failure (not induced this pass, would need e.g. temporarily pointing at a bad DB credential, which risks corrupting the harness for the rest of the pass); DRD workspace's `drd-http-error-view` blocked by the create-flow bug above | See per-row reasons |
| permission | No | Blocked by the create-flow bug — freeze's `missing_permission` 403 path is real and unit/integration-tested server-side, but unreachable through the actual UI this pass |
| conflict | No | Same blocker; would additionally need two browser contexts racing a version-mismatched write once the screen is reachable |
| success | No | Same blocker — freeze can't be attempted because the workspace screen never mounts |

## Flags in effect per capture

- `assessmentFiveSurfacesV1`: **ON** (default) for every capture in this
  pass.
- `drdMethodWorkspaceSliceV1` / `drdHttpSourceOfTruthV1`: **ON**, via the
  sandbox-DB `feature_flags` rows described above (global, boolean,
  `environment='production'`) — NOT via `localStorage`, because Bug 1 (fixed)
  only unblocked the Library tab's own read, and Bug 2 (unleased, unfixed)
  means the destination screen never gets far enough to read a `localStorage`
  override at all. Every screenshot in this pass otherwise has the
  DEFAULT flag set (both OFF) EXCEPT the Library tab captures, which show
  the "Method Core (pilot)" status chip live.
