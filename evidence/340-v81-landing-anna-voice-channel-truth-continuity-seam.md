# V8.1 Evidence - Landing Anna voice channel truth continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna` broader voice UX / architecture
Packet: `Landing Anna voice channel truth continuity`
Status: `landed`

## Seam closed

The next bounded voice packet now closes the operator/runtime truth seam where typed Anna and live voice could reuse the same conversation row only by shared `sessionId`.

## What changed

1. `server/src/services/ai/virtualWorkerConversationLogger.ts` now keys `findOrCreateConversation(...)` by `sessionId + workerId + channel` instead of only `sessionId + workerId`
2. public Anna typed chat and public Anna voice can now coexist in one visitor session without the voice path reusing or overwriting the typed conversation channel row
3. focused regression in `server/src/services/ai/__tests__/virtualWorkerConversationLogger.test.ts` now proves that typed and voice lookups stay channel-scoped and that `logVoiceEvent(...)` writes against a voice-scoped conversation row

## Why this packet matters

Before this packet:

1. public Anna typed chat logged conversations under `channel = text_chat`,
2. public Anna voice end events reused conversation lookup by the same `sessionId`,
3. so a mixed typed+voice visitor session could blur operator truth by collapsing distinct channels into one shared conversation row.

After this packet:

1. typed and voice still share the same public visitor session where appropriate,
2. but operator/runtime truth now preserves channel identity instead of letting voice mutate typed conversation rows,
3. and broader voice architecture/productization work remains visible backlog rather than being hidden inside analytics or prompt changes.

## Lane state after this packet

The broader `Landing Anna` broader voice UX / architecture lane remains active.

The next step is to assess whether the smallest remaining packet is now around browser-direct voice authority versus server-mediated typed Anna, rather than same-session continuity or channel truth.
