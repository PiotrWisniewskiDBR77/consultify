# V8.1 Evidence - Landing Anna voice reopen connecting continuity Seam

Date: 2026-03-26
Lane: `Landing Anna voice reopen connecting continuity`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/components/Landing/AnnaAssistantWidget.tsx` now invalidates superseded voice attempts and ignores stale `onopen`,
`onclose`, and `onerror` callbacks from a prior attempt, so a fresh reopen no longer inherits live or error voice state from a
previous connecting session.

## Regression

Focused regression:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Verified with:

1. `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The public Anna widget now scopes voice lifecycle callbacks to the current attempt only while preserving the previously
accepted reopen, text, telemetry, and voice-event seams.
