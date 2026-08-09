# Consultify pre-rebuild repository hygiene report

Date: 2026-08-09 (Europe/Warsaw)

## Executive status

Status: **RECONCILIATION CANDIDATE BUILT; NOT YET PROMOTED**

The deployed demo is healthy, but GitHub `origin/demo` does not currently describe the deployed runtime. A clean two-parent reconciliation candidate now combines the latest GitHub demo tip with the exact Railway runtime SHA. The active Documents / Artifact Studio work remains isolated and has not been modified by this cleanup.

## Canonical coordinates

| Surface | Reference | SHA | State |
|---|---|---:|---|
| GitHub demo | `origin/demo` | `bf29e98a3d8a0c40bf822d8c79f817a679c30695` | one commit beyond the historical common base |
| Railway demo runtime | `https://demo.consultify.ai` | `37f835ccfd5e49462986ed95f8285ef1b04dc59d` | healthy; DB and Redis connected; readiness green |
| Reconciliation candidate | `codex/pre-rebuild-cleanup-20260809` | `957a820d6db5aa1db435b941402a664b4d268af4` | clean two-parent merge; local only |
| Active Documents WIP | `codex/sync-demo-20260729` | `9c23e3d80ece...` plus dirty worktree | protected; do not reset, stash, clean, or merge blindly |

The reconciliation merge has parents `bf29e98a3d` and `37f835ccfd`. Its only textual conflict was `src/components/Economics/FinanceHub.tsx`; it was resolved in favor of the newer GitHub demo decision that FinanceHub tabs remain list-only and tools open inside the selected record workspace.

## Runtime evidence

- Railway project/environment/service: `consultify` / `demo` / `consultify`.
- Deployment status: `SUCCESS`; 1/1 replica running.
- Deployment id: `9fbe9911-7956-4532-afca-ef676746ae45`.
- `/api/health`: application healthy, PostgreSQL connected, Redis connected, runtime SHA `37f835ccfd5e49462986ed95f8285ef1b04dc59d`.
- `/api/ready`: ready; migrations report `0 applied`, `454 already up to date`.
- No Railway mutation, deployment, database mutation, push, or remote branch update was performed in this audit.

## Local repository condition

- 883 local branches and 178 origin refs exist.
- 410 local branches are not ancestors of `origin/demo`; this count is discovery data, not proof that 410 branches contain promotable work.
- 34 linked worktrees exist.
- The active root worktree contains 415 changed/untracked paths and is being used by the Documents agent.
- Several historical/recovery worktrees are also dirty. They must be classified by ownership and evidence before removal; a clean-looking old branch is not automatically disposable.
- `origin/main` is not a usable source of truth for the demo line: demo is thousands of commits ahead, while main has a small divergent tail.

## Classification and cleanup policy

### CANONICAL CANDIDATE

`codex/pre-rebuild-cleanup-20260809` is the only clean local candidate intended to reconcile GitHub demo and deployed demo. It must pass current gates before any push or deployment decision.

### ACTIVE WIP — PROTECTED

The root Documents / Word / Excel / PowerPoint worktree is active. Its uncommitted changes must first be delivered as a bounded, reviewed package and then replayed onto the reconciliation candidate. Until that handoff exists, local and remote truth cannot be declared fully unified.

### REVIEW / QUARANTINE

All dirty historical worktrees, recovery branches, branches with unique commits, and abandoned experiments require a record with owner, base SHA, unique commit range, dirty-path count, evidence status, and one disposition: integrate, preserve, or quarantine. Quarantine means retained outside the canonical release line, not silently deleted.

### SAFE CLEANUP

Only worktrees that are clean, have no live task, and whose commits are reachable from an accepted canonical branch may be removed automatically. Dirty or ambiguous worktrees are excluded from automatic cleanup.

## Gates before four large rebuilds

1. Finish and accept the active Documents package on its exact SHA.
2. Rebase or replay that bounded package onto this clean reconciliation candidate.
3. Run typecheck, backend build, frontend build, targeted regression, strict fresh-schema/read-only demo preflight, and negative tenant/permission controls.
4. Push a reviewed candidate branch, then fast-forward `demo` only after explicit approval and green gates.
5. Confirm Railway runtime SHA equals the promoted GitHub demo SHA.
6. Perform integrated business-flow reacceptance and only then declare the branch ready as the common base for the four rebuilds.

## Candidate gate results

- Root TypeScript typecheck: **PASS**.
- Backend production build: **PASS**.
- Frontend production build: **PASS** (bundle-size warnings remain non-blocking technical debt).
- Finance list-only contract, V8 finance API contract, and artifact content envelope: **PASS — 57/57**.
- Broader targeted integration set: **PARTIAL — 64/71 passed**.
  - `FinanceHub.v8-runtime-strip.test.tsx` still asserts the superseded below-list panel behavior and conflicts with the accepted list-only contract. The implementation and current list-only test agree; the obsolete test requires formal retirement/update.
  - Artifact origin runtime parity is missing `assessment_report` on the client. The active Documents worktree already contains an uncommitted correction to the same exact contract, so this candidate must not duplicate it. The fix must arrive through the reviewed Documents handoff.

These are integration blockers for promotion, not evidence that the clean merge itself is corrupted.

## Current decision

**NO-GO for broad cleanup or starting four rebuilds from the current root worktree.**

**GO to continue validation of the clean reconciliation candidate while the Documents package finishes.**
