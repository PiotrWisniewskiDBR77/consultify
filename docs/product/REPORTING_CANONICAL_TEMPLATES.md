# Consultinity – Reporting, RAG & Escalation Standard (Canonical)

## 0. Purpose of this document
This document defines:
- Canonical report types (must-have)
- Data sources for each report
- RAG logic (Red / Amber / Green)
- Escalation rules
- UX expectations for Reporting module

Reporting is not optional – it is the management layer of Consultinity.

---

## 1. Canonical report types (MVP)
Consultinity supports 4 mandatory cross-system report types.

| Code | Report type | Audience | Frequency |
|---|---|---|---|
| R1 | Weekly Execution Report | PMO / Project Team | Weekly |
| R2 | Steering Committee Report | Sponsors / Board | Monthly / gate-based |
| R3 | Benefits Tracking Report | Business Owners | Monthly / Quarterly |
| R4 | Portfolio Overview | Executives / Owner | On-demand |

---

## 1a. Execution reporting surface extension

Within `Execution -> Raporty`, the product may expose a broader pre-defined catalog of execution-focused reports, as long as they remain derived from the same canonical data model and map back to the four mandatory reporting families above.

Allowed execution-focused report surfaces include:

- Weekly execution pack
- Monthly PMO review
- Program health summary
- Blockers and recovery report
- Milestone slippage report
- Capacity utilization report
- Budget variance report
- Decision backlog and approval aging report
- Cross-initiative dependency report
- Delivery confidence report
- Sponsor-ready one-pager

Rule:

- the four canonical report families remain mandatory,
- execution-specific report packs are allowed as curated operational views,
- no execution report may invent a second truth or bypass the canonical reporting logic.

---

## 2. R1 – Weekly Execution Report

### 2.1 Purpose
Operational control of initiative execution.

### 2.2 Mandatory sections
1. Initiatives Overview
2. Tasks Progress
3. Blocked / Risks
4. Decisions Pending
5. Next Week Focus

### 2.3 Data sources
| Section | Source | Fields / meaning |
|---|---|---|
| Initiatives Overview | `Initiative` | status, progress (derived), owners |
| Tasks Progress | `Task` | status, owner, due dates |
| Blocked / Risks | `Initiative` | status = `BLOCKED`, risk flags (initiative-level) |
| Decisions Pending | `Decision` | `decision_status = PENDING` (or equivalent) |
| Next Week Focus | Initiative + Task + Decision | top priorities derived from backlog + deadlines |

### 2.4 RAG logic (initiative-level)
Thresholds are configurable per organization/project. Default MVP values:
- Delay threshold \(X\) = 7 days
- `BLOCKED` > 7 days → Steering Committee escalation (see R2)

| Status | Rule |
|---|---|
| Green | On track, no blockers, no critical pending decisions |
| Amber | Delay ≤ X days OR minor blocker OR minor change pending |
| Red | `BLOCKED` OR critical decision pending OR delay > X days |

---

## 3. R2 – Steering Committee Report

### 3.1 Purpose
Strategic oversight & decision-making.

### 3.2 Mandatory sections
1. Executive Summary (AI-generated)
2. Initiatives Requiring Decision
3. Budget / Capacity Overview
4. Escalated Risks
5. Gate Decisions

### 3.3 Data sources
| Section | Source | Fields / meaning |
|---|---|---|
| Executive Summary | AI + all below | narrative synthesis |
| Initiatives Requiring Decision | `Decision` | pending `APPROVAL` / `CHANGE` / `CANCEL` / `CLOSURE` |
| Budget / Capacity Overview | `EconomicAnalysis` + project/team config | approved economics + capacity snapshot |
| Escalated Risks | `Initiative` + Decisions | escalations derived from blockers/overdue decisions |
| Gate Decisions | `Initiative` status + `Decision` | which gates are pending/overdue and why |

### 3.4 Escalation rules (automatic inclusion)
Initiative appears automatically if any is true (thresholds configurable, defaults below):
- `BLOCKED` > 7 days → Steering Committee
- Budget deviation > threshold
- Change request pending > SLA

---

## 4. R3 – Benefits Tracking Report

### 4.1 Purpose
Verify whether delivered initiatives produce business value.

### 4.2 Mandatory sections
1. Delivered Initiatives
2. Planned vs Realized Benefits
3. KPI Trends
4. Financial Impact
5. Corrective Actions

### 4.2A KPI reporting doctrine

For KPI-native reporting, `R3` is the canonical family for benefits and outcome review.

It should be created through a template-first flow:

`scope -> observed KPI set -> template -> narrative -> snapshot`

The user may:

- choose initiatives in scope
- choose KPI from the observed KPI set
- keep the report as a snapshot by default
- optionally refresh the report from current data later

Canonical guardrail:

- reporting does not create a second KPI truth,
- reporting materializes narrative and review context from governed KPI objects.

### 4.3 Data sources
| Section | Source | Fields / meaning |
|---|---|---|
| Delivered Initiatives | `Initiative` | status `DONE` / `TRACKING` (as configured for report scope) |
| Planned vs Realized | `EconomicAnalysis` + `BenefitsRecord` | plan vs actual comparisons |
| KPI Trends | `BenefitsRecord` | time-based operational/financial metrics |
| Financial Impact | `BenefitsRecord` + `BenefitsEvaluation` | realized outcome + final evaluation |
| Corrective Actions | `Decision` | actions requested due to underperformance |

### 4.4 RAG logic (benefits)
| Status | Rule |
|---|---|
| Green | ≥ 100% target |
| Amber | 80–99% |
| Red | < 80% |

---

## 5. R4 – Portfolio Overview

### 5.1 Purpose
High-level view of transformation portfolio.

### 5.2 Mandatory dimensions
- Status distribution
- Budget allocation
- Value realized vs planned
- Risk exposure
- Timeline heatmap

### 5.3 Data sources
- `Initiative`
- `EconomicAnalysis`
- `BenefitsRecord`
- `Timeline`

---

## 6. UX – Reporting module

### 6.1 Entry points
- Side menu: Reports
- Contextual entry:
  - Project
  - Steering Committee
  - Benefits

### 6.2 UX principles
- Reports are read-only
- AI-generated narrative always visible
- Filters:
  - time
  - initiative
  - owner
- Export:
  - PDF
  - PPT (future)

Additional KPI reporting expectations:

- `Benefits` and KPI review reports must clearly show initiative scope and KPI scope used for the snapshot.
- Reports should open as governed review documents, not as inline KPI preview cards.
- KPI-native reports may generate action-plan drafts, but action creation stays human-confirmed.

---

## 7. AI role in reporting
AI Assistant:
- generates executive summaries
- flags anomalies
- suggests escalations
- never overrides human decisions

