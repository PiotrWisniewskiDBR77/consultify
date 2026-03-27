# V8.1 Evidence - Landing Anna voice event integrity Seam

Date: 2026-03-26
Lane: `Landing Anna voice event integrity`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/components/Landing/AnnaAssistantWidget.tsx` now marks voice reporting as active only after the public session reaches
`live`, and it clears that state on failed setup or unexpected teardown so `/api/public/anna/voice-event` is not posted for
bootstrap attempts that never became real voice sessions.

## Regression

Focused regression:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Verified with:

1. `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The public Anna widget now preserves `/voice-event` integrity by reporting only genuine live-voice sessions while keeping the
existing stop reporting for successful voice runs.
