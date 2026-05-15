# DBR77 LP Repo Import Contract

## Purpose

This file defines the import contract for LP repositories that build public knowledge bases from DBR77 product content.

## Contract Priority

LP repos should not infer structure from markdown alone when manifests are available.

Use this priority order:

1. `Blogs/_LP_KB_READY/<Product>/knowledge_base_manifest.json`
2. `Blogs/_LP_KB_READY/<Product>/relation_manifest.json`
3. `Blogs/_LP_KB_READY/<Product>/renderer_manifest.json`
4. article folders under `Blogs/<Product>/Blog/<NN_topic_slug>/`

## Canonical Meaning Of Each Layer

### `knowledge_base_manifest.json`

Use as the canonical structured dataset for:

- section definitions
- featured vs deeper article grouping
- article identity and locale paths
- CTA ladder
- product bridges
- section assignment per article

### `relation_manifest.json`

Use as the canonical relation graph for:

- same-section recommendations
- featured/deeper linking
- bridge logic
- recommendation ordering

### `renderer_manifest.json`

Use as the canonical renderer contract for:

- hero knowledge entry
- decision paths
- section module composition
- CTA blocks
- proof modules

### Article folders under `Blogs/<Product>/Blog/`

Use only as the content payload:

- article bodies
- locale variants
- SEO sidecars
- CTA sidecars
- social/publish/source/image prompt sidecars

## LP Repo Must Not Guess

An LP repo must not:

- derive sections by scanning headings across all markdown files
- invent category grouping independent of manifest `lp_section`
- pick article folders by globbing the whole `Blog/` root without manifest verification
- import duplicate article files with ` 2` suffixes

## Required Runtime Pattern

LP repos should mirror the Consultify KB runtime pattern:

- public KB API routes
- KB service using `kb_*` tables
- public KB pages for home/category/article
- hooks/client using `/api/public/kb-v8` and `/api/v8/kb`
- static assets under `/kb/<productKey>/<slug>/...`

## Product Scoping Rule

Every LP repo import must be product-scoped:

- IDs: `kb-<productKey>-...`
- categories: `kb-cat-<productKey>-...`
- collections: `kb-coll-<productKey>-...`
- static paths: `/kb/<productKey>/<slug>/...`

## Release Rule

Do not mark an LP repo import ready unless:

- the manifest article count is `50`
- all three locales exist per article
- section assignments match manifest `lp_section`
- recommendation edges come from `relation_manifest.json`
- public pages render article bodies without metadata leaking into the reader-facing content
