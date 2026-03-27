# V8.1 Evidence - Landing Anna voice history bootstrap continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna` broader voice UX / architecture
Packet: `Landing Anna voice history bootstrap continuity`
Status: `landed`

## Seam closed

The next bounded voice packet now closes the typed-to-voice history bootstrap seam so live voice starts with the current visible Anna session context instead of a disconnected fresh turn.

## What changed

1. `src/components/Landing/AnnaAssistantWidget.tsx` now maps the current visible typed Anna transcript into Gemini Live turns before voice audio begins
2. the live voice bootstrap now uses `session.sendClientContent(...)` to seed same-session context into the voice runtime without adding a new backend seam
3. the bounded history seed keeps the existing public transcript shape by mapping visitor turns to `user` and Anna turns to `model`
4. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now states that switching from typed Anna into live voice should reuse the visible session transcript
5. focused regression in `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now proves that a typed exchange is seeded into the next live voice session bootstrap

## Why this packet matters

Before this packet:

1. live voice could now feed typed follow-up history,
2. but switching from typed Anna into live voice still started the browser voice path without the already visible session context,
3. so the public Anna experience still had a real split between typed session truth and voice bootstrap truth.

After this packet:

1. typed Anna and live voice now share bounded same-session context in both directions,
2. the live voice path no longer has to begin as if the visible public conversation never happened,
3. and broader voice architecture/productization questions remain visible backlog instead of being smuggled into this continuity packet.

## Lane state after this packet

The broader `Landing Anna` broader voice UX / architecture lane remains active.

The next step is to assess whether the smallest remaining packet sits around broader voice architecture authority, likely where browser-direct voice still depends on a separate runtime path from server-mediated typed Anna.
