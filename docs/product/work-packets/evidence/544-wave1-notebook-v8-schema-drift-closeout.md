# 544 - Wave 1 notebook V8 schema-drift closeout

Date: 2026-03-28
Lane: first-tranche `must have` / `Notebook`
Status: historical blocker closeout, later notebook ratification applied

## Problem

During live manual acceptance on `https://consultify.ai/my-work`, opening `My Work -> Notebook` triggered:

- `GET /api/v8/my-work/notebook/pages?limit=50 -> 500`
- client console readback: `Failed to load notebook pages`

This blocked the `Notebook` manual gate before even reaching note create / attachment / convert checks.

## Root cause

The V8 notebook routes assumed that every environment already had the full latest `notebook_pages` schema, including later-added optional columns such as:

- `maturity`
- `icon`
- `summary`
- `status`
- `pinned`
- `verification_status`
- `review_cadence`
- `stale_at`
- `last_reviewed_at`
- `capture_source`
- `capture_metadata`
- `attachments_json`
- `converted_to_json`

However, the route guard only verified that the table itself existed. On an environment with a partially upgraded schema, list / get / post-readback SQL could reference missing columns and fail with `500`.

## What landed

- added a shared `buildNotebookSelectFields()` helper in `server/src/routes/v8/my-work.routes.ts`
- made V8 notebook readback SQL schema-aware via `getTableColumns('notebook_pages')`
- replaced hard assumptions with safe defaults for optional columns:
  - string defaults like `status = 'active'`
  - lifecycle defaults like `verificationStatus = 'unverified'`
  - attachment defaults like `attachments = []`
  - provenance / conversion defaults like `captureSource = null`, `convertedTo = null`
- guarded notebook update mutations so optional columns are only written when they actually exist in the current schema

This hardens:

- `GET /api/v8/my-work/notebook/pages`
- `POST /api/v8/my-work/notebook/pages` readback
- `GET /api/v8/my-work/notebook/pages/:id`
- post-attachment upload / delete notebook readbacks
- notebook page update readback

## Verification

Automated:

- `npx vitest run server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

Added regression coverage for:

- listing notebook pages when optional notebook columns are missing
- preserving the richer update path when the full schema is present

Result:

- `16 / 16` tests passed

Static:

- `ReadLints` on touched route + test files returned no diagnostics

## Manual status

Live hosted manual gate discovered the blocker and established the failing request path.

At the time of this closeout, the hosted `Notebook` manual checklist still needed a post-deploy re-run to confirm:

1. page list loads without `500`
2. note create/readback works
3. attachment readback stays honest
4. convert/readback path remains available on the live environment

Current authority:

- deeper notebook browser continuity proof is recorded in `544-v81-mywork-deep-acceptance-pack.md`
- final module closure is ratified in `548-v81-wave1-final-module-gate-ratification.md`

## Why this matters

This is not a cosmetic hardening pass. Without it, Wave 1 could report `Notebook` as "closed" in code while a partially migrated environment still crashes at the first V8 notebook read.
