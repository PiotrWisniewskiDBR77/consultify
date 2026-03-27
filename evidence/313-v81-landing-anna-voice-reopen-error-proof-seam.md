# V8.1 Evidence - Landing Anna voice reopen error proof Seam

Date: 2026-03-26
Lane: `Landing Anna voice reopen error proof`
Taxonomy: `T4`
Status: `done`

## Seam closed

`tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now explicitly proves that a stale `onerror` callback from a
superseded voice attempt does not surface stale error state after the widget is closed and reopened.

## Regression

Focused regression:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Verified with:

1. `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The accepted voice-attempt token seam now has explicit regression coverage for both late `onopen` and late `onerror` behavior
across widget close/reopen.
