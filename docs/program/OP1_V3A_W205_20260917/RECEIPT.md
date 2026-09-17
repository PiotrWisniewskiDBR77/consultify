# OP-1 v3a — W205 P0 row-click repair + Z-63b RealPG

Status: READY FOR CTO REVIEW.

Base after rebase: `fa075366be0c8bafa666275c8f8cb7868e5f0099` (`origin/integracja/20260911` at fetch time).
Branch: `codex/a-op1-v3-w205-20260917`.
Scope split: v3a closes W205 P0 and Z-63b RealPG. The remaining W101 connections are explicitly left for OP-1 v3b: Audits → Sessions workspace with U-28 receipt, Audits → Initiatives `registeredInitiativeId`/Open initiative, Execution → Decisions by `decision.id` with TOOL_* filter, Execution → Work Open task/TaskDetailView for manager. W205 row 64 is not claimed as 5/5 in v3a.

## Delivered in v3a

- Assessment → Insights row click again opens the frozen Output preview and fetches the immutable server snapshot. It no longer navigates to the live assessment session editor for ordinary frozen Output rows carrying a `sessionId` FK.
- “Open session” remains available as an explicit secondary action in the row menu and preview when `sessionEditorPath` exists.
- The source-level OP-1 guard now protects the W205 rule: row click must open preview, not session navigation.
- Z-63b RealPG proof added for `method_sessions.name`: create without name persists a visible fallback name, and frozen→active reopen persists that name on the new active revision.

## Evidence

- P0 reproduction before fix: `AssessmentOutputsTab.test.tsx` = 8 PASS / 4 FAIL after rebase; row click did not open `[data-right-panel]` and lineage/report tests could not reach preview actions.
- Focused OP-1 v3a: `AssessmentOutputsTab.test.tsx`, `AssessmentOutputsTab.openSession.source.test.ts`, `AuditFallbackCopy.source.test.ts`, `MethodSessionService.sessionName.source.test.ts`, `methodCoreSessionName.source.test.ts` — 5 files / 21 tests PASS.
- RealPG Z-63b: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6454/consultify_op1 npm exec vitest -- run server/src/method-core/__tests__/MethodSessionService.sessionName.realpg.test.ts --retry=0 --no-file-parallelism` — 1 file / 1 test PASS against local container `cx-codex-op1-pg`.
- `git diff --check` PASS.
- `npm run check:jezyk:ci -- --report /tmp/op1-v3a-lang.txt` PASS: nothing increased; drops K4obj -4, K5en -1, K8sen -3.
- `npm run type-check`: 167 `error TS` total, 5 in `node_modules`, 0 in changed OP-1 files.
- `npm run type-check:server`: 0 `error TS`.

## Limits

- No migrations.
- No staging/demo/Londyn/integracja push.
- No deploy/Railway/env/staging writes.
- No claim that W205 row 64 is complete; OP-1 v3b remains needed for the four W101 connections listed above.
