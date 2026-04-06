# Consultify First 10 Image Batch Report

Date: 2026-03-28
Provider: OpenAI `gpt-image-1.5`
Scope: `Consultify` articles `01-10`
Run result: `30/30` generated successfully, `0` failed

## Executive Summary

The pipeline is now operational at small-batch production scale. The strongest improvement came from switching the production test from Google to OpenAI for this product slice.

Overall quality across the first 10 full sets is good enough to continue iterating in production, but not yet good enough to call fully standardized. The batch shows a clear split:

- `Hero` images are the most consistently useful.
- `Analytical` images are often usable, but several drift into generic infographic language instead of credible operational storytelling.
- `Social` images are the least stable and need the most prompt tuning for stronger narrative punch and stricter brand consistency.

Recommended decision:

- Continue generation for `Consultify` with OpenAI as the default provider.
- Keep reviewing in batches of 10 articles.
- Before scaling to all products, tighten the prompt standard specifically for `social` and for `analytical` images that still allow text-like diagram behavior.

## Article-By-Article Assessment

### 01 `why_traditional_consulting_is_broken`

- Quality: strong
- Usefulness: high
- Notes: strong hero and analytical metaphor, strong social crop, good contrast between static consulting output and live execution.

### 02 `10_questions_before_buying_ai_consulting_platform`

- Quality: strong
- Usefulness: high
- Notes: one of the best complete sets in the batch. Hero and analytical are clear, executive, and product-relevant. Social is simple but practical for LinkedIn and newsletter thumbnails.

### 03 `first_30_minutes_in_consultify`

- Quality: mixed
- Usefulness: medium
- Notes: hero communicates onboarding and working session well, but analytical is too simplified and social leans back into document-centric visual language instead of platform activation energy.

### 04 `roi_calculator_guide`

- Quality: mixed
- Usefulness: medium-high
- Notes: hero and social are usable. Analytical contains explicit labels and feels too close to templated infographic output, which weakens credibility.

### 05 `ai_driven_swot`

- Quality: mixed
- Usefulness: medium
- Notes: analytical and social are directionally useful. Hero drifts toward a generic strategy meeting with dashboard wall instead of a sharper SWOT-specific transformation frame.

### 06 `scenario_planning`

- Quality: strong
- Usefulness: high
- Notes: one of the best sets conceptually. Hero is credible and clear. Analytical is clean and easy to understand. Social is dramatic, but effective for attention capture.

### 07 `competitive_intelligence`

- Quality: weak-mixed
- Usefulness: low-medium
- Notes: hero is acceptable, analytical is usable, but social is not acceptable for production because it introduces a giant question mark and feels like a stock poster rather than a premium B2B asset.

### 08 `strategic_alignment`

- Quality: mixed
- Usefulness: medium
- Notes: hero is decent. Analytical is readable but too framework-slide-like. Social is visually striking, but stylistically inconsistent with the rest of the Consultify system because it shifts into monochrome illustrated editorial art.

### 09 `data_first_strategy`

- Quality: mixed
- Usefulness: medium
- Notes: hero is credible but generic. Analytical explains the idea, but the `VS` comparison layout feels more like a presentation aid than a premium article graphic. Social is usable, though still document-heavy.

### 10 `decision_latency`

- Quality: strong
- Usefulness: high
- Notes: hero is strong and memorable, analytical clearly supports the thesis, and social is premium, simple, and reusable across website/newsletter/social contexts.

## Best And Weakest Sets

### Best Sets

- `02_10_questions_before_buying_ai_consulting_platform`
- `06_scenario_planning`
- `10_decision_latency`
- `01_why_traditional_consulting_is_broken`

### Weakest Sets

- `07_competitive_intelligence`
- `08_strategic_alignment`
- `03_first_30_minutes_in_consultify`
- `05_ai_driven_swot`

## Cross-Batch Findings

### What Worked Well

- OpenAI handles executive realism much better than Google for this system.
- Physical objects, cards, markers, table-top systems, and workshop scenes generate better than prompts centered on screens, dashboards, or labeled diagrams.
- Decision, tradeoff, timing, and execution themes work especially well when expressed through material metaphors.
- The runner, naming, sidecars, and queue execution behaved reliably through a full 30-image batch.

### Recurring Problems

- `Social` prompts often fall back to documents, cards, dashboards, or symbolic props instead of creating a memorable single-frame thesis.
- Some `analytical` prompts still permit too much diagram logic, which causes slide-like output or faint text artifacts.
- Several images are conceptually correct but too generic for premium content marketing.
- Style consistency still drifts from article to article, especially in social assets.

## What We Can Do Better

### 1. Tighten the Social Prompt Contract

Current social prompts are the weakest part of the system. They need a stricter rule set:

- one dominant focal object
- one thesis, not a mini-scene with many ideas
- no documents unless the article is explicitly about documentation
- no literal symbols like giant punctuation marks
- no illustrated poster drift unless intentionally requested

### 2. Reduce Diagram Language In Analytical Prompts

Analytical images should remain explanatory, but they should stop looking like presentation slides. Better direction:

- use physical modules, flows, tokens, gates, and states
- avoid panelized UI grids
- avoid charts with labels
- avoid slide boards and whiteboard aesthetics

### 3. Make Hero Prompts More Article-Specific

Some hero images are good but interchangeable. To improve:

- reference the article's unique business tension more explicitly
- prefer industry or operating context over generic boardroom scenes
- add one concrete operational cue per article

### 4. Create Social Style Families

Instead of one broad social style, define 3 reusable families:

- executive close-up
- object metaphor
- operational tension scene

This should improve consistency while still giving variation across the library.

### 5. Add Batch-Level Quality Gates

Before scaling beyond `Consultify`, apply these quick review rules:

- reject any readable text or punctuation
- reject any stock-photo facial acting
- reject any image that could fit any generic B2B SaaS blog
- reject any social image without a clean center-safe focal subject

## Recommended Next Step

Proceed with a focused prompt cleanup for:

- `03_first_30_minutes_in_consultify`
- `05_ai_driven_swot`
- `07_competitive_intelligence`
- `08_strategic_alignment`
- `09_data_first_strategy`

Then run a second corrective batch only for those weaker sets before scaling `Consultify 11-20`.
