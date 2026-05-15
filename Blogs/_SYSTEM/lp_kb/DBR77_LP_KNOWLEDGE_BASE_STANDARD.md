# DBR77 LP Knowledge Base Standard

## Purpose

This file defines the canonical standard for the knowledge-base module used on DBR77 product landing pages.

It answers one practical implementation question:

When a product content catalog is copied into an LP repository, what should the LP program build, how should it behave, and what quality bar must it meet?

## Core Rule

The LP knowledge base is not:

- a blog list
- a date archive
- a generic CMS category page
- a thin proof block with a few article links

The LP knowledge base is:

- the public knowledge front door for one product
- a structured decision system
- a curated entry point into grouped industrial knowledge
- a routing layer from problem -> section -> article -> next step

## Standard Input Assumption

The LP program receives one product content package as input.

That input must contain:

- article folders
- locale article bodies
- machine-readable manifests
- relation manifests
- section and CTA logic

The program must never infer structure only from filenames if explicit manifests are available.

## What The Module Must Do

Every product LP knowledge base module must:

1. make the product promise clear
2. prove the buyer problem fast
3. let the buyer choose a starting path
4. expose grouped knowledge sections, not chronological posts
5. surface proof and implementation depth
6. present maturity-matched CTA options
7. surface controlled cross-product bridges
8. preserve locale behavior for `EN`, `PL`, and `DE`

## Required Module Layers

### 1. Entry Layer

This is the top visible layer on the LP.

Required components:

- `heroValueProposition`
- `problemRealityBlock`
- `decisionPaths`

Purpose:

- explain what the product is
- make the problem legible
- reduce choice paralysis

### 2. Knowledge Layer

This is the main article-discovery layer.

Required components:

- `knowledgeSectionNav`
- `knowledgeSections`
- `sectionIntro`
- `featuredCluster`
- `deeperLibraryList`
- `articleCard`

Purpose:

- expose depth
- group by decision logic
- help the buyer self-route without reading the full page top to bottom

### 3. Proof Layer

Required components:

- `proofSnapshots`
- `implementationWarnings`
- `caseShapedObservations`

Purpose:

- show repeated industrial pattern recognition
- make the company feel experienced, not merely articulate

### 4. CTA Layer

Required components:

- `ctaLadderLow`
- `ctaLadderMid`
- `ctaLadderHigh`

Purpose:

- match next step to maturity
- avoid a one-CTA-fits-all LP

### 5. Bridge Layer

Required components:

- `crossProductBridge`
- `relatedArticles`
- `relatedSections`

Purpose:

- reveal the DBR77 system progressively
- keep the current LP primary
- avoid random internal linking

## Mandatory Public Structure

The default public module order is:

1. hero value proposition
2. problem reality block
3. decision or use-case paths
4. grouped knowledge sections
5. proof and implementation block
6. CTA ladder
7. cross-product bridge

This follows the logic already defined in:

- `Blogs/_SYSTEM/lp_kb/DBR77_LP_KNOWLEDGE_ARCHITECTURE_MODEL.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_IMPLEMENTATION_MAP.md`

## Minimum And Expanded Variants

### Minimum variant

Use when a product LP must go live quickly.

Must include:

- `3` grouped knowledge sections
- `3-6` featured articles per section
- `1` proof block
- `1` CTA ladder
- `1` cross-product bridge

### Expanded variant

Use when the LP can expose a fuller module.

Should include:

- `3` grouped knowledge sections with featured and deeper library blocks
- section-specific proof assets
- section-level CTA ladders
- related-article modules
- article-to-article and section-to-section recommendations
- locale switcher behavior

## Required Record Types

The LP program must work with these record types:

- `knowledgeBase`
- `knowledgeSection`
- `featuredArticle`
- `articleRecord`
- `proofSnapshot`
- `ctaEntry`
- `crossProductBridge`
- `relatedArticleEdge`

Each record type is defined in:

- `Blogs/_SYSTEM/lp_kb/DBR77_LP_CONTENT_CONTRACT.md`
- `Blogs/_SYSTEM/lp_kb/DBR77_LP_RENDERER_CONTRACT.md`

## Knowledge Section Rules

Every LP knowledge base must expose at least `3` grouped knowledge sections.

Every section must have:

- one public label
- one section promise
- one short buyer-intent intro
- one featured cluster
- one deeper library list
- one section-level CTA

Allowed shared labels:

- `Downtime And OEE`
- `Layout And Flow`
- `CAPEX And Investment`
- `Governance And ROI`
- `Automation And Sourcing`
- `AI And Decision Making`
- `Execution And Rollout`

## Article Card Rules

Every article card rendered on the LP must expose:

- title
- one-line problem or promise
- primary persona
- funnel stage
- LP section
- knowledge layer
- locale availability
- one primary CTA hint

Recommended optional fields:

- proof note
- bridge note
- estimated reading time

## Locale Rules

The module must support `EN`, `PL`, and `DE`.

Rules:

- article identity stays stable across locales
- locale switching changes body content, not article identity
- section placement must remain stable across locales
- missing locale variants must surface as QA failures before publish

## Cross-Product Bridge Rules

Cross-product bridges must be explicit and controlled.

They must:

- come after the primary product logic
- be tied to a known next buyer question
- point to one specific product and section, not a vague ecosystem statement

They must not:

- flood the LP with unrelated DBR77 links
- replace product clarity with system explanation too early

## Quality Gate

Do not mark an LP knowledge base module ready unless:

- one primary persona entry is obvious
- one primary product promise is obvious
- `3` grouped sections are visible
- each section contains featured plus deeper knowledge
- proof is visible beyond article titles
- CTA ladder covers low, mid, and high commitment
- at least one controlled cross-product bridge exists
- locales are structurally supported

## Output Expectation

The LP repository program should be able to take one product package and generate:

- section records
- article records
- relation edges
- proof blocks
- CTA blocks
- locale variant maps
- QA warnings

Those outputs are defined by:

- `Blogs/_SYSTEM/lp_kb/DBR77_LP_MANIFEST_SCHEMA.md`
- `Blogs/_SYSTEM/lp_kb/DBR77_LP_RELATION_RULES.md`

