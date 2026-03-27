# V8.1 Evidence - Landing Anna answer-structure prompt shaping seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna prompt-quality / retrieval-quality`
Packet: `Landing Anna answer-structure prompt shaping`
Status: `landed`

## Seam closed

The fifth bounded quality packet now closes the answer-structure prompt seam for public Anna.

## What changed

1. `server/src/routes/public-anna.routes.ts` now adds an explicit `ANSWER SHAPE` section to the base Anna runtime instruction
2. the public Anna prompt now requires a direct answer first, a short public-value explanation second, and only one natural CTA when it genuinely helps
3. the same shaping applies even when worker-specific guidance is present, because it lives inside the base public Anna contract
4. `server/src/routes/v8/__tests__/public-anna.routes.test.ts` now adds focused regression proving that the answer-shape rules stay present in the runtime instruction
5. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now records the landing-page answer-shape rule at the contract level

## Why this packet matters

Before this packet:

1. Anna had concise-tone guidance
2. but the LP answer shape was still implicit rather than explicit in the runtime contract
3. that left room for uneven answer structure between similar questions or worker-backed variants

After this packet:

1. Anna answers are more consistently framed for the public landing context
2. the visitor gets a clearer direct answer before optional sales guidance
3. prompt quality improves without broadening into multilingual, analytics, or voice-architecture work

## Lane state after this packet

The broader `Landing Anna prompt-quality / retrieval-quality` lane remains active.

The next step is to assess the next smallest prompt or retrieval quality residual after:

1. locale-aware retrieval quality
2. follow-up retrieval continuity
3. worker prompt merge continuity
4. worker locale-aware retrieval quality
5. answer-structure prompt shaping

are all landed.
