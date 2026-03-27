# V8.1 Evidence - Landing Anna resources placement Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna resources placement`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the shared-shell placement cut, the smallest next bespoke public residual was `ResourcesPage`.

## Surface truth before promotion

Anna placement still diverged across public landing pages:

1. canonical `/` exposed `AnnaAssistantWidget`
2. shared-shell pages using `MarketingLayout` now exposed Anna
3. `src/views/ResourcesPage.tsx` still mounted landing topbar/footer and demo modal authority but omitted Anna entirely

## Why this is a real split-brain

`ResourcesPage` is still a public landing surface with shared conversion authority, but visitors there could not access the
same bounded public assistant available on canonical `/` and shared-shell pages.

## Bounded packet

This lane is narrowed to one packet:

1. mount Anna on `ResourcesPage`
2. wire demo/trial/contact handoffs through the existing page authority
3. prove placement with a focused page regression
4. leave `Tools`, `Audits`, legal, and pricing bespoke-shell placement for separate promotion
