# Consultify KB Build Start

Use this folder as the build input for the first live knowledge-base implementation for `Consultify`.

## Files

- `knowledge_base_manifest.json` contains the product-level content contract for the module.
- `renderer_manifest.json` defines the entry module, decision paths, section order, proof modules, CTA modules, and bridge module.
- `relation_manifest.json` contains article-to-article and cross-product relation edges.
- `qa_manifest.json` is the release gate for this product package.

## Current Status

- article count: `50/50`
- locales complete: `50/50`
- sections: `3`
- warnings: `0`
- errors: `0`

## Build Order

1. Render the entry module from `renderer_manifest.json`.
2. Render decision paths and CTA ladder.
3. Render the three knowledge sections in this order:
   - `Governance And ROI`
   - `Execution And Rollout`
   - `AI And Decision Making`
4. Attach proof modules and bridge modules.
5. Use `relation_manifest.json` for related-article recommendations.
6. Validate the build against `qa_manifest.json`.

## First Implementation Note

For the first live build, start from the `featured_cluster` articles in each section before exposing the full deeper library.
