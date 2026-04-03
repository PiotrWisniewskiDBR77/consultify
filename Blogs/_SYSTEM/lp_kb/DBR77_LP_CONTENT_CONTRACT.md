# DBR77 LP Content Contract

## Purpose

This file defines the input contract between:

- the DBR77 content repository
- the product catalog copied into an LP repository
- the LP program that builds the knowledge base module

## Contract Rule

The LP program should consume one product package as a structured content input.

It should not scrape or guess page structure from arbitrary markdown alone when manifests are available.

## Canonical Input Root

Preferred input root:

- `Blogs/_LP_UPLOAD_READY/<Product>/`

The LP build workflow may also accept:

- `Blogs/<Product>/Blog/`

But only if the same validation rules are applied and operational files are excluded.

## Allowed Input Unit

The only valid content unit is the article folder.

Valid example:

- `01_why_traditional_consulting_is_broken/`

Invalid units:

- the whole `Blog/` root
- individual files detached from article folders
- `00_*` planning documents
- `_archive_*` folders

## Required Files Per Article Folder

Every valid article folder must contain:

- `article_EN.md`
- `article_PL.md`
- `article_DE.md`
- `seo.md`
- `cta.md`
- `image-prompts.md`
- `publish.md`
- `social.md`
- `sources.md`

## Required Fields Extracted By The LP Program

### From `article_EN.md`

The program must extract:

- `title`
- `target persona`
- `funnel stage`
- `core problem`
- `main promise`
- article body

### Editorial contract for public article bodies

For public reading quality, the article body must follow these rules:

- the reader-facing body starts after the operational metadata header
- the body should open with prose, not with a checklist or metadata block
- the core argument should be delivered primarily through paragraphs
- bullets should be limited to high-value decision tools such as checklists, scorecards, red flags, vendor questions, and leadership outputs
- CTA copy and product bridge should close the article rather than dominate the structure

Default article body sequence:

1. narrative opening
2. tension or mini-case
3. core argument in prose
4. compact decision block
5. product bridge
6. bottom line

### From `seo.md`

The program should extract:

- `slug`
- `meta title`
- `meta description`
- `primary keyword`
- `secondary keywords`
- `search intent`
- `core question to answer`
- `direct answer snippet`

### From `cta.md`

The program should extract:

- primary CTA
- secondary CTA
- product bridge
- objection to handle
- next-step recommendation

### From `publish.md`

The program should extract:

- page goal
- page structure notes
- CTA placement notes
- image placement notes
- optional FAQ or comparison notes

### From `social.md`

The program should extract:

- primary publishing face
- short teaser
- email angle or hook
- channel language note

### From `sources.md`

The program should extract:

- relevant live product pages
- proof points needing verification
- structural source notes if helpful for QA

## Required Enriched Metadata

The LP program must enrich article records with:

- `product`
- `lp_section`
- `knowledge_layer`
- `bridge_product`
- `bridge_section`
- `locale_status`
- `featured_status`
- `mva_role` when applicable

These fields come from:

- `Blogs/_DATA/catalogs/DBR77_CONTENT_CATALOG.csv`
- `Blogs/<Product>/Blog/00_KNOWLEDGE_LAYER_MAP_01_50.csv`
- `Blogs/<Product>/Blog/00_LP_ATTACHMENT_CHECK_01_50.md`
- `Blogs/_SYSTEM/standards/DBR77_MINIMUM_VIABLE_ASSET_SET.md`

## Required Output Records

The LP program should produce one machine-readable content package per product:

- `knowledge_base_manifest.json`
- `renderer_manifest.json`
- `relation_manifest.json`
- `qa_manifest.json`

Optional:

- `featured_clusters.json`
- `proof_snapshot_manifest.json`

## Validation Rules

Reject an article folder if:

- any of `article_EN.md`, `article_PL.md`, `article_DE.md` is missing
- title is missing
- target persona is missing
- funnel stage is missing
- LP section cannot be resolved
- knowledge layer cannot be resolved

Warn, but do not necessarily block, if:

- `social.md` misses publishing-face guidance
- `cta.md` is weak or generic
- `sources.md` has unresolved proof notes
- the public body opens with bullet-heavy structure instead of prose
- more than two long bullet sections appear without explanatory paragraphs between them
- the article has no mini-case, tension paragraph, or concrete consequence framing
- `Good answer` / `Red flag` style blocks dominate the article instead of summarizing it

## Locale Contract

The LP program must treat locales as variants of one article identity.

Required fields:

- `canonical_id`
- `slug`
- `locales.EN`
- `locales.PL`
- `locales.DE`

Locale behavior:

- all variants inherit the same `lp_section`
- all variants inherit the same `knowledge_layer`
- all variants inherit the same relation graph

## Exclusions

Never import:

- `00_*`
- `_archive_*`
- top-level files sitting directly in `Blog/`

Never render these as public knowledge records:

- `publish.md`
- `cta.md`
- `social.md`
- `seo.md`
- `sources.md`
- `image-prompts.md`

They are source inputs for manifests, not public article bodies.

## Metadata Header Rule

The four-line article header:

- `Target persona`
- `Funnel stage`
- `Core problem`
- `Main promise`

is an operational header.

It may remain in source files for content operations, but it must not define the public reading rhythm.

## Output Contract Stability

The LP repo program should rely on:

- stable record type names
- stable field names
- stable section labels
- stable locale keys

If the strategy changes, update:

1. `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_PLAN.md`
2. this file
3. `Blogs/_SYSTEM/lp_kb/DBR77_LP_MANIFEST_SCHEMA.md`

