# Business Work Canvas Stage 33 Workflow Comment Input Guard

Status: `DRAFT / STAGE 33 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 33 makes workflow comment creation reflect basic input validity before the user submits.

The handler already rejected empty comments. This stage moves that feedback into the visible control state so the ledger does not present an impossible action.

## 2. Completed Scope

- Trimmed workflow comment input for action availability.
- Disabled `Add comment` for empty or whitespace-only input.
- Preserved in-flight disabling while a comment request is active.
- Added component coverage for disabled empty comments and enabled valid comments.

## 3. Safety Contract

- Frontend validation is ergonomic only.
- Backend validation remains authoritative.
- Existing comment persistence, event creation and conflict handling remain unchanged.

## 4. Quality Gate

Stage 33 passes only when:

- empty comments cannot be submitted from the visible control,
- valid comments enable the action,
- in-flight comment state remains protected,
- targeted tests pass,
- changed files have no linter errors.
