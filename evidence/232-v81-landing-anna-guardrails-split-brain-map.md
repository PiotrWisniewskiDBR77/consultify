# V8.1 Evidence - Landing Anna guardrails Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna guardrails`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

Anna's live landing widget now exposes visible `Demo`, `Trial`, and `Contact` handoffs, but one bounded contract-vs-runtime
gap remained in the public assistant guardrails.

The public contract requires per-session rate limiting and a polite redirect toward static public paths when the limit is hit.
The live route had no Anna-specific rate limiter, and the widget treated any non-`200` response as a generic connectivity
error.

## Surface and runtime truth before promotion

The public landing assistant mixed truth in three places:

1. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` requires per-session rate limiting plus polite CTA-oriented behavior
2. `server/src/routes/public-anna.routes.ts` had no Anna-specific per-session limiter on `POST /api/public/anna/chat`
3. `src/components/Landing/AnnaAssistantWidget.tsx` collapsed non-`200` route responses to a generic error instead of
   surfacing a rate-limit-specific message

## Bounded packet

This lane is narrowed to one packet:

1. add a bounded per-session guardrail to `POST /api/public/anna/chat`
2. return a polite rate-limit message that points users back to public CTA paths
3. surface that message directly in the widget
4. close the guardrail split-brain without broadening into Anna prompt, unsupported-language, or analytics work
