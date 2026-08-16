# Consultify cleanup current state — 2026-08-16

## Authority

This is the only current operational state for the repository recovery. Earlier
cleanup snapshots and five-hour plans are historical evidence.

## Literal status

- Cleanup: `IN_PROGRESS`
- Canonical candidate: `PARTIAL / STATIC_REALDB_AND_MODULE_MOUNT_GATES_GREEN`
- Demo: `NOT_VERIFIED`
- Production: `NOT_AUTHORIZED / NOT_VERIFIED`

## Frozen source tree

- Path: `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify`
- Branch: `codex/sync-demo-20260729`
- Frozen HEAD observed before recovery: `869f9c322c61f01030c2900ea9c79ff046707f00`
- Role: immutable recovery evidence; do not merge from this worktree as a unit
- Last measured state: 186 tracked changes, 199 collapsed untracked entries,
  zero unmerged index entries. The untracked count is not a file denominator.

## Canonical candidate

- Path: `/Users/piotrwisniewski/Developer/consultify-recovery-canonical-20260816`
- Branch: `codex/recovery-canonical-20260816`
- Baseline: `origin/demo` at `e45904dc7940f259b9cf017c283264d5c166c9ab`
- Current committed checkpoint before this state update: `1f80643998b777722e0d2730dfa3f93705478cc8`
- Recovery control-plane commit: `844001c525`
- Integrated packages: Assessment (fast-forward ancestry), Tools (49
  patch-unique non-merge commits) and Audits (34 patch-unique non-merge
  commits), all replayed without merging the source branch heads
- Tools pre-integration recovery point: branch
  `codex/recovery-pre-tools-20260816` at `2706985e9a`
- Worktree state before this document update: clean

## Current gate result

Assessment and Tools are present but not fully runtime-accepted. `git diff --check
e45904dc7940..031772082b7d` reports whitespace failures in captured HTTP/SQL log
evidence under `docs/qa/a9-2026-08-13/`. These are evidence-file hygiene defects,
not a product-code verdict, but the repository-wide diff gate is not green.

Assessment also retains product gaps recorded in its own handoff:

- Library to Method Session creation is missing;
- `assessment_definitions`, `method_packs`, and client feature flags are not one
  coherent source of truth;
- historical browser evidence does not replace a fresh run on this candidate.

Fresh checks on this candidate:

- `npm ci --ignore-scripts`: PASS; 2075 packages installed, lockfile unchanged.
- Dependency audit emitted 52 vulnerabilities: 4 low, 12 moderate, 35 high,
  1 critical. No automatic dependency mutation was performed.
- `npx vitest run src/method-core src/components/assessment ...`: 48 test
  files PASS, 10 SKIPPED; 394 tests PASS, 158 SKIPPED. The skipped denominator
  includes real-PostgreSQL/HTTP tests and therefore remains evidence missing.
- `npm run type-check`: initially failed with six candidate errors; fixed in
  `8c0e29ae56`, then PASS.
- Focused regression after the fix: 3 files PASS, 19 tests PASS.
- Tools focused verification: 13 files PASS, 482 tests PASS. React `act(...)`
  warnings remain test-harness debt, not failed assertions.
- Tool-session synchronization regression: 1 file PASS, 14 tests PASS.
- Test discovery manifest regenerated from the integrated candidate: 4964 of
  4964 files classified; discovery gate PASS. Classification is 4665 ACTIVE,
  290 PLAYWRIGHT, 7 INTENTIONALLY_EXCLUDED, 1 LEGACY and 1 explicit
  BROKEN_ORPHAN (`tests/e2e/security-cookie-auth.spec.ts`).
- Full `npm run type-check` after Tools integration: PASS after three boundary
  typing fixes committed in `59d6d0d85c`.
- Full `npm run type-check` after Audits integration: PASS.
- Test discovery after Audits: 4996/4996 classified; 4697 ACTIVE, 290
  PLAYWRIGHT, 7 INTENTIONALLY_EXCLUDED, 1 LEGACY, 1 BROKEN_ORPHAN; PASS.
- The earlier Audits result (27 failed, 45 skipped) used an invalid ambient
  `iris` target and is retained only as negative-control evidence. On the
  isolated disposable PostgreSQL database the complete selected Audits
  denominator passed: 32/32 files and 259/259 tests, with no skips. The run
  initially exposed a soft-failing `audit_events` dual-schema write path.
  Commit `ff2d3dfd8e` now preserves unknown/external actors through the legacy
  compatibility columns while populating canonical action/resource fields.
  Full type-check and the complete 32-file/259-test Audits denominator passed
  again; catalog readback showed 16 events with canonical actions, including
  one compatibility-actor event.
- A disposable `pgvector/pgvector:pg16` instance on port 32900 built a database
  from zero with all 702 then 703 strict migrations; both idempotent reruns
  applied zero migrations. Commit `51d9c48b98` makes the CW-P01..P11 dependency
  order explicit and its focused deterministic regression passed.
- The first full Tools realDB run passed 12/12 files and 100/100 tests but
  surfaced missing runtime columns on fresh schema. Additive migration
  `20260816_recovery_runtime_schema_parity.sql` in `4cd5d54317` repaired
  `organizations` context/MFA columns and `initiatives.source_report_id`.
  A second database rebuilt from zero applied 703/703 migrations, reran with
  zero pending, and the full Tools denominator again passed 12/12 and 100/100.
  Initiative quality advisories (10/10 checks failed for synthetic proposals)
  remain explicit product-quality debt; feature flags remain OFF.
- The fresh real-PostgreSQL browser gate initially found two real defects:
  backend `tsx` could not resolve client-only `@/` aliases in the shared SWOT
  output builder, and the browser fixture omitted the now-mandatory CAS
  `expectedVersion`. Commit `b214207c9c` repairs both. On a new 703-migration
  database, Chromium then passed both durable SWOT journeys: deep-link/edit/
  autosave/hard-reload and submit/approve/freeze/immutable-reload (2/2 PASS).
- Case source `adf77cb833ec` is classified `ALREADY_PRESENT / KEEP_EVIDENCE`:
  all 782 source files exist in the candidate, and its 110 dedicated services,
  39 routes, 19 UI files and 19 migrations are byte-identical. Replay allowlist
  is empty; verification remains open.
- Artifact Studio source `64715cdd3751` initially appeared to contain five
  patch-unique commits because patch identity diverged. Tree-level reconciliation
  proved that 44/48 touched paths are byte-identical and the remaining four are
  intentionally newer in the candidate (test-discovery/CAS dependencies,
  spreadsheet markup cleanup and nested accessible context menus). It is now
  `ALREADY_PRESENT / KEEP_EVIDENCE`; replay allowlist is empty. Its focused
  source-derived suite passed 145/145 assertions across 15 files after rebuilding
  the locally skipped sqlite3 native binding (131 plus 14 approval assertions).
- A production-route Chromium mount gate now passes 2/2 against the fresh
  703-migration PostgreSQL database: Assessment and Audits each render their
  five canonical surfaces at the real authenticated application route. The
  first attempt was rejected as invalid because AppProviders ignored the test's
  local flag overrides. The accepted run uses the explicit, staging-only
  `VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true` switch; production remains
  fail-closed by default. This proves route/mount/tab truth, not the complete
  create/edit/freeze/readback golden journeys.
- Results final fan-in is `5afefe8bb82fc1791c7f72c8c64a8205abd87f00`,
  not the older `8b03e2dba590` handoff. Tree reconciliation found the dedicated
  Results runtime already present. All 954 source-only paths are historical
  QA screenshots/evidence; the 23 evolved paths preserve later route, flag,
  migration, ROI-engine and shared-integration work. Replay allowlist is empty.
- Finance final fan-in is `c78086057d38f57c5351c6254d41f02fd50246b6`.
  Dedicated implementation is already present: 125/127 Finance components,
  72/73 Economics components and 120/122 Finance service files are identical;
  remaining differences are later candidate evolution. Replay allowlist is
  empty. Runtime spine, flag rollout, version identity and Results seam still
  require proof before runtime acceptance.
- Commit hooks reported no new list, TRIADA, density, focus, or artifact-shell
  regression in the changed files. Existing repository-wide focus debt remains.

## Repository scale

- Local branches: 1268
- Remote branches: 189
- Registered worktrees after candidate creation: 352
- Unique worktree tip SHAs: 251
- Worktrees sharing duplicate tips: 130
- Local branches not merged into the baseline: 749

These numbers describe duplicated execution history, not 749 unique product
features. No bulk branch or worktree deletion is authorized by these counts.

## Storage condition

- `.git` was measured at about 21 GiB, including about 19.5 GiB of packfiles.
- Root and server `node_modules` were selected for removal because they are
  reproducible dependencies, not evidence. Removal is being performed only to
  recover working capacity.
- Do not run `git gc` while free space is constrained or before branch/worktree
  recovery classification is complete.

## Next gate

1. Extend the green Assessment/Audits route-and-mount proof into their complete
   create/edit/freeze/readback browser journeys. Tools has one green real-
   PostgreSQL Chromium slice, but its remaining quality/provider gates and
   feature-flag decision stay open.
2. Reconcile the synthetic initiative quality advisories without weakening
   assertions.
3. Resolve the one explicit broken orphan and the Assessment immutable-log
   `diff --check` policy without rewriting evidence silently.
4. Verify already-present Case, Artifact, Results and Finance browser/realDB
   closure. Results/Finance require no code replay, but their mount/data/spine
   and owner decisions remain literal blockers.
