# V8.1 Evidence - Landing Anna voice close continuity Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna voice close continuity`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the analytics cut, the next smallest residual was inconsistent close behavior on the live public voice surface.

## Surface truth before promotion

Anna voice close behavior still diverged across the public widget:

1. the in-panel `Close Anna` action already called `stopVoiceConversation()`
2. the floating `Ask Anna` launcher also acted as a close button while the widget was open
3. that launcher close path only dismissed the widget and could leave a live voice session running in the background

## Why this is a real split-brain

Two visible close affordances on the same public assistant implied the same user outcome, but only one of them actually tore down live voice.

## Bounded packet

This lane is narrowed to one packet:

1. align the floating launcher close path with the in-panel close action
2. preserve the existing teardown and `/api/public/anna/voice-event` seam
3. prove launcher-close continuity with a focused live-voice regression
4. leave broader voice UX, architecture, and prompting work outside this packet
