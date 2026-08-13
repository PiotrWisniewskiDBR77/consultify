# RN_G6_KPITAB — KPI registry Menu 2 tab/chip/selection persistence

Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g6-kpitab`, branch `rn-g6-kpitab`.
Base HEAD at start: `fe3772bdea`. After this package: `HEAD` carries two
commits on top (see §Commits below).

## 1. Defect

`src/components/ResultsVNext/ResultsKpiRegistryPage.tsx:689` — the Menu 2
tab (`My`/`Org`/`Scorecards`) was a plain `useState('my')` with **no
persistence**. Switching to "Org", opening the full KPI tool, and coming
back reset the registry to "My", silently discarding the user's filter and
selection. ROI's `ResultsRoiHub.tsx` and OKR's `ResultsOkrHub.tsx` both
already got this exact fix under RN-G5 — KPI never did.

## 2. What is persisted, and under what key

One `sessionStorage` key for the whole surface (D09 — never per-record):

```
results-vnext.kpi-registry.ui-state
```

Shape (`KpiHubUiState`):

```ts
{ tab?: 'my' | 'org' | 'scorecards';
  statusFilter?: KpiStatus | null;
  selectedId?: string | null;
  selectedScorecardId?: string | null; }
```

Read once at mount via `useMemo(() => readKpiHubUiState(), [])`, used to seed
the four `useState` initial values; written on every change via one
`useEffect` watching `[tab, statusFilter, selectedId, selectedScorecardId]`.
Wrapped in `try/catch` (private-mode `sessionStorage` failures are a no-op,
never a crash) — identical shape to `ResultsRoiHub.tsx`'s
`readRoiHubUiState`/`writeRoiHubUiState`.

Deliberately **not** persisted: `measurementsKpi` (the "Pomiary" sub-view) —
it never crosses a route boundary (entered/exited within the same mount via
row menu/preview → "Wstecz"), so it is outside "tab/chip/selected row"
survives-navigation scope the task brief asks for.

## 3. Did the ROI/OKR pattern need adaptation?

**Mechanism: no — reused as-is.** KPI's third tab, "Scorecards", swaps the
whole registry to a different DTO/endpoint, exactly like ROI's "Benefits
realization" tab already does. ROI already persists two independent
selection ids for its two differently-shaped tabs
(`selectedCaseId`/`selectedBenefitsCaseId`); KPI mirrors that 1:1 —
`selectedId` for the my/org KPI-definition table, `selectedScorecardId` for
the Scorecards table. No third mechanism was invented.

**One KPI-specific wrinkle, found live, fixed in the same file:** the
pre-existing `?kpiId=` deep-link effect only ever called `setSelectedId(...)`
— it never touched `tab`/`statusFilter`. Before persistence this was
harmless (mount always started at `tab: 'my'`, `statusFilter: null`). Once
tab/chip started surviving navigation and reload, a **restored** tab of
`'scorecards'` (whose branch never renders the KPI table/preview) or a
restored `statusFilter` chip that excludes the deep-linked KPI's status (or
a restored `'my'` tab when the KPI belongs to someone else) would silently
strand the deep link: `selectedId` set, but no visible row to attach the
preview to. Caught live during this package's own dowód run (see §5,
screenshot `07-*` before the second fix — the deep-linked `KPI-A-001` never
appeared because the persisted `'draft'` chip excluded it even after the
tab correctly bumped off `'scorecards'`).

Fix (same effect, `ResultsKpiRegistryPage.tsx` ~L836): on successful
resolution,
```ts
setStatusFilter(null);
setTab((t) => (t === 'scorecards' || (t === 'my' && kpi.ownerUserId !== currentUser?.id) ? 'org' : t));
```
`setStatusFilter(null)` is the **identical rule** `handleFormSubmit`'s
create branch already applies to a freshly-created row ("ensure the row is
visible regardless of prior filter") — not a new invention, the same
existing rule applied to the same failure mode. This is a local,
KPI-registry-only fix; `ResultsRoiHub.tsx`/`ResultsOkrHub.tsx` (out of
allowlist, not touched) very likely have the same latent gap in their own
`?caseId=`/`?setId=` deep-link effects — worth a follow-up pass, flagged
here rather than fixed silently in a forbidden file.

## 4. Files touched

- `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` — the fix.
- `tests/components/ResultsVNext/ResultsKpiRegistryPage.uiStatePersistence.test.tsx` — new component test (3 cases).
- `docs/qa/screens/rn-g6-kpitab/**` — dowód screenshots + raw report (this package).
- `docs/product/results-vnext/RN_G6_KPITAB.md` — this file.

Nothing in `server/src/**`, `src/components/standard/**`, `shared/**`,
`roi/**`, `okr/**`, or the five files reserved for the parallel session was
touched. `.claude/launch.json` not committed (backend/frontend run directly
via `npx`, per `RN_G6_RUNTIME_ENVIRONMENT.md`).

## 5. Dowód — real runtime, not dev-render

Own instances, **not** the owner's live session on 3097/3197 and not the
parallel UI/CX matrix track on 3101/3201:
- Backend: port **3105** (`DATABASE_URL` → the shared runtime Postgres on
  `55821`, `rn_g6_runtime` — same DB the owner's session and
  `RN_G6_RUNTIME_ENVIRONMENT.md` already use; only read/written through the
  real API, no direct writes).
- Frontend: port **3205** (`VITE_API_TARGET=http://127.0.0.1:3105`).
- Logged in as `rn-g6-user-a-admin@consultify.local` (seeded user, org
  `rn-g6-org-przemysl`, 9 KPIs — 6 original seed + 3 from a prior RN-G5/P0A
  package on this same branch).

Headless Playwright script (ad hoc, session scratchpad, **not** committed to
the repo — only its PNG output under `docs/qa/screens/rn-g6-kpitab/` is)
drove the real browser end-to-end. Steps and screenshots:

1. **`01-fresh-mount-default-my-tab.png`** — fresh mount (no prior session),
   default `My` tab, 0 rows (admin owns no KPI directly) — sanity baseline.
2. **`02-before-org-draft-selected.png`** — clicked `Org` tab, clicked the
   `Draft` chip (2/9 rows), clicked `KPI-G6-001` → preview opens. **BEFORE**
   state.
3. **`03-full-kpi-tool.png`** — clicked "Open" in the preview header →
   navigated to the real full KPI tool route
   (`/results/kpi/4b4c462c-…`, `KpiToolPage.tsx`).
4. **`04-after-back-tab-chip-selection-restored.png`** — browser **back**
   (`page.goBack()`, a real history navigation, not a re-render trick) →
   **pixel-identical to step 2**: `Org` tab, `Draft` chip, `KPI-G6-001`
   selected, preview populated. **This is the fix, proven live.**
5. **`05-after-f5-reload-still-restored.png`** — real **F5** (`page.reload()`)
   → still `Org`/`Draft`/`KPI-G6-001` (proves `sessionStorage`, not just React
   state that would have survived the SPA navigation alone).
6. **`06-scorecards-tab-selected-before-deeplink.png`** — clicked the
   `Scorecards` tab (persisted state is now `tab: 'scorecards'`,
   `statusFilter: 'draft'` still lingering from steps 2–5).
7. **`07-deep-link-still-resolves-off-scorecards-tab.png`** — navigated to
   `/results/kpi?ff_resultsVNextKpi=1&kpiId=<KPI-A-001 id>` (a full page
   load, fresh mount reading the persisted `scorecards`/`draft` state) →
   lands on `Org` tab, `All` chip (status filter cleared), `KPI-A-001`
   selected and its preview populated (including the seeded
   `-2,450,320.75` deviation measurement) — **both** deep-link hazards from
   §3 exercised and fixed in the same run (tab bumped off `scorecards` AND
   the stale `draft` chip cleared so the target KPI's `active` status is not
   excluded).

Raw combined report: `docs/qa/screens/rn-g6-kpitab/proof-report.json`.

**Console errors / ≥400 responses across the whole 7-step run:** 6 total —
2× `401 GET /api/v10/teresa/voice-config` (fires around login, unrelated to
this screen), 4× `404 GET /api/v8/admin/flags` (once per full page
navigation: steps 1/3/5/7). Both are pre-existing and unrelated —
`/api/v8/admin/flags` 404 is the exact same finding already documented in
`RN_G6_RUNTIME_ENVIRONMENT.md` §6 ("PRZEDISTNIEJĄCE i NIEZWIĄZANE... on
every page of the app, not something this program introduced"). **Zero**
new errors traced to this change.

## 6. Component test

`tests/components/ResultsVNext/ResultsKpiRegistryPage.uiStatePersistence.test.tsx`,
3 cases, all green:

1. **Core round-trip**: switch to Org, filter Draft, select a row → real
   `unmount()`/fresh `render()` (the same transition a route change and back
   produces) → tab/chip/selection all restored; a differently-scoped/status
   row stays correctly excluded (proves the chip is genuinely re-applied,
   not just remembered as a label).
2. **Deep link off a restored `scorecards` tab**: seed `sessionStorage` with
   `tab: 'scorecards'`, navigate `?kpiId=...` → record still resolves and
   becomes visible.
3. **Deep link off a restored `my` tab + a hiding chip simultaneously** (the
   defect found live in §5): seed `tab: 'my', statusFilter: 'active'`, deep
   link to a KPI owned by someone else with status `draft` → still resolves,
   tab bumped to `Org`.

### Negative control (mandatory, run twice — once per fix)

**Control 1 — core persistence.** Reverted the three restored `useState`
initializers (`tab`/`statusFilter`/`selectedId`) back to their original
literal defaults (`'my'` / `null` / `null`), i.e. reintroduced the exact
original defect.
- Result: **RED** — test 1 failed at
  `await screen.findAllByText('ORG-DRAFT-002')` with
  `TestingLibraryElementError: Unable to find an element with the text:
  ORG-DRAFT-002` (the remounted page landed back on `My`, which correctly
  shows nothing for that org-owned row — exactly the symptom this package
  fixes).
- Reverted the negative control, reran → **GREEN**, all 3 tests pass.

**Control 2 — deep-link double-hazard fix.** Removed `setStatusFilter(null)`
and the `t === 'my' && ...` branch from the deep-link effect (kept only the
`scorecards` bump).
- Result: **RED** — test 3 failed at
  `await waitFor(() => expect(screen.getAllByText('ORG-DRAFT-002')...` (the
  deep-linked KPI stayed hidden behind the stale `active` chip / `my` scope
  — reproducing the exact live finding from dowód screenshot 07's first
  run).
- Restored the fix, reran (together with the kpiCreate regression suite) →
  **GREEN**, 6/6 tests pass (3 new + 3 pre-existing).

## 7. Gates

Run from the worktree, after both commits:

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — exit `0` (checked via `$?` directly, not `PIPESTATUS`), 0 errors, both before and after the second fix.
- `npx vite build` — exit `0`, `✓ built in 1m 19s` (chunk-size warnings only, pre-existing, unrelated to this file).
- `bash scripts/check-list-canon.sh` — `✓ brak NOWYCH naruszeń kanonu tabel (baseline 0, dług nie rośnie)` for the staged files (this package touches no table/list-canon surface at all — `ResultsKpiRegistryPage.tsx` already used `StandardTable`/`StandardModuleBar` before this change).
- `bash scripts/check-artefakt.sh` — `✓ brak nowych naruszeń crimson w powłoce artefaktów (7/7, baseline 7 — dług nie rośnie)`.
- `git diff --check` — clean, both commits.
- Pre-commit hook re-ran all of the above (plus `check-triada`/`check-gestosc`/`check-focus-canon`) on both commits — all passed, no new debt (focus-canon baseline 130 files/261 occurrences unchanged, this file was already compliant).

## 8. What this does NOT prove

- Not a full TRIADA/SPEC-A 40-point checklist odbiór (menu/kebab/preview/kanban/dark+light) — only the tab/chip/selection persistence contract this task targeted, verified by real clicks.
- Does not prove the write path (create/edit/submit/approve/reject) still works — that is `RN-G5`'s own test file (`ResultsKpiRegistryPage.kpiCreate.test.tsx`), rerun here only as a **regression check** (still 3/3 green), not re-verified live in the browser this session.
- Does not prove ROI's/OKR's own deep-link effects are free of the same §3 hazard — flagged as a likely-shared latent gap, not fixed (their files are outside this session's allowlist).
- Multi-tab/multi-window `sessionStorage` isolation not explicitly tested (by design, `sessionStorage` is per-tab — not re-verified live, but this is the same guarantee ROI/OKR already rely on).
- No load/perf testing.

## 9. Allowlist compliance

Touched only: `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`,
`tests/components/ResultsVNext/ResultsKpiRegistryPage.uiStatePersistence.test.tsx`
(new, `git add -f`'d per repo convention for new test files),
`docs/qa/screens/rn-g6-kpitab/**` (new), this doc (new). Did not touch
`server/src/**`, `src/components/standard/**`, `shared/**`, `roi/**`,
`okr/**`, the three `*.realdb.test.ts` files, `PostgresDatabase.ts`, the
initiatives-status-default migration, or `.claude/launch.json`. No
push/merge/deploy. No sub-agents. No default flags changed
(`kpiRegistry` stays default-OFF, unaffected by this fix).
