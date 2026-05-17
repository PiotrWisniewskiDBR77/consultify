---
doc_id: END_TO_END_WORKFLOWS
doc_kind: SYSTEM_CONTRACT
owner: user
status: active
last_updated: 2026-05-10
---

# End-to-End Workflows (System-Level)

## Purpose

Define canonical cross-module workflows that represent whole-application delivery, not isolated module actions.

Each workflow is a contract that must remain coherent across routing, ownership, evidence, and approvals.

## Workflow Template

Each workflow must include:

- start trigger,
- module path,
- objects and ownership transitions,
- approval gates,
- evidence bundle (`route`, `component`, `api`, `test`),
- failure/degraded fallback and next action.

## Canonical E2E Workflows

### WF-01 Discovery to Initiative Portfolio

- Path: `01_czat -> 03_wywiad -> 04_narzedzia -> 05_inicjatywy`
- Outcome: evidence-backed initiative candidate enters initiative portfolio.
- Owner transitions: `Conversation` -> findings -> `Initiative`.
- Approval gate: initiative creation/approval in owner flow.

### WF-02 Initiative to Execution to Results

- Path: `05_inicjatywy -> 06_realizacja -> 07_rezultaty`
- Outcome: approved initiative becomes tasks and measurable outcomes.
- Owner transitions: `Initiative` -> `Task` -> `KPI`.
- Approval gate: initiative state transitions and high-impact execution updates.

### WF-03 Results and Finance to Client Outputs

- Path: `07_rezultaty -> 08_finanse -> 09_outputs`
- Outcome: validated business + financial story packaged for delivery.
- Owner transitions: `KPI/ROI` + `FinancialModel` -> output package.
- Approval gate: export/release approval before client delivery.

### WF-04 Output Specialization Lanes

- Path: `09_outputs -> 10_dokumenty|11_tabele|12_prezentacje`
- Outcome: editable artifacts prepared in specialized lanes.
- Owner transitions: output package request -> artifact form owner.
- Approval gate: publish/export gate remains explicit.

### WF-05 Meeting Follow-Up Loop

- Path: `13_meeting -> 02_moja-praca -> 05_inicjatywy|06_realizacja`
- Outcome: meeting decisions/follow-ups become actionable workload.
- Owner transitions: meeting decision/task refs -> owner module updates.
- Approval gate: decision acceptance and scoped task ownership.

### WF-06 Control Plane Governance Flow

- Path: `superadmin -> 17_panel-administratora -> all modules`
- Outcome: policy constraints propagated without domain ownership drift.
- Owner transitions: none for domain objects (policy only).
- Approval gate: governance audit trail for policy changes.

## E2E Integrity Rules

1. No workflow may skip canonical owner module for object mutation.
2. No workflow may hide approvals for high-impact actions.
3. Degraded state must point user to next valid module/action.
4. Every workflow change must update module contracts and this file.

## Required Evidence Mapping

For each workflow, maintain at least:

- route evidence: route declarations and entry paths,
- component evidence: major view/container surfaces,
- api evidence: backend routes/services that execute transitions,
- test evidence: integration/e2e suites for critical path.

## Composition and Artifact Alignment

Every workflow implementation must align with:

- component composition canon: `APPROVED_COMPONENT_COMPOSITION.md`
- artifact ownership and promotion canon: `ARTIFACT_LINEAGE_MATRIX.md`

This keeps E2E delivery aligned with approved UI components and canonical artifact lifecycle.
