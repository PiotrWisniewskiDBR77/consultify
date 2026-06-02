# Table Template Catalog V1 — Tabele consulting pack

**Status:** `LOCKED — 2026-05-08`
**Owner:** Block A · EPIC-T5 (Cursor agent in CTO mode)
**Source seed file:** `consultify/server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts`
**Seeder:** `consultify/server/src/services/tablePlatform/seeds/tabeleConsultingTemplatesSeeder.ts`
**Test:** `seeds/__tests__/tabele_consulting_templates.test.ts` (15 invariants + idempotency)

This document is the canonical, human-readable description of the 30 Tabele
consulting templates that ship with Consultify. Every template surfaced in the
Tabele module home, the Anygravity P0 trial harness, the QA Engine spec, and
the AI Editor proposal templates MUST resolve back to this file. If you change
a template's contract here, the seed file and the i18n keys update in lock-step.

---

## 1. Pack contract

| Property | Constraint |
|---|---|
| Total entries | exactly 30 |
| `status='approved'` | exactly 12 |
| `status='draft'` | exactly 18 |
| Idempotency key | `governance_rules.seed_id` (string slug, never reused) |
| Field types | only those listed in `SchemaValidationService.ALLOWED_FIELD_TYPES` |
| Minimum fields per primary table | 5 |
| Required `governance_rules` keys | `seed_id`, `audience`, `min_records_for_publish`, `review_cadence_days` |
| EPIC-T7 fallbacks captured in | `governance_rules.fallback_field_upgrades` |

The seeder enforces these by INSERT-or-UPDATE keyed on `seed_id`; the
`governance_rules.fallback_field_upgrades` map drives the EPIC-T7 follow-up
migration that swaps generic types for their specialised replacements
(`priority`, `risk_score`, `source_reference`, `ai_generated_summary`).

---

## 2. The 12 approved templates

| Seed id | Name | Category | Audience | Why approved |
|---|---|---|---|---|
| `tab-init-reg` | Initiative Register | strategy | PMO, Leadership | universal strategy-portfolio artifact |
| `tab-risk-reg-ops` | Risk Register (operational) | risk | PMO, Risk owners | mandatory in every engagement |
| `tab-action-plan` | Action Plan | execution | Project teams | core execution artifact |
| `tab-stake-map` | Stakeholder Map | change | Change leads | required for change & adoption |
| `tab-decision-log` | Decision Log | governance | Steering committees | governance evidence |
| `tab-issue-log` | Issue Log | governance | PMO | weekly steerco artifact |
| `tab-meddpicc` | MEDDPICC Qualification Sheet | sales | Sales | top-of-funnel, every deal |
| `tab-icp-fit` | ICP Fit Score Sheet | sales | Sales | account scoring at entry |
| `tab-map` | Mutual Action Plan | sales | Sales + customer | enterprise close motion |
| `tab-sales-pipe` | Sales Pipeline Table | sales | Sales leadership | weekly pipeline review |
| `tab-kpi-matrix` | KPI Matrix | operations | Operations, Finance | KPI measurement spine |
| `tab-impl-tracker` | Implementation Tracker | execution | PMO | every go-live |

Each `approved` template has `is_featured=true` so it surfaces first in the
Tabele module home. Approval can only be reverted by `TemplateLifecycleService`
(`POST /templates/:id/deprecate`); the seeder will not demote a manually-touched
row back to its seed status (UPDATE clause uses `CASE WHEN status IS NULL OR
status = 'draft' THEN seed_status ELSE current END`).

---

## 3. The 18 draft templates

| Seed id | Name | Category | Audience |
|---|---|---|---|
| `tab-proj-backlog` | Project Backlog | execution | Project teams |
| `tab-interview-tracker` | Interview Tracker | research | Researchers |
| `tab-workshop-output` | Workshop Output Table | research | Workshop leads |
| `tab-dt-roadmap` | Digital Transformation Roadmap | strategy | Transformation PMO |
| `tab-ai-uc-reg` | AI Use Case Register | strategy | AI office |
| `tab-auto-opp-reg` | Automation Opportunity Register | operations | Operations |
| `tab-bizcase` | Business Case Table | finance | Finance, Strategy |
| `tab-vendor-comp` | Vendor Comparison Table | procurement | Procurement |
| `tab-research-source` | Research Source Table | research | Researchers |
| `tab-sop-reg` | SOP Register | operations | Operations |
| `tab-change-tracker` | Change Management Tracker | change | Change leads |
| `tab-train-plan` | Training Plan Table | hr | HR, L&D |
| `tab-gov-reg` | Governance Register | governance | Risk, Compliance |
| `tab-audit-find` | Audit Findings Table | audit | Audit, Risk |
| `tab-req-table` | Requirements Table | product | Product |
| `tab-feat-prio` | Feature Prioritization Table | product | Product |
| `tab-roi-calc` | ROI Calculation Table | finance | Finance |
| `tab-client-disc` | Client Discovery Table | sales | Sales |

A draft template is fully functional but is not surfaced as featured in the
Tabele module home until a human or super-admin promotes it via
`POST /templates/:id/approve` (Block A · EPIC-T6 endpoint). Promotion records
the actor in `approval_history` and triggers the `tp_audit_events` ledger.

---

## 4. Field-type fallbacks (EPIC-T7 follow-up)

Until the specialised field types ship in Block A · Sprint 3, the seed pack
uses these fallbacks. Each template's `governance_rules.fallback_field_upgrades`
records the eventual upgrade so the migration is mechanical.

| Field name | Current type | Target type (EPIC-T7) | Fallback rationale |
|---|---|---|---|
| `Priority` | `singleSelect(Low/Medium/High/Critical)` | `priority` | Choices match the canonical priority scale; semantic equivalence. |
| `Risk Score` | `rating(max=5)` | `risk_score` | 1-5 rating preserves ordering and the 5×5 risk matrix idiom. |
| `Source` | `url` | `source_reference` | URL stores a single artifact link; multi-source ledger lives in `tp_record_sources` (Block B). |
| `AI Recommendation` / `AI Summary` | `longText` | `ai_generated_summary` | Free-form text manually editable until the AI-derived field type ships. |

The EPIC-T7 follow-up migration must:

1. Add the new field types to `SchemaValidationService.ALLOWED_FIELD_TYPES`.
2. Iterate over `tp_base_templates` where `governance_rules.fallback_field_upgrades` is non-empty.
3. Rewrite the matching field's `fieldType` in the `schema_snapshot.tables[].fields[]` JSONB tree.
4. Bump `version` to `1.1.0` and append an `approval_history` entry stamped `migration:epic-t7-field-type-upgrade`.

---

## 5. Governance rules schema (per template)

Every template carries:

```jsonc
{
  "seed_id": "tab-init-reg",
  "audience": ["PMO", "Leadership"],
  "required_inputs": ["Title", "Owner"],
  "approval_required_fields": ["Owner", "Status"],
  "source_required_fields": ["Source"],
  "ai_fill_disallowed_fields": ["Owner"],
  "min_records_for_publish": 3,
  "review_cadence_days": 30,
  "fallback_field_upgrades": {
    "Priority": "priority",
    "Risk Score": "risk_score",
    "Source": "source_reference",
    "AI Recommendation": "ai_generated_summary"
  }
}
```

These rules feed:

- the **AI Editor** (Block C) — `ai_fill_disallowed_fields` is a hard block.
- the **QA Engine** (Block C) — `min_records_for_publish` and `source_required_fields`
  drive the publish-gate.
- the **Lifecycle service** (this block) — `approval_required_fields` show as
  required diff in the approve dialog.
- the **Provenance service** (Block B) — `source_required_fields` drive the
  badge on the row gutter.

---

## 6. Operational notes

- The seeder is idempotent on `seed_id`. Re-running on a workspace that already
  has all 30 entries is a no-op writes-wise (it issues UPDATEs that touch no
  fields meaningfully — `is_featured` and `version` are derived from the
  source-of-truth pack).
- The seeder is invoked from `TemplateService.seedDefaultTemplates()` on every
  boot AND directly via `templateService.seedTabeleConsultingTemplates()`
  for ops scripts.
- `created_by` and `owner_user_id` for newly-inserted rows default to
  `system:tabele-template-seeder-2026-05-08`. When a real user later
  approves / deprecates a row, the lifecycle service overwrites the
  `approval_history` ledger but never the system stamp.
- Anygravity P0 trial #1 (per `DRD/testy_antygravity/ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`)
  consumes the 12 approved templates; the trial card is recorded under
  `evidence/sprint-2/anygravity-p0-trial-1.md` and is the GO/NO-GO gate to
  Block A · Sprint 3.

---

## 7. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| `1.0.0` | 2026-05-08 | Cursor agent (CTO mode) | Initial 30-entry pack. 12 approved + 18 draft. Field types use EPIC-T7 fallbacks. |
