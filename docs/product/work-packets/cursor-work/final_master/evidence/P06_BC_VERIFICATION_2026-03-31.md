# P06-B/C Verification — Radar Triage Cockpit

**Date**: 2026-03-31
**Packet**: P06-B (signal→action continuity) + P06-C (verification)
**Status**: verified(evidence)

## Technical closure

### P06-B: Signal→Action Continuity
1. **Radar Triage Service** — `server/src/services/v8/radarTriageService.ts`
   - 5 stable categories: execution_delivery, decision_alignment, finance_kpi, governance_compliance, external_change
   - No "Misc" or "Interesting" category
2. **Ranking Grammar** — deterministic P0/P1/P2
   - Score formula: (4·I + 3·U + 2·S + 2·A) · conf(C) + fresh(F) - dup
   - Hard-gate rules: GOVERNANCE_DEADLINE_7D, EXECUTION_BLOCKER_D7, DECISION_72H, KPI_THRESHOLD
   - Tie-breakers: hard-gate > non hard-gate; higher U, then I, then A
3. **Why-Now Payload** — rationale_text (2-4 sentences) + time_window + primary_driver
   - Evidence pointers + last_observed_at + source_coverage
   - Uncertainty boundary: missing_inputs, conflicts, what_would_change_ranking
4. **Handoff** — `executeHandoff` with full `radar_handoff_context`
   - To Inicjatywy: initiative_suggestion (problem_statement, proposed_outcome, ...)
   - To Wdrożenia: deployment_suggestion (affected_milestone, blocker_summary, ...)
   - To Notatki: note_suggestion (summary, assumptions, decision_needed, links)
5. **Degraded States** — ready, degraded_missing_data, degraded_conflict, degraded_stale, blocked_permission
6. **Routes**: 4 endpoints under `/api/v8/radar-triage/*`
7. **Migration**: `20260331_v8_radar_triage_p06b.sql`

### P06-C: Verification
- Contract tests: `tests/integration/p06-radar-triage.contract.test.ts`
- Smoke: `server/scripts/smoke-p06-radar-triage-c.ts`

## Staging checklist
- [x] 3 signal types with explainability + next action
- [x] Landing in target module preserves context (handoff payload)
- [x] Uncertainty boundary visible in degraded states
- [x] No overclaim — degraded signals show limitations

## Rollback plan
- Disable radar-triage routing; preserve neutral view
- No data destruction

## Known limits
None — all P06 contract §2.3 requirements implemented.
