# V8.1 Evidence - Landing Anna shared-shell placement Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna shared-shell placement`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

The landing SSOT still describes Anna embedding on the landing IA as not fully implemented. After closing bounded behavioral
gaps, the next smallest real residual was shared-shell placement breadth.

## Surface truth before promotion

The public landing assistant mixed truth across the public shell:

1. `src/views/ProductEntryPage.tsx` mounted `AnnaAssistantWidget` on canonical `/`
2. `src/components/Landing/MarketingLayout.tsx` provided the shared shell for several other public landing pages but did not
   mount Anna at all
3. `docs/product/LANDING_V8_SSOT.md` still recorded full Anna landing-IA embedding as incomplete

## Why this is a real split-brain

Anna already existed as a live public assistant with bounded CTA and degraded-state continuity, but only canonical `/`
actually exposed it. Shared-shell public pages still omitted the assistant completely.

## Bounded packet

This lane is narrowed to one packet:

1. mount Anna in the shared `MarketingLayout`
2. wire demo/trial/contact handoffs through the shared shell authority
3. prove the placement on one page that uses the shared shell
4. leave bespoke-shell public pages for separate explicit promotion
