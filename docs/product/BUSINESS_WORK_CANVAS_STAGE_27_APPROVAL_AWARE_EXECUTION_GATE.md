# Business Work Canvas Stage 27 Approval-Aware Execution Gate

Status: `DRAFT / STAGE 27 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 27 makes workflow approval checkpoints visible at the exact point where the user creates a durable output.

Before this stage, the frontend sent `approved: true`, but the primary action still looked like a generic `Run next` command. This made the governance model technically correct but too implicit for users.

## 2. Completed Scope

- Added pending approval detection in the workflow ledger.
- Displayed the pending approval step title inline.
- Renamed the primary execution CTA to `Approve and run` while an approval is pending.
- Preserved review lifecycle gating from Stage 26.

## 3. Safety Contract

- The backend remains authoritative for approval enforcement.
- The frontend does not create a separate approval state.
- Review lifecycle gate and approval checkpoint messaging can appear together without changing execution semantics.

## 4. Quality Gate

Stage 27 passes only when:

- approval checkpoints are visible before durable output generation,
- the CTA communicates explicit approval,
- review-gated workflows remain blocked,
- targeted tests pass,
- changed files have no linter errors.
