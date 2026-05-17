# Business Work Canvas Stage 28 Status-Aware Completion Gate

Status: `DRAFT / STAGE 28 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 28 makes terminal workflow state explicit in the Canvas ledger.

After durable output creation, a workflow can be `completed`, but the UI previously still exposed an active-looking execution control. This stage makes completion visible and prevents accidental repeated execution from the ledger.

## 2. Completed Scope

- Added terminal status detection for `completed` and `failed` workflows.
- Disabled the execution CTA for terminal workflow runs.
- Replaced the execution CTA label with the terminal status.
- Added inline completion copy that directs users to the output ledger.

## 3. Safety Contract

- Backend workflow execution remains authoritative.
- Terminal-state UI controls do not mutate workflow state.
- `Resume` remains available as the explicit continuation path.
- Review gate and approval checkpoint messaging remain intact for active workflows.

## 4. Quality Gate

Stage 28 passes only when:

- completed workflow runs cannot be executed again from the primary CTA,
- generated outputs remain visible and linked,
- approval and review gates still behave correctly,
- targeted tests pass,
- changed files have no linter errors.
