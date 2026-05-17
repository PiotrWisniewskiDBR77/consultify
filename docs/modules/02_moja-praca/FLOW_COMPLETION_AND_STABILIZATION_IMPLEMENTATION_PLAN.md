---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_PROCESS_FLOW
doc_kind: IMPLEMENTATION_PLAN
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Implementation Plan — MW_IDEAS_PROCESS_FLOW Completion & Stabilization

## 0. Scope and objective

This plan defines the implementation-ready path to complete and stabilize `MW_IDEAS_PROCESS_FLOW` inside module `02_moja-praca`.

Target outcome:

- generation works reliably end-to-end,
- governance and evidence rules are enforceable in runtime,
- handoff to owner modules is explicit and auditable,
- release readiness is measurable by gate criteria.

Out of scope for this cycle:

- standalone process-mining platform,
- full workflow-execution engine,
- cross-module ownership remapping.

## 1. Priority model (hard order)

Execution order is mandatory:

1. `P0` — unblock and stabilize generation chain.
2. `P0` — enforce governance, approvals, and evidence safety.
3. `P1` — add process intelligence and advanced analysis packs.
4. `P1` — strengthen conversion packs to initiatives/tasks/SOP/report.
5. `P2` — BPMN/VSM interoperability and external execution/mining connectors.

No work may start on `P1` while any `P0` gate is open.

## 2. Workstreams and deliverables

## 2.1 Workstream A — Generation Runtime Spine (`P0`)

Goal: one canonical generation path for Process Flow.

Deliverables:

- single canonical FE -> BE generation contract for Flow,
- deterministic AI panel entrypoint in Flow UX,
- proposal lifecycle: `generate -> preview -> accept/reject -> persist`,
- runtime fallback when generation fails (no dead-end UX).

Done criteria:

- user can generate from prompt in one click,
- generated proposal is visible and resolvable,
- accepted proposal persists and survives refresh,
- failed generation provides explicit retry/recovery.

## 2.2 Workstream B — Governance and Safety Hardening (`P0`)

Goal: high-impact actions remain guard-railed and evidence-aware.

Deliverables:

- approval gates before high-impact conversion,
- visible source/provenance and confidence posture for critical nodes,
- conversion blockers when required evidence/owner/conditions are missing,
- explicit deny-by-default behavior for uncertain ACL/tenant cases.

Done criteria:

- no silent high-impact mutation path,
- blocked conversion explains exact reason and recovery action,
- critical steps expose source/evidence state before conversion.

## 2.3 Workstream C — Validation and Recovery (`P0`)

Goal: stable runtime under error/degraded conditions.

Deliverables:

- clear classification of loading/error/degraded states,
- conflict-safe map sync and recover path,
- revert-to-last-valid behavior for invalid graph transitions,
- operational diagnostics for generation/sync failures.

Done criteria:

- no blank/dead canvas on recoverable errors,
- user can always choose retry, restore, or safe fallback,
- map conflict path is deterministic and auditable.

## 2.4 Workstream D — Process Intelligence Layer (`P1`)

Goal: transform Flow from drawing UI into diagnosis engine.

Deliverables:

- AI analysis bundle: bottlenecks, missing owner, unclear decision, compliance gap,
- Current/Future/Target view posture with explicit comparison context,
- VSM metrics layer: lead time, cycle time, waiting, process efficiency,
- Process brief package for governance review.

Done criteria:

- user receives actionable diagnosis, not only graph rendering,
- each recommendation has provenance and confidence,
- analysis can be exported as structured brief.

## 2.5 Workstream E — Conversion Packs (`P1`)

Goal: operational handoff from Flow into execution artifacts.

Deliverables:

- `Flow -> Initiative candidate` pack,
- `Flow -> Task/action chain` pack,
- `Flow -> SOP/checklist/report` pack,
- owner read-back confirmation contract for high-impact conversion.

Done criteria:

- conversion payload always includes source/evidence + readiness posture,
- owner module confirms mutation before success status is shown,
- conversion gaps are reported as `code_gap`, not hidden.

## 2.6 Workstream F — Interop and Connectors (`P2`)

Goal: selective expansion after core reliability.

Deliverables:

- BPMN XML import/export posture (advanced mode),
- deeper VSM expansion and archetype templates,
- optional connectors to execution automation,
- optional process-mining bridge for mature data environments.

Done criteria:

- interop does not degrade core Flow stability,
- all connector actions remain approval-gated.

## 3. Sprint plan (implementation sequence)

### Sprint S0 — Stabilization baseline (`P0`)

- close generation-chain inconsistency,
- lock one canonical API contract,
- activate AI panel entrypoint and proposal lifecycle,
- add smoke telemetry and failure diagnostics.

Gate target: `PASS` on Generation Spine checklist.

### Sprint S1 — Governance and recovery (`P0`)

- enforce approval and evidence blockers,
- complete degraded/error recovery behaviors,
- close top reliability regressions from S0.

Gate target: `PASS` on Safety and Recovery checklist.

### Sprint S2 — Intelligence and conversion (`P1`)

- ship process diagnostics + VSM metrics bundle,
- ship conversion packs to initiative/task/SOP/report,
- add owner read-back confirmation flow.

Gate target: `PASS_WITH_P2` allowed only for external connector items.

### Sprint S3 — Interop extensions (`P2`)

- add BPMN/interoperability and optional connectors,
- only after S0-S2 are fully accepted.

Gate target: `REVIEW` or `APPROVED` depending on release scope.

## 4. Evidence and test matrix (mandatory)

Every critical claim must bind to:

- route evidence,
- component evidence,
- API evidence,
- test evidence.

Minimum test packs for completion:

- Unit:
  - proposal mapper/apply/reject,
  - guard-rail validator,
  - evidence blocker rules.
- Integration:
  - generate API contract,
  - map sync conflict and recovery,
  - conversion payload and owner read-back contract.
- E2E:
  - `generate -> accept -> save -> convert -> owner read-back`.

Release cannot be `APPROVED` without the E2E chain above.

## 5. Gate model and status vocabulary

Allowed statuses:

- `APPROVED`,
- `PASS_WITH_P2`,
- `BLOCKED_P1`,
- `NO_GO`.

Hard stops:

- generation chain broken in production path,
- missing evidence binding for critical claims,
- silent mutation path across module ownership boundary,
- unresolved handoff conflict with owner modules.

## 6. Cross-module impact and boundaries

`MW_IDEAS_PROCESS_FLOW` may hand off to:

- `05_inicjatywy` (initiative candidates),
- `06_realizacja` (task/action candidates),
- artifact lanes (`10/11/12/09`) as structured conversion payload.

Boundary invariant:

- Flow never performs canonical owner mutation directly;
- owner module review/read-back is required for high-impact completion.

If handoff contract changes:

- update `MODULE_INTERACTION_GRAPH.md` and/or `ARTIFACT_LINEAGE_MATRIX.md` in same delivery cycle.

## 7. Risk register

- `R1` Generation mismatch risk: multiple AI pathways diverge in behavior.
  - Mitigation: single canonical generator contract in `P0`.
- `R2` Governance bypass risk: conversion success shown without owner read-back.
  - Mitigation: enforce success only after owner confirmation.
- `R3` Reliability risk: sync conflict causes silent state loss.
  - Mitigation: explicit conflict resolver + restore path.
- `R4` Scope creep risk: interop/connectors start before core is stable.
  - Mitigation: hard order `P0 -> P1 -> P2`.

## 8. Implementation handoff checklist

Before starting each sprint:

- scope and owners confirmed,
- packet updated with sprint target and non-goals,
- open questions tracked (max 3),
- required evidence placeholders prepared.

Before closing each sprint:

- changed contracts updated (`functions`, `04_UI_UX`, `07_ACCEPTANCE_AND_TESTS`),
- runtime/test evidence linked,
- gate decision recorded,
- remaining risks and next sprint deltas documented.

## 9. Final completion definition

`MW_IDEAS_PROCESS_FLOW` is considered complete for this plan only when:

- all `P0` and `P1` gates are passed,
- generation and conversion chains are operational and test-proven,
- governance/evidence/approval constraints are runtime-enforced,
- cross-module handoff is conflict-free and owner-accepted,
- packet and module contracts are coherent with runtime evidence.
