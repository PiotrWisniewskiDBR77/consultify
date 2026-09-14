# F2-2 E2 — author fixes after independent review

**Verdict: READY_FOR_LINE_REBASE_THEN_INDEPENDENT_REREVIEW; all four P1 findings are fixed on the current `88f1a1994d` base, with no migration.**

## Four review findings

1. The Monday 05:00 UTC scheduler now generates a server-owned weekly analysis and writes an idempotent durable result to the existing `execution_report_snapshots` table. The on-demand route accepts only a week and regenerates from canonical execution records. Both server and client gates require explicit `true`; default is OFF.
2. Attention rows call the existing `executeManagerProblemAction` route and service for escalation, reassignment/delegation, and capacity/resource change. The route-level `manage_workstreams` permission, V8 organization context, transactional mutation, and `manager_action_audit_log` remain the authority.
3. The UI renders concrete attention records, translated reasons, project, and available actions in `StandardTable`.
4. The canonical execution-case reader joins `projects` by organization and returns the real `projectTitle`; the UI no longer has to display a fixture-only title.

## Narrow canonical-writer exception

The existing manager action route was mounted behind `requireCanonicalExecutionWriter`, so every POST returned 409 before the already governed service could run. Runtime-v1 has no replacement for these service actions. The exception is deliberately limited to `POST /lanes/:laneId/problem-actions/execute`. Gateway/JWT/RealPG proves OWNER success and audit, a USER receives 403 from `manage_workstreams`, and adjacent `POST .../suggestions/apply` remains 409. The earlier lifecycle exceptions from wave B remain unchanged.

## Evidence

- Focused E2 + wave B + K5 + middleware/scheduler: 8 files, 80 tests PASS, `--retry=0`.
- Gateway/JWT/RealPG on package-owned PostgreSQL `cx-s4-e2-pg:5290`: 2/2 PASS. It proves Monday scheduler persistence, on-demand creation and replay, OFF=404, real project-name join, service mutation, SQL readback, audit, USER=403, and adjacent write=409.
- Server TypeScript: `npx tsc -p server/tsconfig.json --noEmit` — exit 0.
- Focused esbuild: Work Intelligence and browser harness — exit 0.
- EN/PL `execution.workAnalysis`: 29/29 leaf-key parity.
- Browser: production-built harness, light and dark, 0 console exceptions/errors; see `BROWSER_RECEIPT.md`.
- K5 word-counter: `ExecutionHub.bankPreviewCanon.test.tsx` passes 9/9 in isolation and in the focused group. The earlier failure was an inherited/order-dependent red, not caused by E2.
- Historical `f2-2-entry-contract.red.test.ts` is not an E2 release gate: it asserts completion of the whole 29-thought F2-2 denominator and references a deliberately capped, absent historical audit fixture. No E2 code or evidence was changed to manufacture that unrelated result.
- Migrations: none.
