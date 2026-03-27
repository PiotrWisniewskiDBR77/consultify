# V8.1 Evidence - Landing Anna follow-up retrieval continuity seam

Date: 2026-03-26
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna prompt-quality / retrieval-quality`
Packet: `Landing Anna follow-up retrieval continuity`
Status: `landed`

## Seam closed

The second bounded quality packet now closes the follow-up retrieval continuity seam for public Anna.

## What changed

1. `server/src/routes/public-anna.routes.ts` now expands short follow-up questions with the latest user context before sending the retrieval query into the Anna knowledge path
2. the model conversation history still remains unchanged; this packet only improves retrieval continuity for ambiguous follow-up questions
3. `server/src/routes/v8/__tests__/public-anna.routes.test.ts` now proves that short follow-up prompts such as `And pricing?` inherit the previous user topic when building the Anna retrieval query

## Why this packet matters

Before this packet:

1. Anna could keep conversational context at the model level
2. but retrieval still received only the final short follow-up message
3. so answer quality could drift on brief public follow-up prompts

After this packet:

1. retrieval continuity is closer to the visible conversation continuity
2. the lane improves answer quality without broadening into multilingual expansion or broader prompt-product redesign

## Lane state after this packet

The broader `Landing Anna prompt-quality / retrieval-quality` lane remains active.

The next step is to assess the next smallest prompt or retrieval quality residual after locale-aware knowledge preference and follow-up retrieval continuity are both in place.
