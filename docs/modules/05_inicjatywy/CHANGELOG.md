---
module_id: MODULE_INITIATIVES
doc_kind: CHANGELOG
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Changelog — Inicjatywy

## 2026-05-10

- Added missing function execution cards for dispatch-safe single-scope runs: `IN_PORTFOLIO_HUB`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`.
- Normalized `IMPLEMENTATION_TASK_BOARD.md` source-card references from module-level card to function-specific cards for `IN_HUB`, `IN_ROAD`, `IN_PORT` and `IN_ROI` rows.
- Updated `README.md` contract layers with integration report, implementation task board and function-card governance links.
- Added `INTEGRATION_REPORT.md` for scope anchor `05_inicjatywy/MODULE_INTEGRATION` with executive verdict, function coverage matrix, consistency findings, handoff impact summary, evidence baseline and next action.
- Integrated module status across 00-07, function contracts, RAW packet and task board: documentation integration is `GO_FOR_NEXT_DOCS_WAVE`; runtime `DONE` remains blocked by UI evidence and owner acceptance.
- Confirmed no new cross-module handoff edge or artifact type was introduced; `MODULE_INTERACTION_GRAPH.md` and `ARTIFACT_LINEAGE_MATRIX.md` remain valid without edits for this integration cycle.
- Added module integration baseline sections to behavior, UI/UX, data, permissions and acceptance contracts.
- Added `RAW_TARGET_STATE_2_0_PACKET.md` for scope anchor `05_inicjatywy/MODULE_DELIVERY` with As-Is, Author Target, Delta, Contract 2.0, cross-module impact, delivery plan and open questions.
- Updated module contract metadata to version `2.0` / `review` and made the delivery gate explicit: documentation baseline is `DONE_DOC`, runtime readiness remains `NOT_DONE`.
- Added full function responsibility, business/tech owner, input/output, handoff and evidence mapping for `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW` and `IN_ROI_VIEW`.
- Added evidence binding tables requiring route, component, API and test evidence for every critical module claim.
- Marked dedicated initiative UI lifecycle/card regression coverage, lane smoke evidence, owner acceptance and source-envelope taxonomy as blockers before `DONE`.
- Updated `SYSTEM_TRACEABILITY_MATRIX.md` with a granular module 05 requirement row.
- Added `INITIATIVE_IMPROVEMENT_IDEAS_AND_DEVELOPMENT_ANALYSIS.md` with improvement ideas for guided initiative development, including development cockpit, readiness gate, source panel, consultant review, duplicate/split/merge assistant, execution preview and task/decision ownership panels.
- Added `RAW_PROJECT_MANAGEMENT_BENCHMARK_ANALYSIS.md` as the project/program management benchmark analysis for 2026-level initiative lifecycle, stage/gate, PMO, timeline, traction and Results/ROI handover requirements.
- Added `RAW_TASK_MANAGEMENT_BENCHMARK_ANALYSIS.md` as the task/workflow management benchmark analysis for 2026-level task assignment, decision blockers, inbox triage, calendar scheduling, AI proposal and evidence-backed execution requirements.
- Confirmed RAW benchmark verdict: `GO_DOCS`, `NO_GO_RUNTIME` until source envelopes, generator review UX, initiative sheet readiness, task/decision backbone and capability extensions are defined and validated.
- Added `INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS.md` as the full gap analysis for source evidence, generators, initiative validation, task/decision execution and readiness.
- Added transfer-backbone findings for broader initiative sources: tools, assessments, interview, conversation/MyWork, finance analysis and KPI/results evidence.
- Added execution-backbone findings: initiative validation hands off to task/decision management, with task assignees independent from initiative owner/manager.
- Marked source doctrine conflict: current ToolSession/AssessmentReport-only traceability doctrine is too narrow for runtime/product direction.
- Added canonical `INITIATIVE_CARD_SYSTEM_CONTRACT.md` for the shared Initiative Card model, variants, permissions, AI policy, provenance and evidence map.
- Linked the card contract from module README, behavior, UI/UX, data, permissions, acceptance and `IN_PORTFOLIO_HUB` function contract.
- Documented conflict resolution between older governance status wording and the current status/CTA + capabilities SoT.
- Added function-first contract layer for module 05 (`5/5` functions).
- Added function annex in `04_UI_UX.md` and linked function contracts in `functions/`.
- Updated codemap, behavior, acceptance and status with function coverage evidence.

## 2026-05-09

- Rebuilt module contract as author-level canonical baseline.
- Replaced empty/template placeholders with structured requirements from verified repo sources and raw author canon where available.
- Normalized source map in `SSOT.md` to avoid missing-file references.
