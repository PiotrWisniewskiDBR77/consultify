# V8.1 Evidence - Landing Anna reopen in-flight continuity Seam

Date: 2026-03-26
Lane: `Landing Anna reopen in-flight continuity`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/components/Landing/AnnaAssistantWidget.tsx` now invalidates text request outcomes from a prior visible widget session and
clears text loading when the widget closes, so a fresh reopen no longer inherits late replies or stale loading from the prior
hidden session.

## Regression

Focused regression:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Verified with:

1. `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The public Anna widget now reopens against only the current visible session for text-request continuity while preserving the
previously accepted reopen-error, reopen-draft, voice, and telemetry seams.
