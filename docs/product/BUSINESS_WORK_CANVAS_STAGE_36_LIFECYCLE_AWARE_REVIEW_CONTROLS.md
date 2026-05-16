# Business Work Canvas Stage 36 Lifecycle-Aware Review Controls

Status: `DRAFT / STAGE 36 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 36 prevents redundant workflow review lifecycle updates from the ledger.

If a workflow is already `in_review`, `Send to review` should not look actionable. If it is already `approved`, `Mark approved` should not invite another no-op update.

## 2. Completed Scope

- Disabled `Send to review` for `in_review` workflows.
- Disabled `Mark approved` for `approved` workflows.
- Preserved valid opposite lifecycle transitions.
- Kept in-flight disabled states and input locks intact.
- Extended component coverage for lifecycle-aware disabled states.

## 3. Safety Contract

- Backend lifecycle validation remains authoritative.
- UI prevents visible no-op lifecycle submissions.
- Valid lifecycle changes remain available.
- In-flight states override lifecycle controls while a request is running.

## 4. Quality Gate

Stage 36 passes only when:

- current lifecycle buttons are disabled,
- valid lifecycle transition buttons are enabled,
- request in-flight behavior still works,
- targeted tests pass,
- changed files have no linter errors.
