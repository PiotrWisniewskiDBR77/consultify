# DBR77 LP Upload Batch Sheet

## Purpose

This sheet is the operator view for tomorrow's LP knowledge-base upload.

Use one row per product and do not move forward until the previous row is complete.

## Batch Table

| Order | Product | Source root | Count target | Main LP sections | Status | Notes |
|---|---|---|---:|---|---|---|
| 1 | `Consultify` | `Blogs/Consultify/Blog/` | 50 | `Governance And ROI` / `Execution And Rollout` / `AI And Decision Making` | ready | exclude `00_*` files |
| 2 | `IoT` | `Blogs/IoT/Blog/` | 50 | `Downtime And OEE` / `Execution And Rollout` / `AI And Decision Making` | ready | exclude `00_*` files |
| 3 | `IRIS` | `Blogs/IRIS/Blog/` | 50 | `AI And Decision Making` / `Execution And Rollout` / `Governance And ROI` | ready | use `00_LP_ATTACHMENT_CHECK_01_50.md` as section reference |
| 4 | `DT` | `Blogs/DT/Blog/` | 50 | `Layout And Flow` / `CAPEX And Investment` / `Governance And ROI` | ready | exclude `00_*` files |
| 5 | `Marketplace` | `Blogs/Marketplace/Blog/` | 50 | `Automation And Sourcing` / `CAPEX And Investment` / `Execution And Rollout` | caution | exclude `_archive_marketplace_43_49_pre_collision_packages/` and `00_*` |
| 6 | `Vector` | `Blogs/Vector/Blog/` | 50 | `AI And Decision Making` / `Governance And ROI` / `Execution And Rollout` | ready | exclude `00_*` and `00_VECTOR_STRATEGY.md` |

## Operator Pass Fields

For each product, log:

- upload started
- upload finished
- imported count
- rejected count
- section mapping confirmed
- locale variant confirmed
- spot-check passed

## Spot-Check Rule

After each product upload, check at least:

1. one early-number article
2. one middle-range article
3. one late-range article

Verify for each check:

- title is correct
- body is the article body, not package metadata
- locale variants are attached correctly
- section assignment matches the LP model

## Stop Conditions

Stop the upload wave immediately if:

- a `00_*` file is entering the LP
- an `_archive_*` package is entering the LP
- locale files are being created as separate wrong products
- section labels diverge from the LP implementation map
- body content is missing or replaced by metadata
