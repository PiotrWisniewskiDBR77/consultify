# V8.1 Evidence - Landing Anna voice degraded fallback Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna voice degraded fallback`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

The public Anna contract already requires a static degraded-state message and explicitly forbids technical details from being
shown to visitors when the AI path is unavailable.

The main chat path is already aligned, but the live voice surface still diverged from that rule.

## Surface truth before promotion

The public landing assistant mixed truth in two voice-facing places:

1. `src/components/Landing/AnnaAssistantWidget.tsx` showed a voice-unavailable hint mentioning browser microphone and
   `NEXT_PUBLIC_GEMINI_API_KEY` configuration
2. the same widget used a separate voice-start failure message instead of the static degraded-state message used on the main
   chat path

## Why this is a real split-brain

The contract says degraded Anna behavior must avoid technical details and should keep the visitor on a safe static fallback.
Instead, the public widget exposed implementation-level setup language on the live voice surface.

## Bounded packet

This lane is narrowed to one packet:

1. align voice-unavailable copy to the same static degraded-state message
2. align voice-start-failure copy to the same message
3. add focused regression that proves the voice surface no longer exposes technical setup details
4. avoid broadening into voice architecture, permissions UX, or realtime transport redesign
