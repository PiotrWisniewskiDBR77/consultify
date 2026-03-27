# V8.1 Evidence - Landing Anna reopen error reset Seam

Date: 2026-03-26
Lane: `Landing Anna reopen error reset`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/components/Landing/AnnaAssistantWidget.tsx` now clears the transient request `error` when the public widget opens from a
closed state, so a fresh reopen no longer carries the stale request-error banner from the prior hidden session.

## Regression

Focused regression:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Verified with:

1. `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The public Anna widget now returns to a clean transient-error state on reopen while preserving current conversation continuity
and the previously accepted voice/telemetry seams.
