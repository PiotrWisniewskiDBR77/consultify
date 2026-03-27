# V8.1 Evidence - Landing Anna prompt-quality split-brain map

Date: 2026-03-26
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna prompt-quality / retrieval-quality`
Status: `active`

## Why this lane is now active

The bounded Anna series already closed:

1. public placement breadth
2. CTA handoff continuity
3. guardrails and degraded-state handling
4. telemetry integrity
5. close/reopen and voice callback continuity

What remains is no longer continuity work. It is answer-quality work on the live public surface.

## Current split-brain

The current public Anna quality path still has a retrieval-quality seam:

1. `public-anna.routes.ts` accepts `locale` and forwards it into the Anna retrieval path
2. `annaKnowledgeService.ts` loads indexed product pills that already carry `language` metadata
3. but the retrieval path has not been strongly using that language signal to prefer same-language public knowledge before cross-language material

This creates a mixed-truth quality risk:

1. the LP contract says Anna is bilingual in PL and EN
2. the runtime knows the visitor locale
3. the indexed docs know their language
4. but retrieval quality can still drift because locale-aware knowledge preference is not yet an explicit bounded seam

## Smallest honest first packet

The first bounded packet is:

`Landing Anna locale-aware retrieval quality`

It is the smallest honest packet because it:

1. improves answer quality directly
2. uses already available runtime signals instead of inventing new breadth
3. stays inside prompt/retrieval quality rather than broadening into multilingual product rollout

## Explicitly not this packet

This split-brain map does not activate:

1. multilingual expansion beyond PL/EN
2. backend analytics/dashboard breadth
3. broader voice UX/architecture work
4. landing redesign work
