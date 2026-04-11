# P05-B/C Verification — Finance Lane E2E

**Date**: 2026-03-31
**Packet**: P05-B (E2E closure) + P05-C (verification)
**Status**: verified(evidence)

## Technical closure

### P05-B: Import→Analysis→Mutation→Readback
1. **Finance Lane Service** — `server/src/services/v8/financeLaneService.ts`
   - `startLaneRun`, `advanceLaneStep`, `getLaneRun`, `getLaneRuns`
   - 4-step canonical order: import → analysis → mutation → readback
   - Failed import blocks downstream mutation
2. **Error Taxonomy** — 6 import outcomes + 4 mutation outcomes
   - Import: completed, completed_with_warnings, failed, queued, running, cancelled
   - Mutation: applied, failed, conflict, rolled_back
3. **Mutation Audit** — `recordMutationAudit`, `getMutationAudits`
   - who/what/when + outcome for every mutation
4. **Versioning** — `createVersionSnapshot`, `finalizeSwitchover`, `getVersionSnapshots`
   - current vs actual with explicit switchover boundary
5. **KPI↔Finance Coherence** — `checkKpiLinkageCoherence`
   - Returns: coherent | stale | unavailable
6. **Degraded Scenarios** — 10 explicit degraded reasons per §2.3.6
7. **Routes**: 11 new endpoints under `/api/v8/finance/lane/*` and `/api/v8/finance/versions/*`
8. **Migration**: `20260331_v8_finance_lane_p05b.sql`

### P05-C: Verification
- Contract tests: `tests/integration/p05-finance-lane.contract.test.ts`
- Integration tests: `server/src/routes/v8/__tests__/p05-finance-lane.test.ts` (32 tests — lane CRUD, E2E workflow, mutation audit, versioning, KPI coherence, canon unit tests, P05_INVALID_OUTCOME, completed_with_warnings transition, concurrent prevention 409, permission denied 403)
- Hook tests: `tests/components/Economics/useFinanceLane.test.tsx` (8 tests — mount, active run, degraded severity mapping, startRun, advanceStep, refreshCoherence, error fallback, error message mapping)
- Component tests: `tests/components/Economics/FinanceLaneStrip.test.tsx` (9 tests — strip rendering, degraded badge, KPI chip, version badge, panel sections)
- E2E smoke: `tests/e2e/smoke/p05-finance-lane.spec.ts` (12 tests — full lane flow, mutation audit POST/GET, KPI coherence, version snapshot lifecycle)
- Canon module: `server/src/services/v8/financeCanon.ts` (P05 acceptance checklist, degraded scenarios, anti-duplicate rules, ownership boundary, version semantics, error taxonomy)

## Staging checklist
- [x] Import → analysis → mutation → readback E2E
- [x] Failed import → degraded state + next action
- [x] Mutation audit trail (who/what/when)
- [x] Version switchover explicit and reviewable
- [x] KPI readback coherent on declared linkage path
- [x] P05_INVALID_OUTCOME returns 422
- [x] completed_with_warnings adds degraded entry + advances
- [x] Concurrent lane start returns 409
- [x] Permission denied returns 403
- [x] Fail-closed permission check on DB error

## Rollback plan
- Disable mutation routes; preserve read-only + audit
- No data destruction

## GAP closure (commit 6ab53c8553)

| GAP | Fix |
|-----|-----|
| Mutation failure no auto-audit | `advanceLaneStep` now calls `recordMutationAudit` automatically on mutation failure/conflict |
| KPI coherence not a hard gate | Readback confirmation blocked if coherence is `stale` (`readbackConfirmed = false`) |
| No step+outcome validation | `validOutcomes` per step; throws `P05_INVALID_OUTCOME` for invalid combos |
| Missing degraded scenarios | Added `mapping_missing`, `schema_drift` import outcomes + degraded entries |
| Import outcomes incomplete | `ImportOutcomeValues` extended to 8 (added `mapping_missing`, `schema_drift`) |

## Remediation R1-R3 (2026-04-11)

| GAP | Fix |
|-----|-----|
| GAP-B1: degraded_json overwrite race | `checkKpiLinkageCoherence` no longer writes DB directly; caller handles reconciliation_mismatch |
| GAP-B2: Permission fail-open | Changed to fail-closed (`hasPermission = false`) on DB error |
| GAP-B3: Concurrent start TOCTOU | Atomic `INSERT...WHERE NOT EXISTS` pattern, no separate SELECT+INSERT |
| GAP-B4: switchover_misconfigured not in degraded | `finalizeSwitchover` now pushes to active run's degraded array before throwing |
| GAP-B5: HTTP status codes | P05_CONCURRENT_RUN_EXISTS → 409, P05_PERMISSION_DENIED → 403, P05_INVALID_OUTCOME → 422, P05_SWITCHOVER_MISCONFIGURED → 409 |
| GAP-F1: financeErrorMap orphaned | Wired into `useFinanceLane` and `FinanceHub` error handlers |
| GAP-F2: FinanceVersionTimeline orphaned | Wired into `FinanceLanePanel` and `FinancePreviewPanel` |
| GAP-F3: No i18n on lane components | Added `useTranslation` to all 4 lane components |
| GAP-F4: Server output row shape | `serverRows` now produces `FinanceModelForecastLine` shape |
| GAP-F5: Advance drops detail | Added text input to advance dropdown |
| GAP-U1: Custom drawer | FinanceLanePanel uses Dialog/DialogOverlay pattern with slide-in animation |
| GAP-T1/T2: Missing outcome tests | Added P05_INVALID_OUTCOME (422) + completed_with_warnings transition tests |
| GAP-T3: Mutation audit in E2E | Added POST/GET mutation-audit steps to E2E smoke |

## Known limits
None — all P05 contract §2.3 requirements implemented. 8 import outcomes, auto-audit on mutation failure, KPI coherence hard gate, full degraded coverage. All identified gaps (B1-B5, F1-F5, U1, T1-T3) remediated.
