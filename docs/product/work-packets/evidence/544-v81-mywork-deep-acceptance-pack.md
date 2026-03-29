# 544 - V8.1 My Work deep acceptance pack

Date: 2026-03-29
Owner: Cursor agent
Scope: browser-level deep acceptance for the Wave 1 `My Work` notebook + idea-workspace spine

## Why this pass was needed

The earlier Wave 1 smoke spine proved that `My Work` routes mount, but it did not yet verify the deeper multi-tool workspace shell and real notebook continuity flow that users actually depend on.

That left a practical acceptance gap:

- no browser-level proof that one idea can move across `mindmap`, `whiteboard`, `process flow`, and `table`
- no browser-level proof that degraded `process flow` and `table` states stay honest and retryable instead of pretending the canvas is empty
- no browser-level proof that the `mindmap` and `whiteboard` shells still expose their core user-facing guidance contracts
- no passing browser-level proof that a notebook page can be created, edited, and switched without losing user changes in the real UI flow

## What landed

Added:

- `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts`
- `server/src/routes/__tests__/my-work-notebook.routes.test.ts`

Fixed:

- `src/components/MyWork/NotebookContent.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/services/api.ts`
- `server/src/routes/my-work.routes.ts`

The runtime fixes corrected two real product seams:

- the React Flow store contract in `Recommendation map` by importing `useStore` as a named export and hardening selectors with empty-array fallbacks during store warmup
- the notebook continuity contract by forcing draft flush before page switching/creation, locking the client to one backend family after `V8_DISABLED`, and making legacy notebook list visibility honor aliased owner/org fields

Without those fixes, the browser-level suite exposed:

- a real crash path in the `Recommendation map` surface
- a real split-brain notebook path where create succeeded but list returned `[]`
- a real notebook save-flush race where a just-edited title could collapse back to `Untitled` after switching pages

## Acceptance truth now covered

### Notebook continuity contract

The browser suite now proves that the real notebook UI flow can:

- create page A through the visible template flow
- rename page A and persist tags
- create page B through the same UI contract
- switch between A and B without losing A's saved title/tags
- read the persisted tags back after note switching

### Shared idea-workspace shell

The browser suite now proves that one real idea can open through the shared workspace shell across:

- `Recommendation map`
- `Whiteboard`
- `Process Flow`
- `Table`

For each tool, the suite verifies:

- the canonical workspace route resolves
- the `Idea workspace` shell renders
- the active tool switcher renders the correct tool label
- the active idea title is visible in the workspace header

### Mindmap user contract

The suite verifies that `mindmap` still exposes:

- the visible `Connect` contract in the canvas toolbar
- the keyboard shortcuts help surface
- the shortcut guidance for adding sibling nodes

### Whiteboard user contract

The suite verifies that `whiteboard` still exposes:

- explicit `Board mode` framing
- the honest board-mode helper copy
- keyboard help with whiteboard-specific guidance

### Honest degraded states

The suite intentionally aborts the map load request to verify that:

- `Process flow` shows `temporarily unavailable` with visible retry affordance
- `Table` shows `temporarily unavailable` with visible retry affordance

This closes the acceptance gap where an unavailable workspace could otherwise look like an empty one.

## Verification

Passed:

- `E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts`

Result:

- `6 / 6` deep acceptance tests passed

## Residual risk

- The `mindmap` connect-mode exit interaction is still primarily covered by focused component/unit tests rather than by a full browser pointer-sequence assertion, because the fixed canvas overlay makes that interaction non-deterministic in Playwright hit-testing.

## Status

- `Idea Workspace` now has a repeatable browser-level deep acceptance pack for the core Wave 1 multi-tool shell
- `Notebook` now has a passing browser-level continuity proof in the same pack
- the pack also surfaced and fixed a real runtime crash in `Recommendation map`
- the pack also surfaced and fixed a real legacy notebook create/list continuity seam and a draft flush race
