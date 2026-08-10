# ROI-E007 Stream B rewrite — Finance-side adapter over the canonical ROI/Finance seam

Status: implemented and **EXECUTED against a real, fully-migrated PostgreSQL
17.9** — 4/4 tests pass, including the core Decision-D4 survival test. No
adapter code changes were needed to make them pass. Proven non-vacuous by a
two-mutation negative control (see "Test execution" below).

Base commit: `c2ff92ac8b9bf522c7d19a54ef2a3fbf58da4599`
(`codex/finance-v3-roi-e007-integration`, worktree
`codex/finance-v3-roi-e007-streamB-rewrite`).

## Scope

A Finance-side adapter over the **canonical** Results vNext ROI/Finance seam.
It does not redefine or duplicate the seam's tables/SQL — `rvn_roi_finance_links`
and its repository/command layer are owned by Results vNext (ROI-E007) and
already exist:

- Schema: `server/migrations/20260820_rvn_roi_finance_seam.sql`
  (`rvn_roi_finance_links`: `link_id` UUID PK, `case_id` FK → `rvn_roi_cases`,
  `organization_id`, `finance_artifact_type`/`finance_artifact_id`/
  `finance_version_id` as plain TEXT with **no FK** — Decision D4 — plus
  `mapping_version`, `source`, `as_of`, `semantic_unit`, `currency`,
  `link_purpose`, `linked_by`/`linked_at`, `row_version`, `created_by`/
  `created_at`/`updated_at`). No freeze/append-only trigger — rows are
  DELETEable by design.
- Canonical write: `server/src/services/resultsVnext/roi/roiFinanceLinkCommands.ts`
  (`createRoiFinanceLink`, `removeRoiFinanceLink`).
- Canonical read: `server/src/services/resultsVnext/roi/roiFinanceLinkRepository.ts`
  (`listRoiFinanceLinks`, `getRoiFinanceLink`, plus the reconciliation-table
  siblings).
- Shared types: `server/src/services/resultsVnext/roi/roiFinanceSeamTypes.ts`
  (`RoiFinanceLink`/`RoiFinanceLinkRow`, `toRoiFinanceLink`).

None of the above were modified. Finance-side reads use the existing Gate C
canonical services (`server/src/services/finance/canonical/artifactVersionService.ts`
— `getArtifact`, `getBusinessVersion`), also unmodified.

## Files delivered (allowlist)

1. `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts` (NEW)
2. `server/src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts` (NEW)
3. `docs/validation/finance-v3/generated/gate-d/ROI_E007_streamB_rewrite_report.md` (this file, NEW)

No other files touched — `server/migrations/`, `server/src/services/resultsVnext/**`,
`server/src/routes/**` are all untouched (verified via `git status`/`git diff`
against the allowlist below).

## Exported functions (exact signatures)

All in `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts`.

### `linkFinanceArtifactToRoiCase(params: LinkFinanceArtifactToRoiCaseParams): Promise<RoiFinanceLink>`

```ts
export interface LinkFinanceArtifactToRoiCaseParams {
  organizationId: string;
  caseId: string;
  financeBusinessVersionId: string;      // finance_business_versions.business_version_id
  mappingVersion?: number;
  source: string;
  semanticUnit?: string | null;
  currency?: string | null;
  linkPurpose: string;
  linkedBy: string;
  asOf?: string;                          // defaults to now()
  // Additive beyond the task's literal param list — required by the
  // canonical command's AtomicEventInput envelope; optional here with
  // safe defaults (see file header comment for the full rationale):
  actorEffectiveRole?: string;            // default: 'finance_adapter'
  idempotencyKey?: string;                // default: randomUUID()
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}
```

Behavior, in order:
1. **(a)** `artifactVersionService.getBusinessVersion(organizationId, financeBusinessVersionId)`
   — an application-layer existence check, never a DB FK (Decision D4). Throws
   `FinanceBusinessVersionNotFoundError` (`code: 'FINANCE_BUSINESS_VERSION_NOT_FOUND'`)
   **before** the canonical command is ever called if the row does not exist.
2. **(b)** `artifactVersionService.getArtifact(organizationId, businessVersion.artifact_id)`
   to resolve Finance's own `artifact_type`. Throws
   `FinanceArtifactNotFoundError` (`code: 'FINANCE_ARTIFACT_NOT_FOUND'`) in the
   defensive/should-be-unreachable case where that also fails to resolve.
3. **(c)** Delegates the actual write to
   `roiFinanceLinkCommands.createRoiFinanceLink({ ..., financeArtifactType:
   artifact.artifact_type, financeArtifactId: artifact.artifact_id,
   financeVersionId: financeBusinessVersionId, ... })` — no local INSERT.
   Returns `outcome.result` (the canonical `RoiFinanceLink` DTO).

### `getFinanceContextForLink(linkId: string): Promise<FinanceContextForLink>`

```ts
export type FinanceContextForLink =
  | { status: 'OK'; link: RoiFinanceLink; businessVersion: BusinessVersionRow; artifact: ArtifactRow | null }
  | { status: 'FINANCE_VERSION_NOT_FOUND'; link: RoiFinanceLink }
  | { status: 'LINK_NOT_FOUND' };
```

Reverse direction: loads the `rvn_roi_finance_links` row by `link_id` (a
direct primary-key `SELECT`, not a duplicate of the visibility-scoped
`getRoiFinanceLink` — see the in-file comment on `loadRoiFinanceLinkById` for
why: that repository function needs `{userId, caseId}` for its ABAC join,
which this function's task signature — `linkId` alone — does not have), then
resolves `link.financeVersionId` fresh via `getBusinessVersion`. If Finance
no longer has that exact row, returns `'FINANCE_VERSION_NOT_FOUND'` — never
throws, never crashes, never silently follows to a newer/"current" version.
`'LINK_NOT_FOUND'` covers the case where the `link_id` itself does not exist.

### `listFinanceLinksForCase(organizationId: string, caseId: string, userId: string): Promise<RoiFinanceLink[]>`

Thin wrapper over `roiFinanceLinkRepository.listRoiFinanceLinks({ userId,
organizationId, caseId })`. **Deviation from the task's literal 2-arg
signature**: `userId` was added as a required third parameter. The canonical
repository this wraps enforces visibility (§B.4 CTE over
`rvn_visible_resources`, `resource_type='roi_case'`) by `(userId,
organizationId)`, not by `(organizationId, caseId)` alone — dropping `userId`
here would force either a visibility bypass (an unscoped list) or a second,
divergent hand-rolled SQL query duplicating the canonical repository's own
CTE, both explicitly disallowed by the task brief ("nie duplikuje ich SQL").
A caller with no real end-user context should pass a service-account id that
carries an RBAC-override capability.

### Errors

- `FinanceBusinessVersionNotFoundError` — `code: 'FINANCE_BUSINESS_VERSION_NOT_FOUND'`, `details: {organizationId, financeBusinessVersionId}`
- `FinanceArtifactNotFoundError` — `code: 'FINANCE_ARTIFACT_NOT_FOUND'`, `details: {organizationId, artifactId}`

## Test coverage (`roiFinanceLinkAdapter.pg.test.ts`)

Real-Postgres suite, gated identically to every other `.pg.test.ts` in this
repo (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`,
`describe.skipIf`). Fixture setup per run: one organization, one
`initiatives` row, one `domain='roi'` `OPEN_ORG` visibility policy (required
by `createRoiCase`'s fail-closed guard), one `rvn_roi_cases` row via the
canonical `roiCaseCommands.createRoiCase`.

4 `it()` blocks:

1. **Happy path** — creates a Finance `HISTORICAL_ANALYSIS` artifact, drives
   its `finance_business_versions` row DRAFT → READY_FOR_REVIEW → IN_REVIEW →
   APPROVED (same T2→T4→approve sequence `canonicalServices.pg.test.ts`
   already proves), calls `linkFinanceArtifactToRoiCase`, asserts the
   returned `RoiFinanceLink`'s `financeArtifactType`/`financeArtifactId`/
   `financeVersionId` match what Finance actually has.
2. **Validation-before-command** — calls `linkFinanceArtifactToRoiCase` with
   a random, nonexistent `financeBusinessVersionId`; asserts it rejects with
   `FinanceBusinessVersionNotFoundError`/`FINANCE_BUSINESS_VERSION_NOT_FOUND`
   and that **no** `rvn_roi_finance_links` row was created for that id (the
   canonical command was never reached).
3. **`getFinanceContextForLink` on an unknown id** — asserts
   `{status: 'LINK_NOT_FOUND'}`.
4. **The core Decision-D4 survival test** (the scenario the task explicitly
   asked for): creates a second `HISTORICAL_ANALYSIS` artifact, approves v1,
   links it, confirms `getFinanceContextForLink` resolves to v1/`APPROVED`.
   Then calls `artifactVersionService.reopenVersion(v1)` → v2 (`DRAFT`,
   `parent_version_id=v1`) and drives v2 to `APPROVED` too (which triggers T9:
   v1 flips from `APPROVED` to `SUPERSEDED`). Asserts:
   - the link's `financeVersionId` is **still v1** (never rewritten to v2 —
     no coupling, no trigger, exactly Decision D4's claim);
   - `getFinanceContextForLink` **still resolves to v1**, not v2;
   - the resolved `businessVersion.status` is now `SUPERSEDED` — a **fresh**
     read reflecting v1's real current state, not a cached/stale snapshot
     taken at link-creation time.
   - `listFinanceLinksForCase` includes the link.

## Test execution — REAL PostgreSQL (2026-08-10)

The previous revision of this report said the suite was "not executed against
a live Postgres" and cited a blanket ban on standing up an ephemeral cluster.
**That reading was wrong** — the restriction was on touching *other sessions'*
running clusters (ports 5432/28711/52824/57900/28933), not on creating an own
throwaway one. The suite has now actually been run.

### Cluster

- PostgreSQL **17.9** (Homebrew, `/opt/homebrew/opt/postgresql@17`), a
  purpose-built throwaway cluster owned by this session only.
- `initdb --locale=C --encoding=UTF8 --auth=trust`, data dir
  `/private/tmp/pgroi-e007/data`, socket `/tmp/pgroi`, TCP
  `127.0.0.1:58211` (port confirmed free with `lsof -i:58211`; 58211 was
  chosen after an unrelated SSH tunnel grabbed the first candidate port
  between the free-check and the bind), database `roi_e007`.
- macOS gotcha worth recording: the postmaster refuses to start with
  `FATAL: postmaster became multithreaded during startup` unless `LC_ALL=C`
  is exported for the **`pg_ctl start`** call too, not only for `initdb`.
- Torn down at the end of the session (`pg_ctl stop -m immediate` +
  `rm -rf /private/tmp/pgroi-e007 /tmp/pgroi`). Nothing was written to any
  shared/demo/staging/prod database.

### Migrations

Full project migration set, strict mode (no `--safe`, so any failure aborts
with a non-zero exit):

```bash
DB_TYPE=postgres NODE_ENV=test \
DATABASE_URL="postgresql://postgres@127.0.0.1:58211/roi_e007" \
npx tsx server/scripts/migrate.postgres.ts
```

- `Applying migrations: 623` → `✅ Postgres migrations complete`, **exit 0**.
- **623 migrations applied, 0 errors, 0 skipped** (`grep -ciE
  "error|failed|skipped"` over the run log → `0`); `SELECT count(*) FROM
  schema_migrations` → **623**.
- Resulting schema: **1577 tables** outside `pg_catalog`/`information_schema`.
- Every table this suite depends on verified present via `to_regclass`:
  `rvn_roi_finance_links`, `finance_business_versions`, `finance_artifacts`,
  `rvn_roi_cases`, `rvn_platform_visibility_policies`, `organizations`,
  `initiatives`. Both migrations named in the task brief
  (`20260815_rvn_roi_core.sql`, `20260820_rvn_roi_finance_seam.sql`) and the
  whole `20260809_finance_v3_*` family applied without incident — i.e. a
  fresh schema *does* converge for this slice.

### Running the suite

Correction to the invocation printed in the previous revision (and in the
test file's own header): `server/vitest.config.ts` declares
`include: ['src/**', 'tests/**']` with **no `root`**, so running it from the
repo root resolves those globs against the repo root and reports
`No test files found, exiting with code 1` — a silent no-op that could easily
be mistaken for "nothing to run". The suite must be invoked **from `server/`**:

```bash
cd server
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:58211/roi_e007 \
npx vitest run --config vitest.config.ts \
  src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts \
  --no-file-parallelism --reporter=verbose
```

### Results — 4/4 PASS

`Test Files 1 passed (1)` · `Tests 4 passed (4)` · duration **811 ms**
(transform 277 ms, import 36 ms, tests 592 ms). Not skipped: the run log
shows the real pool coming up (`[Postgres] Connection test successful
(PostgreSQL verified)`, `database: roi_e007`) and each `it()` reporting a
real duration.

| # | Test | Result | Time |
|---|------|--------|------|
| 1 | `linkFinanceArtifactToRoiCase` resolves `financeArtifactType`/`financeArtifactId` and delegates to the canonical command | PASS | 25 ms |
| 2 | rejects a nonexistent `financeBusinessVersionId` BEFORE the canonical command (no row created) | PASS | 3 ms |
| 3 | `getFinanceContextForLink` returns `LINK_NOT_FOUND` for an unknown link id | PASS | 1 ms |
| 4 | **Decision D4**: after reopen + re-approve, the link stays pinned to v1 (never moves to v2) and resolves fresh as `SUPERSEDED` | PASS | 151 ms |

**No adapter fixes were required** — `roiFinanceLinkAdapter.ts` passed
unmodified on the first real run. `git diff` against the committed version is
empty.

### Negative control (anti-false-green)

A green suite on a first run is exactly the shape of a vacuous test, so the
adapter was deliberately mutated twice and the suite re-run:

1. **NC1** — removed the `FinanceBusinessVersionNotFoundError` throw in
   `linkFinanceArtifactToRoiCase` (returned a stub link instead). → Test 2
   went red: `AssertionError: promise resolved "{ linkId: 'nc1', …(2) }"
   instead of rejecting`.
2. **NC2** — made `getFinanceContextForLink` follow the artifact's *newest*
   `finance_business_versions` row instead of the pinned `financeVersionId`
   (i.e. the exact coupling Decision D4 forbids). → Test 4 went red on the
   business-version-id equality assertion.

Result of the mutated run: `Tests 2 failed | 2 passed (4)` — each mutation
reddened precisely its intended test and nothing else. The adapter was then
restored byte-identically (`git diff --stat` empty) and the suite re-run to
the 4/4 pass recorded above.

## Commit

Files committed on `codex/finance-v3-roi-e007-streamB-rewrite`:
- `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts`
- `server/src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts`
- `docs/validation/finance-v3/generated/gate-d/ROI_E007_streamB_rewrite_report.md`

See the git log on this branch for the commit SHA (created after this report
was written, so it is not self-referential here — read it with
`git log --oneline -1` on this branch).
