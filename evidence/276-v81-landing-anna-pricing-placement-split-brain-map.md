# V8.1 Evidence - Landing Anna pricing placement Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna pricing placement`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the accepted showcase and legal-shell packets, `PricingView` remained the last obvious public-shell Anna residual in the
current bounded placement series.

## Surface truth before promotion

Anna placement still diverged across public landing pages:

1. canonical `/`, shared-shell pages, showcase pages, and accepted legal shells exposed `AnnaAssistantWidget`
2. `src/views/PricingView.tsx` still mounted a bespoke public shell with explicit `demo` and `trial` authority, but omitted Anna entirely

## Why this is a real split-brain

Visitors could move from Anna-enabled public shells into `PricingView` and lose the Anna entry point on the destination surface.

## Bounded packet

This lane is narrowed to one packet:

1. mount Anna on `PricingView`
2. wire demo/trial/contact handoffs through the existing page authority
3. prove placement with a focused page regression
4. leave analytics, prompt-quality, and deeper Anna behavior work outside this packet
