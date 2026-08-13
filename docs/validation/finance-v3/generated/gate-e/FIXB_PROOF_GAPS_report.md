# FIX-B — Proof-gaps closeout report

Gate E, Finance v3. Branch `codex/fv3p-fixb-proof-gaps`, worktree
`/Users/piotrwisniewski/consultify-wt/fv3p-h-valuation`.

**Start SHA:** `57fe0543cc` (clean tree).
**Final SHA:** `3d1c92d3c0`.

```
$ git diff --stat 57fe0543cc..3d1c92d3c0
 server/src/routes/v8/finance-v2/__tests__/cross-tenant.routes.pg.test.ts        | 15 +++---
 server/src/routes/v8/finance-v2/__tests__/export-import.routes.pg.test.ts       | 28 ++++++---
 server/src/routes/v8/finance-v2/__tests__/legacy-id-bridge.routes.pg.test.ts    | 151 ++++++++++++++++++++++++++++++++++++++++++++++++++++-
 server/src/routes/v8/finance-v2/__tests__/saved-views.routes.pg.test.ts         | 33 +++++++++++
 server/src/routes/v8/finance-v2/compute.routes.ts                              | 34 +++++++++++-
 server/src/routes/v8/finance-v2/export-import.routes.ts                        | 25 +++++++++
 server/src/routes/v8/finance-v2/saved-views.routes.ts                          | 12 +++++
 server/src/services/finance/canonical/computeJobService.ts                     | 71 +++++++++++++++++-------
 server/src/services/finance/canonical/savedViewService.ts                      | 22 +++++---
 tests/unit/finance/rawEnumLeakScanner.test.ts                                  | 76 ++++++++++++++++++++++++++
 10 files changed, 421 insertions(+), 46 deletions(-)
```

Three commits, one per LUKA, each with a green realDB/unit run at the time
it landed:

- `21cd47fd1b` — LUKA 2 (rawEnumLeakScanner directory slack)
- `3bcf660f4b` — LUKA 1 (cross-tenant QUARANTINED bridge coverage)
- `3d1c92d3c0` — LUKA 3 (uniform cross-tenant denial shape, 3 endpoints)

No files were skipped for collision reasons. `artifactVersionService.ts`
and `lifecycleService.ts` were **not edited** — `getArtifact` (an existing
export of `artifactVersionService.ts`) is only **imported and called** from
`saved-views.routes.ts`, the same read-only usage pattern
`savedViewService.ts` already had before this session.

---

## LUKA 1 — cross-tenant test only exercised the double-protected RESOLVED path

**File:** `server/src/routes/v8/finance-v2/__tests__/legacy-id-bridge.routes.pg.test.ts`
(tests #6, #7 added; header doc comment expanded).

### What was wrong

`resolveLegacyFinanceArtifact()` (`legacyIdBridgeService.ts`) has two
`organization_id` filters in series:

1. Query #1 — `SELECT * FROM finance_artifact_aliases WHERE legacy_table = ?
   AND legacy_id = ? AND organization_id = ?`.
2. Query #2 — only reached for `AUTO_MIGRATE`/`MIGRATE_WITH_WARNING` —
   `SELECT * FROM finance_artifacts WHERE artifact_id = ? AND
   organization_id = ?`.

The pre-existing cross-tenant test #4 inserts an `AUTO_MIGRATE` alias under
`otherOrgId` and queries from `orgId`. In the **unmutated** code, query #1's
own filter already excludes the row — query #2 is **never reached** by that
test. The `QUARANTINE`/`EXCLUDE_WITH_REASON` branch returns immediately
after query #1 with **no second query at all**, so it inherited the exact
same single-filter protection as the RESOLVED branch but had **zero test
coverage** of it.

### Fix

Added:

- **Test #6** — a `QUARANTINE` alias belonging to `otherOrgId`, queried from
  `orgId`, must resolve `NOT_MIGRATED` (never leak `mapping_reason`).
  Verified with an independent `pg.Client` (own TCP socket, never the app's
  `PostgresDatabase` pool) that the fixture row genuinely exists and
  genuinely belongs to `otherOrgId` before trusting the HTTP response.
- **Test #7** — locks in a **third, previously undocumented defense layer**
  discovered while designing test #6 (see below): `finance_artifact_aliases`
  carries `CONSTRAINT fk_finance_alias_artifact_org FOREIGN KEY (artifact_id,
  organization_id) REFERENCES finance_artifacts (artifact_id,
  organization_id)`. Test #7 proves, via a direct `pg.Client` `INSERT`, that
  this FK rejects an alias row whose own `organization_id` disagrees with the
  real owning org of its `artifact_id`.

No production code changed for LUKA 1 — `legacyIdBridgeService.ts` was
temporarily mutated for the negative control only, then restored (empty
diff, see below).

### Negative control

Removed `AND organization_id = ?` from query #1 only:

```diff
-      `SELECT * FROM finance_artifact_aliases
-       WHERE legacy_table = ? AND legacy_id = ? AND organization_id = ?
-       ORDER BY created_at DESC LIMIT 1`,
-      [legacyTable, legacyId, organizationId]
+      `SELECT * FROM finance_artifact_aliases
+       WHERE legacy_table = ? AND legacy_id = ?
+       ORDER BY created_at DESC LIMIT 1`,
+      [legacyTable, legacyId]
```

Result — **exactly reproducing the independent verifier's original
finding**:

- Test #6 (QUARANTINED) → **RED**. Leaked the other org's row:
  `{"status":"QUARANTINED","mappingConfidence":"QUARANTINE","reason":"other-org-secret-quarantine-reason"}`
  instead of `{"status":"NOT_MIGRATED"}`.
- Test #4 (RESOLVED, pre-existing) → **stayed GREEN**. Query #2's own,
  untouched filter alone still blocked it.
- All other tests in the file (1, 2, 3, 5, 7) → GREEN, unaffected.

Reverted via `git show 57fe0543cc:server/src/services/finance/canonical/legacyIdBridgeService.ts >
server/src/services/finance/canonical/legacyIdBridgeService.ts`. Confirmed
`git diff` empty. Re-ran: **7/7 GREEN**.

### Multi-layer defense — how many layers actually hold

For the **RESOLVED** branch specifically, there are **three** layers, not
two:

1. Query #1's `organization_id` filter.
2. **`fk_finance_alias_artifact_org`** (DB-level, composite FK) — makes it
   **impossible**, via any ordinary `INSERT`, for an alias's own
   `organization_id` to disagree with the real organization_id of the
   artifact it points at. Confirmed empirically: an attempt to construct a
   "dangling alias" (own org correct, `artifact_id` pointing at another
   org's artifact) for a would-be test #7 was **rejected by Postgres**
   before the HTTP layer was ever reached — this is why test #7 became a
   regression guard for the FK itself instead of the originally-planned
   "isolate query #2" test.
3. Query #2's `organization_id` filter.

Consequence: mutating query #2 **alone** (leaving query #1 intact) is **not
reachable by any legitimate cross-tenant request today** — query #1 + the FK
already exclude any alias whose linked artifact belongs to another org
before query #2 ever runs with mismatched data. Query #2's filter is
real and load-bearing only in the "query #1 already broken" scenario the
negative control above exercises (where it single-handedly saves the
RESOLVED branch). Documented in the test file's header comment so a future
reader does not assume query #2 is pulling weight it cannot exercise in
isolation while the FK stands.

For the **QUARANTINED** branch: only **one** layer (query #1's filter) — no
FK-backed second query exists for that branch, which is exactly why it was
the real gap.

---

## LUKA 2 — rawEnumLeakScanner had four files of slack in its threshold

**File:** `tests/unit/finance/rawEnumLeakScanner.test.ts`.

### What was wrong

`SCANNED_ROOTS` recurses `src/components/Finance/**`, guarded by a single
sanity check: `expect(files.length).toBeGreaterThanOrEqual(40)` (actual
count at the time it was raised: 44). An independent mutation run excluded
`Finance/Prediction/**` and `Finance/baseline/**` from `listTsxFiles`
(5 files removed at today's count) — the count dropped to 41, still
`>= 40` — and **all five tests in the file stayed GREEN**, silently losing
coverage of two entire directories.

### Fix

- Added a named, per-directory assertion —
  `EXPECTED_FINANCE_SUBDIRECTORIES` (11 entries: `Analysis`, `Prediction`,
  `Valuation`, `baseline`, `comments`, `compare`, `exportImport`,
  `lineage`, `savedViews`, `shared`, `statementPackWorkspaceV2`) — as the
  **real defense**. Kept the `>= 40` count only as a coarse, fast-failing
  smoke check per the brief's own reasoning ("liczba jest krucha").
- Documented the scanner's **fifth known blind spot**: it cannot catch a
  value that only exists as an API response body field (vs. a literal
  `.property` chain in the scanned source text). Illustrated with the ID
  BRIDGE's own `mapping_reason` (`legacyIdBridgeService.ts`,
  `resolveLegacyFinanceArtifact()` — LUKA 1 above) as the concrete example:
  if a future component renders `{resolution.reason}` raw, this scanner
  would not flag it, both because `reason` is not in
  `ENUM_PROPERTY_NAMES` and because the scanner has no way to know a
  runtime value originated from a typed API response at all.
- Found and triaged a **pre-existing** offender while widening the
  directory-list assertion: `Finance/Prediction/PredictionWorkspace.tsx:
  {mountCheck.version.status}`. Confirmed via `git show
  57fe0543cc:src/components/Finance/Prediction/PredictionWorkspace.tsx` that
  this line already existed at this session's own base commit — **not
  introduced by this pass**. Added to `KNOWN_UNFIXED_LEAKS` with a
  justification comment (out of scope for a proof-coverage task; a
  workspace file a parallel session may be mounting/editing concurrently,
  same collision class the pre-existing `FinancialStatementPackWorkspace.tsx`
  entry documents) rather than fixed in-place.

### Negative control

Added `'Prediction'` and `'baseline'` to `listTsxFiles`'s directory-skip
set (mirroring the original mutation):

```diff
-      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
+      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'Prediction' || entry.name === 'baseline') continue;
```

Result:

- New "discovers every directory Finance/** is currently known to contain"
  test → **RED**, correctly naming `Prediction` and `baseline` as the two
  missing directories.
- The old `>= 40` count check → **stayed GREEN** (41 >= 40) — proving the
  count alone would **not** have caught this regression.
- The `KNOWN_UNFIXED_LEAKS` staleness test also went RED (correctly — the
  now-excluded `PredictionWorkspace.tsx` offender was no longer detected).

Reverted the one-line mutation. Re-ran: **6/6 GREEN**.

---

## LUKA 3 — non-uniform cross-tenant denial shape on 3 endpoints

No leak and no write on any of the three endpoints (independently
confirmed below, same as the original finding) — the defect was a
**weak/inconsistent response-shape oracle**: a cross-tenant request could
land on a different status/shape than the uniform 404 the rest of the
`finance-v2` surface returns, letting a caller distinguish request classes
that should be indistinguishable.

### 3a. `POST /saved-views` — shape validated before ownership

**Files:** `savedViewService.ts` (`createSavedView`), `saved-views.routes.ts`
(POST handler), `__tests__/saved-views.routes.pg.test.ts` (2 new tests).

`createSavedView()` checked `NAME_REQUIRED` → `INVALID_FILTERS` →
`INVALID_GRID_VIEW_STATE` **before** the `getArtifact()` ownership check.
The router itself also validated `scope` enum membership and
`gridViewState` shape before ever calling the service. A cross-tenant
`artifactId` combined with an otherwise-malformed body (e.g. missing
`name`) surfaced as `400 NAME_REQUIRED` instead of the uniform
`404 ARTIFACT_NOT_FOUND` a well-formed cross-tenant body already got.

**Fix:** moved the `getArtifact()` ownership check to the top of both the
router handler (before the `scope`/`gridViewState` 400s) and the service
function (before `name`/`filters`/`gridViewState` validation) — belt and
suspenders, since `createSavedView` is a public function other future
callers might invoke directly.

**New tests** (both in the CROSS-TENANT section):
- well-formed body + foreign `artifactId` → `404 ARTIFACT_NOT_FOUND`, no row
  created (was already 404 before the fix — control case).
- **malformed** body (no `name`) + foreign `artifactId` → **same**
  `404 ARTIFACT_NOT_FOUND`, explicitly asserts `code !== 'NAME_REQUIRED'`.

**Negative control:** reverted `savedViewService.ts` +
`saved-views.routes.ts` to `57fe0543cc`. Result:
- Malformed-body cross-tenant test → **RED** (`400 NAME_REQUIRED` instead
  of `404`).
- Well-formed-body cross-tenant test → stayed GREEN (old code already
  reached the ownership check for a fully valid body).
- 16/17 other tests in the file unaffected.

Restored via `cp` from the pre-mutation fixed copies (both files were
edited together as one logical fix); confirmed `git diff --stat` matches
the intended fix and re-ran: **17/17 GREEN**.

### 3b. `POST /import/preview` — no ownership check existed at all

**Files:** `export-import.routes.ts` (`/import/preview` handler),
`__tests__/export-import.routes.pg.test.ts` (2 tests: 1 updated, 1 new).

`previewFinanceImport()` had **no `NOT_FOUND` branch whatsoever** — a
cross-tenant `businessVersionId` made every taxonomy lookup empty
(org-scoped SQL), so the response was always `200` with `data.ok: false`
and a manifest-organizationId mismatch — a weak oracle already documented
by the **pre-existing** cross-tenant test in this file (its own comment:
*"previewFinanceImport itself has no NOT_FOUND branch..."*).

**Fix:** added an ownership check directly in the route handler — `SELECT
business_version_id FROM finance_business_versions WHERE
business_version_id = ? AND organization_id = ? AND artifact_id = ?` —
**before** the `manifest`/`rows` shape checks and before calling
`previewFinanceImport()` at all. Scoped to all three of
(`businessVersionId`, `organizationId`, `artifactId`) together, mirroring
the same three-way check `applyFinanceImport()` already performs for the
same two ids.

**Tests:**
- Updated the pre-existing cross-tenant test to assert the new uniform
  `404 NOT_FOUND` (previously asserted the old `200`/`ok:false` shape —
  the exact behavior being fixed).
- Added a malformed-body variant (missing `rows`) proving the **same**
  `404 NOT_FOUND`, not `400 INVALID_BODY`.

**Negative control:** reverted `export-import.routes.ts` to `57fe0543cc`.
Both tests → **RED** (one still `200` diff-shaped, the malformed one
`400 INVALID_BODY`). Restored; re-ran: **11/11 GREEN**.

### 3c. `POST /compute/jobs` — raw 500 on cross-tenant FK violation

**Files:** `computeJobService.ts` (`enqueue`), `compute.routes.ts` (POST
handler), `__tests__/cross-tenant.routes.pg.test.ts` (1 test updated).

`enqueue()`'s `INSERT` relies on the composite FK
`fk_compute_jobs_artifact_org (input_artifact_id, organization_id)`. A
cross-tenant `inputArtifactId` (belongs to another org) has no matching
row, so Postgres rejects the insert — but the raw `error` propagated
through `asyncHandler` unhandled, producing a `500` with the raw FK
violation message. This was already documented as a **known defect** in
the pre-existing test's own comment (*"asyncHandler surfaces this as a 500
with the raw FK violation"*).

**Fix:** `enqueue()` now catches specifically `error.code === '23503'` +
`/fk_compute_jobs_artifact_org/` in the message and throws a new typed
`ComputeJobArtifactMismatchError` (`code: 'ARTIFACT_NOT_FOUND'`). Any other
insert failure still propagates unchanged. `compute.routes.ts` catches
that one error type and returns `404 ARTIFACT_NOT_FOUND` — the same shape
`GET /compute/jobs/:id` and `POST /compute/jobs/:id/cancel` already use for
their own cross-tenant denials in the same router.

**Test:** updated the pre-existing test's assertions from `expect(res.status).not.toBe(201); expect(res.status).not.toBe(200);`
to `expect(res.status).toBe(404); expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');`.

**Negative control:** reverted both `computeJobService.ts` and
`compute.routes.ts` to `57fe0543cc`. Result: that one test → **RED**
(status was `500`, not `404`); all 7 other tests in the file unaffected.
Restored; re-ran: **8/8 GREEN**.

### Blast-radius check

`enqueue()` and `createSavedView()` are both called from exactly one other
production call site class each:
- `enqueue()` — 5 self-service compute call sites
  (`baselineComputeService.ts`, `kpiComputeService.ts`,
  `predictionComputeService.ts` ×2, `valuationComputeService.ts`), all of
  which enqueue against their **own** org's artifact — the new error path
  is unreachable for them in normal operation, and the success-path return
  shape (`{job, wasExisting}`) is unchanged.
- `createSavedView()` — only called from `saved-views.routes.ts` (grep
  confirmed, `__tests__` excluded).

No other files reference `previewFinanceImport()` in production code
(`exceptionInboxService.ts` only has a doc comment mentioning it, no call).

---

## Test results

All commands run from the worktree, `NODE_ENV=test MOCK_DB=false
RUN_DB_TESTS=1 DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/fixb`
(cluster started via `/Users/piotrwisniewski/fv3-pg/newdb.sh fixb`, PG 15,
127.0.0.1:54330 only — zero connections to demo/staging/prod). Exit codes
read from `$?` after the command finished (never through a pipe), per the
brief's own warning about `PIPESTATUS`.

| Suite | Command (abbrev.) | Result | Time |
|---|---|---|---|
| LUKA 1 file alone | `vitest run .../legacy-id-bridge.routes.pg.test.ts --maxWorkers=2` | **7/7 PASS**, exit 0 | ~4.1s |
| LUKA 1 + both cross-tenant files | `vitest run legacy-id-bridge + cross-tenant + pkg-b2-cross-tenant --maxWorkers=2` | **24/24 PASS**, exit 0 | ~5.0s |
| LUKA 2 file alone | `vitest run tests/unit/finance/rawEnumLeakScanner.test.ts` | **6/6 PASS**, exit 0 | ~4.0s |
| LUKA 3 — cross-tenant.routes | `vitest run .../cross-tenant.routes.pg.test.ts --maxWorkers=2` | **8/8 PASS**, exit 0 | — |
| LUKA 3 — saved-views.routes | `vitest run .../saved-views.routes.pg.test.ts --maxWorkers=2` | **17/17 PASS**, exit 0 | — |
| LUKA 3 — export-import.routes | `vitest run .../export-import.routes.pg.test.ts --maxWorkers=2` | **11/11 PASS**, exit 0 | — |
| `tsc --noEmit -p server/tsconfig.json` | — | **clean**, exit 0 | — |
| **Full realDB run** (required by brief) | `vitest run server/src/routes/v8/finance-v2 server/src/services/finance/canonical --maxWorkers=2` | **62 files / 689 tests PASS**, exit **1** (see below) | 71.7s |
| Same run, `--maxWorkers=1` | same paths | **62 files / 689 tests PASS**, exit **0** | 100.0s |

**On the `--maxWorkers=2` exit code:** the `--maxWorkers=2` run passed
689/689 tests (**0 `FAIL` lines**) but exited 1 because of one **unhandled
rejection** during `initDb()` — two parallel worker processes racing to
create the same index (`idx_invitations_inviter`) during concurrent schema
initialization, `23505 duplicate key value violates unique constraint
"pg_class_relname_nsp_index"`. This is a known, environmental race in
concurrent schema init (unrelated to this session's three fixes — it fires
inside `coldReopen.pg.test.ts`'s `initDb()` call, a file untouched by this
pass) and disappears entirely at `--maxWorkers=1` (689/689, exit 0, no
errors at all). Reported per instructions rather than silently
re-run-until-green; not a regression from LUKA 1–3.

Database cleaned up: `dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski fixb`
run at session end.

---

## Not delivered / out of scope

- **LUKA 2's pre-existing `PredictionWorkspace.tsx` leak** — found, not
  fixed (documented above and in the test file itself). Fixing it is a
  one-line UI change but touches a workspace file that may be under
  concurrent edit by another session; out of scope for a proof-coverage
  task regardless.
- **No file in this pass required touching
  `server/src/services/finance/canonical/artifactVersionService.ts` or
  `lifecycleService.ts`** — no collision to report. `getArtifact` (an
  existing export of `artifactVersionService.ts`) was imported into
  `saved-views.routes.ts` for a read-only ownership check, the same pattern
  `savedViewService.ts` already used.
- **Query #2's org filter in `resolveLegacyFinanceArtifact()`** is real but
  currently unreachable in isolation (see LUKA 1's multi-layer section) —
  not a defect, documented rather than "fixed" (there is nothing to fix;
  the FK already makes the underlying data state impossible).
