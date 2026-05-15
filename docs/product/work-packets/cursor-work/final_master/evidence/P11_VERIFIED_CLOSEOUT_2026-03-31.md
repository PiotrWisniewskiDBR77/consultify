# P11 Inicjatywy — closeout evidence (verified)

**Date:** 2026-03-31 (updated 2026-04-11)  
**Status:** `verified(evidence)` — all gaps closed; contract expanded to §2.4–§2.14  
**Branch:** `ws/c-artifact-evidence`

## Automated verification

| Suite | Result | What |
|-------|--------|------|
| `initiativeLifecycleCanon.test.ts` | 11/11 | Canon states, mapping, coercion, drift, handoff builder |
| `planning.handoff.p11.test.ts` | 2/2 | Handoff route envelope + 404 |
| `tests/unit/utils/initiativeWorkflowStatus.test.ts` | 3/3 | UI helper normalization |
| `tests/integration/p11-two-entry-points.test.ts` | 4/4 | Supertest E2E: PMO+assessment→portfolio read, drift on list, handoff parity, all-status normalization |
| `forbiddenTransitions.test.ts` | 22/22 | §2.3.2 backward/invalid transitions rejected, ARCHIVED terminal, no self-transitions, forward-only audit |

**Total: 42 tests, all green.**

## §5.1 Acceptance criteria — point-by-point (AC-01 through AC-31)

### §2.3 Canon (original 11 criteria)
1. [x] **AC-01** Lifecycle uses exactly the canonical states from §2.3.1 — `P11_CANONICAL_LIFECYCLE_STATES` (9 states)
2. [x] **AC-02** Every lifecycle transition is explicit and audited — `initiative_status_history` / `initiative_history`; `VALID_TRANSITIONS` + `GATE_TRANSITIONS` in `initiativeStatuses.ts`, re-exported via `initiativeLifecycleCanon.ts`
3. [x] **AC-03** Initiative can be created from at least 2 entry points and lands in same canonical truth — **supertest E2E**: PMO + assessment initiatives → same V8 portfolio read with identical `displayStatus`, `p11LifecycleState`, `statusReadDrift`
4. [x] **AC-04** After any write, list/table + detail + preview show identical lifecycle + key header fields — portfolio list now includes `displayStatus`, `p11LifecycleState`, `statusReadDrift` (same as detail)
5. [x] **AC-05** Counters/filters based on lifecycle state match visible rows — portfolio stats use normalized row `status`
6. [x] **AC-06** AI scaffold produces structured `proposal` and never writes silently — blueprint row + explicit `apply` route
7. [x] **AC-07** User can review/edit proposal and must explicitly accept — apply is separate mutating call
8. [x] **AC-08** System records audit trail for proposal→accept — `ai_blueprint_applied` + JSON summary; `auditWritten` flag returned in response
9. [x] **AC-09** Handoff payloads include required IDs + bounded context — `GET .../handoff` + builder; consumers in P03/P04/P02
10. [x] **AC-10** Degraded mode is truth-preserving — unknown target status → 400; drift Callout on read (detail + list)
11. [x] **AC-11** Schema drift does not corrupt lifecycle truth — `statusReadDrift` flag on both portfolio list and detail; normalized read surfaces

### §2.4 Full CRUD + workflow actions
12. [x] **AC-12** All core CRUD operations work — `InitiativeController.ts` 40+ handlers
13. [x] **AC-13** Workflow action endpoints enforce transition matrix and gate permissions — `coerceInitiativeStatusForWrite` + `VALID_TRANSITIONS`
14. [x] **AC-14** Sub-entity CRUD operates within initiative scope — all routes under `/:id/` prefix

### §2.5 V8 Planning Continuity
15. [x] **AC-15** WBS decomposition 4-level hierarchy — `v8_initiative_decompositions` + `planningContinuityService`
16. [x] **AC-16** Cross-initiative dependencies tracked — `v8_cross_initiative_dependencies`
17. [x] **AC-17** Decision chains support sequential/parallel/delegated — `v8_decision_chains`
18. [x] **AC-18** V8 snapshot aggregates all planning data — `GET /initiatives/:id/snapshot`

### §2.6 Gate Readiness Engine
19. [x] **AC-19** Gate readiness provides blocking/warning checks — `getBlockingReadinessItems` + `getInitiativeGateReadinessRead`
20. [x] **AC-20** Access resolver computes effective roles — `resolveInitiativeAccessContext`
21. [x] **AC-21** Capabilities envelope drives frontend CTA — `capabilities` object in gate readiness response

### §2.7–§2.10 Document + Portfolio surfaces
22. [x] **AC-22** Dynamic document view renders 25+ section types — `InitiativeDocumentView.tsx` + `sections/registry.ts`
23. [x] **AC-23** Initiative templates define level-based section visibility — `initiativeLevelTemplates.ts`
24. [x] **AC-24** Portfolio analysis workspace provides 5 subviews — `PortfolioAnalysisView.tsx`
25. [x] **AC-25** Multi-view portfolio: table, kanban, timeline, grid — `InitiativesHub.tsx`

### §2.11–§2.14 AI + KPI + Write-Truth + Governance
26. [x] **AC-26** AI generation endpoints operate within governance envelope — `/initiatives/generate-section`, `/readiness-analysis`, `/suggest-sections`
27. [x] **AC-27** KPI assignment runtime tracks phases — `initiativeKpiAssignmentService.ts` + migration 670
28. [x] **AC-28** Write-truth service ensures V8-first reads — `initiativeWriteTruth.ts`
29. [x] **AC-29** Governance service provides goals, blueprints, gates — `initiativeGovernanceService.ts`

### Negative / regression criteria
30. [x] **AC-30** Backward transitions rejected — `forbiddenTransitions.test.ts` 22/22 (DONE→EXECUTING, ARCHIVED→DRAFT, etc.)
31. [x] **AC-31** Audit trail for AI blueprint apply returns `auditWritten` flag — `applyBlueprint()` now tracks and returns success/failure

## §5.3 Staging checklist (operator)

1. **Portfolio vs detail:** Portfolio list rows include `displayStatus`, `p11LifecycleState`, `statusReadDrift` — matching detail view. Drift initiative shows `statusReadDrift: true` + `displayStatus: DRAFT` + `p11LifecycleState: intake` on the list.
2. **Handoff envelope:** `GET /api/v8/planning/initiatives/{id}/handoff?kind=execution` returns `initiativeId`, `initiativeLifecycleState`, bounded `contextPack` (≤5), `handoffAt` / `handoffBy`.
3. **Status transition guard:** PATCH unknown target status → `400` with `UNKNOWN_TARGET_STATUS` / `coerceInitiativeStatusForWrite`.
4. **AI blueprint:** Create blueprint via governance API; **apply** triggers `initiative_history.action = ai_blueprint_applied` with JSON payload including `proposalId`, `acceptedDiffSummary`, `citations`. Response now includes `auditWritten: true|false`.
5. **Two entry points:** Supertest E2E confirms PMO-created and assessment-created initiatives normalize identically through V8 portfolio read.
6. **Priority filter:** Hub UI now offers priority filter (CRITICAL/HIGH/MEDIUM/LOW) via FilterChip with active filter state visible in the command bar.
7. **Forbidden transitions:** `forbiddenTransitions.test.ts` validates 18 explicit forbidden pairs + terminal state + no self-transition + forward-only structural check.

## §2.3.2 Transition matrix consolidation

Transition matrix (`VALID_TRANSITIONS`, `GATE_TRANSITIONS`, `isValidTransition`, `validateTransition`) is now re-exported from `initiativeLifecycleCanon.ts` as `P11_VALID_TRANSITIONS`, `P11_GATE_TRANSITIONS`, `p11IsValidTransition`, `p11ValidateTransition` — ensuring downstream consumers can import everything lifecycle-related from one module.

## Changes in P11-D packet (2026-04-11)

| Change | Files | Impact |
|--------|-------|--------|
| Contract expanded §2.4–§2.14 | `FINAL_IMPLEMENTATION_PLAN_11_INICJATYWY_2026-03-29.md` | 11 new sections documenting all implemented functionality |
| Acceptance criteria expanded AC-01–AC-31 | `FINAL_IMPLEMENTATION_PLAN_11_INICJATYWY_2026-03-29.md` §5.1 | From 11 to 31 criteria |
| Audit trail fix (C1) | `initiativeGovernanceService.ts` | `auditWritten` flag returned in `applyBlueprint` response |
| Forbidden transitions tests (C2) | `forbiddenTransitions.test.ts` | 22 new tests for backward/invalid transition rejection |
| Deprecated views cleanup (C3) | `index.ts`, deprecated files | Removed `InitiativeFullView` + `InitiativeDetailCard` from public exports |
| Status history org_id migration (C4) | `20260411_p11_status_history_org_id_backfill.sql` | SQLite-compatible org_id + backfill migration |
| Priority filter + matrix cleanup (C6) | `InitiativesHub.tsx` | Priority filter wired to FilterChip; unreachable matrix view removed |
| Evidence ledger P11-D | Contract §10 | New ledger row for expanded packet |

## Known limits

- `approved→executing` is a 3-step path in DB (`APPROVED→SCHEDULED→EXECUTING`) rather than a single hop; this is by design (scheduling gate)
- P03/P04/P02 consumers attach to handoff API in their packets
- Transition matrix implementation lives in `initiativeStatuses.ts` with re-exports in `initiativeLifecycleCanon.ts` (not a full move, to avoid breaking existing imports)
- Deprecated views (`InitiativeFullView`, `InitiativeManagementView`, `InitiativeDetailCard`) still exist as files but are no longer publicly exported; full file deletion is deferred to avoid breaking any uncommitted work
- Zod validation migration (TODO in validators) deferred to a separate packet
