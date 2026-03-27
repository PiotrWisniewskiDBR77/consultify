# V8.1 Evidence - Landing Anna contact placement Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna contact placement`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After closing shared-shell and showcase-page placement, the next smallest bespoke public residual was `ContactView`.

## Surface truth before promotion

Anna placement still diverged across public landing pages:

1. canonical `/`, shared-shell pages, and the public showcase pages exposed `AnnaAssistantWidget`
2. `src/views/legal/ContactView.tsx` still mounted landing topbar/footer and acted as Anna's public contact handoff target, but
   omitted Anna entirely

## Why this is a real split-brain

Visitors could follow Anna's `Contact` CTA onto `ContactView` and then lose access to Anna on the destination surface itself.

## Bounded packet

This lane is narrowed to one packet:

1. mount Anna on `ContactView`
2. wire demo/trial/contact handoffs through the existing page authority
3. prove placement with a focused page regression
4. leave `About`, `Security`, and `Pricing` bespoke-shell placement for separate promotion
