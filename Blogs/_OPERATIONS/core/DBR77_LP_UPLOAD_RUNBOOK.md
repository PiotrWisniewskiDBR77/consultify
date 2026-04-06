# DBR77 LP Upload Runbook

## Purpose

This file is the operational runbook for uploading all article texts into the LP knowledge bases for:

- `Consultify`
- `IoT`
- `IRIS`
- `DT`
- `Marketplace`
- `Vector`

Use it tomorrow as the execution layer for the upload wave.

## Upload Goal

Load the full article libraries into the LP knowledge bases without importing:

- audit plans
- roadmap files
- attachment-check files
- archived collision packages
- other `00_*` operational documents

## Hard Import Rules

Import only article-package folders that contain:

- `article_EN.md`
- `article_PL.md`
- `article_DE.md`

Do not import anything from files or folders matching:

- `00_*`
- `_archive_*`

Do not treat files sitting directly inside `Blog/` as knowledge-base content.

The import unit is always the article folder, not the whole `Blog/` directory.

## Source Roots

| Product | Source root | Expected article count | LP section model |
|---|---|---:|---|
| `Consultify` | `Blogs/Consultify/Blog/` | 50 | `Governance And ROI`, `Execution And Rollout`, `AI And Decision Making` |
| `IoT` | `Blogs/IoT/Blog/` | 50 | `Downtime And OEE`, `Execution And Rollout`, `AI And Decision Making` |
| `IRIS` | `Blogs/IRIS/Blog/` | 50 | `AI And Decision Making`, `Execution And Rollout`, `Governance And ROI` |
| `DT` | `Blogs/DT/Blog/` | 50 | `Layout And Flow`, `CAPEX And Investment`, `Governance And ROI` |
| `Marketplace` | `Blogs/Marketplace/Blog/` | 50 | `Automation And Sourcing`, `CAPEX And Investment`, `Execution And Rollout` |
| `Vector` | `Blogs/Vector/Blog/` | 50 | `AI And Decision Making`, `Governance And ROI`, `Execution And Rollout` |

## Preferred Upload Layer

For live execution, prefer the clean export layer at:

- `Blogs/_LP_UPLOAD_READY/`

It contains only upload-ready article folders, locale bodies, per-product `upload_manifest.csv` files, batch archives in `_archives/`, and `integrity_manifest.csv` for checksum control.

## Product-Specific Warnings

### Consultify

- structure is clean for upload
- skip `00_AUDIT_AND_UPDATE_PLAN_*`

### IoT

- structure is clean for upload
- skip `00_AUDIT_AND_UPDATE_PLAN_*`

### IRIS

- structure is clean for upload
- skip `00_AUDIT_AND_UPDATE_PLAN_*`
- skip `00_LP_ATTACHMENT_CHECK_01_50.md`
- skip `00_PUBLICATION_CHECKLIST_PASS_01_50.md`
- use `Blogs/IRIS/Blog/00_LP_ATTACHMENT_CHECK_01_50.md` as the model for future section attachment logic

### DT

- structure is clean for upload
- skip `00_AUDIT_AND_UPDATE_PLAN_*`

### Marketplace

- import only the main `50` article folders
- do not import `_archive_marketplace_43_49_pre_collision_packages/`
- skip `00_AUDIT_AND_UPDATE_PLAN_*`

### Vector

- structure is clean for upload
- skip `00_AUDIT_AND_UPDATE_PLAN_*`
- skip `00_VECTOR_STRATEGY.md`

## Tomorrow's Upload Order

Use this order:

1. `Consultify`
2. `IoT`
3. `IRIS`
4. `DT`
5. `Marketplace`
6. `Vector`

Reason:

- it follows the current LP implementation sequence from strategy to operations to execution
- it keeps `IRIS` in the middle, where the existing attachment check can help validate section logic
- it leaves `Marketplace` late enough to avoid archive-package mistakes under time pressure

## Upload Checklist Per Product

- [ ] confirm source root
- [ ] confirm exactly `50` article folders are selected
- [ ] confirm only `article_EN.md`, `article_PL.md`, `article_DE.md` are used as body content
- [ ] confirm `00_*` files are excluded
- [ ] confirm `_archive_*` folders are excluded
- [ ] confirm LP section model for that product
- [ ] confirm CTA ladder for that product
- [ ] confirm upload batch is saved before moving to next product

## LP Mapping Sources

Use these files while uploading:

- `Blogs/_OPERATIONS/core/DBR77_LP_IMPLEMENTATION_MAP.md`
- `Blogs/_OPERATIONS/core/DBR77_PUBLICATION_ROUTING_QUEUE.md`
- `Blogs/_OPERATIONS/core/DBR77_DISTRIBUTION_REPURPOSING_REFRESH.md`
- `Blogs/IRIS/Blog/00_LP_ATTACHMENT_CHECK_01_50.md`

## Final Pre-Go Check

Before starting the first upload batch:

- confirm the LP platform expects article body markdown, not full package metadata
- confirm whether locales are loaded as separate records or as language variants of one record
- confirm whether LP section assignment happens during import or after import
- confirm whether slug comes from folder name or LP-side record title

If any of the four points above is unclear, stop and lock the import rule first.
