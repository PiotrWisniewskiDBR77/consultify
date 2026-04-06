# DBR77 LP KB Example Flow: Consultify

## Purpose

This file shows the full import -> build -> QA -> publish flow for one product LP.

Use it as the reference operating example for LP repositories.

## Input

Copy this product package into the LP repo workflow input:

- `Blogs/_LP_UPLOAD_READY/Consultify/`

## Build Inputs

The LP build program should also consume:

- `Blogs/_DATA/catalogs/DBR77_CONTENT_CATALOG.csv`
- `Blogs/Consultify/Blog/00_KNOWLEDGE_LAYER_MAP_01_50.csv`
- `Blogs/Consultify/Blog/00_LP_ATTACHMENT_CHECK_01_50.md`
- `Blogs/_SYSTEM/standards/DBR77_MINIMUM_VIABLE_ASSET_SET.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_IMPLEMENTATION_MAP.md`

## Build Steps

1. validate that `50` article folders exist
2. validate all `EN`, `PL`, and `DE` article bodies exist
3. enrich each article with:
   - `lp_section`
   - `knowledge_layer`
   - `target_persona`
   - `funnel_stage`
   - `bridge_product`
4. build grouped sections:
   - `Governance And ROI`
   - `Execution And Rollout`
   - `AI And Decision Making`
5. build featured clusters and deeper-library lists
6. build MVA path:
   - `01_why_traditional_consulting_is_broken`
   - `03_first_30_minutes_in_consultify`
   - `21_how_to_defend_transformation_investment_with_live_value_evidence`
   - `24_what_a_transformation_pmo_should_track_every_week`
7. build relation graph
8. render LP knowledge-base module
9. run knowledge-base QA

## Expected Generated Output

After running:

- `python3 "Blogs/_TOOLS/build_lp_kb_ready.py"`

the program should expose:

- `Blogs/_LP_KB_READY/Consultify/knowledge_base_manifest.json`
- `Blogs/_LP_KB_READY/Consultify/renderer_manifest.json`
- `Blogs/_LP_KB_READY/Consultify/relation_manifest.json`
- `Blogs/_LP_KB_READY/Consultify/qa_manifest.json`

## Expected LP Result

The rendered Consultify LP knowledge base should show:

1. hero entry for executive transformation logic
2. problem reality block around strategy without execution control
3. three grouped sections
4. visible proof and implementation logic
5. CTA ladder from explore -> workshop -> ROI review
6. controlled bridges to:
   - `DT`
   - `IRIS`
   - `Vector`

## Release Gate

Treat the Consultify module as release-ready only when:

- all `50` articles are mapped
- no locale is missing
- no section is empty
- MVA path renders correctly
- cross-product bridges point to intended next products
- `qa_manifest.json` shows no blocking errors

