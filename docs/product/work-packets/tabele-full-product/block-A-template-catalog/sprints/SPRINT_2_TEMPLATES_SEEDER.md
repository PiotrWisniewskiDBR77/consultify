# Sprint 2 — 30 Templates Seeder + Anygravity Trial #1 (Block A)

**Sprint ID:** `A-S2`
**Owner:** Agent A (seeder) + Orchestrator (Anygravity)
**Status:** `PLANNED`
**Estimate:** ~1.5 days
**Epic:** EPIC-T5

## Goal

Seed `tp_base_templates` with 30 consulting templates (12 approved, 18 draft) per `EPIC-T5_CONSULTING_TEMPLATE_PACK.md`, write i18n keys, run Anygravity P0 trial #1 against staging.

## Pre-sprint risk check

A-T2 (large seeder file) — mitigation: split into per-template files. A-T4 (i18n drift) — mitigation: centralized strings file. PR3 (Anygravity reveals tenancy bugs) — accept that A may pause if trial FAILs.

## Deliverables

- File `consultify/server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts` exporting 30 entries.
- `TemplateService.seedDefaultTemplates` extended to seed Tabele templates idempotently.
- `consultify/docs/product/TABLE_TEMPLATE_CATALOG_V1.md` documenting all 30 templates with audience, fields, governance_rules.
- ~120 i18n keys added to EN + PL.
- Anygravity P0 trial #1 card filed in `DRD/testy_antygravity/TEST_QUEUE.md` per `ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`.
- Trial executed and result recorded in `evidence/sprint-2/anygravity-p0-trial-1.md`.

## Files

### Created
- `consultify/server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts`
- `consultify/server/src/services/tablePlatform/seeds/__tests__/tabele_consulting_templates.test.ts`
- `consultify/docs/product/TABLE_TEMPLATE_CATALOG_V1.md`
- `evidence/sprint-2/anygravity-p0-trial-1.md`

### Updated
- `consultify/server/src/services/tablePlatform/TemplateService.ts` (seeder integration only)
- `consultify/public/locales/en/translation.json` (~120 keys)
- `consultify/public/locales/pl/translation.json` (~120 keys)

## Sprint Entry Gate

- [ ] S1 closed `GO`.
- [ ] Migration deployed on staging.

## Sprint Exit Gate

- [ ] Seeder writes 30 entries idempotently.
- [ ] 12 entries `status='approved'`, 18 `status='draft'`.
- [ ] Each template has non-empty `schema_snapshot.tables[0].fields` (≥5).
- [ ] i18n keys present in EN and PL.
- [ ] Anygravity P0 trial #1 PASS.
- [ ] Recommendation: `GO` to S3.

## Realized risks

(filled at exit)

## Daily evidence

(filled per day)
