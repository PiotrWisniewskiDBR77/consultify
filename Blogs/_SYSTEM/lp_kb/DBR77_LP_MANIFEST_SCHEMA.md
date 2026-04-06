# DBR77 LP Manifest Schema

## Purpose

This file defines the schema expected from generated LP manifests.

It is a practical schema contract, not a formal JSON Schema file.

## Manifest Set

Per product, the LP build pipeline should generate:

- `knowledge_base_manifest.json`
- `renderer_manifest.json`
- `relation_manifest.json`
- `qa_manifest.json`

## 1. `knowledge_base_manifest.json`

### Purpose

Canonical structured content dataset for one product knowledge base.

### Required top-level fields

- `schema_version`
- `product`
- `source_root`
- `generated_at`
- `primary_persona_entry`
- `sections`
- `articles`
- `cta_ladder`
- `cross_product_bridges`

### Required `sections[]` fields

- `section_id`
- `label`
- `promise`
- `intro`
- `featured_slugs`
- `deeper_slugs`
- `section_cta`

### Required `articles[]` fields

- `canonical_id`
- `slug`
- `title`
- `product`
- `target_persona`
- `funnel_stage`
- `core_problem`
- `main_promise`
- `lp_section`
- `knowledge_layer`
- `bridge_product`
- `bridge_section`
- `primary_keyword`
- `featured`
- `mva_role`
- `locales`

### Required `locales` object

- `EN.path`
- `PL.path`
- `DE.path`

Recommended:

- `EN.title`
- `PL.title`
- `DE.title`

## 2. `renderer_manifest.json`

### Purpose

UI-facing module composition manifest for the LP renderer.

### Required top-level fields

- `product`
- `entry_module`
- `decision_paths`
- `knowledge_sections`
- `proof_modules`
- `cta_modules`
- `bridge_module`

### Required `entry_module`

- `hero_value_proposition`
- `problem_reality_block`
- `primary_persona_bridge`
- `primary_cta`

### Required `decision_paths[]`

- `path_id`
- `label`
- `goal`
- `section_target`
- `cta`

### Required `knowledge_sections[]`

- `section_id`
- `label`
- `featured_cluster`
- `deeper_library`
- `proof_module_ref`
- `cta_module_ref`

## 3. `relation_manifest.json`

### Purpose

Explicit relation graph used for recommendations and bridges.

### Required top-level fields

- `product`
- `same_lp_edges`
- `cross_product_edges`
- `featured_edges`
- `mva_edges`

### Required edge fields

- `from_slug`
- `to_slug`
- `edge_type`
- `reason`
- `weight`

Allowed `edge_type` values:

- `same_section`
- `same_layer`
- `same_persona`
- `same_stage`
- `bridge_next_product`
- `featured_cluster`
- `mva_path`

## 4. `qa_manifest.json`

### Purpose

Machine-readable validation output for the LP program.

### Required fields

- `product`
- `article_count_expected`
- `article_count_actual`
- `locale_complete_count`
- `section_count`
- `featured_article_count`
- `bridge_count`
- `warnings`
- `errors`

### Required `warnings[]` fields

- `code`
- `scope`
- `message`

### Required `errors[]` fields

- `code`
- `scope`
- `message`

## Identity Rules

### `canonical_id`

Use:

- `<product>::<slug>`

Example:

- `Consultify::01_why_traditional_consulting_is_broken`

### `section_id`

Use:

- `<product>::<normalized_section_label>`

Example:

- `Consultify::governance_and_roi`

## Versioning Rule

Every generated manifest must include:

- `schema_version`

Initial value:

- `1.0.0`

## Recommended Output Folder

Per product, write manifests to:

- `_LP_KB_READY/<Product>/`

Suggested files:

- `_LP_KB_READY/<Product>/knowledge_base_manifest.json`
- `_LP_KB_READY/<Product>/renderer_manifest.json`
- `_LP_KB_READY/<Product>/relation_manifest.json`
- `_LP_KB_READY/<Product>/qa_manifest.json`

