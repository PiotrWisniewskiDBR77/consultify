---
module_id: MODULE_RESULTS
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Rezultaty / Results & Value Realization

## Purpose

System odpowiedzialności za wartość: KPI, baseline, target, actual, deviation, corrective action, ROI reconciliation, evidence and verified result.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Owning financial model calculations that belong in Finance.
- Owning task execution runtime that belongs in Realizacja.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/RESULTS_V8_SSOT.md`
- `DRD/consultify/docs/product/KPI_FULL_SYSTEM_CANON_V8.md`
- `DRD/consultify/docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
- `DRD/consultify/docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `DRD/consultify/docs/product/work-packets/T2_RESULTS_KPI_ROI_CHARTER.md`
- `DRD/consultify/docs/UI_UX/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md`
