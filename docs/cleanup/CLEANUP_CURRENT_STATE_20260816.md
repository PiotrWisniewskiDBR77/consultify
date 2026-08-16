# Consultify cleanup current state — 2026-08-16

## Authority

This is the only current operational state for the repository recovery. Earlier
cleanup snapshots and five-hour plans are historical evidence.

## Literal status

- Cleanup: `IN_PROGRESS`
- Canonical candidate: `PARTIAL / STATIC_GATES_GREEN / RUNTIME_EVIDENCE_MISSING`
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
- Current verified implementation checkpoint: `59d6d0d85c`
- Recovery control-plane commit: `844001c525`
- Integrated packages: Assessment (fast-forward ancestry) and Tools (49
  patch-unique, ordered non-merge commits replayed selectively)
- Tools pre-integration recovery point: branch
  `codex/recovery-pre-tools-20260816` at `2706985e9a`
- Worktree state before this document update: clean

## Current gate result

Assessment and Tools are present but not runtime-accepted. `git diff --check
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

1. Run Tools fresh strict PostgreSQL migrations and realDB suites; do not infer
   runtime readiness from the 482 unit/component tests.
2. Resolve the one explicit broken orphan and the Assessment immutable-log
   `diff --check` policy without rewriting evidence silently.
3. Reconcile Audits selectively; do not merge its branch head.
4. Reconcile Case/Artifact, then the owner-gated Results/Finance packages.
