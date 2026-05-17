---
module_id: MODULE_RESULTS
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Data & Integrations — Rezultaty / Results & Value Realization

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- KPI, scorecard, baseline, target, actual, deviation, explanation, corrective action, ROI record and evidence.

## Function Data Responsibility Map

- `RZ_INITIATIVES_TRACKING`: initiative realization linkage and corrective loop context.
- `RZ_KPI_WORKSPACE`: KPI datasets, mappings, scorecards and deviation streams.
- `RZ_REPORTS_WORKSPACE`: results reporting datasets and lineage context.
- `RZ_ROI_TRACKING` and `RZ_ROI_ANALYSIS`: ROI assumptions, realizations and variance evidence.
- `RZ_KPI_OKR_ROUTE`: route-level KPI-focused read/write surface.

## Reports Workspace Provenance Contract (RZ-REP)

`RZ_REPORTS_WORKSPACE` report snapshots should keep explicit fields:

- `template_family` (`R1`/`R2`/`R3`/`R4`),
- `scope_refs` (initiative IDs, KPI IDs, period),
- `source_records` (source type/reference/system),
- `source_confidence` (trusted/stale/disputed or numeric confidence),
- `evidence_refs` (documents, links, uploads),
- `approval_status` (`draft`, `under_review`, `approved`, `rejected`),
- `finalization_status` (`not_finalized`, `finalized`),
- `reviewed_at` / `reviewed_by`.

Rules:

- `MISSING_EVIDENCE` is an explicit state derived when required evidence/source is absent.
- `MISSING_EVIDENCE` must prevent transition to `approved`.
- `refresh` may update snapshot content but must not mutate approval/finalization status implicitly.

## ROI Ownership Boundary (Results vs Finance)

| Domain object / workflow | Canonical owner | Allowed cross-module linkage | Forbidden transfer |
| --- | --- | --- | --- |
| ROI assumptions and realized entries in `/benefits` (`roi` tab) | `07_rezultaty` (Results) | Link to Finance analysis artifacts as evidence/reference. | Finance cannot silently overwrite these values. |
| KPI/ROI reconciliation trigger and tracking status in Results runtime | `07_rezultaty` (Results) | Results can open reconciliation context for Finance review. | Results must not mutate Finance model truth directly. |
| Finance interpretation/model semantics (valuation, budget, CFO logic) | `08_finanse` (Finance) | Returned to Results as linked interpretation/evidence context. | Must not be materialized as a second ROI truth object in Results. |
| Metric-finance linkage metadata (`MetricFinanceLink`, driver/reconciliation refs) | shared linkage contract | Shared as governed linkage objects with explicit provenance. | No hidden write path bypassing explicit user/governance action. |

Canonical boundary rule:

- KPI/ROI operational truth remains in Results.
- Finance model truth remains in Finance.
- Linkage explains relationship; it does not collapse ownership domains.

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.
- MUST keep Results ROI writes explicit (no hidden write to Finance objects).
- MUST keep Finance interpretation as linked context, not silent value replacement.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.
- MUST NOT leak ownership by allowing `/benefits` ROI actions to mutate Finance-owned model truth.
- MUST NOT allow Finance linkage sync to silently overwrite Results-tracked ROI assumptions/realized entries.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.
- [ ] ROI ownership boundary is explicit: Results owns tracked ROI values, Finance owns finance-model truth.
- [ ] ROI-Finance linkage is evidence-based and auditable (no hidden write, no second truth materialization).

## ROI Tracking Quality Delta (`RZ_ROI_TRACKING`)

| Area | As-is | Target quality | Priority |
| --- | --- | --- | --- |
| Ownership boundary | Explicit in docs, partial negative-test depth | dedicated proof path for no Results->Finance write leak | `P2` |
| Assumption lineage | assumption writes exist with baseline provenance | per-source lineage matrix (`manual`, `synced`, `finance-linked`) | `P2` |
| Read-back certainty | component-level read-back evidence exists | explicit mutation -> read-back trust contract across critical flows | `P1` |
| Variance handling | variance surface is present | explicit degraded/compatibility variance trust state evidence | `P1` |

## Related Sources

- `DRD/consultify/docs/product/RESULTS_V8_SSOT.md`
- `DRD/consultify/docs/product/KPI_FULL_SYSTEM_CANON_V8.md`
- `DRD/consultify/docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
- `DRD/consultify/docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `DRD/consultify/docs/product/work-packets/T2_RESULTS_KPI_ROI_CHARTER.md`
- `DRD/consultify/docs/UI_UX/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md`
