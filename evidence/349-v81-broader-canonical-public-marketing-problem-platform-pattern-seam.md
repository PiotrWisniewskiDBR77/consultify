# V8.1 Evidence - broader canonical `/` problem-platform-pattern narrative seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader canonical `/` and public marketing breadth
Packet: `canonical / problem-platform-pattern narrative seam`
Status: `landed`

## Seam closed

The next bounded packet in the broader public-marketing lane now restores the missing `Problem` and `Platform pattern` narrative layer on the active canonical `/` surface.

## What changed

1. `src/components/Landing/ProblemPlatformSection.tsx` now introduces a bounded narrative section for the business problem and the platform-access pattern directly on canonical `/`
2. `src/views/ProductEntryPage.tsx` now mounts that section immediately after the hero so the landing funnel no longer jumps straight from promise into product surfaces
3. `public/locales/en/translation.json` and `public/locales/pl/translation.json` now define the new landing narrative block around limited access, platform winners, and the structured consulting workflow differentiator
4. `tests/components/Landing/ProblemPlatformSection.messaging.test.tsx` now proves that the section renders the canonical problem and platform-pattern story
5. `tests/components/ProductEntryPage.kb-preview.test.tsx` now proves the section order on canonical `/`

## Why this packet matters

Before this packet:

1. `docs/product/LANDING_V8_SSOT.md` expected explicit `Problem` and `Platform pattern` layers early in the landing funnel
2. the live canonical `/` moved from hero directly into product/value surfaces
3. the broader lane still lacked the narrative bridge that explains why the category exists before showing what the product does

After this packet:

1. canonical `/` now explains the access problem before asking the visitor to absorb the broader product story
2. the active landing narrative is materially closer to the SSOT without pretending the full homepage redesign is finished
3. the remaining residual stays explicit around value-layers / consulting-journey breadth and supporting public-route coherence

## Lane state after this packet

The broader canonical `/` and public marketing breadth lane remains active.

The next step is to assess the next smallest honest packet after hero authority, trust-strip order authority, and the problem-platform-pattern seam, likely around the missing value-layers / consulting-journey narrative structure on canonical `/`.
