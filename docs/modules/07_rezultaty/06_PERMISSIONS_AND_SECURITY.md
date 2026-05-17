---
module_id: MODULE_RESULTS
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Permissions & Security — Rezultaty / Results & Value Realization

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- Finance-confirmed values and executive-approved results require role/approval controls.

Function-level enforcement applies uniformly to: `RZ_INITIATIVES_TRACKING`, `RZ_KPI_WORKSPACE`, `RZ_REPORTS_WORKSPACE`, `RZ_ROI_TRACKING`, `RZ_ROI_ANALYSIS`, `RZ_KPI_OKR_ROUTE`.

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.

## Acceptance Criteria

- [ ] Unauthorized users cannot view or mutate protected objects.
- [ ] High-impact actions require explicit approval and produce audit evidence.
- [ ] Sensitive data remains scoped to allowed tenant/project/user context.

## KPI Workspace Security Strategy (`RZ_KPI_WORKSPACE`)

### Approval and mutation policy

- KPI value writes (`create/update/delete/value record`) MUST remain explicit user actions in `/benefits` lane.
- KPI high-impact review states MUST require explicit approval intent; no implicit/hidden finalization is allowed.
- AI assistance MUST remain advisory and MUST NOT mutate KPI truth without explicit user approval.

### Source trust and tenancy policy

- KPI trust posture (`trusted/stale/disputed`) SHOULD be visible before operator approval actions.
- Finance linkage context MUST NOT overwrite KPI truth; linkage is interpretive and reviewable.
- Tenant boundary violations or missing ACL context MUST hard-fail with deny-by-default behavior.

### Evidence binding for critical security claims

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| KPI writes are explicit and user-triggered. | `/benefits?tab=results_kpi` | `src/components/Results/ResultsHub.tsx` mutation handlers | `src/services/api/v8/results.ts` (`createKpiTimeSeriesValue`, `deleteKpi`) | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`, `tests/unit/services/v8-results-api.test.ts` | `PASS` |
| No hidden cross-domain overwrite to Finance truth. | Results route boundary (`/benefits`) | KPI workspace remains Results-owned lane in `ResultsHub` | linkage doctrine in `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | no dedicated negative mutation test across modules | `PASS_WITH_P2` |
| Approval path is explicit and auditable for high-impact KPI decisions. | KPI lane review path in `/benefits` | KPI mode/command flow in `ResultsHub` | V8 KPI/report API seams in `src/services/api/v8/results.ts` | direct approval-state regression in KPI branch not yet dedicated | `PASS_WITH_P2` |

## ROI Tracking Security Strategy (`RZ_ROI_TRACKING`)

### Approval and mutation policy

- ROI assumptions and realized-value writes MUST remain explicit user actions in `/benefits?tab=roi`.
- Hidden ROI-to-Finance writes are forbidden; cross-module linkage is evidence-only.
- AI assistance MUST remain advisory and MUST NOT finalize or mutate ROI/Finance truth silently.

### Ownership and tenancy policy

- Results owns ROI tracking truth and write path.
- Finance owns model/accounting interpretation and review semantics.
- Missing ACL/tenant certainty MUST hard-fail with deny-by-default behavior.

### Evidence binding for critical security claims

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| ROI writes are explicit and user-triggered. | `/benefits?tab=roi` | `src/components/Results/ResultsHub.tsx`, `src/components/Results/ROIDetailDrawer.tsx` | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`) | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| No ownership leak from Results ROI flow to Finance model truth. | Results route boundary (`/benefits`) | ROI tracking remains Results-owned lane/components | ownership doctrine in `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | dedicated negative cross-module write assertion not found | `PASS_WITH_P2` |
| Read-back and degraded variance handling remain explicit before trust/approval posture. | ROI lane runtime flow in `/benefits` | ROI view/drawer state handling in Results components | V8-first ROI reads/writes with bounded fallback in results API seam | ROI degraded/read-back depth remains component-focused | `PASS_WITH_P2` |
