# Repo Cleanup Inventory - 2026-03-16

## Goal

Clean up repository structure without losing information.

This inventory is phase 1 only:

- no deletions
- no destructive moves yet
- classify first
- move/archive in later commits

## Classification Rules

Use these four statuses during cleanup:

### `keep-active`

Current source of truth, current product specification, active validation pack, or active engineering reference.

### `archive-keep`

Historical but useful. Keep in git, but move out of primary working folders into archive structure.

### `local-ignore`

Generated, personal, experimental, imported, or runtime-local content that should not live in the main repo.

### `review-needed`

Looks useful, but ownership or authority is unclear. Do not delete or move until replacement/owner is confirmed.

## Current Findings

### 1. `docs/product/`

Current state:

- very dense folder with many active specs mixed with historical plans, audits, reports, and completion notes
- `DOCUMENTATION_REGISTRY.md` already defines part of the canonical set
- filename patterns strongly suggest drift:
  - `*PLAN*.md` - 11 files
  - `*FINAL*.md` - 6 files
  - `*AUDIT*.md` - 14 files
  - `*REPORT*.md` - 8 files

Recommended treatment:

- `keep-active`
  - files explicitly listed as canonical in `docs/product/DOCUMENTATION_REGISTRY.md`
  - SSOT and contract-style docs still used by engineering/product
  - current module specs that are still implementation references

- `archive-keep`
  - dated completion reports, implementation reports, remediation reports, audits, frozen snapshots
  - superseded plan variants once canonical replacement is confirmed
  - examples likely to archive:
    - `docs/product/V7-0_COMPLETION_REPORT.md`
    - `docs/product/MINDMAP_COMPLETION_FINDINGS_2026-03-12.md`
    - `docs/product/INITIATIVE_AI_IMPLEMENTATION_REPORT_2026-02-15.md`
    - module-level `*_AUDIT*.md`
    - module-level `*_FINAL*.md` where there is now a broader canonical SSOT

- `review-needed`
  - files containing `FINAL`, `FINAL_SSOT`, `IMPLEMENTATION_PLAN`, or `READINESS` in names
  - these often look historical, but some may still be acting as de facto SSOT

Primary cleanup action:

- create `docs/archive/product/`
- move historical product plans/audits/reports there in thematic subfolders

### 2. `docs/strategy/`

Current state:

- this folder is in better shape because `docs/strategy/README.md` already points to the current execution reference
- clear active core exists:
  - `TABLE_PLATFORM_IMPLEMENTATION_PLAN_V7.md`
  - `CONSULTIFY_AIRTABLE_90_DAY_PLAN.md`
  - `CONSULTIFY_TABLE_PLATFORM_EPICS.md`
  - `CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md`
  - `CONSULTIFY_TABLE_PLATFORM_IMPLEMENTATION_REQUIREMENTS.md`
  - `CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md`
  - `CONSULTIFY_TABLE_PLATFORM_RISK_REGISTER.md`

High-confidence archive candidates:

- `docs/strategy/TABLE_PLATFORM_IMPLEMENTATION_PLAN_V2.md`
- `docs/strategy/TABLE_PLATFORM_FINAL_WIRING_PLAN.md`
- `docs/strategy/TABLE_PLATFORM_FINAL_IMPLEMENTATION_PLAN.md`
- `docs/strategy/TABLE_PLATFORM_STATUS_2026-03-15.md`
- `docs/strategy/TABLE_PLATFORM_HONEST_AUDIT_AND_PLAN_2026-03-16.md`
- `docs/strategy/V7_OPUS_EXECUTION_INSTRUCTION_2026-03-16.md`

Likely active:

- architecture, epics, migration, risk register, 90-day plan, current V7 plan
- `workstreams/` subtree

Primary cleanup action:

- keep current core in `docs/strategy/`
- move older plan variants and dated execution notes into `docs/archive/strategy/`

### 3. `docs/validation/finance-v3/`

Current state:

- top-level folder reads like a real validation pack and has a useful README
- `generated/` contains many iterative, versioned evidence files
- `generated/` currently holds 39 markdown files, many with version suffixes

Recommended treatment:

- `keep-active`
  - top-level validation pack docs:
    - `README.md`
    - `CFO_AUTO_VALIDATION.md`
    - `SSOT_COMPLIANCE_MATRIX.md`
    - `SMOKE_CHECKLIST.md`
    - `AUTOMATION.md`
    - governance/policy/architecture docs
    - latest clearly referenced end-to-end reports

- `archive-keep`
  - older versioned generated files:
    - `APATOR_VERIFY_v2..v9*`
    - `OFFLINE_AUDIT_NON_APATOR_v3..v21*`
    - duplicate result variants and intermediate snapshots

- `review-needed`
  - decide which single file per evidence family should remain visible in `generated/`
  - move all older versions to `docs/archive/validation/finance-v3/generated/`

Primary cleanup action:

- preserve the validation pack as an entrypoint
- archive most iterative evidence snapshots outside the main validation path

### 4. `docs/plans/`

Current state:

- appears to be a legacy planning warehouse
- contains chat export specs, wave prompt packs, delivery packets, and old implementation notes
- high chance this is historical and not a daily working area anymore

Recommended treatment:

- `archive-keep`
  - most of `docs/plans/`

- `review-needed`
  - keep only if any plan is still referenced by current docs or active process

Primary cleanup action:

- move to `docs/archive/plans/`
- keep a very small README in `docs/plans/` only if the folder still has active purpose

### 5. `wdrozenia/`

Current state:

- 297 files
- large implementation pack in Polish
- contains workflows, standards, templates, module implementation notes, testing notes, and prompts
- looks valuable historically, but not part of the main day-to-day docs surface

Recommended treatment:

- `review-needed`
  - likely a major archive candidate, not deletion candidate

Primary cleanup action:

- decide whether this belongs in:
  - `docs/archive/wdrozenia/`, or
  - an external knowledge repository, or
  - a dedicated `legacy/` area

Do not delete this area in early cleanup.

### 6. `odpowiedzi/`

Current state:

- 18 markdown files
- appears to be a curated answer bank / GTM / objection handling set

Recommended treatment:

- `review-needed`
  - probably useful content, but not well placed

Primary cleanup action:

- move to either:
  - `docs/archive/gtm/odpowiedzi/`, or
  - `knowledge/gtm/`

### 7. `Piotr_Tools/`

Current state:

- 116 files
- personal tooling, local rules, drafts, experiments, migration helpers, backlog notes
- already conceptually local/private rather than product repo content

Recommended treatment:

- `local-ignore`

Primary cleanup action:

- keep ignored and out of repo
- do not mix with product documentation cleanup

### 8. `uploads/`

Current state:

- 216 files
- clearly runtime/local upload artifacts and temp content

Recommended treatment:

- `local-ignore`

Primary cleanup action:

- keep ignored and out of repo
- never archive these into docs

### 9. Root and singleton odd files

Examples discovered:

- `docs/FORK_INVENTORY.md`
- `server/services_list.txt`
- other singleton reports or inventories outside their natural homes

Recommended treatment:

- `review-needed`

Primary cleanup action:

- re-home singleton engineering/history docs into:
  - `docs/archive/engineering/`
  - `docs/archive/analysis/`
  - or active engineering docs if still used

## Proposed Target Structure

```text
docs/
  archive/
    analysis/
    engineering/
    plans/
    product/
    strategy/
    validation/
    wdrozenia/
    gtm/
```

Rules:

- active docs stay near active product areas
- historical docs stay in git, but under archive
- local artifacts remain ignored and outside docs

## Execution Plan

### Phase 2 - inventory to mapping table

Create a file-by-file mapping for:

- `docs/product/`
- `docs/strategy/`
- `docs/validation/finance-v3/`
- `docs/plans/`
- root singleton docs

Columns:

- path
- status
- owner area
- replacement SSOT
- target location
- action

### Phase 3 - non-destructive moves

Perform only:

- `keep-active`: no move
- `archive-keep`: move into `docs/archive/...`
- `local-ignore`: ignore or leave local
- `review-needed`: leave untouched

### Phase 4 - guardrails

Add:

- `docs/README.md` with retention rules
- archive folder READMEs
- stricter `.gitignore` for obvious local artifacts if needed

## Recommended Immediate Next Slice

Start with the safest, highest-value cleanup:

1. `docs/strategy/`
2. `docs/validation/finance-v3/generated/`
3. singleton root docs
4. only then `docs/product/`

Reason:

- strategy has the clearest active-vs-historical split
- validation generated files are easy to archive without losing signal
- product docs require the most careful canonical review

## Decision

Do not start with deletion.

Start with:

- building a file-by-file mapping table
- archiving high-confidence strategy and generated validation snapshots
- leaving product SSOT review for a dedicated second pass
