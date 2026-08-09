# Consultify — readiness for further large development

Date: 2026-08-09 (Europe/Warsaw)

## CTO verdict

**READY FOR FURTHER LARGE DEVELOPMENT WITH CONTROLLED BACKLOG**

This verdict applies to the clean candidate branch described below. It does not
mean that every rebuilt surface is enabled on demo or accepted for human users.
Artifact Studio remains fail-closed behind explicit rollout flags and its
runtime/visual program gates remain `PARTIAL` or `PENDING` where evidence is not
yet complete.

## Canonical candidate

| Item | Value |
|---|---|
| Worktree | `/private/tmp/consultify-pre-rebuild-v8-ui-integration-20260809` |
| Branch | `codex/pre-rebuild-v8-ui-integration-20260809` |
| Candidate SHA before this report | `ab013cbaf565dc94b5c38b1b4a2af1dd5a0f0bfb` |
| Current GitHub demo | `bf29e98a3d8a0c40bf822d8c79f817a679c30695` |
| Accepted Railway runtime parent | `37f835ccfd5e49462986ed95f8285ef1b04dc59d` |
| Git status | clean before report creation |

Both the current `origin/demo` and accepted Railway runtime SHA are ancestors
of the candidate. No merge from `main` was performed.

## Integrated and resolved scope

1. Demo/runtime reconciliation and accepted Finance list-only decision.
2. DB/MFA security series: strict migration ordering, LLM tenant isolation,
   fail-closed migration command, real PostgreSQL CI coverage, document source
   pack persistence, destructive-fixture safety, `user_mfa`, and SuperAdmin
   `user_mfa_methods` PostgreSQL repair.
3. Customer access repair for `/api/artifact-runs`; ordinary authenticated
   tenant users are no longer blocked by the internal-tools pre-guard.
4. Accepted V8 full-case evidence package.
5. Accepted 45-table UI package, UI standards, and Results navigation.
6. Deterministic Excel initiative-budget path.
7. One bounded Documents / Presentations / Spreadsheet handoff, including its
   missing dependencies and server-contract reconciliation.
8. Obsolete Finance runtime test retired in favor of the accepted list-only
   contract. Production-only Presentation TypeScript narrowing repaired.

## Current verification evidence

| Gate | Result |
|---|---|
| Root TypeScript typecheck | PASS |
| Server TypeScript typecheck | PASS |
| Frontend production build | PASS; bundle-size warnings only |
| Backend production build | PASS |
| Artifact Studio targeted suite | PASS — 115/115 |
| Presentation watchlist regression | PASS — 13/13 |
| Finance list-only/runtime guards | PASS — 4/4 |
| Artifact program-gate integrity | PASS — 4/4 |
| Strict fresh PostgreSQL schema | PASS — 579/579 |
| Immediate migration replay | PASS — 0 pending |
| RealDB and negative controls | PASS — 43/43 |
| Git whitespace/diff check | PASS |
| `origin/demo` ancestry after fresh fetch | PASS |
| Accepted runtime ancestry | PASS |

The 43 realDB/negative tests cover organization isolation, permission denial,
concurrent initiative/resource updates, source-pack cold reopen and refused
writes, `user_mfa`, SuperAdmin MFA, and LLM organization scope.

## Artifact Studio rollout truth

The integrated Artifact Studio package is a safe development foundation, not a
completed production rollout. Its own canonical control board records:

- `CMD-01`, `GOV-01`, and `XLSX-01`: code-verified;
- `SHELL-01`, `TER-01`, `PPT-01`, `DOC-01`, `XLSX-02`, and `XFER-01`:
  `PARTIAL` pending runtime/visual or dependency evidence;
- `LEGACY-01`: `PENDING` by design until two stable release windows.

The master and lane flags stay OFF until lane-by-lane browser, persistence,
export, tenant, light/dark and mobile acceptance. This protects the common
development base from exposing incomplete rebuilt studios.

## Repository cleanup and quarantine

- Ten clean, contained historical worktrees were safely removed; one stale
  registration was pruned. Branch refs and commits were retained.
- The repository currently has 26 registered worktrees. Dirty, ambiguous, or
  uniquely committed worktrees were not deleted.
- The active root Documents worktree still contains 311 changed/untracked
  paths from overlapping owners/history. Its accepted bounded handoff is now
  captured in the candidate; the remaining delta is quarantined, not silently
  promoted or destroyed.
- Eleven shared stashes remain untouched. No stash apply/drop/clear was used.
- Alternative Documents, V8, UI45, UX-tools, Finance recovery, CB01/03/05 and
  detached recovery histories remain preserved outside the canonical line.
- 402 local branches are not merged into this candidate. This is a historical
  inventory, not 402 missing product packages. No bulk deletion is authorized
  until patch-equivalence and ownership records exist.

## Rules for the next four rebuilds

1. Start each rebuild from this exact candidate branch (or its promoted
   descendant), never from the dirty root worktree.
2. One bounded owner package per scope with an allowlist and evidence manifest.
3. No stash, broad `git add -A`, reset, clean, or cross-owner mass commit.
4. Re-run typecheck/build and scope-targeted tests before integration.
5. Keep Artifact Studio lanes fail-closed until their individual runtime gate.
6. Promotion to `demo` and Railway deployment are a separate release decision;
   this report authorizes development readiness, not automatic deployment.

## Remaining controlled backlog

- Artifact Studio runtime/visual acceptance and `LEGACY-01` removal window.
- Lane-by-lane rollout flag decision for DOC/PPT/XLSX.
- Full human integrated business-flow reacceptance on a deployed exact SHA.
- UX-tools conflicted worktree and CB01/03/05 uncommitted packages: preserve and
  resolve only through bounded ownership handoffs.
- Repository-wide `DbPromise` error swallowing and the historical red test
  backlog remain hardening work unless a new P0 is demonstrated.
- Historical branch/worktree archive ledger and eventual off-GitHub quarantine
  remain housekeeping; they no longer block starting bounded development from
  the clean candidate.

## Final boundary

**GO:** begin the four large rebuilds from the clean candidate under bounded
integration rules.

**NO-GO:** call the whole application human-test ready, enable all Artifact
Studio flags, fast-forward `demo`, deploy, or delete quarantined histories
without the separate runtime/release gates.
