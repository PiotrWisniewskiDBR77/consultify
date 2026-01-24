# Consultinity – Economic Analysis Rules, Thresholds & Gate Enforcement (Canonical)

## 0. Purpose of this document
This document defines:
- when Economic Analysis is required
- minimal required fields
- how it blocks or enables gates
- how it integrates with Initiative, Decision, and Reporting

Economic Analysis ≠ Excel  
Economic Analysis = governance artefact

---

## 1. What is Economic Analysis
Economic Analysis is a structured evaluation of business impact of an initiative.

It supports:
- approval decisions
- prioritization
- benefits tracking
- accountability after delivery

---

## 2. When Economic Analysis is REQUIRED
Economic Analysis is mandatory if any of the following is true (thresholds are configurable per org/project):

| Condition | Threshold / rule |
|---|---|
| CAPEX | > 50,000 (project currency) |
| OPEX (annual) | > 25,000 (project currency) |
| Initiative type | Strategic / Transformation |
| Resource impact | cross-team or multi-quarter |
| Risk level | Medium / High |
| Requested by Sponsor | always |

If mandatory and missing → **Gate APPROVE is blocked**.

---

## 3. Economic Analysis – minimal required fields (canonical)

| Field | Type | Description |
|---|---|---|
| `analysis_id` | UUID | primary key |
| `initiative_id` | reference | linked initiative |
| `owner` | Business Owner | accountable owner |
| `currency` | ISO code | e.g., EUR, USD |
| `total_cost` | numeric | CAPEX+OPEX total |
| `expected_benefit` | numeric | expected value |
| `benefit_type` | enum | cost saving / revenue / risk |
| `payback_period` | months | payback period |
| `roi` | % | ROI percentage |
| `assumptions` | text | key assumptions |
| `risks` | text | economic risks |
| `created_at` | timestamp | creation time |
| `version` | integer | versioning |
| `status` | enum | `DRAFT` / `FINAL` |

---

## 4. Lifecycle rules

### 4.1 Draft
- editable
- not eligible for gate decisions

### 4.2 Final
- locked
- used in:
  - Gate APPROVE
  - reporting
  - benefits baseline

---

## 5. Gate enforcement rules

### 5.1 Gate APPROVE
Gate APPROVE requires:
- Final Economic Analysis (if required)
- ROI & Payback filled
- Assigned Business Owner

If missing → Approve button disabled.

### 5.2 Gate CHANGE
If a change affects:
- budget
- scope
- benefits

→ Economic Analysis must be updated & re-finalized.

### 5.3 Gate DONE → TRACKING
The final Economic Analysis snapshot becomes the baseline for Benefits Tracking.

---

## 6. UX rules

### 6.1 Initiative view
Economic Analysis is:
- a tab inside Initiative
- visible from PLANNING onward
- read-only after FINAL (unless changed via governed CHANGE)

### 6.2 Approval UX
Approver sees:
- summary metrics
- delta vs baseline (if change)
- AI explanation

---

## 7. AI role
AI Assistant:
- validates consistency
- flags unrealistic assumptions
- explains ROI in plain language
- does NOT approve

---

## 8. Reporting integration
Economic Analysis feeds:
- Steering Committee Report
- Portfolio Overview
- Benefits Tracking Report

