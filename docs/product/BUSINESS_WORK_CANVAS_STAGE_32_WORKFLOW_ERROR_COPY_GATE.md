# Business Work Canvas Stage 32 Workflow Error Copy Gate

Status: `DRAFT / STAGE 32 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 32 makes workflow mutation errors consistent across the Canvas ledger.

Earlier stages added conflict safety and backend workflow gates. This stage ensures start, resume, review metadata and comment actions all use the same user-facing Canvas error mapping instead of falling back to raw API messages.

## 2. Completed Scope

- Routed workflow start errors through shared Canvas error copy.
- Routed workflow resume errors through shared Canvas error copy.
- Routed workflow review metadata update errors through shared Canvas error copy.
- Routed workflow comment errors through shared Canvas error copy.
- Added component coverage for stale workflow creation conflict copy.

## 3. Safety Contract

- Backend error codes remain authoritative.
- Frontend copy explains recoverable action without hiding the failure.
- In-flight flags still clear after failure.
- Existing review gate and terminal-state messages remain specific.

## 4. Quality Gate

Stage 32 passes only when:

- stale workflow mutations show friendly Canvas conflict copy,
- workflow guard errors avoid raw backend JSON,
- controls recover from failed requests,
- targeted tests pass,
- changed files have no linter errors.
