# P11 Inicjatywy — closeout evidence (verified)

**Date:** 2026-03-31  
**Branch:** `ws/c-artifact-evidence`

## Automated verification

| Suite | Result |
|-------|--------|
| `initiativeLifecycleCanon.test.ts` | 11/11 |
| `planning.handoff.p11.test.ts` | 2/2 |
| `tests/unit/utils/initiativeWorkflowStatus.test.ts` | 3/3 |

## §5.3 Staging checklist (operator)

1. **Portfolio vs detail:** Open Initiatives portfolio (V8 planning), select a row; open full document view — status badge matches portfolio row (same normalized PMO status). If DB holds a legacy/novel raw value, **Status drift** Callout appears and badge still follows `displayStatus`.
2. **Handoff envelope:** `GET /api/v8/planning/initiatives/{id}/handoff?kind=execution` returns `initiativeId`, `initiativeLifecycleState`, bounded `contextPack` (≤5), `handoffAt` / `handoffBy`.
3. **Status transition guard:** PATCH unknown target status → `400` with `UNKNOWN_TARGET_STATUS` / `coerceInitiativeStatusForWrite`.
4. **AI blueprint:** Create blueprint via governance API; **apply** triggers `initiative_history.action = ai_blueprint_applied` with JSON payload including `proposalId`, `acceptedDiffSummary`, `citations` (best-effort; schema-safe).

## Known limits

- Full E2E “two entry points create same id” depends on product routes (manual or separate E2E pack).
- P03/P04/P02 consumers still attach to handoff API in their packets.
