# V8.1 Evidence - Landing Anna voice transcript continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna` broader voice UX / architecture
Packet: `Landing Anna voice transcript continuity`
Status: `landed`

## Seam closed

The first real bounded voice packet now closes the visible transcript continuity seam between live voice Anna and the typed Anna session history.

## What changed

1. `src/components/Landing/AnnaAssistantWidget.tsx` now enables Gemini Live `inputAudioTranscription` and `outputAudioTranscription` for the existing public voice session
2. the live voice callback now upserts transcribed user and assistant turns into the same visible widget transcript used by typed Anna history shaping
3. the live voice callback now consumes transcript data and audio from the same server event path instead of assuming only `parts[0]` matters
4. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now states that live voice turns should feed the same visible session transcript used by typed Anna
5. focused regression in `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now proves that a typed follow-up after voice carries the live transcript history into `POST /api/public/anna/chat`

## Why this packet matters

Before this packet:

1. live voice ran as a continuity-safe browser path but did not feed the typed Anna session transcript
2. typed follow-up requests after voice could still behave as if the latest live exchange was not part of the same visible conversation
3. the broader voice lane remained blocked on a real voice-vs-typed session-memory split rather than just a proof gap

After this packet:

1. the current public voice path now contributes bounded session memory to the same visible Anna transcript
2. typed follow-up questions can reuse the latest live voice topic without inventing a separate public voice product architecture
3. broader voice productization questions remain visible backlog instead of being silently folded into this first continuity packet

## Lane state after this packet

The broader `Landing Anna` broader voice UX / architecture lane remains active.

The next step is to assess the next smallest honest voice packet after live transcript continuity is in place, likely around broader voice architecture authority rather than same-session transcript memory.
