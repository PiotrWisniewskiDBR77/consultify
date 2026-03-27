# V8.1 Evidence - Landing Anna about placement Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna about placement`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After `ContactView` was closed, the next smallest bespoke public residual was `AboutView`.

## Surface truth before promotion

Anna placement still diverged across public landing pages:

1. canonical `/`, shared-shell pages, showcase pages, `ContactView`, and other already accepted surfaces exposed `AnnaAssistantWidget`
2. `src/views/legal/AboutView.tsx` still mounted a bespoke public shell with explicit `demo` and `trial` CTAs, but omitted Anna entirely

## Why this is a real split-brain

Visitors could move from Anna-enabled public shells into `AboutView` and lose the Anna entry point on the destination surface.

## Bounded packet

This lane is narrowed to one packet:

1. mount Anna on `AboutView`
2. wire demo/trial/contact handoffs through the existing page authority
3. prove placement with a focused page regression
4. leave `Security` and pricing placement for separate promotion
