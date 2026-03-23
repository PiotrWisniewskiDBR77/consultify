# Results KPI And Finance Analysis Linkage Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical optional linkage between KPI and Finance analysis, models, budgets, valuation and finance review packs

---

## 1. Why this document exists

KPI and Finance often describe the same business reality from two different angles.

Without a proper bridge, the product risks:

- duplicate definitions
- contradictory numbers
- finance analysis detached from KPI outcomes
- KPI reviews detached from financial meaning

This document defines the smart optional linkage between those layers.

---

## 2. Core statement

`KPI` and `Finance` should remain separate governed domains.

But when useful, they should be linkable in a disciplined way.

Canonical rule:

`KPI may remain operational and independent, but when a KPI has real financial relevance the system should support governed linkage to finance analysis rather than duplicated manual interpretation`

Additional rule:

`metric truth stays in Results, modeled finance truth stays in Finance, and the linkage explains how they relate instead of collapsing them into one object`

---

## 3. Why the linkage is optional

Not every KPI should connect to Finance.

Examples of KPI that may stay independent:

- service response time
- defect rate
- training completion
- process-cycle time with no direct financial use yet

Examples of KPI that often benefit from Finance linkage:

- gross margin
- EBITDA margin
- cash conversion cycle
- inventory days
- revenue growth
- debt service coverage
- working-capital release
- cost-saving realization

Rule:

`Finance linkage is optional by design, but strong where the metric has economic meaning or financial consequences`

---

## 4. Canonical linkage patterns

The package should support four patterns.

### 4.1 Interpretation linkage

Use when Finance helps explain KPI behavior.

Examples:

- revenue KPI linked to revenue bridge analysis
- margin KPI linked to cost and pricing analysis
- CCC KPI linked to working-capital analysis

### 4.2 Driver linkage

Use when KPI acts as a driver or output inside Finance models.

Examples:

- volume KPI affects revenue forecast
- DSO KPI affects working-capital driver
- utilization KPI affects cost absorption

### 4.3 Review linkage

Use when a KPI review should open or reference Finance evidence.

Examples:

- KPI deviation case linked to finance review pack
- scorecard review linked to modeled sensitivity
- executive KPI pack linked to CFO narrative

### 4.4 Realization linkage

Use when KPI progression and finance realization should be reviewed together.

Examples:

- initiative benefits KPI linked to ROI realization
- savings KPI linked to cost baseline and realized finance impact
- revenue uplift KPI linked to post-delivery finance verification

---

## 5. Canonical objects

### 5.1 `MetricFinanceLink`

Represents durable linkage between a KPI and Finance artifact.

It should contain:

- `metricId`
- `financeArtifactType`
- `financeArtifactId`
- `linkMode`
- `linkRationale`
- `syncStatus`
- `lastReconciledAt`

### 5.2 `MetricFinanceDriverRef`

Represents mapping between a KPI and one or more finance drivers or outputs.

It should contain:

- `metricId`
- `financeDriverCode`
- `mappingType`
- `directionality`
- `confidence`

### 5.3 `MetricFinanceReconciliation`

Represents a governed comparison of KPI truth and finance interpretation.

It should contain:

- `metricId`
- `financeArtifactRef`
- `comparisonWindow`
- `differenceSummary`
- `reconciliationStatus`
- `notes`

---

## 6. What can flow from KPI into Finance

KPI may seed or influence Finance through:

- baseline and target values
- trend and cadence
- threshold logic
- operational driver assumptions
- variance signals
- measured evidence from Results

Examples:

- DSO KPI seeds working-capital assumptions
- revenue KPI trend influences forecast setup
- cost-to-serve KPI informs margin analysis
- utilization KPI informs operating leverage scenarios

These should not silently overwrite Finance truth.

They should become:

- linked evidence
- suggested drivers
- finance review inputs
- scenario seed candidates

---

## 7. What can flow from Finance into KPI context

Finance may send structured context back into Results through:

- modeled financial interpretation of KPI changes
- scenario implications
- variance explanation
- sensitivity notes
- finance-backed evidence for deviation cases
- realization confirmation for ROI-linked KPI

Examples:

- KPI margin drop explained by finance pack on mix and cost inflation
- KPI cash target flagged against liquidity stress analysis
- KPI savings target reconciled against realized finance evidence

This should appear in Results as:

- linked finance evidence
- interpretation context
- reconciliation status

not as silent value replacement.

---

## 8. Reconciliation doctrine

When Results values and Finance interpretation diverge, the system must make that explicit.

It should support:

- difference visibility
- source explanation
- period alignment check
- unit and formula alignment check
- reconciliation notes
- approval or acknowledgment path where needed

Typical reasons for divergence:

- timing mismatch
- scope mismatch
- metric vs accounting definition mismatch
- stale finance model
- stale KPI data

Rule:

`reconciliation should explain divergence, not hide it`

### 8.1 Reconciliation ownership

> V8 Decision W6-5 applied — 2026-03-23

- **Results** owns KPI truth and the reconciliation workflow trigger. The primary runtime anchor for reconciliation starts in Results.
- **Finance** owns finance interpretation, finance model truth, and CFO review semantics. Finance resolves finance-side meaning.
- Reconciliation is a shared cross-module process with dual ownership.

Canonical rule:

`Results starts reconciliation, Finance resolves finance-side meaning`

---

## 9. UX doctrine

In Results, a KPI should be able to show:

- whether Finance linkage exists
- which finance artifact it is linked to
- whether the link is interpretive, driver-based, review-based or realization-based
- whether the linkage is current or stale
- quick path to open finance evidence
- quick path to open a dedicated reconciliation view when needed

In Finance, models and analysis packs should be able to show:

- which KPI are linked
- whether the KPI is a driver, output or review signal
- what reconciliation status exists

The user should never have to guess whether:

- the KPI influenced the finance model
- or the finance model merely explains the KPI

Detailed UX and workflow reference:

- `RESULTS_KPI_FINANCE_RECONCILIATION_UX_AND_WORKFLOW_V8.md`

---

## 10. AI role

AI should:

- detect which KPI are economically meaningful enough to link
- propose the correct linkage pattern
- explain how KPI relate to finance drivers or outputs
- flag likely scope or timing mismatches
- draft reconciliation summaries
- suggest when a KPI deviation should open a finance analysis pack

AI should not:

- silently map all KPI to Finance
- claim financial causality without evidence
- overwrite metric values with modeled finance estimates

Canonical AI pattern:

`metric context -> AI linkage proposal -> user review -> durable MetricFinanceLink -> ongoing reconciliation`

---

## 11. Why this is strategically strong

This linkage matters because it closes a real gap:

- PM and Results tools often show KPI without financial interpretation
- Finance tools often model value without living KPI discipline

`consultify` can be stronger by making KPI and Finance:

- separate where needed
- connected where valuable
- reviewable where ambiguous

---

## 12. Related canonical docs

- `RESULTS_V8_SSOT.md`
- `RESULTS_KPI_OPERATING_MODEL_AND_OKR_FUNCTIONS_V8.md`
- `RESULTS_PLATFORM_INTEGRATION_PLAN_V8.md`
- `RESULTS_KPI_FINANCE_RECONCILIATION_UX_AND_WORKFLOW_V8.md`
- `FINANCE_V8_SSOT.md`
- `FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md`
- `RESULTS_ROI_REGISTRY_AND_REALIZATION_TRACKING_RUNTIME_V8.md`
