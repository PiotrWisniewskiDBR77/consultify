# Business Work Canvas Stage 40 Artifact Runtime Unification Metadata

Status: `PASSED`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 40 starts unifying Work Canvas outputs with the Wave 5 artifact runtime.

The safe first step is shared correlation metadata, not an implicit double-write into Wave 5. Canvas outputs now carry enough artifact runtime information to be promoted, mirrored or indexed by the Wave 5 artifact layer in a later governed step.

## 2. Completed Scope

- Added `artifactRuntimeHint` to Work Canvas output metadata.
- Mapped Canvas `presentation` outputs to Wave 5 `slide_deck`.
- Mapped Canvas `table` outputs to Wave 5 `spreadsheet`.
- Mapped Canvas `report` outputs to Wave 5 `report`.
- Added `sourceRefsTemplate` with Work Canvas draft, version and output lineage.
- Preserved conversation, project and research session anchors in the hint.
- Covered manual `create-output` and workflow `run-next` output paths with backend tests.

## 3. Safety Contract

- Stage 40 is additive metadata only.
- Work Canvas does not silently create Wave 5 artifact rows.
- Existing output records, presentation decks and output drafts remain the durable resources created by their current paths.
- `artifactRuntimeHint` is the bridge contract for later Wave 5 promotion or mirroring.

## 4. Quality Gate

Stage 40 passes only when:

- manual Canvas output metadata includes Wave 5 correlation information,
- workflow output metadata includes the same correlation information,
- source Canvas lineage remains available,
- targeted backend tests pass,
- changed files have no linter errors.
