# P11 Inicjatywy — closeout evidence (verified)

**Date:** 2026-03-31  
**Status:** `verified(evidence)` — all gaps closed  
**Branch:** `ws/c-artifact-evidence`

## Automated verification

| Suite | Result | What |
|-------|--------|------|
| `initiativeLifecycleCanon.test.ts` | 11/11 | Canon states, mapping, coercion, drift, handoff builder |
| `planning.handoff.p11.test.ts` | 2/2 | Handoff route envelope + 404 |
| `tests/unit/utils/initiativeWorkflowStatus.test.ts` | 3/3 | UI helper normalization |
| `tests/integration/p11-two-entry-points.test.ts` | 4/4 | Supertest E2E: PMO+assessment→portfolio read, drift on list, handoff parity, all-status normalization |

**Total: 20 tests, all green.**

## §5.1 Acceptance criteria — point-by-point

1. [x] Lifecycle uses exactly the canonical states from §2.3.1 — `P11_CANONICAL_LIFECYCLE_STATES` (9 states)
2. [x] Every lifecycle transition is explicit and audited — `initiative_status_history` / `initiative_history`; `VALID_TRANSITIONS` + `GATE_TRANSITIONS` in `initiativeStatuses.ts`, re-exported via `initiativeLifecycleCanon.ts`
3. [x] Initiative can be created from at least 2 entry points and lands in same canonical truth — **supertest E2E**: PMO + assessment initiatives → same V8 portfolio read with identical `displayStatus`, `p11LifecycleState`, `statusReadDrift`
4. [x] After any write, list/table + detail + preview show identical lifecycle + key header fields — portfolio list now includes `displayStatus`, `p11LifecycleState`, `statusReadDrift` (same as detail)
5. [x] Counters/filters based on lifecycle state match visible rows — portfolio stats use normalized row `status`
6. [x] AI scaffold produces structured `proposal` and never writes silently — blueprint row + explicit `apply` route
7. [x] User can review/edit proposal and must explicitly accept — apply is separate mutating call
8. [x] System records audit trail for proposal→accept — `ai_blueprint_applied` + JSON summary
9. [x] Handoff payloads include required IDs + bounded context — `GET .../handoff` + builder; consumers in P03/P04/P02
10. [x] Degraded mode is truth-preserving — unknown target status → 400; drift Callout on read (detail + list)
11. [x] Schema drift does not corrupt lifecycle truth — `statusReadDrift` flag on both portfolio list and detail; normalized read surfaces

## §5.3 Staging checklist (operator)

1. **Portfolio vs detail:** Portfolio list rows now include `displayStatus`, `p11LifecycleState`, `statusReadDrift` — matching detail view. Drift initiative shows `statusReadDrift: true` + `displayStatus: DRAFT` + `p11LifecycleState: intake` on the list.
2. **Handoff envelope:** `GET /api/v8/planning/initiatives/{id}/handoff?kind=execution` returns `initiativeId`, `initiativeLifecycleState`, bounded `contextPack` (≤5), `handoffAt` / `handoffBy`.
3. **Status transition guard:** PATCH unknown target status → `400` with `UNKNOWN_TARGET_STATUS` / `coerceInitiativeStatusForWrite`.
4. **AI blueprint:** Create blueprint via governance API; **apply** triggers `initiative_history.action = ai_blueprint_applied` with JSON payload including `proposalId`, `acceptedDiffSummary`, `citations` (best-effort; schema-safe).
5. **Two entry points:** Supertest E2E confirms PMO-created and assessment-created initiatives normalize identically through V8 portfolio read.

## §2.3.2 Transition matrix consolidation

Transition matrix (`VALID_TRANSITIONS`, `GATE_TRANSITIONS`, `isValidTransition`, `validateTransition`) is now re-exported from `initiativeLifecycleCanon.ts` as `P11_VALID_TRANSITIONS`, `P11_GATE_TRANSITIONS`, `p11IsValidTransition`, `p11ValidateTransition` — ensuring downstream consumers can import everything lifecycle-related from one module.

## Known limits

- `approved→executing` is a 3-step path in DB (`APPROVED→SCHEDULED→EXECUTING`) rather than a single hop; this is by design (scheduling gate)
- P03/P04/P02 consumers attach to handoff API in their packets
- Transition matrix implementation lives in `initiativeStatuses.ts` with re-exports in `initiativeLifecycleCanon.ts` (not a full move, to avoid breaking existing imports)
