# V8.1 Evidence - Landing Anna handoff Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna handoff`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

Anna is already embedded on canonical `/`, but the live widget still diverged from its own public contract.

The contract requires Anna to guide visitors toward `Demo`, `Trial`, and `Contact` handoffs and to keep those CTA paths
available even when AI service quality degrades. The live widget only offered suggestion chips and free-text chat, so the
handoff contract remained implicit instead of visible.

## Surface truth before promotion

The public landing assistant surface mixed truth in three places:

1. `src/components/Landing/AnnaAssistantWidget.tsx` exposed suggestions and chat/voice controls, but no explicit handoff CTAs
2. `src/views/ProductEntryPage.tsx` already owned the shared landing `Demo` / `Trial` modal contract, but Anna was not wired
   into it
3. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` requires Anna to guide visitors toward `Demo`, `Trial`, and `Contact`
   actions, including degraded-state CTA continuity

## Bounded packet

This lane is narrowed to one packet:

1. add explicit `Demo`, `Trial`, and `Contact` controls to the Anna widget
2. route homepage Anna handoffs through the existing shared landing callbacks
3. preserve safe fallback navigation for non-homepage use
4. close the contract-vs-surface handoff split-brain without broadening into Anna prompt, KB, or landing redesign work
