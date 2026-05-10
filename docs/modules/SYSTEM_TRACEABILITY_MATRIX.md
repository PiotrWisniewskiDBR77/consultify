---
doc_id: SYSTEM_TRACEABILITY_MATRIX
doc_kind: ENTERPRISE_GOVERNANCE_MATRIX
owner: user
status: active
last_updated: 2026-05-10
---

# System Traceability Matrix

## Purpose

Provide one application-wide traceability map from requirements to runtime evidence.

This matrix is the bridge between:

- RAW author input,
- module contracts,
- function contracts,
- object and artifact ownership,
- runtime routes/components/APIs,
- tests and release gates.

## Traceability Rule

Every critical requirement must resolve to:

`requirement -> module -> function -> object/artifact -> route -> component -> API -> test -> owner`

If any link is missing, the requirement is not release-ready.

## Core Traceability Rows

| Requirement class | Module scope | Function scope | Object/artifact | Runtime evidence | Test evidence | Owner source |
| --- | --- | --- | --- | --- | --- | --- |
| Chat/AI proposal work | `01_czat` | `CZ_CHAT_ENGINE`, `CZ_CANVAS_WORKSPACE` | `Conversation`, proposal, source refs | route + chat components + API services | chat/e2e smoke | function contracts + ownership registry |
| Personal work routing | `02_moja-praca` | all `MW_*` | task/action pointer, idea, note | My Work routes + hub/workspace components | My Work regression/e2e | function contracts |
| Discovery and diagnosis | `03_wywiad`, `04_narzedzia` | `WY_*`, `NZ_*` | finding, evidence, assessment output | interview/tool views + APIs | integration/e2e | module contracts |
| Initiative lifecycle | `05_inicjatywy` | `IN_*` | `Initiative`, decision | portfolio/roadmap routes + services | initiative tests | object graph + function contracts |
| Execution lifecycle | `06_realizacja` | `RL_*` | `Task`, blocker, delivery evidence | implementation/execution routes | execution tests | module contracts |
| Results and finance | `07_rezultaty`, `08_finanse` | `RZ_*`, `FN_*` | `KPI`, `ROI`, `FinancialModel` | results/finance views + APIs | results/finance tests | object graph |
| Outputs and artifacts | `09_outputs` to `13_meeting` | `OUT_*`, `DOC_*`, `TB_*`, `PR_*`, `ME_*` | output package, document, table, deck, meeting pack | output/artifact routes + components | artifact/e2e tests | artifact lineage matrix |
| Integrations and marketplace | `14_mcp-iris`, `15_mcp-marketplace` | `IRIS_*`, `MCPM_*` | connector execution report, capability listing | MCP routes/components/APIs | integration tests | control plane + function contracts |
| Organization and admin planes | `16_organizacja`, `17_panel-administratora`, `18_ustawienia` | `ORG_*`, `ADM_*`, `SET_*` | org context, policy, preference | org/admin/settings routes + APIs | readiness/admin smoke | control plane contract |
| Partner workflow | `19_portal-partnerski` | `PART_*` | partner deliverable | partner routes/components/APIs | partner smoke/e2e | module contract |

## RAW Conversion Gate

Before RAW input can become implementation scope:

1. Add or update a traceability row.
2. Identify impacted module(s) and function(s).
3. Link object/artifact owner.
4. Identify evidence that exists and evidence that must be created.
5. Add acceptance criteria in module/function contracts.

## Required Evidence Granularity

- route evidence: exact route or route file reference,
- component evidence: exact view/container/component path,
- API evidence: backend route/service or frontend API boundary,
- test evidence: exact test file or planned test pack with owner/date.

## Release Use

Release readiness requires all critical rows to be either:

- `COMPLETE` with evidence, or
- `DEFERRED_P2` with owner, due date, and release acceptance.
