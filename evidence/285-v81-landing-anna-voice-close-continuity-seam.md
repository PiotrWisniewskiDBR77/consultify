# V8.1 Evidence - Landing Anna voice close continuity Seam

Date: 2026-03-26
Lane: `Landing Anna voice close continuity`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/components/Landing/AnnaAssistantWidget.tsx` now routes the floating launcher close path through
`stopVoiceConversation()` before dismissing the widget, so live voice sessions are torn down consistently no matter which
close affordance the visitor uses.

## Regression

Focused regression:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Verified with:

1. `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The public Anna widget now preserves the same voice-stop and `/api/public/anna/voice-event` continuity whether the visitor closes it from the panel header or from the floating launcher.
