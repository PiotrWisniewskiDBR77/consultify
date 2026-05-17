# Advanced Manual Scenarios Blocks 1-15 - 2026-05-16

## Purpose

High-depth, business-realistic manual scenarios for all prepared modules (Blocks 1-15) to detect defects, regressions, trust issues, and cross-module contract drift before final promotion.

## Global Execution Rules

1. Run each module in two roles where applicable:
   - owner/admin,
   - non-privileged/member.
2. For every scenario capture:
   - steps,
   - expected behavior,
   - actual behavior,
   - evidence (screen/video/log/API snippet).
3. Mark outcomes with severity:
   - `P0` critical stop,
   - `P1` blocking fix required,
   - `P2` accepted non-blocking follow-up.
4. Mandatory checks in every module:
   - no silent writes,
   - no data leaks across tenant/role boundaries,
   - save/read-back survives refresh,
   - denied-state is explicit and honest.

## Block-by-Block Advanced Scenarios

## Block 1 - Chat

- Scenario 1: Multi-turn strategic planning with context carry-over and refresh.
- Scenario 2: Chat with artifact references and source/limitation verification.
- Scenario 3: Role boundary (Anna public vs Teresa tenant) and refusal behavior.
- Scenario 4: Long-session stability (navigation away/back, refresh, no message loss).

## Block 2 - Canvas

- Scenario 1: Create + edit + save + F5 + reopen deep link.
- Scenario 2: Capability-sensitive actions (share/output/conversion) under allowed vs denied profile.
- Scenario 3: Teresa proposal to Canvas with approval path and audit trace.
- Scenario 4: Parallel edits and conflict-safety behavior.

## Block 3 - Teresa

- Scenario 1: Teresa -> Canvas proposal -> approval -> persisted artifact.
- Scenario 2: Teresa -> Table -> Document -> Presentation chained workflow.
- Scenario 3: Unsafe mutation refusal and insufficient permission refusal.
- Scenario 4: Clarification flow when context is incomplete.

## Block 4 - Radar

- Scenario 1: Signal/radar review with real data and trend interpretation.
- Scenario 2: Empty/degraded state correctness and user guidance.
- Scenario 3: Teresa handoff into Radar with proposal discipline.
- Scenario 4: Role-sensitive visibility of radar items.

## Block 5 - Idea Mind Map

- Scenario 1: Deep hierarchy editing (add/move/delete/rename) with full read-back.
- Scenario 2: Large-map performance and usability stress.
- Scenario 3: ACL denied-state for restricted user.
- Scenario 4: Teresa-assisted map refinement without hidden changes.

## Block 6 - Idea Process Flow

- Scenario 1: Build end-to-end process with linked steps and dependencies.
- Scenario 2: Edit/reorder/link stress with refresh validation.
- Scenario 3: QA/analysis overlays where enabled.
- Scenario 4: Teresa proposal into process flow with explicit approval gate.

## Block 7 - Idea Whiteboard

- Scenario 1: Object-heavy board build (text/shapes/connections) and persistence.
- Scenario 2: Collaboration-like edits in sequence (simulated handoff).
- Scenario 3: AI clustering/synthesis verification where enabled.
- Scenario 4: Version/diff transparency for AI-originated edits.

## Block 8 - Idea Table

- Scenario 1: Full table lifecycle: create/open/add rows/edit/delete/save/reload.
- Scenario 2: Duplicate table flow and context switch consistency.
- Scenario 3: Conversion flows to task/initiative/document (where enabled).
- Scenario 4: ACL denial + Teresa table proposal flow.

## Block 9 - Calendar

- Scenario 1: Create/edit/delete event with read-back and timeline consistency.
- Scenario 2: Task-event linkage and cross-view consistency.
- Scenario 3: Refresh/reopen stability with multiple events.
- Scenario 4: Teresa proposal to calendar event with approval trail.

## Block 10 - Task Management

- Scenario 1: Full CRUD + assign + status + due date + detail read-back.
- Scenario 2: Focus-state badge consistency after focus board updates.
- Scenario 3: Urgent filter/count correctness vs list content.
- Scenario 4: Cross-module visibility (calendar/initiative surfaces) and role denial.

## Block 11 - PMO Functions

- Scenario 1: Initiative lifecycle from creation to status transitions.
- Scenario 2: Execution queue (overdue/missing plan) actionability.
- Scenario 3: Results/KPI deviation handling and closure loop.
- Scenario 4: Finance decision path with governance constraints.

## Block 12 - Excel / Table Studio

- Scenario 1: Data editing flow with persistence and relation integrity.
- Scenario 2: AI Editor 8-level actions with explainability and no hidden writes.
- Scenario 3: QA report + source pack + conversions to Doc/Presentation.
- Scenario 4: Form intake JWT and access boundaries.

## Block 13 - Word / Documents / Reports

- Scenario 1: Intake -> generate -> edit -> save -> refresh.
- Scenario 2: Export DOCX/PDF parity and content integrity.
- Scenario 3: Provenance/source panel trust verification.
- Scenario 4: Teresa proposal -> approval -> document/report read-back.

## Block 14 - Presentations

- Scenario 1: Execute MT-PRES 001-031 matrix end-to-end.
- Scenario 2: Deck edit + preview render + no blank states.
- Scenario 3: PDF/PPTX export quality and parity checks.
- Scenario 4: Governance + template restrictions + subscriber/token views.

## Block 15 - Settings/Admin

- Scenario 1: RBAC route/access boundaries across roles.
- Scenario 2: Denied-state UX quality (explicit, no spinner loops, no raw internals).
- Scenario 3: Governance writes + auditability.
- Scenario 4: Ownership scope correctness (personal vs tenant-admin vs superadmin).

## Cross-Module Stress Scenarios

- Scenario X1: Full chain Teresa -> Canvas -> Table -> Document -> Presentation.
- Scenario X2: Tenant boundary adversarial pass across all primary modules.
- Scenario X3: Save/read-back reliability under navigation and refresh loops.
- Scenario X4: Concurrent-like handoff between two operators on the same business context.

## Output Format for Test Results

For each scenario produce:

- `scenarioId`
- `module`
- `status` (`PASS`, `PASS_WITH_P2`, `FAIL_P1`, `FAIL_P0`)
- `defectSummary`
- `reproSteps`
- `evidenceLinks`
- `proposedRepairProgram`
