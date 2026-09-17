# OP-1 v3b — W205 / W101 connections

Status: READY FOR CTO REVIEW.

Scope delivered in this package:

- Audits → Sessions workspace: next-stage gates no longer stay on a permanent `Loading…` state when lifecycle read fails. The preview now shows an explicit error while preserving criteria workspace links.
- Audits → Initiatives: `registeredInitiativeId` is carried through the frontend contract. `Open initiative` is available only when the backend returned a registered initiative id; local proposal drafts still do not pretend to be Initiatives module records.
- Execution → Decisions: Work Intelligence uses the real decision record id when `id` is available, falls back to `decisionId` for runtime records, and filters technical `TOOL_*` decisions out of user-facing work registers.
- Execution → Work: `Open task` from Execution opens manager-safe `TaskDetailView ownerScoped={false}` through the ExecutionHub work document route. The standalone surface keeps its local preview fallback when no hub callback is provided.

Evidence:

- `npm exec vitest -- run src/components/Audit/method/__tests__/AuditProcessesTab.nextStageGates.test.tsx src/components/Audit/method/__tests__/AuditInitiativesTab.test.tsx src/components/Execution/__tests__/ExecutionHub.workDeepLink.source.test.ts src/components/Execution/reports-intelligence/__tests__/WorkIntelligenceReport.test.tsx src/components/Execution/__tests__/ExecutionWorkSurface.otworzZadanie.test.tsx --retry=0 --no-file-parallelism` → 5 files / 22 tests PASS.
- `git diff --check` → PASS.
- `npm run check:jezyk:ci -- --report /tmp/op1v3b-jezyk.txt` → PASS; K4obj -4, K5en -1, K8sen -3.
- `npm run type-check:server` → PASS, 0 `error TS`.
- `npm run type-check` → `TIMEOUT_180`, no `error TS` emitted before timeout. This is recorded as an incomplete front tsc measurement, not a PASS.

No migrations. No staging/demo/deploy changes.
