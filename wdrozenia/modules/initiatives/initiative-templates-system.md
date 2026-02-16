# Initiative Templates System – Documentation

## Overview

Initiative Templates are comprehensive **project management methodology blueprints** that define how an initiative should be created, managed, governed, and tracked. Each template encapsulates the full lifecycle configuration for a specific type of initiative.

Templates are the **prerequisite** for the Initiative Creator tool – when a user clicks "Create Initiative" from an assessment, tool, or manually, they select a template which pre-configures the entire initiative structure.

---

## Template Levels

| Level            | Use Case                     | Typical Sections | Governance                    |
| ---------------- | ---------------------------- | ---------------- | ----------------------------- |
| **Quick Win**    | Small, fast improvements     | 4-6 sections     | Minimal – no gates            |
| **Standard**     | Regular operational projects | 10-12 sections   | Standard approval             |
| **Enterprise**   | Strategic transformations    | 16-18 sections   | Full governance + gates       |
| **Full Charter** | Major investment cases       | 20+ sections     | Complete – steering committee |

---

## Configuration Areas

### 1. Basic Info

- **Name & Description** – Template identity
- **Level** – quick_win / standard / enterprise / full_charter
- **Category** – transformation, optimization, digital, etc.
- **Source Types** – Which sources can use this template (assessment, tool, manual, AI)

### 2. Sections (Initiative Block Library)

- Toggle which sections appear in the initiative card
- Reorder sections within left/right columns
- Per-section configuration: required, collapsed by default, AI auto-fill
- Preset buttons for Quick Win / Standard / Enterprise / Full

### 3. Workflow & Gates

- **Workflow Phases** – PLAN, BUILD, TEST, DEPLOY, REVIEW, CLOSE
- **Approval Configuration** – Require approval, steering committee
- **Auto-Creation** – Auto-create tasks and milestones from template
- **Gate Readiness Rules** – Skip gates, per-gate required fields
- **Validation Rules** – Required fields per status transition:
  - Before Submit for Review
  - Before Approve
  - Before Start Execution
  - Before Complete

### 4. Tasks & Milestones

- **Suggested Tasks** – Pre-defined task list with:
  - Title, task type (analysis/design/development/testing/...)
  - Step phase (design/pilot/rollout/closeout)
  - Priority (low/medium/high/critical)
- **Suggested Milestones** – Key milestones with:
  - Name, is gate (yes/no), order
- **Suggested Decisions** – Governance decisions with:
  - Title, type (GO_NO_GO/APPROVAL/RESOURCE_ALLOCATION/...)
  - Priority, trigger status, PMO domain

### 5. Team & Resources

- **Required Ownership** – Business Owner, Execution Owner, Sponsor
- **Resource Requirements** – Minimum FTE allocation
- **Required Roles** – Mandatory team roles (lead, member, consultant, etc.)
- **RACI Template** – Default RACI assignments for stakeholders

### 6. KPIs & Finance

- **Suggested KPIs** – Pre-defined KPIs with:
  - Name, unit (%, PLN, count, etc.)
  - Target value, measurement frequency
- **Financial Requirements**:
  - Require financial analysis / business case / cost-benefit analysis
  - Minimum ROI percentage threshold
- **Benefits Tracking Configuration**:
  - Enable/disable benefits tracking
  - Measurement frequency (monthly/quarterly)
  - Tracking duration (months after completion)
  - Require quantitative benefits

### 7. Communication

- **Notification Triggers** – Which events trigger notifications:
  - Status changes, task assigned, decision needed
  - Milestone reached, escalation, blocked
- **Escalation Rules**:
  - Amber threshold (days)
  - Red threshold (days)
  - Auto-escalate to Steering Committee on Red
- **Status Reports**:
  - Reporting frequency (weekly/biweekly/monthly)
  - Auto-generate reports
  - AI summary enabled
- **RAID Templates** – Pre-defined risks, assumptions, issues, dependencies:
  - Type (RISK/ASSUMPTION/ISSUE/DEPENDENCY)
  - Title, probability, impact (for risks)

---

## Database Schema

### Main Table: `initiative_templates`

| Column               | Type    | Description                                |
| -------------------- | ------- | ------------------------------------------ |
| id                   | TEXT PK | UUID                                       |
| name                 | TEXT    | Template name                              |
| category             | TEXT    | Category classification                    |
| description          | TEXT    | Description                                |
| level                | TEXT    | quick_win/standard/enterprise/full_charter |
| source_types         | JSON    | Compatible source types                    |
| is_system            | BOOL    | System template (read-only)                |
| visible_sections     | JSON    | Section visibility map                     |
| section_order        | JSON    | Custom section ordering                    |
| section_config       | JSON    | Per-section configuration                  |
| workflow_config      | JSON    | Phases, approval, auto-create settings     |
| suggested_tasks      | JSON    | Suggested task blueprints                  |
| suggested_milestones | JSON    | Suggested milestone definitions            |
| suggested_decisions  | JSON    | Suggested decision definitions             |
| suggested_kpis       | JSON    | Suggested KPI definitions                  |
| team_config          | JSON    | Team roles, RACI, FTE requirements         |
| financial_config     | JSON    | Financial analysis requirements            |
| benefits_config      | JSON    | Benefits tracking configuration            |
| escalation_config    | JSON    | Escalation thresholds and rules            |
| gate_config          | JSON    | Gate readiness rules                       |
| notification_config  | JSON    | Notification trigger settings              |
| status_report_config | JSON    | Status report configuration                |
| raid_templates       | JSON    | Pre-defined RAID items                     |
| validation_rules     | JSON    | Per-status validation rules                |
| required_fields      | JSON    | Global required fields                     |

### Related Table: `initiative_section_types`

Defines the available section types (the "block library" for initiative cards).

| Column             | Type    | Description             |
| ------------------ | ------- | ----------------------- |
| id                 | TEXT PK | UUID                    |
| key                | TEXT    | Unique section key      |
| name               | TEXT    | Display name (EN)       |
| name_pl            | TEXT    | Display name (PL)       |
| category           | TEXT    | content/control/meta    |
| column_position    | TEXT    | left/right              |
| default_order      | INT     | Default sort order      |
| icon               | TEXT    | Lucide icon name        |
| component_key      | TEXT    | React component mapping |
| ai_prompt_template | TEXT    | AI generation prompt    |
| is_system          | BOOL    | System type (read-only) |

---

## API Endpoints

### Templates

- `GET /api/initiatives/templates` – List all templates
- `GET /api/initiatives/templates/:id` – Get template by ID
- `POST /api/initiatives/templates` – Create template
- `PUT /api/initiatives/templates/:id` – Update template
- `DELETE /api/initiatives/templates/:id` – Delete template

### Section Types

- `GET /api/initiatives/section-types` – List all section types
- `GET /api/initiatives/section-types/:id` – Get section type
- `POST /api/initiatives/section-types` – Create section type
- `PUT /api/initiatives/section-types/:id` – Update section type
- `DELETE /api/initiatives/section-types/:id` – Deactivate section type
- `POST /api/initiatives/section-types/:id/duplicate` – Duplicate to organization

### AI Generation

- `POST /api/initiatives/generate-section` – Generate AI content for section
- `POST /api/initiatives/suggest-sections` – Get AI section suggestions

---

## Admin UI

### Section Library (`/admin?tab=initiative-sections`)

- Table view of all 24 system section types
- Filters: All/App/Org, Category, Column
- Expandable detail view with AI prompt preview
- Duplicate system types to organization

### Template Editor (`/admin?tab=initiative-templates` → Edit/New)

- Slide-over panel with 7 tabs:
  1. Basic Info
  2. Sections (24 toggleable sections)
  3. Workflow & Gates
  4. Tasks & Milestones
  5. Team & Resources
  6. KPIs & Finance
  7. Communication

---

## Architecture

```
initiative_templates (blueprint)
    ├── visible_sections → initiative_section_types (library)
    ├── suggested_tasks → tasks (created on init)
    ├── suggested_milestones → initiative_milestones (created on init)
    ├── suggested_decisions → decisions (created on init)
    ├── suggested_kpis → initiative_kpis (created on init)
    ├── team_config → initiative_resources + initiative_stakeholders
    ├── financial_config → initiative_financials
    ├── benefits_config → benefit_tracking
    ├── escalation_config → escalation rules
    ├── gate_config → stage gates + decisions
    ├── notification_config → notifications + initiative_watchers
    ├── status_report_config → status_reports
    ├── raid_templates → raid_items
    └── validation_rules → gate policy engine
```

---

## Migrations

| #   | File                                      | Description                                                                                |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| 529 | `529_initiative_section_types.sql`        | Section types table + 24 system seeds                                                      |
| 530 | `530_initiative_section_ai_prompts.sql`   | AI prompt templates for sections                                                           |
| 531 | `531_initiative_template_full_config.sql` | V3 columns: tasks, team, escalation, gates, RAID, financial, benefits, reports, validation |

---

## Next Steps

1. **Initiative Creator** – Use templates to create initiatives with pre-filled data
2. **Template Marketplace** – Share templates between organizations
3. **AI Template Generation** – Generate template suggestions based on initiative description
4. **Template Analytics** – Track which templates lead to best outcomes
