# RN-G6 B3 — real routing inventory (Results Next)

**SHA under test:** `d6bd233a77` (branch `rn-g6-runtime2`), full integration of
10 RN-G5 lanes + P0-A + P0-C + role fix + acceptance fixtures. Verified
against the real backend (`:3097`) + real frontend (`:3197`) + real
PostgreSQL 17 environment in
`RN_G6_RUNTIME_ENVIRONMENT.md`, logged in as `rn-g6-user-a-admin`
(ADMIN, org `rn-g6-org-przemysl`), via headless Playwright
(`scripts/rn-g6-smoke-screenshot.mjs`). Raw report:
`docs/qa/screens/rn-g6-runtime/smoke-report.json`. Screenshots in the same
directory.

Route paths and their gating flags were read from `src/routes/routeConfig.ts`
(`RESULTS_KPI` / `RESULTS_ROI` / `RESULTS_OKR` / `RESULTS_ATTENTION`) and
`src/components/ResultsVNext/attention/ResultsAttentionPage.tsx`, not
guessed — see "Mission brief vs real route" note below for the one mismatch
found.

## Table

| Route (requested) | Rendered? | What it showed | Console errors | ≥400 responses | Screenshot |
|---|---|---|---|---|---|
| `/results/kpi?ff_resultsVNextKpi=1` | YES | Real `StandardTable`, 6/6 KPI (Draft 1, Pending approval 1, Active 2, Suspended 1, Archived 1), Org/My/Scorecards tabs | 2 | 2 | `kpi-registry.png` |
| `/results/kpi/:kpiId?ff_resultsVNextKpi=1` (KPI-A-001) | YES | Full KPI tool — Performance tab, latest measurement -2,450,320.75 PLN (critical, verified), status Active, Properties panel, Actions panel with Suspend | 1 | 1 | `kpi-tool.png` |
| `/results/kpi/scorecards/:scorecardId?ff_resultsVNextKpi=1` | YES | Scorecard detail — Items tab, 3 items (1 primary / 2 supporting), Review snapshots tab | 1 | 1 | `kpi-scorecard.png` |
| `/results/roi?ff_resultsVNextRoi=1` | YES | Real registry, 6/6 ROI cases across all statuses (modeling/approved/tracking/post_investment_review/changes_requested/closed) | 1 | 1 | `roi-registry.png` |
| `/results/roi/cases/:roiCaseId?ff_resultsVNextRoi=1` (case2, approved) | YES | Case detail, Baseline & policy tab, phase tabs with real counts (Build Case 6, Decision 2, Realize Value 5, Learn 3) — Baseline/Calculation policy show honest "No record" (see finding below) | 5 | 5 | `roi-case.png` |
| `/results/okr?ff_resultsVNextOkr=1` | YES | Registry, 1 OKR set, 58% progress (correctly derived from `overall_progress=0.58`), Organization/My/Company scope tabs | 1 | 1 | `okr-registry.png` |
| `/results/okr/sets/:okrSetId?ff_resultsVNextOkr=1` | YES | Set detail Overview tab — Status Active, Scope Team, Overall progress 58%, Confidence Medium, Attention Watch, lifecycle action buttons with real transition-guard reasons | 1 | 1 | `okr-set.png` |
| `/results/attention?ff_resultsVNextKpi=1&ff_resultsVNextOkr=1` | YES | Real cross-cutting attention view, KPI/OKR toggle, "Missing ownership 6" (all 6 org-A KPIs have `owner_user_id IS NULL` — genuine, not fabricated, see finding), "Performance distribution 1" | 1 | 1 | `attention.png` |
| `/attention` (bare, per mission brief literal text) | **NO — dead route** | Silently falls through to the default authenticated route (`/chat`, "Let's start your transformation") — no 404, no error, just a different screen. Confirms the mission brief's `/attention` was informal shorthand; the real route is `/results/attention` (`ROUTES.RESULTS_ATTENTION` in `routeConfig.ts`), gated behind `ff_resultsVNextKpi` AND `ff_resultsVNextOkr` together (not its own flag). | 1 | 1 | `attention-bare.png` |

All "1 console error / 1 ≥400 response" rows are the same **pre-existing,
unrelated** `GET /api/v8/admin/flags → 404` noted in the prior runtime doc
(reproducible on `/chat` too — a global layout hook, not something Results
Next introduced or should fix).

## Findings

### F1 — `/attention` (bare) is not a route; confirms the mission brief's literal text was informal
Not treated as a defect — `ROUTES.RESULTS_ATTENTION` has always been
`/results/attention`, and the router's unmatched-path fallback silently lands
on `/chat` (no error surfaced to the user). Documented so nobody re-checks
the wrong URL later.

### F2 — ROI case tool 404s on two optional per-case sub-resources when unseeded, and renders that as an honest "No record" row (not a crash)
`GET /api/vnext/results/roi/cases/:id/calculation-policy` and
`GET /api/vnext/results/roi/cases/:id/baseline` both 404 for `case2` because
`rvn_roi_calculation_policy` / `rvn_roi_baselines` are 1:1-optional tables
(`UNIQUE (case_id)`) the B2 seed never populated for any case. The UI's
"Baseline & policy" tab correctly renders two rows reading **"No record"**
with `—` for confidence/updated — this is the B2-requested "brakujące
wartości" (missing values) state occurring **organically**, not injected.
Left as-is (not backfilled) — B1's instruction was to report gaps honestly,
not paper over them with more mock data.

### F3 — role-diversity login check (B2 requirement, verified empirically, not assumed)
Logged in as all 5 seeded org-A roles + the org-B admin and hit
`/results/kpi?ff_resultsVNextKpi=1` for each — reproducible via
`node scripts/rn-g6-role-check.mjs` (backend on `:3097`, frontend on `:3197`
already up). `GET /api/auth/me`'s `role` field is the ground truth the
client's `isPilotRestrictedRole` gate acts on:

| user | DB `organization_members.role` | effective `role` from `/api/auth/me` | landed on `/results/kpi`? |
|---|---|---|---|
| `rn-g6-user-a-owner` | OWNER | `OWNER` | YES |
| `rn-g6-user-a-admin` | ADMIN | `ADMIN` | YES |
| `rn-g6-user-a-contributor` | MEMBER | `USER` | **NO — bounced to `/interview`** |
| `rn-g6-user-a-reviewer` | CONSULTANT | `USER` | **NO — bounced to `/interview`** |
| `rn-g6-user-a-outsider` | GUEST | `GUEST` | **NO — bounced to `/interview`** |
| `rn-g6-user-b-admin` (org B) | ADMIN | `ADMIN` | YES (own org's 2 KPIs, tenant-isolated) |

**This is a real product-shape finding, not a seed bug.** Only `OWNER` and
`ADMIN` org memberships can currently reach `/results/*` at all in this SHA —
every other DB role value the schema allows (`MEMBER`, `CONSULTANT`,
`USER`, `GUEST`) normalizes through
`server/src/utils/roleNormalization.ts`'s `normalizeApplicationRole` to the
client's `USER`/`GUEST` band before it ever reaches
`src/utils/roleGuards.ts`'s `isPilotRestrictedRole`, which then bounces it to
`/interview`. `roleGuards.ts`'s own `STAFF_EXEMPT_FROM_PILOT` set
(`PROJECT_MANAGER`/`MANAGER`/`CONSULTANT`) is checked against the **raw**
role string — but the raw string never survives the backend's
`resolveAuthEffectiveRole` collapse, so that exemption is effectively dead
code for any role reaching the client via the normal login/`/me` path.
Practical consequence: there is currently no way to seed (or configure) a
"manager" or "reviewer/approver" role that can see Results Next screens with
reduced privileges — the only two tiers that exist today are "full access"
(OWNER/ADMIN) and "zero access, redirected before the page loads"
(everything else). Out of allowlist to fix (`server/src/utils/`,
`src/utils/`) — reported, not patched.

### F4 — org-B tenant isolation held
`rn-g6-user-b-admin` landed on `/results/kpi` with `role: ADMIN` and (per the
seed's per-org `rvn_platform_resource_visibility` policies) can only see
org B's own resources — org A's 6 KPIs never leaked into org B's `visible`
set in the API response inspected during F3's check.

## What this does NOT prove
Same caveats as `RN_G6_RUNTIME_ENVIRONMENT.md` §8 — no 40-point TRIADA/SPEC-A
checklist pass (menu/kebab/preview/kanban/dark+light), no write-path
(form submission) testing, no load/concurrency testing.
