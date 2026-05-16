# Business Work Canvas Stage 34 Reviewer Preservation Gate

Status: `DRAFT / STAGE 34 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 34 prevents workflow lifecycle updates from accidentally clearing reviewer assignment.

When a workflow already has a reviewer from persisted provenance, changing lifecycle to `approved` should preserve that reviewer unless the user explicitly edits the reviewer field.

## 2. Completed Scope

- Added reviewer fallback from the current workflow state.
- Preserved existing reviewer id when the reviewer field is untouched.
- Kept intentional clearing behavior when the user edits the field to empty.
- Added component coverage for approving an in-review workflow without retyping reviewer id.

## 3. Safety Contract

- Persisted collaboration metadata remains the source of truth.
- UI input state overrides persisted reviewer only after local user editing.
- Lifecycle-only changes must not erase reviewer context.

## 4. Quality Gate

Stage 34 passes only when:

- existing reviewers survive lifecycle-only updates,
- explicit reviewer edits still affect the payload,
- targeted tests pass,
- changed files have no linter errors.
