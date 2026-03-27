# V8.1 Evidence - broader canonical `/` value-layers and consulting-journey narrative seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader canonical `/` and public marketing breadth
Packet: `canonical / value-layers and consulting-journey narrative seam`
Status: `landed`

## Seam closed

The next bounded packet in the broader public-marketing lane now restores the missing `Value layers` and `Consulting journey` narrative stage on canonical `/`.

## What changed

1. `src/components/Landing/ValueJourneySection.tsx` now introduces a bounded section for the five value layers and the full consulting journey
2. `src/views/ProductEntryPage.tsx` now mounts that section between the product-statement surface and the existing how-it-works surface, keeping the landing narrative closer to the SSOT funnel
3. `public/locales/en/translation.json` and `public/locales/pl/translation.json` now define the new narrative block around value architecture and consulting journey
4. `tests/components/Landing/ValueJourneySection.messaging.test.tsx` now proves the section renders the canonical value layers and consulting journey
5. `tests/components/ProductEntryPage.kb-preview.test.tsx` now proves the section order on canonical `/`

## Why this packet matters

Before this packet:

1. `docs/product/LANDING_V8_SSOT.md` expected explicit `Value layers` and `Consulting journey` stages after the product statement
2. the live canonical `/` still skipped that architecture layer
3. visitors could see product surfaces without first seeing how Consultify creates value across the full consulting workflow

After this packet:

1. canonical `/` now explains both the five-layer value model and the end-to-end consulting journey
2. the live landing narrative is materially closer to the SSOT without pretending the full public marketing redesign is complete
3. the remaining residual stays explicit around the extended-scope layer and broader supporting-route coherence

## Lane state after this packet

The broader canonical `/` and public marketing breadth lane remains active.

The next step is to assess the next smallest honest packet after hero authority, trust-strip order authority, problem-platform-pattern, and value-journey narrative closure, likely around the missing canonical `/` extended-scope narrative seam.
