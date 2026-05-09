---
module_id: MODULE_RESULTS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Rezultaty / Results & Value Realization

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST distinguish metric truth (Results) from modeled financial truth (Finance).
- MUST explain deviations and require corrective action path when thresholds are crossed.
- MUST keep evidence and approval state for realized value.

## Must Not

- MUST NOT silently mutate high-impact objects.
- MUST NOT show fake success, hide blocking errors or leave users in infinite loading states.
- MUST NOT bypass source, role, approval or tenant constraints for convenience.

## Should

- SHOULD expose recovery paths for failed or degraded states.
- SHOULD make AI-generated proposals reviewable before they become durable state.

## Acceptance Criteria

- [ ] Main happy path can be executed end-to-end with visible state transitions.
- [ ] Error/degraded/empty states are explicit and recoverable.
- [ ] Any AI or automation action is auditable and approval-aware.

## Related Sources

- `DRD/consultify/docs/product/RESULTS_V8_SSOT.md`
- `DRD/consultify/docs/product/KPI_FULL_SYSTEM_CANON_V8.md`
- `DRD/consultify/docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
- `DRD/consultify/docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `DRD/consultify/docs/product/work-packets/T2_RESULTS_KPI_ROI_CHARTER.md`
- `DRD/consultify/docs/UI_UX/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md`
