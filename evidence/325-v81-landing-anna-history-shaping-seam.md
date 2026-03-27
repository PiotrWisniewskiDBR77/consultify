# V8.1 Evidence - Landing Anna history shaping seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna prompt-quality / retrieval-quality`
Packet: `Landing Anna history shaping`
Status: `landed`

## Seam closed

The sixth bounded quality packet now closes the short follow-up history-shaping seam for public Anna.

## What changed

1. `server/src/routes/public-anna.routes.ts` now builds a bounded `RECENT CONVERSATION CONTEXT` note for short follow-up prompts
2. the public Anna runtime instruction now receives the latest user topic, and when available the latest Anna reply, as explicit follow-up context
3. this shaping is added inside the base Anna runtime contract, so it also applies when worker-specific guidance is present
4. `server/src/routes/v8/__tests__/public-anna.routes.test.ts` now adds focused regression proving that short follow-up context is present in the runtime instruction
5. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now records that short follow-ups inside one session should use the latest visible topic as local context

## Why this packet matters

Before this packet:

1. retrieval already expanded short follow-up queries
2. but the model prompt still relied on raw history only, without an explicit LP-safe follow-up anchor
3. that left room for the assistant to restart the topic too broadly on short contextual questions

After this packet:

1. Anna gets the same recent-topic anchor at prompt level, not only at retrieval level
2. short follow-up answers stay more continuous without pretending to have broader memory
3. the lane improves answer quality without broadening into multilingual, analytics, or voice-architecture scope

## Lane state after this packet

The broader `Landing Anna prompt-quality / retrieval-quality` lane remains active.

The next step is to assess the next smallest prompt or retrieval quality residual after:

1. locale-aware retrieval quality
2. follow-up retrieval continuity
3. worker prompt merge continuity
4. worker locale-aware retrieval quality
5. answer-structure prompt shaping
6. history shaping

are all landed.
