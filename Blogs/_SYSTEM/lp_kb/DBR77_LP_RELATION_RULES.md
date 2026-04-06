# DBR77 LP Relation Rules

## Purpose

This file defines how the LP program should auto-build relations:

- article -> article
- article -> section
- section -> section
- LP -> LP

## Core Rule

Relations are automatic by default.

Manual curation is allowed only through controlled override files.

## Relation Sources

Use these inputs in order:

1. `bridge` and `lp_section` from `Blogs/_DATA/catalogs/DBR77_CONTENT_CATALOG.csv`
2. `knowledge_layer`
3. `target_persona`
4. `funnel_stage`
5. `Blogs/_OPERATIONS/core/DBR77_LP_IMPLEMENTATION_MAP.md`
6. `Blogs/_SYSTEM/standards/DBR77_MINIMUM_VIABLE_ASSET_SET.md`

## Relation Classes

### 1. Same-section relations

Use when two articles share:

- same `product`
- same `lp_section`

Default weight:

- `100`

Purpose:

- section-level discovery
- featured to deeper-library expansion

### 2. Same-layer relations

Use when two articles share:

- same `product`
- same `knowledge_layer`

Default weight:

- `70`

Purpose:

- help buyers continue within the same knowledge maturity

### 3. Same-persona relations

Use when two articles share:

- same `product`
- same `target_persona`

Default weight:

- `60`

### 4. Same-stage relations

Use when two articles share:

- same `product`
- same `funnel_stage`

Default weight:

- `50`

### 5. Bridge-next-product relations

Use when:

- `bridge_product` is present
- `bridge_section` is present or can be inferred from implementation map

Default weight:

- `80`

Purpose:

- controlled cross-product progression

## Ranking Rule

For related articles inside one product, rank by:

1. same `lp_section`
2. same `knowledge_layer`
3. same `target_persona`
4. same `funnel_stage`
5. same `mva_role`

For cross-product relations, rank by:

1. explicit `bridge_product`
2. explicit section mapping in `DBR77_LP_IMPLEMENTATION_MAP.md`
3. matching CTA family

## Tie-Breaker Rule

If multiple candidates have the same score, prefer:

1. `featured`
2. article in the current MVA set
3. lower cognitive distance from current stage

### Cognitive distance rule

Prefer:

- awareness -> awareness or decision support
- decision -> decision support or execution
- adoption -> execution or same-product advanced content

## MVA Relations

Every product should expose a canonical minimum path:

- flagship awareness -> explainer -> decision-stage -> adoption-stage

Those paths are defined in:

- `Blogs/_SYSTEM/standards/DBR77_MINIMUM_VIABLE_ASSET_SET.md`

The LP program should create `mva_path` edges for those links even if other scoring paths exist.

## Featured Cluster Relations

Inside each section:

- all featured articles should link to deeper library candidates
- deeper library candidates should link back to at least one featured anchor

Use relation type:

- `featured_cluster`

## Cross-Product Rules

Cross-product relations are allowed only when one of these is true:

- explicit bridge exists in the content catalog
- explicit bridge exists in the LP implementation map
- override rule exists

Never auto-bridge simply because two articles share a keyword.

## Maximum Relation Counts

Per article, default visible limits:

- same-product related articles: `3-6`
- same-section deeper articles: `3-8`
- cross-product bridges: `1-2`

## Section Relation Rules

Sections can also relate to other sections.

Allowed examples:

- `Governance And ROI` -> `CAPEX And Investment`
- `Downtime And OEE` -> `Execution And Rollout`
- `AI And Decision Making` -> `Governance And ROI`

Section-level bridges should be driven by:

- the LP implementation map
- explicit product bridge logic

## Override Rule

When automatic ranking produces a weak relation, use:

- `Blogs/_SYSTEM/lp_kb/DBR77_LP_RELATION_OVERRIDES_TEMPLATE.md`

Overrides may:

- force-add an edge
- remove an edge
- replace a bridge target
- change relation weight

## Output Rule

The generated relation manifest should contain:

- `same_lp_edges`
- `cross_product_edges`
- `featured_edges`
- `mva_edges`

Each edge must contain:

- `from_slug`
- `to_slug`
- `edge_type`
- `reason`
- `weight`

