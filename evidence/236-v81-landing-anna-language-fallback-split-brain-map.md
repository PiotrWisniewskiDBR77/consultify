# V8.1 Evidence - Landing Anna language fallback Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna language fallback`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

Anna's live landing runtime already enforces CTA handoffs and rate-limit guardrails, but the unsupported-language contract
still remained only on paper.

The public contract requires Anna to answer in English with a note when the visitor writes in a language other than PL or EN.
The live route still attempted the normal conversation path for every input, and the widget had no explicit unsupported-
language continuity of its own.

## Surface and runtime truth before promotion

The public landing assistant mixed truth in three places:

1. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` requires an English fallback for unsupported languages
2. `server/src/routes/public-anna.routes.ts` had no bounded unsupported-language detection or fallback response
3. `src/components/Landing/AnnaAssistantWidget.tsx` could only surface whatever the route returned, so unsupported-language
   behavior remained undefined on the visible landing surface

## Bounded packet

This lane is narrowed to one packet:

1. add bounded unsupported-language detection to the public Anna route
2. return a fixed English fallback note instead of continuing the normal model path
3. surface that note in the live widget
4. close the language-fallback split-brain without broadening into true multilingual support
