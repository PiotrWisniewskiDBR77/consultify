# Business Work Canvas Stage 26 Review-Aware Controls Gate

Status: `DRAFT / STAGE 26 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 26 makes workflow controls reflect review lifecycle state.

The backend already blocks durable output creation while a workflow is in review. This stage makes that state visible before the user clicks `Run next`.

## 2. Completed Scope

- Added review-gate detection in the Canvas workflow ledger.
- Disabled `Run next` for workflows requiring review approval.
- Added inline review gate copy.
- Kept `Mark approved` as the unlock action.

## 3. Safety Contract

- UI gating is advisory and ergonomic; backend Stage 24 remains authoritative.
- Disabled controls do not mutate workflow state.
- Approved workflows can still proceed through the normal explicit execution approval path.

## 4. Quality Gate

Stage 26 passes only when:

- review-gated workflows show why execution is blocked,
- `Run next` is disabled until lifecycle approval,
- targeted tests pass,
- changed files have no linter errors.
