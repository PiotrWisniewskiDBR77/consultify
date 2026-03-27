# V8.1 Evidence - Landing Anna locale-aware retrieval quality seam

Date: 2026-03-26
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna prompt-quality / retrieval-quality`
Packet: `Landing Anna locale-aware retrieval quality`
Status: `landed`

## Seam closed

The first bounded quality packet now closes the locale-aware retrieval seam for public Anna.

## What changed

1. `server/src/services/ai/annaKnowledgeService.ts` now prefers locale-matching and language-neutral product pills before cross-language fallback
2. cross-language fallback is still preserved as a bounded safety net when matching public material is unavailable
3. the same locale preference now applies to `buildAnnaVoiceBootstrap()`
4. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now states the contract-level rule that Anna should prefer the visitor's conversation language when matching public knowledge exists
5. `server/src/services/ai/__tests__/annaKnowledgeService.test.ts` adds focused regression for locale preference and fallback behavior

## Why this packet matters

This improves real answer quality without broadening into:

1. multilingual rollout
2. analytics/dashboard breadth
3. broader voice-product redesign

It is therefore an honest first packet inside the broader prompt/retrieval quality lane.

## Lane state after this packet

The broader `Landing Anna prompt-quality / retrieval-quality` lane remains active.

The next step is to assess the next smallest real quality residual after locale-aware retrieval preference is in place.
