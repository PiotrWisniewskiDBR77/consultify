# Business Work Canvas Final Rollout Sign-Off

Status: `PASSED / CURRENT CUTLINE COMPLETE`
Date: 2026-05-03
Owner: Product + Engineering

## Decision

The current Canvas rollout is complete for the agreed **Markdown-first DocumentCanvas cutline**.

This does not mean the entire long-term Canvas vision is finished. It means the current deployable product surface is coherent, tested and honestly bounded.

## Current Cutline

The shipped cutline includes:

- right-side `DocumentCanvas` opened from chat,
- Teresa chat preserved on the left,
- Markdown as canonical source,
- document and Markdown views,
- editable title and content,
- manual save/autosave,
- versions, restore and show changes,
- selection edit loop,
- visible diff preview,
- revise-before-apply,
- deterministic writing shortcuts,
- proposal-first apply/reject behavior,
- native block rendering for supported table/chart/diagram style blocks,
- ResearchSession id linkage for Research starter,
- Wave 5 artifact correlation metadata through `artifactRuntimeHint`,
- capability honesty labels,
- safe Canvas context packet for Teresa,
- Playwright coverage for the modern editor flow.

## Explicit Backlog

The following are not part of this rollout sign-off:

- TipTap/ProseMirror rich text editor,
- inline comments/decorations,
- multi-user realtime collaboration,
- full Research evidence/source runtime inside Canvas,
- full Wave 5 artifact promotion/write path,
- HTML/React sandbox,
- Python/data execution sandbox,
- full `Review in Canvas` for existing artifacts,
- production-grade shared/public publish.

## Engineering Closeout

Final hardening completed:

- Stage 37-45 gate docs are marked `PASSED`.
- `CANVAS_SOURCE_OF_TRUTH.md` now separates addressed cutline scope from post-cutline backlog.
- `BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md` contains the final rollout sign-off gate.
- Client draft mapping preserves server draft kind vocabulary for `markdown`, `checklist`, `sheet` and `deck`.
- Client draft mapping normalizes server `proposed` lifecycle to UI `in_review` instead of silently falling back.
- Unit coverage verifies lifecycle/kind mapping.
- Playwright coverage verifies the modern editor flow.

## Required Validation

The sign-off is valid only when these checks pass:

```bash
npm exec vitest run tests/unit/utils/canvasWorkspace.test.ts -- --maxWorkers=1 --maxConcurrency=1
npm exec vitest run tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx -- --maxWorkers=1 --maxConcurrency=1
E2E_USE_WEB_SERVER=true E2E_MODE=true E2E_BACKEND_RUNNER=tsx npx playwright test --config playwright.config.ts tests/e2e/smoke/work-canvas-editor-flow.spec.ts --project=chromium --workers=1
```

## Residual Risk

The current implementation still has a large Canvas surface area. Full production rollout should keep capability labels visible and should not market backlog features as shipped. The next major product decision is whether to invest in the rich editor runtime, Wave 5 artifact promotion or Research evidence execution first.
