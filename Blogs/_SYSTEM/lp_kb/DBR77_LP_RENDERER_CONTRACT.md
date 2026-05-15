# DBR77 LP Renderer Contract

## Purpose

This file defines what the LP repository program should render after consuming LP knowledge-base manifests.

It is the UI and module contract for the LP knowledge base.

## Core Rule

The renderer does not invent structure.

It renders:

- the section model
- the article model
- the CTA model
- the proof model
- the relation model

from manifests generated upstream.

## Renderer Input

The renderer should consume:

- `knowledge_base_manifest.json`
- `renderer_manifest.json`
- `relation_manifest.json`
- `qa_manifest.json`

## Required Modules

### 1. `heroKnowledgeEntry`

Purpose:

- open the LP with product clarity
- bridge from buyer problem to knowledge system

Required props:

- `product_promise`
- `persona_bridge`
- `primary_problem`
- `primary_cta`
- `hero_anchor_target`

### 2. `problemRealityBlock`

Purpose:

- prove the problem is real in field language

Required props:

- `problem_statement`
- `common_failure_pattern`
- `role_specific_consequence`
- `supporting_featured_articles`

### 3. `decisionPaths`

Purpose:

- reduce buyer cognitive load
- route by maturity

Required props per path:

- `label`
- `goal`
- `target_section`
- `cta_label`

Recommended path labels:

- `understand the problem`
- `compare options`
- `see implementation path`
- `review proof`
- `start next step`

### 4. `knowledgeSectionNav`

Purpose:

- make grouped knowledge visible early
- allow fast section switching

Required props:

- `sections[]`
- `active_section`

### 5. `knowledgeSection`

Purpose:

- render one public section of the knowledge base

Required props:

- `section_label`
- `section_promise`
- `section_intro`
- `featured_cluster`
- `deeper_library`
- `section_cta`

### 6. `featuredCluster`

Purpose:

- render the front-door articles for one section

Required props:

- `featured_slugs`
- `featured_cards`
- `cluster_reason`

### 7. `articleCard`

Purpose:

- standard reusable card for article discovery

Required props:

- `slug`
- `title`
- `summary_line`
- `target_persona`
- `funnel_stage`
- `knowledge_layer`
- `locale_status`
- `article_url`

Recommended props:

- `proof_hint`
- `bridge_hint`
- `hero_image`

### 8. `proofSnapshots`

Purpose:

- show short proof-bearing insight units between knowledge discovery and CTA

Required props:

- `snapshot_id`
- `headline`
- `situation`
- `signal`
- `mistake`
- `fix_pattern`
- `outcome_logic`
- `asset_anchor`

### 9. `ctaLadder`

Purpose:

- present low, medium, and high commitment options

Required props:

- `low_commitment`
- `mid_commitment`
- `high_commitment`

Each CTA entry must include:

- `label`
- `intent`
- `target`

### 10. `crossProductBridge`

Purpose:

- reveal the next relevant DBR77 gate

Required props:

- `target_product`
- `target_section`
- `why_next`
- `bridge_cta`

## Locale Behavior

### `localeVariantSwitcher`

Purpose:

- switch article body locale without changing article identity

Required props:

- `available_locales`
- `active_locale`
- `canonical_id`

Rule:

- locale changes content variant, not section placement

## Recommendation Modules

### `relatedArticles`

Purpose:

- render same-product recommendations

Required props:

- `source_slug`
- `related_items[]`

### `crossProductRecommendations`

Purpose:

- render controlled cross-product recommendations after the primary logic

Required props:

- `source_slug`
- `bridge_items[]`

## State Rules

The renderer must support these states:

- `ready`
- `warning`
- `error`
- `empty`

### `warning`

Use when:

- some optional metadata is weak
- proof blocks are missing but content can still render

### `error`

Use when:

- article count is broken
- sections are unresolved
- locale contract is broken

### `empty`

Use only if a section has no renderable articles.

The LP should not go live in this state.

## Render Order

Render in this order:

1. `heroKnowledgeEntry`
2. `problemRealityBlock`
3. `decisionPaths`
4. `knowledgeSectionNav`
5. `knowledgeSection[]`
6. `proofSnapshots`
7. `ctaLadder`
8. `crossProductBridge`

## What The Renderer Must Not Do

The renderer must not:

- sort articles by date by default
- flatten grouped sections into one undifferentiated list
- expose cross-product links before product logic is clear
- render locale variants as separate public articles
- replace article summaries with generic marketing copy

