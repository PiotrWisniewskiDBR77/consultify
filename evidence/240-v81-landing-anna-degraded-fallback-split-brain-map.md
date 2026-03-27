# V8.1 Evidence - Landing Anna degraded fallback Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna degraded fallback`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

The public Anna surface already has bounded handoff, rate-limit, and unsupported-language continuity, but the degraded-state
copy for AI unavailability still remained inconsistent with the contract.

The contract requires a static message telling the visitor that the AI assistant is temporarily unavailable and pointing them
back to the page or contact path. The live route still returned older "try again" fallback copy, and the widget used a
different generic network-failure message.

## Surface and runtime truth before promotion

The public landing assistant mixed truth in three places:

1. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` defines one static fallback message for AI service unavailability
2. `server/src/routes/public-anna.routes.ts` returned older product-knowledge fallback copy when no Anna provider was
   available
3. `src/components/Landing/AnnaAssistantWidget.tsx` used a different generic request-failure message for local fetch errors

## Bounded packet

This lane is narrowed to one packet:

1. align the public Anna runtime fallback to the contract message
2. align the widget's local request-failure fallback to the same message
3. prove both paths with focused regressions
4. close the degraded-state split-brain without broadening into voice-mode or prompt-quality work
