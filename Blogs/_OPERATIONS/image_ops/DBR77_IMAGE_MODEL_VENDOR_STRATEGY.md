# DBR77 Image Model Vendor Strategy

Date: 2026-03-28
Scope: research and strategy for better / faster / cheaper image generation for DBR77 blog, social, and newsletter assets

## Short Answer

Google is not giving us an old image model through the API. Our current runner uses `imagen-4.0-generate-001`, which is part of the current Imagen 4 family. The problem is not model age. The problem is fit: for our DBR77 prompt style and quality bar, Google currently looks weaker than OpenAI in prompt obedience and in avoiding slide-like or pseudo-text artifacts.

The best strategy is not "one model for everything". The best strategy is a routed system:

- premium model for final `hero`
- structured design-friendly model for `analytical`
- fast/cheap model for first-pass ideation
- strict review and rerender rules before publication

## What We Learned From Our Own Tests

From the live `Consultify` batch work:

- OpenAI produced materially stronger `hero` and `analytical` outputs than Google for this content system.
- Google was cheaper, but rerender risk was higher.
- Cheap images are not cheap if they require repeated regeneration and manual cleanup.
- Social assets remain the hardest class and need their own prompt contract.

Conclusion:

- Quality-adjusted cost matters more than list price.
- For DBR77, the lowest cost per raw image is not the same as the lowest cost per publishable image.

## Vendor Research Snapshot

### 1. OpenAI

Why it matters:

- strongest real-world result in our current DBR77 test batch
- high prompt obedience
- strong editorial realism
- currently top-tier in public quality benchmarks

Signals:

- OpenAI positions `gpt-image-1` as its image generation API model and gives approximate per-image pricing examples in the official launch post
- Artificial Analysis lists `GPT Image 1.5 (high)` at the top of its image leaderboard

Pros:

- best current fit for premium enterprise editorial images
- strong prompt following
- stable API and documentation
- easiest continuation path because we already integrated it

Cons:

- not the cheapest option
- token-based billing is less intuitive than flat per-image pricing

Best DBR77 use:

- final `hero`
- final rerender for important `analytical`
- premium correction passes

Sources:

- [OpenAI image generation API announcement](https://openai.com/index/image-generation-api/)
- [OpenAI pricing docs](https://platform.openai.com/docs/pricing/)
- [Artificial Analysis OpenAI image family](https://artificialanalysis.ai/image/model-families/openai-gpt)

### 2. Google Imagen 4

Why it matters:

- cheap, official cloud API, enterprise-friendly
- current model family is modern, not legacy

Signals:

- Google lists Imagen 4 pricing at roughly `$0.04` per image, with Fast at `$0.02` and Ultra at `$0.06`
- benchmark position appears respectable, but not top-tier against current leaders

Pros:

- simple per-image pricing
- easy enterprise procurement through Google Cloud
- good for low-cost bulk generation

Cons:

- in our DBR77 tests it drifted too often into slide/UI/text artifacts
- weaker fit for our anti-text, anti-infographic premium editorial style

Best DBR77 use:

- cheap ideation batches
- low-priority archive fills
- maybe background visual explorations, not final premium assets

Sources:

- [Google Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Artificial Analysis Imagen 4](https://artificialanalysis.ai/image/models/google-imagen_imagen-4-standard)

### 3. Recraft V4

Why it matters:

- strongest design-native candidate in this market scan
- good text/layout discipline
- vector output is uniquely valuable for structured content and reusable brand graphics

Signals:

- official docs describe Recraft V4 as design-forward, strong in readable structured text, and available in both raster and vector variants
- official pricing is flat and transparent: V4 `$0.04`, V4 Pro `$0.25`, V4 Vector `$0.08`, V4 Pro Vector `$0.30`

Pros:

- best option for design systems, diagrams, social cards, vector graphics
- much better than generic text-to-image models for brand consistency and structured visuals
- may solve part of our `analytical` and `social` consistency problem

Cons:

- premium variants are expensive
- may not beat OpenAI on natural editorial realism in every hero scene

Best DBR77 use:

- `analytical`
- high-value `social`
- reusable website/supporting graphics
- vector graphics for long-term content system assets

Sources:

- [Recraft API pricing](https://www.recraft.ai/docs/api-reference/pricing)
- [Recraft V4 docs](https://www.recraft.ai/docs/recraft-models/recraft-V4)

### 4. FLUX / Black Forest Labs

Why it matters:

- one of the best quality-to-price families right now
- broad ecosystem and strong hosted availability
- good option when we want flexibility beyond one closed vendor

Signals:

- official BFL pricing is competitive: FLUX.2 Pro from `$0.03`, FLUX.1 Kontext Pro `$0.04`, Kontext Max `$0.08`
- Artificial Analysis ranks recent FLUX variants very highly on quality/price tradeoff

Pros:

- excellent value
- strong ecosystem via official API and hosted providers
- interesting if we want editing, context, or alternate rendering behavior

Cons:

- product surface is broader and slightly more fragmented than OpenAI
- still needs evaluation against our exact DBR77 brand standard

Best DBR77 use:

- cheap-to-mid-cost production
- hero exploration
- alternate rerender vendor to avoid single-provider dependence

Sources:

- [BFL pricing docs](https://docs.bfl.ai/quick_start/pricing)
- [Artificial Analysis FLUX family](https://artificialanalysis.ai/image/model-families/flux)

### 5. Ideogram

Why it matters:

- long-standing reputation for text rendering and layout discipline
- potentially useful for structured marketing compositions

Signals:

- official docs clearly support API onboarding and point to separate API billing
- public pricing docs exist, but direct detailed rate extraction is less straightforward than OpenAI/Recraft/BFL
- benchmark and practitioner sources still associate Ideogram strongly with text-in-image performance

Pros:

- strong typography and text placement reputation
- good candidate for structured promo compositions

Cons:

- less immediately attractive for our no-text-in-image production rule
- pricing transparency is weaker than some competitors in public docs

Best DBR77 use:

- only if we later decide to generate short embedded text compositions or poster-like social variants

Sources:

- [Ideogram API docs](https://docs.ideogram.ai/plans-and-pricing/ideogram-api)
- [Artificial Analysis Ideogram](https://artificialanalysis.ai/image/models/ideogram-v2)

### 6. Chinese / Asian Vendors

#### Tencent Hunyuan

Why it matters:

- official API exists
- pricing is aggressive

Signals:

- official Tencent documentation shows Hunyuan 3.0 pay-as-you-go at around `¥0.2 / image`
- Tencent also offers prepaid packs and concurrency add-ons

Pros:

- low price
- official first-party infrastructure

Cons:

- docs and operations are more China-cloud-centric
- higher operational friction for an English/European workflow
- less evidence yet that it beats OpenAI/Recraft for our DBR77 style

Best DBR77 use:

- only if we intentionally optimize around very low cost at scale

Sources:

- [Tencent Hunyuan pricing overview](https://cloud.tencent.cn/document/product/1668/90896)
- [Artificial Analysis Tencent family](https://artificialanalysis.ai/image/model-families/tencent)

#### ByteDance Seedream

Why it matters:

- benchmark signals are strong
- community perception is increasingly positive

Signals:

- Artificial Analysis shows Seedream as increasingly competitive, including top-tier recent placements
- however, first-party global API pricing/documentation is much less clear than OpenAI, Google, Recraft, or BFL
- in practice, access appears to be easier through third-party API providers

Pros:

- strong quality upside
- likely very attractive price/performance

Cons:

- first-party access transparency is weak
- more operational risk
- higher chance of depending on resellers or proxy platforms

Best DBR77 use:

- experimental second-wave testing only

Sources:

- [Artificial Analysis Seedream family](https://artificialanalysis.ai/image/model-families/Seedream)

#### Alibaba Wan / Wanx

Why it matters:

- official API exists through Alibaba Cloud Model Studio

Signals:

- official docs are available
- billing is per successfully generated image
- pricing is region-specific and less immediately legible than Google/Recraft/OpenAI public summaries

Pros:

- official enterprise cloud path
- potential low-cost option in some regions

Cons:

- lower transparency in quick vendor evaluation
- not enough strong quality evidence yet for our use case

Best DBR77 use:

- not recommended as a first expansion move

Sources:

- [Alibaba Wan image API reference](https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-api-reference)

## Practical Ranking For DBR77

### Best overall quality right now

1. OpenAI
2. Recraft V4 Pro / Recraft V4
3. FLUX.2 Pro / FLUX.1 Kontext
4. Seedream
5. Google Imagen 4
6. Tencent / Alibaba (promising but operationally weaker for us today)

### Best price-to-quality for production

1. FLUX.2 Pro
2. Recraft V4
3. OpenAI
4. Google Imagen 4
5. Tencent Hunyuan

### Best design / structured graphics / branded analytical assets

1. Recraft
2. Ideogram
3. OpenAI
4. FLUX
5. Google

### Lowest operational risk

1. OpenAI
2. Google
3. Recraft
4. BFL / FLUX
5. Tencent
6. Alibaba
7. Seedream via third-party access

## Recommended Strategy: Better, Faster, Cheaper

### Strategy A: Best Immediate Move

Use a two-tier system:

- `OpenAI` for final `hero`
- `Recraft V4` for `analytical` and selected `social`

Why:

- best chance of immediate quality improvement
- keeps tooling simple
- gives us a clear division between editorial realism and structured design

Tradeoff:

- not the absolute cheapest setup
- but likely the cheapest publishable setup

### Strategy B: Balanced Cost System

Use a three-tier system:

- `FLUX.2 Pro` or `Google Imagen 4 Fast` for draft exploration
- `OpenAI` for final `hero`
- `Recraft V4` for final `analytical` and structured social assets

Why:

- cheaper first pass
- premium only where it matters
- likely best cost/performance mix

Tradeoff:

- more routing logic in the runner
- more quality management rules needed

### Strategy C: Aggressive Cost Optimization

Use:

- `Tencent Hunyuan` or `Google Imagen 4 Fast` for bulk generation
- `OpenAI` only for rerendering top-priority failures

Why:

- minimizes list-price cost

Tradeoff:

- higher review burden
- more rerenders
- likely false economy unless quality is proven in our own tests

## My Recommendation

For DBR77 today:

### Phase 1

- keep `OpenAI` as the default production provider for `hero`
- keep `OpenAI` as fallback for everything

### Phase 2

- add `Recraft V4` as a second provider for `analytical` and selected `social`
- compare `Recraft` vs `OpenAI` on 5 weak `Consultify` articles

### Phase 3

- add `FLUX` as a low-cost exploration provider
- use it only for early draft candidates, not for automatic publishable outputs

### Phase 4

- test one Asian challenger only after phases 1-3
- if we test one, test `Seedream` first for quality or `Tencent Hunyuan` first for cost

## Suggested Architecture

Implement provider routing inside the runner:

- `hero` -> `openai`
- `analytical` -> `recraft`
- `social` -> `recraft` or `openai`
- `exploration` mode -> `flux` or `google_fast`

Add a per-row override in the queue:

- `provider_strategy`
- `provider_primary`
- `provider_fallback`
- `quality_tier`

Example:

- `hero, premium, openai, flux`
- `analytical, design, recraft, openai`
- `social, fast_social, recraft, openai`

## Operational Improvements That Matter More Than The Model

Even the best model will waste money if we skip these:

- add automated OCR check to reject readable accidental text
- add style-family tags so social assets stop drifting visually
- score outputs on publishability, not just generation success
- use rerender rules by role, not one generic rule for all assets
- save 2-4 candidates only in exploration mode, but only for selected articles

## Bottom Line

If the goal is to do this better, faster, and cheaper:

- do not stay single-vendor forever
- do not optimize for cheapest raw image
- optimize for cheapest publishable asset

Best next move:

1. keep `OpenAI` for final quality
2. test `Recraft V4` for analytical/social
3. optionally add `FLUX` for cheap exploration
4. treat Chinese models as phase-two experiments, not the immediate production backbone
