# Cleanup Plan Branches Worktrees Approval First - 2026-05-16

## Safety Rule

No deletion of branches, worktrees, directories, or snapshots is allowed before explicit final approval.

This plan is preparation-only.

## Scope

- Repository: `DRD/consultify`
- Includes:
  - local branches,
  - remote-tracking branches,
  - git worktrees,
  - detached/prunable worktree entries.
- Excludes:
  - any destructive execution.

## Current Observations (snapshot)

- Active working branch in `DRD/consultify`: `cto/demo-integration-2026-05-15`
- Working tree contains uncommitted changes and one untracked report file.
- Multiple worktrees exist under `.cursor/worktrees/*` and local `DRD/*` directories.
- There are detached and prunable worktree entries that likely belong to finished agent sessions.

## Classification Model

Every branch/worktree must be classified before cleanup:

1. `KEEP_ACTIVE`
   - currently used for active delivery/testing.
2. `KEEP_REFERENCE`
   - historical but needed for comparison/recovery.
3. `CANDIDATE_ARCHIVE`
   - likely obsolete but not yet approved for cleanup.
4. `CANDIDATE_REMOVE`
   - safe-to-remove candidate after explicit approval.

## Approval Workflow

1. Build inventory tables (branch + worktree + owner + last commit + category).
2. Mark every row with proposed action:
   - `KEEP`
   - `ARCHIVE_THEN_REMOVE`
   - `REMOVE`
3. Review with owner (you) and approve row-by-row or in batches.
4. Execute cleanup in small batches only after approval.
5. Re-run inventory and confirm no accidental loss.

## Execution Batches (for post-approval phase)

Planned order (when approved):

1. Remove clearly stale detached/prunable worktree entries.
2. Remove agent-generated worktrees no longer needed.
3. Remove corresponding local branches not used by active worktrees.
4. Optionally prune stale remote-tracking refs.

## Manual Test Readiness Guardrail

Cleanup execution must wait until:

- manual test readiness pack is accepted,
- in-flight test evidence is persisted in docs,
- no active branch required by BO test execution is removed.

## Validation Checklist (post-approval execution)

- `git worktree list` matches approved target state.
- `git branch -vv` matches approved target state.
- active branch and working directory remain intact.
- no required artifacts or reports are missing.

## Decision Log (to fill during approval)

| itemType | itemName | currentState | proposedAction | approval |
|---|---|---|---|---|
| branch | _fill_ | _fill_ | _fill_ | _pending_ |
| worktree | _fill_ | _fill_ | _fill_ | _pending_ |
