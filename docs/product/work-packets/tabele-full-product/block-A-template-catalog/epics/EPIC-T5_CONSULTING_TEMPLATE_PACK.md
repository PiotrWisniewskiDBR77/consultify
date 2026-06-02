# EPIC-T5 — Consulting Template Pack

**Block:** A — Template Catalog
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, section 12 ("Pierwsze template'y tabel").
**Owner agent:** A (backend) + B (frontend visibility)

---

## Goal

Seed `tp_base_templates` with 30 high-quality consulting templates, each with a complete `schema_snapshot` (fields, types, defaults, validations), lifecycle metadata (`status`, `version`, `owner`, `audience`, `required_inputs`, `governance_rules`), and EN+PL i18n entries. The 12 highest-frequency templates ship as `approved`; the other 18 as `draft` per CTO Q3.

## Acceptance criteria

- 30 entries land in `tp_base_templates` after running `seedTabeleConsultingTemplates`.
- Each entry has a non-empty `schema_snapshot.tables[0].fields` with at least 5 fields.
- Each entry declares `category`, `audience` (string array), `required_inputs` (string array), `governance_rules` (JSON object), `version` (semver string), `owner_user_id` (system user UUID for new ones).
- Idempotent seeder: rerunning does not duplicate rows; updates `updated_at` on changed entries.
- 12 / 30 have `status='approved'`; 18 / 30 have `status='draft'`.
- `BUILTIN_TEMPLATES.tabele` map in `ArtifactModuleHome.tsx` surfaces the 12 approved entries with title/description in EN + PL.

## In scope

- New file `consultify/server/src/services/tablePlatform/seeds/tabele_consulting_templates.ts` exporting `TABELE_CONSULTING_TEMPLATES: TabeleTemplateSeed[]`.
- New helper `seedTabeleConsultingTemplates(db, organizationId|null, userId|null)` inside `TemplateService.ts`.
- Update to `BUILTIN_TEMPLATES.tabele` to add 4 new approved entries (currently 8 → target 12).
- New i18n keys: `tabele.template.<id>.title`, `tabele.template.<id>.desc` for all 30 templates × EN + PL.
- New file `consultify/docs/product/TABLE_TEMPLATE_CATALOG_V1.md` documenting purpose, audience, fields, governance rules per template.

## Out of scope

- No UI for "publish my own template" (separate sprint or program).
- No template marketplace import/export (separate program).
- No AI-generated template authoring (covered partly by EPIC-T10 in Block C).

## Template list (30)

### 12 immediate `approved`

| ID | Name | Audience | Category |
|---|---|---|---|
| `tab-init-reg` | Initiative Register | PMO, Leadership | strategy |
| `tab-risk-reg-ops` | Risk Register (operational) | PMO, Risk owners | risk |
| `tab-action-plan` | Action Plan | Project teams | execution |
| `tab-stake-map` | Stakeholder Map | Change leads | change |
| `tab-decision-log` | Decision Log | Steering committees | governance |
| `tab-issue-log` | Issue Log | PMO | governance |
| `tab-meddpicc` | MEDDPICC Qualification Sheet | Sales | sales |
| `tab-icp-fit` | ICP Fit Score Sheet | Sales | sales |
| `tab-map` | Mutual Action Plan | Sales + customer | sales |
| `tab-sales-pipe` | Sales Pipeline Table | Sales leadership | sales |
| `tab-kpi-matrix` | KPI Matrix | Operations, Finance | operations |
| `tab-impl-tracker` | Implementation Tracker | PMO | execution |

### 18 `draft`

| ID | Name | Audience | Category |
|---|---|---|---|
| `tab-proj-backlog` | Project Backlog | Project teams | execution |
| `tab-interview-tracker` | Interview Tracker | Researchers | research |
| `tab-workshop-output` | Workshop Output Table | Workshop leads | research |
| `tab-dt-roadmap` | Digital Transformation Roadmap | Transformation PMO | strategy |
| `tab-ai-uc-reg` | AI Use Case Register | AI office | strategy |
| `tab-auto-opp-reg` | Automation Opportunity Register | Operations | operations |
| `tab-bizcase` | Business Case Table | Finance, Strategy | finance |
| `tab-vendor-comp` | Vendor Comparison Table | Procurement | procurement |
| `tab-research-source` | Research Source Table | Researchers | research |
| `tab-sop-reg` | SOP Register | Operations | operations |
| `tab-change-tracker` | Change Management Tracker | Change leads | change |
| `tab-train-plan` | Training Plan Table | HR, L&D | hr |
| `tab-gov-reg` | Governance Register | Risk, Compliance | governance |
| `tab-audit-find` | Audit Findings Table | Audit, Risk | audit |
| `tab-req-table` | Requirements Table | Product | product |
| `tab-feat-prio` | Feature Prioritization Table | Product | product |
| `tab-roi-calc` | ROI Calculation Table | Finance | finance |
| `tab-client-disc` | Client Discovery Table | Sales | sales |

## Schema snapshot example (Initiative Register)

```jsonc
{
  "tables": [
    {
      "name": "Initiatives",
      "description": "Operational initiative register with owner, scoring, status",
      "fields": [
        { "name": "Title", "fieldType": "singleLineText", "required": true },
        { "name": "Owner", "fieldType": "user", "required": true, "source_required": true },
        { "name": "Status", "fieldType": "singleSelect", "options": { "choices": [
          { "name": "Idea", "color": "gray" },
          { "name": "Selected", "color": "blue" },
          { "name": "In progress", "color": "yellow" },
          { "name": "Done", "color": "green" },
          { "name": "Dropped", "color": "red" }
        ] } },
        { "name": "Priority", "fieldType": "priority", "required": true },
        { "name": "Impact", "fieldType": "rating", "options": { "max": 5 } },
        { "name": "Effort", "fieldType": "rating", "options": { "max": 5 } },
        { "name": "ROI Score", "fieldType": "formula", "formula": "Impact / max(Effort, 1)" },
        { "name": "Risk Score", "fieldType": "risk_score" },
        { "name": "Source", "fieldType": "source_reference" },
        { "name": "AI Recommendation", "fieldType": "ai_generated_summary" }
      ]
    }
  ]
}
```

## Governance rules schema (per template)

```jsonc
{
  "approval_required_fields": ["Owner", "Status"],
  "source_required_fields": ["Source"],
  "ai_fill_disallowed_fields": ["Owner"],
  "min_records_for_publish": 3,
  "review_cadence_days": 30
}
```

## Dependencies

- A-T3 / A-XB1: `source_reference` field type (EPIC-T7) — ships in same block.
- A-XB2: `governance_rules` consumed by Block C QA Engine — schema must be stable at end of S2.

## Estimated effort

- S2 (1.5 days): backend seeder + i18n.
- Half-day spillover from S1 (lifecycle backend) for `governance_rules` column.

## Open questions

None blocking. Template content can be calibrated post-Anygravity P0 #1.
