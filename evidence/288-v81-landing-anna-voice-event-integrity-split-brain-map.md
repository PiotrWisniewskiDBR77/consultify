# V8.1 Evidence - Landing Anna voice event integrity Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna voice event integrity`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the public close-continuity cut, the next smallest residual was inaccurate voice telemetry when setup failed before a real
live session existed.

## Surface truth before promotion

Anna voice event reporting still diverged across the public widget:

1. `startVoiceConversation()` stamped a voice start time before availability checks and before the live session opened
2. `stopVoiceConversation()` posted `/api/public/anna/voice-event` whenever that start time existed
3. failed bootstrap paths like microphone denial could therefore produce a duration postback even though the session never reached `live`

## Why this is a real split-brain

The widget could report a completed voice session to the backend even when the visitor never actually entered live voice mode.

## Bounded packet

This lane is narrowed to one packet:

1. start voice reporting only after the public session truly reaches `live`
2. preserve the existing stop reporting for genuine live sessions
3. prove failed bootstrap plus close does not create a false `/voice-event`
4. leave broader voice UX, architecture, and analytics work outside this packet
