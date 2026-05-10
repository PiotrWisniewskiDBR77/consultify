---
module_id: MODULE_RESULTS
function_id: RZ_INITIATIVES_TRACKING
function_name: Results — Initiatives Tracking
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Initiatives Tracking

## 1. Function Identity
- Function ID: `RZ_INITIATIVES_TRACKING`
- Runtime anchor: `ResultsHub` tab `results_initiatives`
- Route scope: `/benefits`
- Feature state: `real`

## 2. User Job and Business Outcome
- Track delivery value and initiative realization outcomes against expected benefits.

## 3. Trigger and Entry Points
- Open `/benefits` with tab `results_initiatives`.

## 4. UI Component Footprint
- `ResultsHub` initiatives tracking workspace and linked initiative status controls.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: initiative status, expected value, realized value, owner and timeline attributes.
- Upstream dependencies: initiative portfolio runtime (`05_inicjatywy`) and execution updates (`06_realizacja`).
- API/model dependency: results aggregation endpoints behind `ResultsHub` data loading.
- Data freshness rule: initiative status and value deltas must reflect latest persisted records.

## 6. Outputs and Side Effects
- Output artifacts: updated initiative realization rows and value tracking indicators in Results.
- Downstream handoff: synchronized status view for leadership review and ROI tracking.
- Side effects: user-visible recalculation of initiative health and realization labels.

## 7. Ownership and Handoff Boundaries
- Canonical owner: module `07_rezultaty` owns realized-value tracking presentation.
- Handoff: `05_inicjatywy` and `06_realizacja` provide upstream lifecycle inputs; Results does not own roadmap planning.
- Forbidden ownership: this function must not mutate source initiative strategy definitions.

## 8. Runtime States and UX Behavior
- Loading: show progress state until initiatives tracking data is resolved.
- Empty: show guided empty state when no initiatives are linked to results.
- Error: show non-destructive error state with retry.
- Degraded: render partial rows with stale-data warning if one dependency fails.
- Success: show complete initiative tracking matrix with next-action cues.
- Next action guidance: direct user to portfolio/execution module when source data is missing.

## 9. AI, Source, Evidence, Approval
- AI placement: contextual AI actions remain in Menu 3 command row.
- Source visibility: each tracked value should expose source path and module origin.
- Approval: high-impact state changes require explicit user confirmation.
- Audit evidence: status transitions and value updates must be visible in runtime history.

## 10. Security, Roles, and Tenancy
- Allowed roles: tenant members with access to results and initiative visibility.
- Denied roles: unauthorized users and foreign-tenant identities.
- ACL boundary: tenant-scoped initiative/result data only.
- Failure behavior: deny-by-default when tenant or permission context is missing.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - initiatives tab renders and maps rows to tracked realization state;
  - results view reflects initiative status/value transitions without hidden writes;
  - empty/error/degraded states expose honest user guidance.
- Known `doc_gap`: detailed per-field source lineage still requires deep evidence linking rollout.
- Known `code_gap`: dedicated module-local regression test for initiative tracking remains to be expanded.

- Route evidence: module route/view scope for `07_rezultaty` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `07_rezultaty` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `07_rezultaty` user flows.

## 12. Open Risks and Change Log
- Risks: trust drop if initiative value lineage is not clearly visible in UI.
- Open decisions: whether results can emit lightweight proposal actions back to execution.
- Change log: `2026-05-10` expanded from compact summary to full 12-section standard.
