# V8.1 Evidence - broader canonical `/` extended-scope narrative seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader canonical `/` and public marketing breadth
Packet: `canonical / extended-scope narrative seam`
Status: `landed`

## Seam closed

The fifth bounded packet in the broader public-marketing lane now restores the missing `Extended scope` narrative stage on canonical `/`.

## What changed

1. `src/components/Landing/ExtendedScopeSection.tsx` now introduces a bounded section for `Financial Intelligence`, `Reports & Presentations`, and `My Work`
2. `src/views/ProductEntryPage.tsx` now mounts that section after the consulting-journey layer so the active homepage mirrors the SSOT narrative more closely
3. `public/locales/en/translation.json` and `public/locales/pl/translation.json` now define the new extended-scope narrative block
4. `tests/components/Landing/ExtendedScopeSection.messaging.test.tsx` now proves the section renders the canonical extended platform scope
5. `tests/components/ProductEntryPage.kb-preview.test.tsx` now proves the section order on canonical `/`

## Why this packet matters

Before this packet:

1. `docs/product/LANDING_V8_SSOT.md` expected an explicit extended-scope layer after the consulting journey
2. the live canonical `/` still lacked a clear bridge into finance, deliverables, and the working surface
3. the homepage narrative still stopped short of the broader platform scope described by the business SSOT

After this packet:

1. canonical `/` now reflects the full homepage narrative chain expected by the landing SSOT
2. the active landing explains not only the category and journey but also the broader product surface beyond classic consulting
3. any remaining public-marketing residual is now broader cross-route or visual-system redesign work rather than another small canonical `/` narrative seam

## Lane state after this packet

The broader canonical `/` and public marketing breadth lane is ready for bounded acceptance review.
