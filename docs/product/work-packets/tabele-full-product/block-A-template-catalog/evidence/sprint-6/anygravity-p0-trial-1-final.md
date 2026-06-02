# Anygravity P0 Trial #1 — Final Card (A-S6)

**Trial ID:** `ANYGRAVITY_P0_TABELE_BLOCK_A_TRIAL_1`
**Filed:** 2026-05-08
**Status:** `PENDING_STAGING` — execution deferred to operator pass once staging carries Block A migration + 30-template seeder.
**Sprint:** A-S6 (Block A · QA Gate)
**Runner:** Manual AI tester per `DRD/testy_antygravity/ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`

---

## Why this card exists

The Block A QA Gate (A-S6) requires manual Anygravity P0 evidence per `01_VALIDATION_MATRIX.md` L6.1 and per CTO Q5 ("two trials — Trial #1 in Block A after Sprint 2"). The trial cannot run from CLI; it requires a deployed staging environment. This card freezes the trial scope so the operator pass executes a deterministic, repeatable smoke.

---

## Pre-conditions

Before this trial runs, the following must be true on `https://demo.consultify.ai`:

1. Block A migration deployed: `tp_base_templates.status` + `tp_base_templates.version` + `tp_base_templates.owner` columns present (per A-S1 backend).
2. Block B migration deployed (optional but recommended for full parity): `tp_record_sources` table + `tp_records.confidence_score` + `tp_records.validation_status` columns (per B-S1).
3. Tabele consulting templates seeder has run successfully — `seedTabeleConsultingTemplates()` produces 30 idempotent rows with the seeded `seed_id` keys.
4. Multi-tenant test data: at least 2 tenants (`tenantA`, `tenantB`), each with at least 1 super-admin and 1 regular user.

---

## Trial scope (smoke)

For each scenario the operator records: `screen URL`, `actor`, `expected`, `actual`, `evidence path` (screenshot / Network / DB read-back).

### Scenario 1 — Tenant scoping of templates

- Step: log in as `tenantA-superadmin`, navigate to `/tabele`, open `ArtifactModuleHome` lane.
- Expected: 30 system-owned templates visible (12 approved + 18 draft + 3 promoted legacy).
- Verify: pickling network response of `GET /api/table-platform/template-lifecycle/list` shows tenant-scoped rows; no `tenantB`-owned drafts present.
- Evidence: `screenshots/p0-1-tenantA-templates.png` + `network/p0-1-templates-list.har`.

### Scenario 2 — Lifecycle filter

- Step: as `tenantA-superadmin`, switch the lane filter to "approved only".
- Expected: 15 templates shown (12 immediate approved + 3 promoted legacy per CTO Q3 + Q7).
- Switch to "draft only" → 15 templates shown (per Q3 reclassification balance).
- Evidence: `screenshots/p0-2-approved-filter.png` + `screenshots/p0-3-draft-filter.png`.

### Scenario 3 — Visibility per role

- Step: as `tenantA-regular-user`, open `/tabele` lane.
- Expected: only approved templates surface in the picker; draft templates either hidden OR badged "draft (super-admin only)".
- Evidence: `screenshots/p0-4-regular-user-view.png`.

### Scenario 4 — Cross-tenant isolation

- Step: as `tenantA-superadmin`, copy any `template_id` from the picker. Then log in as `tenantB-superadmin`, navigate to `/api/table-platform/template-lifecycle/templates/<that-id>` directly via fetch.
- Expected: `403 Forbidden` (cross-tenant returns deny-by-default).
- Evidence: `network/p0-5-cross-tenant.har` + `audit/p0-5-tenantB-attempt.log`.

### Scenario 5 — Approve / demote round-trip

- Step: as `tenantA-superadmin`, pick a `draft` template, click "approve". Verify lane refresh shows the row in approved set. Click "demote" → verify return to draft set. Open audit log → verify both events logged with actor + tenant + before/after status.
- Evidence: `screenshots/p0-6-approve.png` + `screenshots/p0-7-demote.png` + `audit/p0-7-events.log`.

### Scenario 6 — Specialized field type rendering (A-S5 land)

- Step: as `tenantA-superadmin`, generate a Risk Register table from the approved Risk Register template. Verify the resulting table contains:
  - a `risk_score` column that renders chips (rose/amber/emerald) per record severity,
  - a `priority` column with chips,
  - an `ai_generated_summary` column with sparkle-marked truncated text or "AI pending…" affordance,
  - a `source_reference` column with internal "Source" buttons or "No source" affordance.
- Evidence: `screenshots/p0-8-specialized-cells.png`.

---

## Pass criteria

All six scenarios PASS. Cross-tenant audit (Scenario 4) is **MANDATORY** — fail of Scenario 4 is a P0 governance leak and triggers immediate hard stop per `40-security-tenancy.mdc`.

## Fail handling

- If any scenario fails: file P0 incident card in `DRD/testy_antygravity/CONTROL_BOARD.md` and freeze Block C kickoff until remediated.

## Sign-off block (operator fills)

- [ ] Scenario 1 — tenant scoping
- [ ] Scenario 2 — lifecycle filter (approved 15 / draft 15)
- [ ] Scenario 3 — visibility per role
- [ ] Scenario 4 — cross-tenant 403 (P0)
- [ ] Scenario 5 — approve / demote round-trip + audit
- [ ] Scenario 6 — specialized cell rendering (A-S5)
- Operator: __________
- Date: __________
- Final verdict: PASS / PASS_WITH_P2 / FAIL
