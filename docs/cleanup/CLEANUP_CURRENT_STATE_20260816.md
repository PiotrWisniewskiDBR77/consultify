# Consultify cleanup current state — 2026-08-16

## Authority

This is the only current operational state for the repository recovery. Earlier
cleanup snapshots and five-hour plans are historical evidence.

## Literal status

- Cleanup: `IN_PROGRESS`
- Canonical candidate: `PARTIAL / NOT_INTEGRATION_READY`
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
- Current HEAD: `031772082b7d4925e11986016079d02adeb17382`
- Integrated package: Assessment, fast-forward ancestry only
- Candidate divergence from baseline: 156 commits ahead, zero behind
- Worktree state before this document update: clean

## Current gate result

Assessment is present but not accepted. `git diff --check
e45904dc7940..031772082b7d` reports whitespace failures in captured HTTP/SQL log
evidence under `docs/qa/a9-2026-08-13/`. These are evidence-file hygiene defects,
not a product-code verdict, but the repository-wide diff gate is not green.

Assessment also retains product gaps recorded in its own handoff:

- Library to Method Session creation is missing;
- `assessment_definitions`, `method_packs`, and client feature flags are not one
  coherent source of truth;
- historical browser evidence does not replace a fresh run on this candidate.

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

1. Commit this control layer on the candidate.
2. Separate Assessment product commits from evidence-only/harness material where
   necessary and resolve the diff-check policy for immutable captured logs.
3. Run scoped static and test gates after dependencies are restored.
4. Reconcile Tools selectively, then Audits; do not merge their branch heads.

