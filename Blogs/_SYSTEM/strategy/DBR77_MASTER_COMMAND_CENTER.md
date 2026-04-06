# DBR77 Master Command Center

## Purpose

This file is the single control point for finishing the DBR77 marketing-system deployment from repo-ready state to live-ready execution.

Open this file first.

## Use These Files In Order

1. `Blogs/_SYSTEM/strategy/DBR77_MASTER_COMMAND_CENTER.md`
2. `Blogs/_OPERATIONS/core/DBR77_LIVE_UPLOAD_DAY_RUNBOOK.md`
3. `Blogs/_SYSTEM/lp_kb/DBR77_POST_UPLOAD_QA_LOG.md`
4. `Blogs/_OPERATIONS/core/DBR77_FIRST_WAVE_PUBLICATION_ACTIVATION.md`
5. `Blogs/_OPERATIONS/core/DBR77_LIVE_COMPLETION_GAPS.md`
6. `Blogs/_SYSTEM/standards/DBR77_TAG_TAXONOMY.md`
7. `Blogs/_SYSTEM/standards/DBR77_MINIMUM_VIABLE_ASSET_SET.md`
8. `Blogs/_SYSTEM/standards/DBR77_PROOF_SNAPSHOTS_PACK.md`
9. `Blogs/_SYSTEM/lp_kb/DBR77_LP_KNOWLEDGE_BASE_STANDARD.md`
10. `Blogs/_SYSTEM/lp_kb/DBR77_LP_CONTENT_CONTRACT.md`
11. `Blogs/_SYSTEM/lp_kb/DBR77_LP_MANIFEST_SCHEMA.md`
12. `Blogs/_SYSTEM/lp_kb/DBR77_LP_RENDERER_CONTRACT.md`
13. `Blogs/_SYSTEM/lp_kb/DBR77_LP_RELATION_RULES.md`
14. `Blogs/_SYSTEM/lp_kb/DBR77_LP_KNOWLEDGE_BASE_QA_CHECKLIST.md`

## Preferred Upload Source

Use `Blogs/_LP_UPLOAD_READY/` for live upload whenever possible.

It is the clean operator layer generated from the canonical libraries and excludes `00_*`, `_archive_*`, and package metadata files.

Use:

- product folders for direct record-by-record upload
- `_archives/` for one-batch product transfer
- `integrity_manifest.csv` to verify the selected batch before import

For LP-repo program builds, use:

- `Blogs/_TOOLS/build_lp_kb_ready.py`
- generated output at `Blogs/_LP_KB_READY/`

## Current State

Repo-side implementation is complete:

- `6/6` product libraries at `50`
- `6/6` LP attachment checks complete
- `6/6` publication checklist passes complete
- upload, QA, and first-wave activation runbooks exist

## Operational Sequence

Run the completion flow in this order:

1. pre-go lock
2. test import
3. six product upload batches
4. post-upload QA signoff
5. first publication activation
6. final live-completion check

## Product Order

Use this exact order:

1. `Consultify`
2. `IoT`
3. `IRIS`
4. `DT`
5. `Marketplace`
6. `Vector`

## Non-Negotiable Rules

- import only `article_EN.md`, `article_PL.md`, `article_DE.md`
- never import `00_*`
- never import `_archive_*`
- stop immediately on locale mismatch
- stop immediately if metadata renders as content
- do not call the system fully live without QA signoff

## Live Completion Definition

Call the deployment complete only when:

- LP knowledge bases are populated
- QA passed for all six products
- LP sections are correct in the live system
- first publication queue is active
- first derivative set is assigned for all six products

## Final Decision Rule

If the team finishes the repo work but has not yet completed the live LP and publication steps, the system is:

- `repo-complete`
- not yet `live-complete`
