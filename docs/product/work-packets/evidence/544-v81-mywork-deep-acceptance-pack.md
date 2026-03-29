# 544 - V8.1 My Work deep acceptance pack

Date: 2026-03-29
Owner: Cursor agent
Scope: browser-level deep acceptance for the Wave 1 `My Work` idea-workspace spine

## Why this pass was needed

The earlier Wave 1 smoke spine proved that `My Work` routes mount, but it did not yet verify the deeper multi-tool workspace shell that users actually depend on inside one idea workspace.

That left a practical acceptance gap:

- no browser-level proof that one idea can move across `mindmap`, `whiteboard`, `process flow`, and `table`
- no browser-level proof that degraded `process flow` and `table` states stay honest and retryable instead of pretending the canvas is empty
- no browser-level proof that the `mindmap` and `whiteboard` shells still expose their core user-facing guidance contracts

## What landed

Added:

- `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts`

Fixed:

- `src/components/MyWork/IdeaRecommendationMap.tsx`

The runtime fix corrected the React Flow store contract by importing `useStore` as a named export and by hardening the selectors with empty-array fallbacks during store warmup.

Without that fix, the browser-level workspace acceptance exposed a real crash path in the `Recommendation map` surface.

## Acceptance truth now covered

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

- `5 / 5` active deep acceptance tests passed
- `1` notebook browser-flow test is marked `fixme`

## Residual risk

- The notebook browser flow is still not accepted at this level. The test remains marked `fixme` because the real UI path for creating and listing a new note is inconsistent in this runtime and needs a separate product-level repair before it can be promoted to a passing browser proof.
- The `mindmap` connect-mode exit interaction is still primarily covered by focused component/unit tests rather than by a full browser pointer-sequence assertion, because the fixed canvas overlay makes that interaction non-deterministic in Playwright hit-testing.

## Status

- `Idea Workspace` now has a repeatable browser-level deep acceptance pack for the core Wave 1 multi-tool shell
- the pack also surfaced and fixed a real runtime crash in `Recommendation map`
- `Notebook` browser-level deep acceptance remains open and is explicitly tracked rather than silently ignored
