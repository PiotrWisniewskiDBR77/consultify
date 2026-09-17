# PMO-1a v2 — W208 rebase and regression closure

Status: READY FOR CTO REVIEW.

Base after rebase: `1a99bece79b7ba0d666a432667418b6c94ce61b6` (`origin/integracja/20260911`, at fetch time).
Branch: `codex/a-pmo-1a-v2-w208-20260917`.

## Scope

- Rebased PMO-1a over the current line and manually resolved the four W208 semantic conflicts.
- `stages12Enabled` and `pmoQueuesEnabled` are both preserved in the canonical register columns.
- Initiative list filtering keeps STAGE-1 12-stage lifecycle status filtering and adds PMO queue filtering as a separate condition.
- PMO dev-render screens are preserved alongside the line's existing `u43-deck-review` screen.
- `InitiativesHub.previewDetails.t25.test.tsx` now asserts the PMO-aware `persistKey` expression and both persisted keys instead of freezing only the old literal.

## Evidence

- PMO + preview focused suite: `InitiativesHub.previewDetails.t25.test.tsx`, `pmoQueues.pmo1a.test.ts`, `PmoStageTransitionPanel.pmo1a.test.tsx`, `pmoContrast.pmo1a.test.ts`, `inboxPmoQueues.pmo1a.test.ts` — 5 files / 135 tests PASS.
- STAGE-1/register + server lifecycle suite after conflict resolution: `initiativeRegisterProjection.dec539.test.ts`, `day274-jedna-kolumnistyka.test.tsx`, `ini-mvp-gate-001-lifecycle-gate-route.test.ts`, `initiativeLifecycleGateDecisionService.test.ts` — 4 files / 45 tests PASS. The older W208 checklist names `initiativesStages12Flag.test.ts`, `initiativeReadinessPoPolsku.test.ts`, `initiativeLifecycleMessages.closureWorkIncomplete.test.ts`, and `enumLabel.test.ts` are not present in this current-line worktree, so they are not counted as executed.
- Wider lifecycle attempt including `tests/unit/initiatives/lancuchZarzadzania.lifecycleActions.test.tsx` produced 2 failures in that unrelated file: missing `initiative-lifecycle-reason-transition:*` nodes, while the reason is already present on button `aria-label`/`title`. PMO-1a does not touch `InitiativeLifecycleActions`; this is treated as existing D-27-style debt, not a PMO regression.
- `git diff --check` PASS after final rebase.
- `npm run check:jezyk:ci -- --report /tmp/pmo-w208-lang.txt` PASS: nothing increased; drops K4obj -4, K5en -1, K8sen -2.
- `npm run type-check`: 156 `error TS` total, 5 in `node_modules`, 0 in changed PMO files.
- `npm run type-check:server`: 0 `error TS`.

## CTO questions

1. DEC-563 “sponsor albo komitet sterujący”: PMO-1a currently wires `reviewerUserId={sponsorId || null}` into `PmoStageTransitionPanel`. The committee path is not implemented in this package; treat it as PMO-1b / follow-up, not covered by PMO-1a v2.
2. `ClosureSection` trap from DESIGN.md: `ClosureSection` is present in `InitiativeDocumentView` and mounted as the `closure` section. PMO-1a did not change it; closure governance remains the existing ClosureSection flow, outside this rebase fix.

## Limits

- No migrations.
- No staging/demo/Londyn/integracja push.
- No deploy/Railway/env/staging writes.
- `src/components/Initiatives/InitiativesHub.tsx` was touched only for the W208-authorized rebase conflict and PMO queue wiring.
