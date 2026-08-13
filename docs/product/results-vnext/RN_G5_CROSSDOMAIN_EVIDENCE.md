# RN-G5 — Cross-domain acceptance evidence (2026-08-12)

Agent: RN-G5 crossdomain executor. Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g5-crossdomain`,
branch `rn-g5-crossdomain`, base `35a1dee6c03b66907219b5b645e4e3ecb267f80a` (confirmed via
`git rev-parse HEAD` before any work started — exact match, no drift).

## What this file proves

Five `tests/acceptance/rvn-g4-*.e2e.test.ts` files were pulled from the WIP commit
`65fd96d6125ffa090f6a10ac0e5bbbbda33e0f77` (branch `rn-g4-lane-crossdomain`, message prefixed
`WIP(...)`, explicit note "Session ended mid-package... never executed against real Postgres and
never negative-controlled"). This session:

1. Stood up a real, ephemeral local PG17 Postgres (not Docker, not mocked).
2. Ran the full migration chain against it (not `--safe`) and verified convergence by counting
   real tables via `information_schema`, not by trusting `schema_migrations`.
3. Ran all 5 files with `RUN_DB_TESTS=1 NODE_ENV=test MOCK_DB=false` against that real database.
4. Result: **all 5 files pass, 18/18 tests, on the FIRST run — no product or test fixes were
   needed.**
5. Performed 3 negative controls (break a real guarantee in `server/src/**` → confirm the
   specific test goes RED with a real, on-topic assertion failure → revert → confirm GREEN again)
   to prove these are real tests, not tests that would pass no matter what.
6. Ran `tsc --noEmit` as a pre-commit gate.
7. Tore down the ephemeral Postgres and deleted its data directory.

No commits were needed on top of the WIP files — they were pulled in as-is (`git checkout
65fd96d612 -- tests/acceptance/`) and passed without modification. See "What was NOT touched"
below for what that does and does not prove.

## Environment stood up (exact, copyable commands)

```bash
# Binaries: no psql/pg_ctl/initdb in PATH on this machine.
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

# postmaster refused to start under the default locale ("postmaster became
# multithreaded during startup" — a real, reproducible macOS/Homebrew PG17
# issue on this machine, NOT a red herring): fixed by pinning LC_ALL/LANG.
export LC_ALL=C
export LANG=C

SCRATCH="/private/tmp/claude-501/.../scratchpad"   # session scratchpad
DATADIR="$SCRATCH/pg17-rn-g5"
SOCKDIR="/tmp/rn-g5-pgsock"   # Unix socket path in $SCRATCH was >103 bytes,
                              # over the OS limit — socket dir must be short.
mkdir -p "$SOCKDIR"

initdb --locale=C -D "$DATADIR" -U postgres

pg_ctl -D "$DATADIR" -l "$SCRATCH/pg17-rn-g5.log" \
  -o "-p 55801 -k $SOCKDIR -c listen_addresses=127.0.0.1" start

createdb -h "$SOCKDIR" -p 55801 -U postgres rn_g5_test

# Migrations — full chain, NOT --safe (per mandate: --safe reports a failed
# migration as "skipped" and exits 0).
cd /Users/piotrwisniewski/rn-g2-lanes/g5-crossdomain
export DATABASE_URL="postgresql://postgres@127.0.0.1:55801/rn_g5_test"
export NODE_ENV=test   # required: databaseTargetResolver.ts refuses any
                        # localhost/127.0.0.1 DATABASE_URL outside
                        # NODE_ENV=test/CI/VITEST, even for the migration
                        # script itself.
DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
# -> "✅ Postgres migrations complete", 168 migration files applied, 0 errors.

# Convergence check — information_schema, not schema_migrations:
psql -h "$SOCKDIR" -p 55801 -U postgres -d rn_g5_test \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# -> 1404 tables
psql -h "$SOCKDIR" -p 55801 -U postgres -d rn_g5_test \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'rvn_%';"
# -> 42 rvn_ tables
```

## Test run — exact commands

```bash
cd /Users/piotrwisniewski/rn-g2-lanes/g5-crossdomain
export DATABASE_URL="postgresql://postgres@127.0.0.1:55801/rn_g5_test"
export RUN_DB_TESTS=1
export NODE_ENV=test
export MOCK_DB=false
npx vitest run --config vitest.acceptance.config.ts \
  tests/acceptance/rvn-g4-mywork-commitment-decision-readback.e2e.test.ts \
  tests/acceptance/rvn-g4-okr-alignment-no-score-inherit.e2e.test.ts \
  tests/acceptance/rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts \
  tests/acceptance/rvn-g4-roi-perspectives-parity.e2e.test.ts \
  tests/acceptance/rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts
```

## Results — THREE states, per file, before and after

No product/test fixes were required. "Before" and "after" are identical for all 5 files.

| File | passed | failed | skipped |
|---|---|---|---|
| `rvn-g4-mywork-commitment-decision-readback.e2e.test.ts` | 3 | 0 | 0 |
| `rvn-g4-okr-alignment-no-score-inherit.e2e.test.ts` | 3 | 0 | 0 |
| `rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts` | 4 | 0 | 0 |
| `rvn-g4-roi-perspectives-parity.e2e.test.ts` | 2 | 0 | 0 |
| `rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts` | 6 | 0 | 0 |
| **Total** | **18** | **0** | **0** |

Full 5-file run together (single sequential fork, `fileParallelism: false` per
`vitest.acceptance.config.ts`): **5 files passed, 18 tests passed**, ~58s wall time.

Cleanup verified after each run: `SELECT id FROM organizations WHERE id LIKE 'odbior--rn-g4%'`
returns 0 rows; `rvn_platform_events`, `rvn_roi_cases`, `okr_vnext_objectives` all count 0 after
the suite — every file's `afterAll` actually ran and actually deleted its fixture rows.

## Points 1–10 — which is proven, by which test, which assertion

1. **KPI evidence ↔ ROI Benefit** — PROVEN.
   `rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts` Step 1: `addBenefitEvidenceLink` links
   a real `rvn_kpi_definitions` row to a benefit line; `listBenefitEvidenceLinks({ hydrateKpiDetails:
   true })` (public repository read, not raw SQL) resolves `kpiDetails.kpiId` for the linked line
   and returns `[]` for the deliberately-unlinked line — proves the link is real AND optional.

2. **ROI ↔ Finance link/reconciliation, no second source of truth** — PROVEN.
   Same file, Step 3: hash+count of 6 ROI source tables (`rvn_roi_approval_snapshots`,
   `rvn_roi_forecast_versions`, `rvn_roi_actual_snapshots`, `rvn_roi_benefit_evidence_links`,
   `rvn_roi_cost_lines`, `rvn_roi_benefit_lines`) identical before/after a `runOutboxDispatchTick()`
   that both projects a new Finance value (`roiValue: 1800`, `sourceKind: 'actual_snapshot'`) and
   opens a reconciliation (`status: 'open'`) — the tick has a real, visible effect but never
   mutates a ROI source-of-truth row.

3. **OKR alignment does not auto-inherit scoring** — PROVEN, and this is the finding a negative
   control actually caught (see below). `rvn-g4-okr-alignment-no-score-inherit.e2e.test.ts` Step
   2: `finalScoreOkrSet` on the PARENT Set leaves the CHILD Objective row byte-for-byte identical
   (`toEqual`) and leaves `okr_vnext_reflections` empty for the child; Step 3: the child only gets
   its own reflection row after its OWNER explicitly runs `finalScoreOkrSet` on the child's own Set.

4. **MyWork obligation → domain command** — PROVEN.
   `rvn-g4-mywork-commitment-decision-readback.e2e.test.ts` test 1: `raiseSupportRequest` creates
   a real `rvn_platform_obligations` row (`status: 'open'`); `resolveSupportRequest` completes it
   and tags `completed_via_command: 'resolveSupportRequest'` — the REAL command name, not a
   generic flag; cold readback via `getSupportRequest` (public repository call) confirms the
   result landed in the owning domain (`okr_vnext_support_requests`).

5. **Decision resolution → domain timeline** — PROVEN, with one documented, pre-existing gap
   (see "known limitations" below). Same file, test 2+3: `requestDecisionFromSupportRequest`
   escalates to a real `decisions` row; `acknowledgeDecisionResolution` (human path) and
   `scanAndAcknowledgeResolvedDecisionLinks` (scheduled path) both write a real
   `rvn_platform_events` row (`event_type: 'okr_support.decision_resolution_acknowledged'`) and
   are re-readable via `getDecisionLinkForSupportRequest` — cold, public path.

6. **individual/team/BU/organization are projections of the same aggregate (D12)** — PROVEN for
   the ROI leg (this file's job — KPI-E007/OKR-E008 legs already had pre-existing, untouched
   coverage per the file header). `rvn-g4-roi-perspectives-parity.e2e.test.ts`: `getRoiCase`
   (individual) and `listOrganizationRoiBenefitsRealization` (manager, via a real
   `rvn_platform_management_chain_closure` row) return the SAME `caseId`, and after a real write
   (`recordActualEntry` → `publishRoiActualSnapshot`) the manager's
   `actualFinancialBenefits` figure is asserted equal to the exact value read straight from
   `rvn_roi_actual_snapshots.total_actual_financial_benefits` for the snapshot the case's own
   `currentActualSnapshotId` now points to — proves a live join, not an independently maintained
   copy.

7. **Zero cross-tenant leaks, asserted per-row via the public path** — PROVEN, and this is the
   second finding a negative control actually caught (see below).
   `rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts`: `FOREIGN` (org B) gets
   `null` from `getPublishedSnapshot` and an empty/foreign-only `listScorecards` result for org
   A's scorecard; `OUTSIDER` (in-org, no ACL) gets only the `OPEN_ORG` KPI.

8. **Outbox ends with zero failed/dead-letter/parked for gold flow** — PROVEN.
   `rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts` Step 3: every
   `runOutboxDispatchTick()` call asserts `failed: 0`, `deadLettered: 0`, `parked: 0`.

9. **D07 — lost KPI access after snapshot publish is re-filtered on every read** — PROVEN, and
   this is the THIRD finding a negative control actually caught.
   `rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts`: `REVIEWER` sees both KPIs
   right after publish, ACL is revoked, a FRESH `getPublishedSnapshot` call shows only the
   still-visible KPI — and the stored artifact's `content_hash` is asserted byte-identical
   before/after, proving the redaction happens at read time only.

10. **All writes survive cold reopen** — PROVEN throughout. Every file's later assertions use a
    fresh `pgClient()`/fresh repository call with no in-memory state carried over (new PG client
    per read helper call in every file); `rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts`
    Step 4 and `rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts`'s final "cold
    reopen" test are explicit dedicated steps for this.

## Negative controls (mandatory, all 3 performed on real PRODUCT code, not test code)

For each: sabotaged real `server/src/**` logic → ran the specific test → confirmed RED with an
on-topic failure → reverted (`git diff --stat` confirmed byte-identical to base) → reran →
confirmed GREEN.

### Control 1 — D07 re-filter (point 8/9)

File: `server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts`, `getPublishedSnapshot`.
Sabotage: commented out the `.filter((item) => visibleKpiIds.has(item.kpiId))` line (served the
raw, unredacted item list).
Result: RED — 3 tests failed in
`rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts` ("D07 — the REVIEWER loses
ACL access...", "Point 7 — restricted outsider...", "Point 7 — cold reopen...") with
`AssertionError: expected [...(2)] to deeply equal [...(1)]` — the restricted KPI's id leaking
into the served response.
Reverted → `git diff --stat` on the file: no output (byte-identical) → reran → 6/6 GREEN.

### Control 2 — no-score-inherit scoping (point 3)

File: `server/src/services/resultsVnext/okr/okrReflectionCommands.ts`, `finalScoreOkrSet`.
Sabotage: dropped the `WHERE set_id = $1` clause from the objectives-to-score query (scored every
Objective in the org, not just the target Set's own).
Result: RED — `rvn-g4-okr-alignment-no-score-inherit.e2e.test.ts` Step 2 failed with
`AssertionError: expected [ {…29 fields…} ] to deeply equal []` on
`childReflectionsAfter` — the CHILD's own `okr_vnext_reflections` row, created while scoring the
PARENT's Set, is exactly the score-inheritance bug point 3 exists to rule out.
Reverted → `git diff --stat`: no output → reran → 3/3 GREEN.

### Control 3 — cross-tenant OPEN_ORG scoping (point 7)

Files: `server/src/services/resultsVnext/platform/visibilityScopedQuery.ts`
(`buildVisibilityScopedCte`'s OPEN_ORG branch) + `kpiScorecardRepository.ts`
(`listScorecards`/`getPublishedSnapshot` outer `organization_id` filters). Sabotage: dropped
`organization_id = $1` from all three query sites simultaneously (single-site sabotage was caught
by a second, independent org filter each time — see "defense in depth" note below — a 3-site
combined sabotage was needed to observe the leak).
Result: RED — `rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts`: "Point 7 —
cross-tenant FOREIGN user sees NOTHING..." and "Point 7 — cold reopen..." failed with
`AssertionError: expected {…16 fields, organizationId: "...org-a"…} to be null` — `FOREIGN` (org
B) received org A's full published snapshot payload.
Reverted all 3 sites → `git diff --stat` across all of `server/src/services/resultsVnext/`: no
output → reran → 6/6 GREEN.

**Notable finding from Control 3 (not a defect — a positive finding worth recording):** a single
sabotaged filter site did NOT turn any test red, because tenant isolation for scorecards is
defense-in-depth — the visibility CTE's `organization_id` filter AND the outer query's own
`rs.organization_id = $1`/`sc.organization_id = $1` are independent, redundant checks. Breaking
only one leaves the other standing. This is a good thing operationally, but it means: **do not
conclude from one green negative control that a specific line is "the" enforcement point** — for
this table, isolation is layered and all layers had to be broken together to see red.

## Defects found in the product — NOT fixed (out of scope per task brief)

- `initiatives.status DEFAULT 'step3'` violates the table's own `initiatives_status_check`
  CHECK constraint (`server/migrations/20260810_fix_initiatives_status_default.sql` is the fix,
  on the explicit do-not-touch list for this session). Confirmed still present on this fresh
  schema:
  ```
  column_default: 'step3'::text
  initiatives_status_check CHECK (status = ANY (ARRAY['DRAFT', 'PENDING_REVIEW', ...]))
  ```
  Every `initiatives` INSERT in the two ROI test files works around this by setting
  `status='DRAFT'` explicitly, per the task brief's documented workaround. Consequence if
  unfixed: any code path that inserts an `initiatives` row without an explicit `status` (there may
  be such call sites outside this test suite — not audited here) will 500 on the CHECK violation.

- Decision resolution has no exported service-layer "resolve/decide" command — the
  `mywork-commitment-decision-readback` file's decision-branch mutation goes through a raw SQL
  `UPDATE decisions SET status = ...` (documented in that file's own header as a pre-existing,
  established precedent, not something this session introduced or should fix). Consequence:
  `DecisionController.ts` emits zero `rvn_platform_events` for a decision resolved through the
  real HTTP/PMO path — only this test's own direct-SQL mutation triggers the acknowledgement
  event chain. The acknowledgement mechanism itself (points 5/9) IS proven; the trigger path for
  a *human resolving a Decision through the real UI/API* is NOT — see "what this does NOT prove"
  below.

## What this evidence does NOT prove (read before treating this as "done")

- **The pre-existing `initiatives_organization_id_fkey`/status-CHECK blocker (B4)** across the 18
  ROI realdb files was NOT re-verified in this session — this task's brief said explicitly not to
  chase it, and this file's own two ROI test files avoid it by setting `status='DRAFT'`
  explicitly. Whether B4 is still live for OTHER callers is unmeasured here.
- **The real HTTP/PMO path for resolving a Decision** (`DecisionController.ts`, behind
  `requireDecisionCapability` + `verifyToken`) was never exercised — only a direct SQL `UPDATE`
  standing in for it, per established precedent. If `DecisionController.ts` itself has a bug in
  how it transitions `decisions.status`, none of today's tests would catch it.
  `okrDecisionResolutionScanner`'s SCAN side (point 5's scheduled-actor variant) IS a real,
  unmocked code path — only the human-HTTP trigger is unproven.
- **Every write in this suite came from calling exported command functions directly, in-process
  — no HTTP layer, no auth middleware, no rate limiting, no request validation were exercised.**
  These are unit-adjacent "real DB, real domain code" tests, not full-stack HTTP acceptance tests.
- **Concurrency/race conditions** were not tested — every command in every file runs sequentially,
  single fork (`fileParallelism: false`). No claim is made about optimistic-concurrency behavior
  under real concurrent writers beyond what `expectedVersion` parameters already imply structurally.
- **The referenced source-of-truth doc `docs/product/results-vnext/RN_G4_CROSS_DOMAIN_EVIDENCE.md`
  does not exist in this worktree** — all 5 test files cite it in their header comments as "the
  FALA 3 cross-domain evidence brief," but `ls docs/product/results-vnext/` shows no such file
  (only `RN_G4_PROMPT_DLA_NASTEPCY.md` and `RN_G4_RAPORT_DLA_CODEX_2026-08-11.md` exist for G4).
  This session did not chase down where that brief lives or whether it was ever committed — flag
  this to whoever owns the RN-G4/G5 program thread.
- **Defense-in-depth in the visibility layer** (see Control 3 above) means a single-line
  regression in exactly one of the 3 sabotaged sites would NOT be caught by these tests alone —
  only a simultaneous break of all layers was observable. This is worth a dedicated single-layer
  test if tighter regression coverage on that layer specifically is ever wanted.
- **Performance/scale** — fixtures are tiny (1–2 KPIs, 1–2 ROI cases, 1–2 OKR Sets per test file).
  No claim is made about behavior at realistic data volumes.
- **`tsc --noEmit` gate result is recorded separately below** (background run at time of writing
  this section — see final status in the report).

## Allowlist compliance

Files touched, final state:
- `tests/acceptance/rvn-g4-*.e2e.test.ts` (5 files) — pulled from WIP commit, ZERO edits needed.
- `docs/product/results-vnext/RN_G5_CROSSDOMAIN_EVIDENCE.md` — this file (new).
- `server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts`,
  `server/src/services/resultsVnext/okr/okrReflectionCommands.ts`,
  `server/src/services/resultsVnext/platform/visibilityScopedQuery.ts` — touched ONLY as
  temporary negative-control sabotage during Step 5, each reverted immediately and verified
  byte-identical via `git diff --stat` before moving on. **None of these three files has any net
  change and none will be committed.**

No file outside the allowlist was permanently modified. No `git push`. No merge to `demo`/`Londyn`.
No sub-agents spawned. No `dev:staging`/`dev:railway` used.

## Addendum — orchestrator follow-up (post-first-pass review)

### Q(a) — actor/role parameters: exact values, per file, per call site

Every write command in this codebase takes `actorUserId`/`createdBy`/`approverId`/etc. (the actor)
and `actorEffectiveRole: string` as separate, CALLER-SUPPLIED literal parameters. Read/repository
functions (`getSupportRequest`, `getDecisionLinkForSupportRequest`, `listBenefitEvidenceLinks`,
`getRoiCase`, `listOrganizationRoiBenefitsRealization`, `getPublishedSnapshot`, `listScorecards`)
take only `userId` — no role parameter exists on the read path at all.

**Load-bearing fact, checked directly in `server/src/services/resultsVnext/`:**
`grep -rn "actorEffectiveRole ===\|actorEffectiveRole !==\|hasEffectiveCapability\|resolveEffectiveAccess" `
against every `okr*Commands.ts`/`roi*Commands.ts` file returns **zero hits**. `actorEffectiveRole`
is threaded into 44 files purely as a string stored in the event envelope
(`eventEnvelope.ts:37`, `actorEffectiveRole: string`) for audit/`after_state` purposes — it is
**not read or validated by any authorization check inside these command modules today**. The
commands trust the caller completely. Separately, every fixture user's `users.role` DB column is
hardcoded `'ADMIN'` in every one of these 5 files (see every file's `insertOrgAndUser(s)` helper) —
completely decoupled from the `actorEffectiveRole` string passed per-call. **Consequence for the
parallel authz-gate track:** if a gate is added that trusts the caller-supplied
`actorEffectiveRole` string as-is (current behavior, just now enforced), these tests keep passing
unchanged as long as the literal role strings below are accepted for their actions. If the new
gate instead RESOLVES the actor's role from `users.role` (currently always `'ADMIN'` in these
fixtures) and ignores the passed string, these tests would also likely keep passing (admin can do
everything) — but that would silently stop testing role-boundary behavior at all. If the gate adds
strict validation that the passed string must be a real enum member AND match what a `'member'`/
`'consultant'` actor is normally allowed to do, some of the calls below (e.g. `MANAGER` acting with
`'member'` on `resolveSupportRequest`, or `CONTRIBUTOR` with `'member'` on `finalScoreOkrSet`) are
the ones to check first.

**Per file, per call site** (actor variable → role string; identical calls collapsed):

`rvn-g4-mywork-commitment-decision-readback.e2e.test.ts`
| Command | Actor | Role |
|---|---|---|
| `createProgram` / `publishProgram` / `createCycle` | `ADMIN` | `'admin'` |
| `createOkrSet` / `createObjective` | `OWNER` | `'member'` |
| `raiseSupportRequest` (×3) | `OWNER` (createdBy) | `'member'` |
| `resolveSupportRequest` | `MANAGER` | `'member'` |
| `requestDecisionFromSupportRequest` (×2) | `MANAGER` (requestedBy) | `'member'` |
| `acknowledgeDecisionResolution` (×2) | `MANAGER` | `'member'` |
| `scanAndAcknowledgeResolvedDecisionLinks` | *(none — system/scheduled actor, only `organizationId`)* | *(none)* |
| `getSupportRequest` / `getDecisionLinkForSupportRequest` | `userId: OWNER` (read path — no role param) | n/a |

`rvn-g4-okr-alignment-no-score-inherit.e2e.test.ts`
| Command | Actor | Role |
|---|---|---|
| `createProgram` / `publishProgram` / `createCycle` | `ADMIN` | `'admin'` |
| `createOkrSet` / `createObjective` / `createKeyResult` (parent+child) | `ownerUserId` (= `MANAGER` for parent, `CONTRIBUTOR` for child) | `'member'` |
| `submitOkrSetForApproval` | `ownerUserId` | `'member'` |
| `approveOkrSet` | `ADMIN` (approverId) | `'admin'` |
| `runOkrSetLifecycleTransition` (activate/open-review, parent+child) | `ownerUserId` | `'member'` |
| `proposeAlignment` | `CONTRIBUTOR` (proposedBy) | `'member'` |
| `acceptAlignment` | `MANAGER` | `'member'` |
| `finalScoreOkrSet` (parent) | `MANAGER` | `'member'` |
| `finalScoreOkrSet` (child) | `CONTRIBUTOR` | `'member'` |

`rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts` and `rvn-g4-roi-perspectives-parity.e2e.test.ts`
(identical actor/role pattern in both files)
| Command | Actor | Role |
|---|---|---|
| `createRoiCase` / `startModeling` / `captureOrUpdateBaseline` / `addCostLine` / `addBenefitLine` / `addBenefitEvidenceLink` / `createRoiCalculationRun` / `markReadyForReview` / `submitRoiCaseForApproval` / `startRoiCaseTracking` / `recordActualEntry` / `publishRoiActualSnapshot` / `createRoiFinanceLink` | `OWNER` | `'consultant'` |
| `approveRoiCase` | `APPROVER` | `'admin'` |
| `getRoiCase` / `listOrganizationRoiBenefitsRealization` / `listBenefitEvidenceLinks` / `listRoiFinanceProjections` / `listRoiFinanceReconciliations` | `userId: OWNER` or `managerId: MANAGER` (read path — no role param) | n/a |

`rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts`
| Command | Actor | Role |
|---|---|---|
| `createScorecard` / `addScorecardItem` / `createReviewSnapshot` / `publishReviewSnapshot` | `OWNER` | `'member'` |
| `getPublishedSnapshot` / `listScorecards` | `userId: REVIEWER`/`OUTSIDER`/`FOREIGN`/`OWNER` (read path — no role param) | n/a |

### Q(b) — weak-assertion review of the remaining 15 tests

I had NOT done this systematically before your message. I reviewed all 18 tests' assertions now
(all 5 files were already fully read into context during Step 1). Findings, reported even though
every test is green:

**Genuinely weak (would not catch a real regression on their own):**

1. `rvn-g4-mywork-commitment-decision-readback.e2e.test.ts`, test 3:
   `expect(scanResult.acknowledged).toBeGreaterThanOrEqual(1)` — a loose lower bound; would also
   pass if the scheduler acknowledged 10 unrelated links. NOT strengthened — the load-bearing
   check for this test is the specific-`linkId` readback two lines later
   (`getDecisionLinkForSupportRequest` → `resolutionAcknowledged: true`, `decisionStatus:
   'rejected'`, `resolutionAcknowledgedBy: null`), which IS exact and specific. Left as-is;
   flagging is sufficient since it isn't the test's real proof.

2. `rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts`, D07 test:
   `expect(...statusCounts.safe ?? 0).toBeLessThanOrEqual(1)` — a loose upper bound that would
   ALSO pass on an undercount (0), which would actually mask a bug (redaction eating a KPI it
   shouldn't). **STRENGTHENED** (this file is in the allowlist, no `server/**` change needed) to
   an exact `toEqual({ safe: 1, warning: 0, critical: 0, missing: 0 })`. Reran the file after the
   change: still 6/6 green (see full-suite rerun above).

3. `rvn-g4-okr-alignment-no-score-inherit.e2e.test.ts`, Step 1 (alignment propose+accept):
   both assertions (`proposeOutcome.result.alignment.status).toBe('proposed')` and
   `acceptOutcome.result.status).toBe('accepted')`) were PURE command-echoes — nothing in the file
   ever independently re-read `okr_vnext_alignments` itself. A command that silently no-op'd but
   still returned a fabricated `{status:'accepted'}` would not have been caught by Step 1, and
   nothing downstream re-checks alignment existence either (Steps 2/3's core claim — no score
   inheritance — is actually independent of whether the alignment row is real, since
   `finalScoreOkrSet` scopes purely by `set_id`). **STRENGTHENED**: added a direct, independent DB
   readback of `okr_vnext_alignments` (source/target/relation/status) right after `acceptAlignment`
   — this table has no dedicated repository read function in this codebase (same precedent as this
   file's own `okr_vnext_reflections` direct reads). Reran: still 3/3 green.

**Mildly weak, left as-is (near-tautological but immediately cross-verified by a strong,
independent assertion in the same test — no realistic false-positive risk):**

4. `rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts`, Step 1:
   `expect(evidenceOutcome.result.kpiId).toBe(kpiId)` echoes an input value back — but the very
   next lines call `listBenefitEvidenceLinks` (an independent public-path read) and assert
   `kpiDetails!.kpiId).toBe(kpiId)` on the HYDRATED join result, which is the real proof.

5. `rvn-g4-roi-perspectives-parity.e2e.test.ts`, both steps:
   `individualView!.caseId).toBe(caseId)` / `individualAfter!.caseId).toBe(caseId)` — querying BY
   `caseId` and then checking the result has that `caseId` is close to tautological (a `WHERE
   case_id = $1` query returning a row with a different `case_id` would be a Postgres bug, not a
   product bug) — but every test also carries a strong cross-domain identity check
   (`orgRow!.caseId).toBe(individualView!.caseId)`, `orgRowAfter!.actualFinancialBenefits).toBe(
   authoritativeActualBenefits)` read straight from `rvn_roi_actual_snapshots`) that IS the real
   proof and is not tautological.

6. `rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts`, Step 4 (cold reopen):
   `expect(state.count, ...).toBeGreaterThan(0)` is a loose lower bound — but it's explicitly
   commented as a "not vacuous" sanity check, not the step's core claim (the core claim, hash+count
   equality, is already asserted with exact `toEqual` in Step 3).

7. `rvn-g4-security-negative-and-kpi-snapshot-lost-access.e2e.test.ts`, foreign-tenant test:
   `for (const sc of listForForeignOrg) { expect(sc.organizationId).toBe(ORG_B); }` is VACUOUS
   under this fixture — `ORG_B` never receives any scorecards in this test, so the loop body never
   executes. This is decorative, not load-bearing: the actual leak-detection assertions right after
   it (`listForForeignOrg.some((sc) => sc.scorecardId === scorecardId)).toBe(false)` and the
   `.name === '...'` variant) are NOT vacuous and ARE what Negative Control 3 proved catches a real
   leak. Left as-is — fixing the vacuity would require seeding a real ORG_B scorecard purely to make
   a decorative loop non-decorative, which is more machinery than the assertion is worth; flagging
   it here instead.

**Verdict on "how many of the 18 really light up":** of 18 tests, I'd call **14 fully load-bearing
with no reservations**, **2 strengthened just now** (D07 statusCounts, alignment readback — both
green after the change), and **2 with one cosmetically-weak line each that is not load-bearing
because a stronger assertion in the same test already carries the real proof** (mywork test 3's
`toBeGreaterThanOrEqual`, security file's foreign-tenant vacuous loop). Zero tests were found to be
ENTIRELY vacuous (i.e., would pass under any product behavior) — every one of the 18 has at least
one assertion that a plausible regression would break, and 3 of them are independently proven
load-bearing by the negative controls above.

No `server/**` file was touched for this addendum — only the two allowlisted test files were
strengthened.
