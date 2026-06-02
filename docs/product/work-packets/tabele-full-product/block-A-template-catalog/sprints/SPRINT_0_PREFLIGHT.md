# Sprint 0 — Preflight (Block A)

**Sprint ID:** `A-S0`
**Owner:** Orchestrator
**Status:** `CLOSED — GO recommended`
**Estimate:** ~0.5 day
**Started:** 2026-05-08
**Closed:** 2026-05-08

## Goal

Audit existing `TemplateService` + `tp_base_templates` schema before any code change, finalize migration plan and reuse decisions, and produce baseline test snapshot for regression compare at S6.

## Pre-sprint risk check

Read `02_RISK_REGISTER.md`. Confirm A-T1 (migration lock), A-XB1 (source_reference), A-XB2 (governance_rules) are accepted.

## Deliverables

- `audit-findings/TEMPLATE_SERVICE_BASELINE_2026-05-XX.md` — current `TemplateService` capabilities, used-by callers, schema of `tp_base_templates`, baseline test count.
- Confirmed migration plan: column types, defaults, rollback path.
- Baseline test result snapshot saved to `evidence/sprint-0/baseline-tests.txt`.
- Confirmation that no Foundation Block file is on the modify list.

## Files this sprint touches

- Created: `audit-findings/TEMPLATE_SERVICE_BASELINE_2026-05-XX.md`, `evidence/sprint-0/baseline-tests.txt`.
- Updated: none.
- Source code: NONE (read-only sprint).

## Sprint Entry Gate

- [ ] Block A `00_TASK_PACKET.md` reviewed.
- [ ] CTO decisions Q1–Q5 confirmed.
- [ ] Test environment + staging snapshot available.

## Sprint Exit Gate

- [x] Audit findings file written → `audit-findings/TEMPLATE_SERVICE_BASELINE_2026-05-08.md`
- [x] Migration plan signed off → `evidence/sprint-0/migration-plan-signoff.md`
- [x] Baseline test snapshot saved → `evidence/sprint-0/baseline-tests.txt`
- [x] **Recommendation: `GO` to S1.**

## Realized risks

| ID | Description | Outcome |
|---|---|---|
| A-T1 (migration lock) | Confirmed mitigation: `ADD COLUMN ... DEFAULT <constant>` is metadata-only on PG11+; estimated lock < 200 ms on the small `tp_base_templates` table (≤100 rows). | Closed; mitigation valid. |
| A-T3 (XB1 source_reference) | Block A's field type can ship null-tolerant before Block B's `tp_record_sources` deploys. | Closed; documented in EPIC-T7 adjustment. |

## Findings (5)

Documented in `audit-findings/TEMPLATE_SERVICE_BASELINE_2026-05-08.md`:

- **A-S0-F1** Migration filename → `20260508_block_a_template_lifecycle.sql` at top-level `migrations/` (not under `services/tablePlatform/migrations/`).
- **A-S0-F2** `owner_user_id` is `TEXT NULL` (not UUID + FK). Matches existing `created_by` convention.
- **A-S0-F3** 3 legacy "featured" templates (CRM Pipeline, Project Tracker, HR Onboarding) are auto-promoted to `approved` in the same migration. Final approved count after migration = 15 (12 new + 3 legacy); draft = 15.
- **A-S0-F4** No existing `TemplateService.test.ts`. S1 must add a baseline regression suite for existing public methods BEFORE adding lifecycle methods.
- **A-S0-F5** Do NOT add `ai_generated_summary`/`ai_classification` to `AUTO_FIELD_TYPES` (rejects all manual writes). Use new mechanism `AI_REGEN_FIELD_TYPES` + `options.aiAuto` flag.

## Plan adjustments produced for downstream sprints

- S1 sprint card: extra micro-task to write baseline `TemplateService.test.ts` first.
- EPIC-T6 schema spec: column types align with findings above.
- EPIC-T7 spec: AI auto-field handling clarified.
- 12-approved list confirmed; 3 legacy entries documented separately.

## Daily evidence

| Date | Activity | Output |
|---|---|---|
| 2026-05-08 | Read TemplateService.ts, 721_templates.sql, 700_table_platform_foundation.sql, SchemaValidationService.ts, RecordsService.ts (cross-reference) | Audit findings + migration plan + baseline. |
