# AntyGravity Master Prompt - All Modules Audit - 2026-05-16

Use this prompt in AntyGravity to run a full, high-discipline audit across all prepared modules and output prioritized repair programs.

---

You are running a full enterprise audit of Consultify readiness across modules 1-15.

## Mission

Run through all prepared modules in sequence, validate real behavior (not declarations), detect issues, classify severity, and propose repair programs that can be executed immediately.

## Ground Rules

1. Do not assume success from documentation labels.
2. Validate behavior from UI + API + persistence + role boundaries.
3. Flag every silent write, hidden mutation, misleading success toast, or data leak as critical.
4. For each detected issue, provide:
   - reproducible steps,
   - impact,
   - severity (`P0/P1/P2`),
   - likely root cause layer (UI/API/DB/auth/workflow),
   - concrete repair program (owner, steps, validation).
5. Focus on business trust:
   - save/read-back integrity,
   - access control honesty,
   - approval governance,
   - export and artifact correctness,
   - audit/provenance clarity.

## Execution Order

1. Block 1 Chat
2. Block 2 Canvas
3. Block 3 Teresa
4. Block 10 Task Management
5. Block 9 Calendar
6. Block 4 Radar
7. Block 5 Mind Map
8. Block 6 Process Flow
9. Block 7 Whiteboard
10. Block 8 Idea Table
11. Block 11 PMO Functions
12. Block 12 Excel/Table Studio
13. Block 13 Word/Documents/Reports
14. Block 14 Presentations
15. Block 15 Settings/Admin

## Scenario Set

Use `docs/testing/reports/ADVANCED_MANUAL_SCENARIOS_BLOCKS_1_15_2026-05-16.md` as mandatory scenario matrix.

## Required Audit Outputs

Produce four sections:

### A) Executive Risk Summary
- Overall readiness verdict.
- Count of `P0`, `P1`, `P2`.
- Top 10 risks by business impact.

### B) Module-by-Module Findings
For each module:
- scenario coverage summary,
- passed scenarios,
- failed scenarios,
- issue list with IDs.

### C) Repair Programs
For each issue:
- `issueId`
- `severity`
- `module`
- `symptom`
- `rootCauseHypothesis`
- `repairProgram` (step-by-step)
- `ownerType` (frontend/backend/fullstack/product-ops)
- `verificationPlan`
- `expectedClosureEvidence`

### D) Promotion Readiness Decision
- Which modules can be promoted now.
- Which modules are blocked and by what.
- Exact conditions to reach `GLOBAL_ALL_MODULES_GO`.

## Strict Quality Bar

- No generic advice.
- No "needs more testing" without specific test steps.
- No mixed severity labels.
- Every issue must include a deterministic retest condition.

## Output Data Contract (JSON + narrative)

Provide:

1. Human-readable narrative report.
2. Machine-readable JSON block with:
   - `globalVerdict`
   - `moduleResults[]`
   - `issues[]`
   - `repairPrograms[]`
   - `promotionChecklist[]`

Use deterministic IDs like:
- `B10-TASK-001`
- `B14-PRES-004`
- `XMOD-SEC-002`

If no critical issues are found, explicitly state why and provide residual risk envelope.

---

Start audit now.
