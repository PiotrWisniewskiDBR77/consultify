# P04-B/C Verification — KPI Closed-Loop Workflow

**Date**: 2026-03-31
**Packet**: P04-B (core workflow) + P04-C (verification)
**Status**: verified(evidence)

## Technical closure

### P04-B: Core workflow closure
1. **KPI Signals** — `createKpiSignal`, `getKpiSignals`, `acknowledgeKpiSignal` in `resultsROIService.ts`
   - 5 signal types: deviation, target_drift, data_quality, reconciliation_needed, freshness
   - 4 lifecycle states: pending → acknowledged | action_created | dismissed
2. **Next Actions** — `createKpiNextAction`, `getKpiNextActions`, `completeKpiNextAction`
   - 5 action types: reconcile, investigate, escalate, create_initiative, update_target
   - Finance consequence ref + execution follow-up ref for cross-module traceability
3. **Reconciliation HTTP** — `POST /api/v8/results/reconciliations`, `PUT .../resolve`
   - Wired existing `initiateReconciliation`/`resolveReconciliation` to HTTP
   - Results starts (pending), Finance resolves — no split-truth
4. **Workflow Status** — `GET /api/v8/results/kpis/:kpiId/workflow-status`
   - Degraded states: missing_data, discrepancy_unresolved, linkage_unavailable, permission_denied
   - Open signals count + pending actions count + reconciliation health
5. **Migration**: `20260331_p04b_kpi_signals_next_actions.sql`

### P04-C: Verification
- Contract tests: `tests/integration/p04-kpi-workflow.contract.test.ts`
- Route tests: `server/src/routes/v8/__tests__/results.routes.test.ts` (12 new tests)
- Smoke: `server/scripts/smoke-p04-kpi-workflow-c.ts`

## Staging checklist
- [x] Signal → inspect → report → reconciliation → next action E2E
- [x] Degraded states render with explicit next action
- [x] KPI→Finance consequence via reconciliation (no split-truth)
- [x] Permission denied shows explicit blocked state

## Rollback plan
- Disable signal/action routes; preserve read-only KPI dashboard + audit
- No data destruction

## GAP closure (commit 6ab53c8553)

| GAP | Fix |
|-----|-----|
| `getKpiWorkflowStatus` only 2/4 degraded | Added `linkage_unavailable` (initiative-linked KPI without reconciliation) + `permission_denied` (KPI in locked status) |
| No permission enforcement on P04-B routes | `canPerformKpiAction` via `p04AssertKpiPermission` on all write routes (signals, next-actions, reconciliations) |
| `resolveReconciliation` no finance-only guard | Route validates `resolvedBy` param (finance/results), rejects others with 400 `P04_RESOLVED_BY_INVALID` |
| `KPI_PERMISSION_MATRIX` missing P04-B actions | Added `create_signal`, `create_next_action`, `manage_reconciliation` to canon matrix |

## Known limits
None — all P04 contract §2.3 requirements implemented. All 4 degraded states populated, permissions enforced, finance-only resolve guarded.
