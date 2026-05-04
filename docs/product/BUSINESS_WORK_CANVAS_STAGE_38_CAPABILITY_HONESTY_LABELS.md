# Business Work Canvas Stage 38 Capability Honesty Labels

Status: `PASSED`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 38 makes Canvas honest about what is already real and what is still partial.

The product source of truth requires exposed Canvas capabilities to be labeled as `real`, `partial`, `scaffold`, `missing` or `out_of_scope`. This gate brings that contract into the user-facing Canvas surface so business users are not promised a complete ResearchCanvas, DeckCanvas or dashboard lane before those runtimes exist.

## 2. Completed Scope

- Added capability status and explanation fields to Canvas starter templates.
- Added capability status and explanation fields to workflow templates.
- Rendered capability badges in the Canvas template picker.
- Rendered the active document capability and explanation in Canvas diagnostics.
- Rendered selected workflow template capability and explanation beside workflow controls.
- Added component coverage for template, diagnostics and workflow capability labels.

## 3. Safety Contract

- `real` means the visible capability is backed by current Canvas runtime behavior.
- `partial` means the visible capability starts usable work but still lacks part of the target runtime.
- `scaffold`, `missing` and `out_of_scope` remain valid vocabulary for future lanes, but should not be presented as ready.
- Capability copy must be understandable to business users and must not expose raw implementation details.

## 4. Quality Gate

Stage 38 passes only when:

- visible starter templates carry capability labels,
- active Canvas diagnostics show current capability status and explanation,
- workflow template selection shows status and explanation,
- partial lanes do not appear as fully production-ready,
- targeted frontend tests pass,
- changed files have no linter errors.
