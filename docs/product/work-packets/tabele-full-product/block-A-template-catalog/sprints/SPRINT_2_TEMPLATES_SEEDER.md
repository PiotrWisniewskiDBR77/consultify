# Sprint 2 — 30 Templates Seeder + Anygravity Trial #1 (Block A)

**Sprint ID:** `A-S2`
**Owner:** Agent A (seeder) + Orchestrator (Anygravity)
**Status:** `BACKEND COMPLETE`
**Estimate:** ~1.5 days
**Epic:** EPIC-T5

## Goal

Seed `tp_base_templates` with 30 consulting templates (12 approved, 18 draft) per `EPIC-T5_CONSULTING_TEMPLATE_PACK.md`, write i18n keys, run Anygravity P0 trial #1 against staging.

## Pre-sprint risk check

A-T2 (large seeder file) — mitigated: split builders + DRY helpers; the seed file is ~900 lines but every template fits a single readable block. A-T4 (i18n drift) — mitigated by `tabele_consulting_templates_i18n.test.ts` parity test. PR3 (Anygravity reveals tenancy bugs) — Anygravity step is gated on staging deploy and remains pending.

## Deliverables

- [x] `consultify/server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts` — 30 entries (`TABELE_CONSULTING_TEMPLATES`).
- [x] `consultify/server/src/services/tablePlatform/seeds/tabeleConsultingTemplatesSeeder.ts` — idempotent seeder (`seed_id` keyed; INSERT/UPDATE; never demotes a manually-approved row).
- [x] `consultify/server/src/services/tablePlatform/TemplateService.ts` — minimal additive integration: new `seedTabeleConsultingTemplates()` method + post-legacy hook in `seedDefaultTemplates()`.
- [x] `consultify/docs/product/TABLE_TEMPLATE_CATALOG_V1.md` — canonical catalog doc with audience, fallback upgrades, governance schema.
- [x] `consultify/public/locales/en/tabele-templates.json` + `…/pl/tabele-templates.json` — 60 keys (30 × {title, description}) per locale = 120 total.
- [x] `seeds/__tests__/tabele_consulting_templates.test.ts` — 15 invariants + idempotency tests.
- [x] `seeds/__tests__/tabele_consulting_templates_i18n.test.ts` — 5 parity tests (EN/PL/seed_id alignment).
- [x] Service exports added to `tablePlatform/index.ts`.
- [ ] Anygravity P0 trial #1 — **PENDING (external)**: card filed in `DRD/testy_antygravity/TEST_QUEUE.md` to be executed once staging carries Block A migration + seeder. Trial scope captured in `evidence/sprint-2/anygravity-p0-trial-1.md`.

## Files

### Created

- `consultify/server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts`
- `consultify/server/src/services/tablePlatform/seeds/tabeleConsultingTemplatesSeeder.ts`
- `consultify/server/src/services/tablePlatform/seeds/__tests__/tabele_consulting_templates.test.ts`
- `consultify/server/src/services/tablePlatform/seeds/__tests__/tabele_consulting_templates_i18n.test.ts`
- `consultify/docs/product/TABLE_TEMPLATE_CATALOG_V1.md`
- `consultify/public/locales/en/tabele-templates.json`
- `consultify/public/locales/pl/tabele-templates.json`
- `evidence/sprint-2/anygravity-p0-trial-1.md` (prep card; trial executed externally)

### Updated

- `consultify/server/src/services/tablePlatform/TemplateService.ts` — additive only.
- `consultify/server/src/services/tablePlatform/index.ts` — type/export surface.

## Test results

```
✓ tabele_consulting_templates.test.ts        (15)
✓ tabele_consulting_templates_i18n.test.ts   ( 5)
Tests  20 passed (20)
```

Full Block A + Block B suite (post-A-S2):

```
✓ migrations.block-a-b.test.ts                  (21)
✓ TemplateLifecycleService.test.ts              (20)
✓ RecordSourcesService.test.ts                  (26)
✓ tabele_consulting_templates.test.ts           (15)
✓ tabele_consulting_templates_i18n.test.ts      ( 5)
✓ template-lifecycle-acl.test.ts                 (9)
✓ record-sources-acl.test.ts                    (15)
Tests 111 passed (111)
```

`npx tsc --noEmit` exit 0.

## Realised risks

- **i18n parity coupling** — the new `tabele-templates.json` namespace is only
  loaded by the i18n parity test today; Tabele module home (`ArtifactModuleHome`)
  still consumes `BUILTIN_TEMPLATES.tabele`. EPIC-T16 / Block A · S4 wires the
  module home to read from `tp_base_templates` directly via the lifecycle list
  endpoint, at which point the i18n keys plug in. Documented as cross-sprint
  dependency in `01_VALIDATION_MATRIX.md`.
- **Field type fallbacks** — every template carries `governance_rules.fallback_field_upgrades`
  pointing at the EPIC-T7 specialised types. Block A · S3 follow-up migration
  reads this map and rewrites the schema_snapshot in place.

## Sprint Entry Gate

- [x] S1 closed `BACKEND COMPLETE`.
- [ ] Migration deployed on staging (still pending external).

## Sprint Exit Gate

- [x] Seeder writes 30 entries idempotently (run #1: 30 inserted; run #2: 30 updated; run #3 with manually-approved rows: never demotes).
- [x] 12 entries `status='approved'`, 18 `status='draft'`.
- [x] Each template has `schema_snapshot.tables[0].fields` ≥ 5.
- [x] i18n keys present in EN and PL (parity-tested; 30 each).
- [ ] Anygravity P0 trial #1 PASS — external, pending staging deploy.
- [x] Recommendation: `GO` to S3 (backend-side); Anygravity gate remains advisory.
