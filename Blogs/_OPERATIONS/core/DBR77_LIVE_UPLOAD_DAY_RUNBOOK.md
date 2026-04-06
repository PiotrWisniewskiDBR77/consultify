# DBR77 Live Upload Day Runbook

## Purpose

This runbook defines the operating sequence for the day the six product knowledge bases are uploaded into the LP system.

Use it with:

- `Blogs/_OPERATIONS/core/DBR77_LP_UPLOAD_RUNBOOK.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_UPLOAD_BATCH_SHEET.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_UPLOAD_MANIFESTS.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_PRE_GO_DECISIONS.md`
- product-level `00_LP_ATTACHMENT_CHECK_01_50.md`

## Day Structure

Run the day in five blocks:

1. pre-go lock
2. one test import
3. six product batches
4. post-upload QA
5. publication activation handoff

## Block 1: Pre-Go Lock

Do not start importing until all four decisions are confirmed:

- LP accepts article markdown body
- locales are handled as variants, not wrong duplicate records
- section assignment timing is known
- slug behavior is known

Before batch `1`, also confirm the operator is using the intended source from `Blogs/_LP_UPLOAD_READY/` and, if archives are used, that the selected product zip matches `integrity_manifest.csv`.

If one point is unknown, stop and test before batch `1`.

## Block 2: One Test Import

Use one low-risk article from `Consultify`:

- `01_why_traditional_consulting_is_broken`

Validate:

- title renders correctly
- body is article body only
- `EN`, `PL`, `DE` are attached correctly
- slug behavior is stable
- section assignment works as expected

Only after that move to batch `1`.

## Block 3: Product Batch Sequence

Run in this order:

1. `Consultify`
2. `IoT`
3. `IRIS`
4. `DT`
5. `Marketplace`
6. `Vector`

For every batch:

1. confirm source root
2. confirm count `50`
3. confirm locale files only
4. confirm exclusions
5. confirm archive or folder matches integrity manifest when using `_LP_UPLOAD_READY/`
6. import batch
7. run 3-article spot-check
8. log pass

## Mandatory Batch Stop Rule

Stop immediately if:

- a `00_*` file enters the LP
- archive content enters `Marketplace`
- locale variants split incorrectly
- body is replaced by metadata
- section labels diverge from the product LP model

## Block 4: Post-Upload QA

Before calling the upload day complete, verify:

- all six products are visible in LP knowledge bases
- each product shows `50` canonical records
- locales exist for all imported records
- spot-check articles pass for all six products
- no archive or operational documents are visible in LP

## Block 5: Publication Activation Handoff

The upload day is not fully done until these handoffs exist:

- LP section assignment confirmed
- publication owner confirmed
- first flagship article per product identified
- first company amplification wave identified
- first email or outbound derivative owner identified

## End-Of-Day Success Condition

Treat the day as successful only when:

- the LP knowledge bases are populated correctly
- all six product batches passed QA
- the first publication activation handoff is ready
