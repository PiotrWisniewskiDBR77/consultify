---
doc_id: integrate-decision-initiative-execution-gate
truth_type: verified-as-is
status: working
owner: claude
product_owner: piotr
priority: P0
depends_on: MW-DEC-001..005, INI-005, EXE-003
last_reviewed: 2026-08-01
---

# Decision → Initiative → Execution — controlled integration packet

STATUS: **AWAITING_CODEX_REVIEW**. Not READY_FOR_STAGING, not CODE_GO. No push/merge/deploy.

## 1. Integration branch, base, and the two frozen HEADs

- Integration branch: `integrate/decision-initiative-execution-gate`
- Common base: `c522a861839f54d0f26baa918566589aab3f6f6b`
- Frozen Decision HEAD: `d1826a474f73b5d4b63a56b5b0cc5bbd7ce08440` (`feat/mw-dec-001-canonical-decision-workflow`)
- Frozen Initiative/Execution HEAD: `06cd5a0c36eeae81cc1cf3f785983fb13baf3147` (`fix/ini-005-canonical-start-execution-gate`)
- New integration worktree, isolated from both frozen worktrees; neither frozen worktree's working directory was modified.

## 2. Method of integration

Two sequential `git merge --no-ff` operations from the common base:
1. Merge Decision line (`d1826a474f`) → commit `5c99f3a69e`.
2. Merge Initiative/Execution line (`06cd5a0c36`) → commit `ae1d798542`.

## 3. Conflicts and resolutions

**Zero merge conflicts** — the two lines never touched the same files (confirmed via the merge output itself: no `CONFLICT` markers, no `--diff-filter=U` unmerged paths at any point). This was expected given the two lines' independent file-ownership scopes (Decision-domain files vs. Initiative/Execution-domain files).

One **post-merge, pre-existing interaction bug** was found and fixed on its own commit (not a merge conflict, but a real defect only observable once both suites ran together): both lines independently hit the same harness-fallback-vs-Config-fallback JWT secret mismatch (root-caused in an earlier INI-005 round and fixed there structurally); the Decision line had only worked around it operationally via an explicit `JWT_SECRET=...` in its documented run command. Fixed by generalizing the existing hermeticity guard (renamed `ini005TestSecret.ts` → `sharedAcceptanceJwtSecret.ts`) to cover both lines' test files. Commit `5c85d838bf`.

## 4. New HEAD

`6e5b73f806f3f8ecd8e74a9399ead0a7034f9369`

Full commit sequence from base:
```
5c99f3a69e  merge: integrate Decision line
ae1d798542  merge: integrate Initiative/Execution line
5c85d838bf  fix(integration): generalize JWT test-secret hermeticity to the whole acceptance suite
743ad15ddd  fix(decisions): route decision-driven initiative unblock through canonical engine
118821dd90  fix(decisions): harden createDecision's auto-block write for initiatives
be8e836970  fix(initiatives): widen system-actor gate allow-list to include UNBLOCK
3b5bbd07fd  fix(decisions): route createDecision's Initiative BLOCK through one atomic canonical writer
6e5b73f806  test: add Decision-driven Initiative BLOCK/UNBLOCK integration acceptance suite
```

**Note on an out-of-band incident during this packet, fully contained and resolved**: a stray, unauthorized commit (`600c9c719c`) landed on the frozen `fix/ini-005-canonical-start-execution-gate` branch mid-packet. Per Codex's explicit recovery decision, it was left untouched (not reset, not deleted) for separate cleanup, and all subsequent work proceeded exclusively on this integration branch. `fix/ini-005-canonical-start-execution-gate`'s HEAD (`600c9c719c`) was re-verified unchanged at the end of this session.

## 5. Full writer list — before and after

| Writer | Before | After |
|---|---|---|
| `refreshInitiativeDecisionBlock` (Decision-driven UNBLOCK, `decide()`'s post-commit cascade) | Raw `UPDATE initiatives SET status=CASE WHEN...EXECUTING...` — unconditional, fired even on rejection, no lock, no GO/NO-GO check, no audit rows | Explicit short-circuit on `resolvedDecisionStatus==='rejected'` (no-op); otherwise routes through `executeInitiativeTransition` (canonical UNBLOCK gate) — row lock, advisory lock, mandatory current-GO check, atomic audit |
| `createDecision`'s blocker-creation (initiative branch) | Raw `UPDATE initiatives SET status=CASE WHEN...BLOCKED...` inside a semi-hardened pinned transaction (intermediate state from an earlier commit this round), no canonical routing | Calls `applyDecisionBlockTransitionOnClient` — a new, narrow, canonical, sole-owner function — on the SAME client as the rest of `createDecision`'s writes, all inside ONE atomic transaction (Model A: decision + history + impacts + initiative BLOCK + both initiative audit rows, one commit or full rollback) |
| `executeInitiativeTransition`'s system-actor allow-list | `GateType.START` only | `GateType.START` + `GateType.UNBLOCK` (narrow, documented widening; GO/NO-GO check remains unconditional regardless of actor kind) |
| `InitiativeController.blockInitiative`/`.completeInitiative`/`.archiveInitiative` | Raw, unguarded, shadow-capability-only | **Unchanged — explicitly out of this packet's scope**, still a documented, deferred gap |
| `managerActionExecutionService.ts`'s `'unblock'` action (writes non-canonical `'IN_PROGRESS'`) | Raw, unguarded | **Unchanged — explicitly out of scope**, separate defect class, doesn't reach EXECUTING |
| `DecisionController`'s other writers (`updateDecision`, `escalateDecision`, `deleteDecision`, comments/alternatives/risks CRUD) | Never touched `initiatives` | **Unchanged — confirmed by discovery, never touched `initiatives`, not in scope** |

## 6. Canonical ownership — precise, corrected claim

`executeInitiativeTransition` and `applyDecisionBlockTransitionOnClient` (both in `server/src/services/initiative/initiativeTransitionService.ts`) are, together, the sole write path for every transition this packet's mandate covers: REVIEW→PROMOTED, SCHEDULED→EXECUTING (via `/start-execution` and the auto-start system actor), BLOCKED→EXECUTING (via `/unblock` and the Decision-driven cascade), and now Decision-driven BLOCKED entry (via `createDecision`). `DecisionController.ts` contains **zero** direct `UPDATE initiatives SET status` statements as of this HEAD — verified both by manual code review and by a standing grep-based test assertion in the new acceptance suite (`grep-check` case) that will catch any regression.

**Explicitly out of this claim's scope** (unchanged, pre-existing, documented, not silently folded in): `blockInitiative`/`completeInitiative`/`archiveInitiative` (raw, human-facing, deferred), `managerActionExecutionService.ts`'s non-canonical `'IN_PROGRESS'` write (doesn't reach EXECUTING).

## 7. Test results

**Baseline (both frozen packets, re-verified on the integration branch before any new work)**: 70/70 (31 Decision + 39 Initiative/Execution real-Postgres, plus 14/14 Decision frontend component tests separately) — required a fix (§3) to be reliably green regardless of shell `JWT_SECRET` state.

**Final combined suite** (8 files, run once as directed, `JWT_SECRET` unset, independently reconfirmed by me in addition to the writer agent's own run):
```
Test Files  8 passed (8)
     Tests  89 passed (89)
```
(70 baseline + 19 new integration-specific cases, covering all 20 numbered cases from Codex's requirements — two cases share one `it()` block where the underlying assertion is identical, noted in the suite's own comments.)

**DB-constraint findings**: the live schema's `initiatives_status_check` CHECK constraint structurally rejects `'COMPLETED'` and any garbage status value at INSERT time — cases 16 (COMPLETED) and 19 (unrecognized status) are therefore proven at the code-logic level (`hasInitiativeStatusSchemaDrift`, `DECISION_BLOCK_TERMINAL_OR_DONE_STATUSES`) rather than via a live end-to-end DB row, with the constraint verification itself asserted in-test.

## 8. Negative controls — all 6 required, all confirmed red→green

| # | Control | Result |
|---|---|---|
| 1 | Remove `rejected` short-circuit in `refreshInitiativeDecisionBlock` | Case 1 → RED (wrongly unblocks). Reverted → green. |
| 2 | Restore raw `UPDATE...EXECUTING` in the UNBLOCK cascade | Case 2/3 → RED (GO/NO-GO bypassed). Reverted → green. |
| 3 | Restore raw `UPDATE...BLOCKED` in `createDecision` | Cases 6/15/17/18 (terminal protection) → RED. Reverted → green. |
| 4 | Remove the advisory lock in `applyDecisionBlockTransitionOnClient` | See §10 — an honest, important nuance was found here, not a clean red→green. |
| 5 | Move audit INSERTs outside the transaction | Cases 5, 7/13 → RED. Reverted → green. |
| 6 | Restore catch-and-swallow-then-201 around the whole `createDecision` transaction | Cases 7/13 → RED (silent block loss undetected). Reverted → green. |

All edits were self-reverted; `git status --short` confirmed clean after every single control before proceeding to the next.

## 9. Browser evidence

**Not performed in this round.** The two Codex messages that followed the original mission brief explicitly narrowed scope to closing the two named blockers ("Nie wykonuj więcej discovery... Dwa blokery pozostają," "Nie rozszerzaj zakresu poza tę semantykę") and did not re-request the browser verification phase from the original mission. I did not unilaterally expand scope back to include it, per those explicit instructions. This is an honest gap, not a silent omission — flagging it here for Codex to decide whether it's required before any GO decision, and if so, requesting it explicitly for a follow-up round.

## 10. Unresolved risks

1. **New, real bug found and deliberately NOT fixed** (per instructions — report, don't fix): `refreshInitiativeDecisionBlock`'s `stillBlocked` count is a non-transactional, shared-pool pre-filter read that happens *before* `executeInitiativeTransition` opens its own row-locked transaction. A **new** blocking Decision can commit in the window between that pre-filter read and the transition's lock acquisition; `executeInitiativeTransition` re-verifies the GO/NO-GO gate freshly but has no way to re-verify "are there other open blockers" (that check lives entirely on the Decision side, outside the engine's own transaction). Empirically reproduced at a ~10-12% rate under concurrent load in the new suite's case 8 — and confirmed to reproduce identically on **unmodified** code, i.e. this is a genuine pre-existing gap this packet's fixes did not introduce and did not fully close, not a regression. The window is narrower than the original (pre-packet) bug — a bare, unguarded raw UPDATE with zero checks at all — but it is not zero. Closing it fully would require either moving the `stillBlocked` check inside `executeInitiativeTransition`'s own transaction (a change to the general-purpose engine, arguably out of this packet's narrow scope) or a second advisory-lock/re-check layer specific to this cascade. Flagging for Codex's explicit scoping decision rather than silently expanding this packet to fix it.
2. **The advisory-lock negative control (§8, control 4) was inconclusive** in a way worth Codex's attention: removing the lock did not cleanly turn the concurrency test red, because the pre-existing bug in item 1 above already produces intermittent failures on the lock-present code — the lock's own contribution couldn't be cleanly isolated by this specific test. This doesn't mean the lock is non-functional (it demonstrably serializes `createDecision`'s block-write against `executeInitiativeTransition`'s own advisory-lock acquisition, by design, using the identical key) — it means the test designed to prove it in isolation was confounded by the separate pre-filter race. Worth a dedicated, narrower test in any follow-up that closes item 1.
3. **Browser verification not performed** — see §9.
4. All previously-disclosed open items from the prior two INI-005 handoff reports remain unchanged and still open: `DecisionController.refreshInitiativeDecisionBlock`'s original cross-team-boundary status is now resolved by this packet (it's no longer a raw bypass), but `blockInitiative`/`completeInitiative`/`archiveInitiative` and `managerActionExecutionService.ts`'s `IN_PROGRESS` write remain exactly as documented before — untouched, deferred, out of scope.

## 11. Scope of remaining INI/EXE submodules this packet did not close

This packet closed the Decision-domain side of the Initiative BLOCKED/EXECUTING bypass entirely (both directions: block-creation and auto-unblock). It did **not** touch, and does not claim to have closed:
- `InitiativeController.blockInitiative`/`.completeInitiative`/`.archiveInitiative` — the human-facing raw writers, same anti-pattern family, explicitly named as deferred in the original INI-005 correction-round report and left untouched again here.
- `managerActionExecutionService.ts`'s non-canonical `'IN_PROGRESS'` write — a distinct, adjacent defect (invalid enum value, doesn't reach EXECUTING), not addressed.
- The general capacity/scheduling engine, Finance post-investment handoff, Results closure handoff, and every other item listed as deferred in the original `RESULTS_EXECUTION_INITIATIVES_GOLDEN_THREAD_RECON_2026-08-01.md` audit — none of those were in scope for this packet and none were touched.
- Browser/UI-level verification of the golden flow (§9).

## 12. Clean-tree proof

```
$ git status --short
(empty)
$ git branch --show-current
integrate/decision-initiative-execution-gate
$ git rev-parse HEAD
6e5b73f806f3f8ecd8e74a9399ead0a7034f9369
$ git rev-parse 600c9c719c   # frozen branch's stray commit, unchanged
600c9c719ccd1e3311db7f476f5af7b2bdbadca4
```
Independently re-verified by me directly, immediately before writing this report.

**Additional gates run once, all clean**: `git diff --check` (exit 0), secret scan on all 3 files touched this round (clean, no real credentials), backend `tsc --noEmit` against the real `server/tsconfig.json` (0 new errors in the 2 touched files; 147 pre-existing baseline errors elsewhere, unrelated), backend build (`tsc --noCheck`, exit 0). Frontend typecheck/build gate: **not applicable** — zero `src/` files were touched anywhere in this integration round.

## 13. No push, no merge to demo, no deploy

Confirmed — no `git push`, no merge to `demo`/`Londyn`, no deploy, no Railway contact at any point in this packet.

---

## Status

**AWAITING_CODEX_REVIEW.** Not READY_FOR_STAGING. No CODE_GO self-declared.
