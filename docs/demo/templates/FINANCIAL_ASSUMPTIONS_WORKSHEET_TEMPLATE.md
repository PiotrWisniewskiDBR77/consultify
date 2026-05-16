# {{CLIENT_NAME}} - Financial Assumptions Worksheet (Template)

Version: {{VERSION}}
Date: {{REPORT_DATE}}
Prepared by: {{AUTHOR_OR_TEAM}}
Audience: Finance + Operations + Program Office
Target length: **4-8 pages** (or spreadsheet-backed appendix)

## 1) Purpose

This worksheet captures the financial logic behind initiative estimates.
It is designed to prevent overclaiming and enforce transparent assumptions.

## 2) Rules of Use (Non-Negotiable)

1. No committed financial value without validated baseline.
2. Every estimate must include formula + source owner + timestamp.
3. Scenario values must be labeled clearly:
   - Conservative
   - Base
   - Upside
4. If data is missing, mark as `TBD` (never fabricate).

## 3) Baseline Data Register

| Metric | Current Baseline | Unit | Source System | Data Owner | Last Verified | Verification Status |
|---|---:|---|---|---|---|---|
| {{METRIC_1}} | {{BASELINE_1}} | {{UNIT_1}} | {{SOURCE_1}} | {{OWNER_1}} | {{DATE_1}} | {{STATUS_1}} |
| {{METRIC_2}} | {{BASELINE_2}} | {{UNIT_2}} | {{SOURCE_2}} | {{OWNER_2}} | {{DATE_2}} | {{STATUS_2}} |
| {{METRIC_3}} | {{BASELINE_3}} | {{UNIT_3}} | {{SOURCE_3}} | {{OWNER_3}} | {{DATE_3}} | {{STATUS_3}} |

## 4) Initiative Value Model Cards

> One card per initiative.

### Initiative {{N}} - {{INITIATIVE_NAME}}

#### 4.1 Operational effect assumptions
- Driver 1: `{{DRIVER_1}}`
- Baseline: `{{DRIVER_1_BASELINE}}`
- Improvement assumption: `{{DRIVER_1_IMPROVEMENT}}`
- Formula: `{{DRIVER_1_FORMULA}}`

#### 4.2 Financial translation assumptions
- Cost or value rate: `{{RATE_1}}`
- Translation formula: `{{TRANSLATION_FORMULA_1}}`
- Constraints: `{{CONSTRAINTS_1}}`

#### 4.3 Scenario outputs
- Conservative: `{{VALUE_CONSERVATIVE}}`
- Base: `{{VALUE_BASE}}`
- Upside: `{{VALUE_UPSIDE}}`

#### 4.4 Confidence and caveats
- Confidence: `{{CONFIDENCE_LEVEL}}`
- Caveat 1: `{{CAVEAT_1}}`
- Caveat 2: `{{CAVEAT_2}}`

## 5) Cross-Initiative Overlap Control

| Overlap Risk | Initiatives Involved | Potential Double Count | Control Rule |
|---|---|---|---|
| {{OVERLAP_1}} | {{INIT_SET_1}} | {{DOUBLE_COUNT_1}} | {{CONTROL_1}} |
| {{OVERLAP_2}} | {{INIT_SET_2}} | {{DOUBLE_COUNT_2}} | {{CONTROL_2}} |

## 6) Roll-Up View (Portfolio Level)

| Scenario | Gross Value | Implementation Cost | Net Value | Confidence |
|---|---:|---:|---:|---|
| Conservative | {{GROSS_C}} | {{COST_C}} | {{NET_C}} | {{CONF_C}} |
| Base | {{GROSS_B}} | {{COST_B}} | {{NET_B}} | {{CONF_B}} |
| Upside | {{GROSS_U}} | {{COST_U}} | {{NET_U}} | {{CONF_U}} |

## 7) Governance and Sign-Off

### Required sign-offs
- Finance lead: `{{FINANCE_SIGNOFF}}`
- Operations lead: `{{OPS_SIGNOFF}}`
- Program lead: `{{PROGRAM_SIGNOFF}}`

### Sign-off checklist
- [ ] Baselines validated
- [ ] Formula logic reviewed
- [ ] Overlap controls applied
- [ ] Scenarios approved
- [ ] Memo numbers aligned with worksheet

---

## Notes

- This worksheet is the single source of truth for value assumptions.
- Executive memo and full report must reference this worksheet, not independent estimates.
