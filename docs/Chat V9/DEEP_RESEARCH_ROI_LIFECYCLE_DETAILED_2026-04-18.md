# ROI Lifecycle + Outcome Instrumentation Requirements — Consultify (detailed)

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the ROI Lifecycle / Outcome Instrumentation deep research
> prompt (Prompt 7 of the first research batch) with the **full, detailed**
> specification. Supersedes the shorter ROI section (R-OUTCOME-1…8) inside
> `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md`.
>
> **ID reconciliation required at plan-action time:**
> - `R-OUTCOME-1…8` from the earlier Artifact/Connectors/ROI/Onboarding research
>   doc is **subsumed** by this document's `R-OUTCOME-1…24`. IDs collide.
> - At plan-action time, this document is authoritative for all `R-OUTCOME-*`
>   IDs. The earlier R-OUTCOME-1…8 rows should be **closed / merged** into the
>   corresponding detailed IDs here, not re-ticketed. The mapping is spelled out
>   in the "ID reconciliation" table below.
>
> Complements the Reasoning, Feedback/Learning, and Agentic Chat / Agent Runtime
> research documents dated 2026-04-18.
>
> **Next step:** this document will be turned into the canonical ROI
> implementation plan (tickets + flags + tests + CI invariants) in a follow-up
> pass.

---

## Strategic thesis

Consultify's moat should not be "better AI answers"; it should be a **finance-grade system of record** that converts initiatives into measurable business outcomes, keeps the baseline stable, links execution to value capture, and proves whether the value reached the P&L and stayed there. That is where enterprise buyers increasingly want accountability: a clear baseline, a standard KPI contract, validated measurement, and explicit linkage between initiatives and realised business value.

The commercial implication is equally important: **outcome-based pricing is strategically attractive, but it only works when metrics, attribution windows, and cost/value measurement are explicit enough to survive disputes.** The market is moving towards hybrid models rather than pure outcome pricing because AI-native software has real variable costs, attribution is messy, and vendors take meaningful downside risk when outcomes are not tightly defined.

**Recommendation:** yes to outcome-based pricing eventually, but **no** to a pure "percentage of ROI delivered" default in MVP. The right approach for Consultify is a hybrid commercial model: platform fee + implementation fee + tightly scoped upside share only for initiatives with auditable baselines, short attribution chains, agreed measurement windows, and finance-approved formulas. That aligns incentives without turning every deal into a pricing arbitration exercise.

### Non-negotiable design principles

1. **Outcome is a contract, not a note.** Every initiative must carry a business case, baseline, KPI set, cost ledger, value ledger, and measurement evidence.
2. **Baseline is sticky.** Once signed off, it changes only via valid change order.
3. **Hard value and soft value must be separated.** CFO headline ROI should include only monetised, policy-approved items; soft benefits such as brand or strategic optionality should sit in an adjacent evidence ledger, not in the auditable headline number.
4. **Every measurement needs provenance:** who entered it, from where, when, using what source, with what confidence and validation status.
5. **Post-delivery monitoring is part of the product, not aftercare.** Value persistence is part of the moat, because transformation value often leaks during implementation and after rollout.

---

## Outcome contract and initiative model

### First-class entity model

Consultify should introduce a first-class **Initiative** entity as the parent contract for value creation. The best mental model is not "project tracking" but **"value-realisation record"**: a governed object that links business intent, execution, measurement, and proof of persistence.

Mandatory `Initiative` schema fields:

- **Identity:** `id`, `tenantId`, `programId`, `parentInitiativeId`, `name`, `description`, `type`, `sectorTemplate`, `region`, `currency`.
- **Roles:** `ownerUserId`, `sponsorUserId`, `measurerUserId`, `financeApproverUserId`, `executiveCommitteeId`.
- **Lifecycle timestamps:** `status`, `stageGate`, `createdAt`, `proposedAt`, `approvedAt`, `fundedAt`, `startedAt`, `deliveredAt`, `measuredAt`, `sustainedAt`, `closedAt`.
- **References:** `baselineSnapshotId`, `targetProfileId`, `roiModelId`, `discountRatePolicyId`.
- **Financials:** `budgetApproved`, `budgetChangeOrders[]`, `actualCostToDate`, `forecastCostAtCompletion`.
- **KPIs:** `primaryKpiIds[]` (max 3), `secondaryKpiIds[]` (max 5).
- **Business case + outcomes:** `businessCaseSummary`, `forecastValueHard`, `forecastValueSoft`, `realisedValueHard`, `realisedValueSoft`, `forecastROI`, `realisedROI`, `paybackPeriod`, `npv`, `irr`, `bcr`.
- **Quality signals:** `riskScore`, `confidenceScore`, `freshnessDate`, `driftState`, `persistenceWindowMonths`, `persistenceCheckpointIds[]`.
- **Linked evidence:** `linkedDecisionIds[]`, `linkedTaskIds[]`, `linkedReportIds[]`, `linkedResearchSessionIds[]`, `linkedArtifactIds[]`, `linkedSystemEvidenceIds[]`.

### Lifecycle state machine

The lifecycle should be a **strict state machine**, not an editable status label. Recommended states:

```
scoped → proposed → approved → funded → in_execution →
  delivered → measured → sustained → expanded
```

Side-exit states: `paused`, `killed`, `expired`.

Each transition needs gate criteria:

| Transition | Gate criteria |
| --- | --- |
| `scoped → proposed` | Initiative charter exists, owner named, draft KPI set created, preliminary baseline method selected |
| `proposed → approved` | Sponsor sign-off, finance sign-off on business case, baseline capture plan agreed |
| `approved → funded` | Budget approved, measurement owner assigned, data-source readiness assessed |
| `funded → in_execution` | Baseline signed, KPI definitions frozen, linked tasks and decisions attached |
| `in_execution → delivered` | Work completed, delivery evidence attached, no open critical risks |
| `delivered → measured` | First "after" measurement completed with source evidence and variance commentary |
| `measured → sustained` | KPI persistence passes policy window, minimum six months |
| `sustained → expanded` | Successor initiatives created with lineage tracking and explicit inherited assumptions |

### Roles and relationships

Consultify should distinguish clearly between **Owner**, **Sponsor**, and **Measurer**. The Owner is accountable for execution and risk response. The Sponsor commits funding and approves the business case. The Measurer is accountable for the KPI evidence pack and outcome validity, but should not be the only approver of their own numbers. In larger accounts, add a fourth role, **Finance Approver**, for hard-value sign-off. This separation is directly aligned with SOX-style control thinking: the more material the metric, the more important review precision and segregation around preparation, review, and approval.

Hierarchy should be **Programme → Initiative → Work package → Task**. Decisions, reports, and research sessions should never exist as isolated knowledge objects if they drive value creation; they should be linkable as supporting evidence to an initiative so the platform can answer the question "which decisions created which outcomes?" rather than merely "what happened?".

---

## KPI measurement and ROI engine

### KPI model and measurement cadence

A KPI should be treated as a **governed definition**, not just a label. Each KPI needs: `metricName`, `preciseDefinition`, `formula`, `unit`, `directionality`, `sourceType`, `sourceSystem`, `frequency`, `owner`, `dataSteward`, `aggregationMethod`, `thresholds`, `materialityFlag`, `signOffPolicy`, and `changePolicy`. That is consistent with the SEC guidance on KPI disclosure.

### Baseline capture protocol

Baseline capture should follow a formal protocol:

1. Choose the baseline logic: trailing actuals, current budget, or momentum case.
2. Document timeframe and comparison window.
3. Record source systems and extraction method.
4. Record assumptions and exclusions.
5. Secure owner, sponsor, and finance sign-off.
6. Freeze the baseline snapshot.
7. Allow changes only through `changeOrder` with reason, approvers, delta impact, and retained history.

### Measurement cadence

Measurement cadence should be configurable per KPI but **constrained by policy**:

| KPI type | Default cadence |
| --- | --- |
| Operational KPIs | Weekly |
| Financial and execution KPIs | Monthly |
| Strategic / slower-moving KPIs | Quarterly |
| Persistence monitoring, months 1–6 after delivery | Monthly |
| Persistence monitoring, months 7–12 (strategic / board-visible / case-study-eligible) | Quarterly |

If the KPI is too infrequently measured, the platform cannot prove persistence or spot deterioration early enough to intervene.

### `KpiMeasurement` schema

Each measurement event should be a **separate immutable object** with provenance fields:

- `enteredBy`, `collectedBy`, `validatedBy`
- `capturedAt`, `effectiveDate`
- `sourceType`, `sourceSystem`, `extractionMethod`, `evidenceArtifactIds`
- `confidenceBand`, `auditStatus`, `restatementFlag`, `restatementReason`

For Consultify, provenance is **not a nice-to-have**; it is the difference between a management metric and an auditable metric.

### Confidence scoring

A practical model:

| Band | When |
| --- | --- |
| **High** | Integration-pulled or system-derived, validated by finance or steward, evidence attached |
| **Medium** | Calculated from governed internal data, reviewer approved, some manual transformation |
| **Low** | Manual or self-reported, no independent validation, evidence partial |

Any measurement marked self-reported should be visually labelled **"Self-reported / lower confidence / not eligible for external proof"** by default.

### Drift detection

Drift detection should operate at both KPI and initiative level:

- **KPI level** — alert when actual deviates beyond threshold from target, from previous-period trend, or from forecast confidence interval.
- **Initiative level** — compute `driftState` from the worst relevant combination of primary KPI deterioration, budget overrun, schedule slippage, and confidence decay.

BCG's 2025 work is especially relevant here: the problem is not just whether impact was forecast, but whether it ultimately reached net P&L and stayed there.

### ROI calculation framework

The ROI engine should maintain **separate ledgers** for cost, hard value, and soft value.

**Cost ledger:**

- approved initiative budget
- actual external consultant spend
- internal team FTE cost at loaded rate
- software and integration cost
- AI/LLM/API inference cost
- training and change-management cost
- deployment and monitoring cost
- opportunity cost *only if* the tenant has an approved policy for estimating it

**Hard-value ledger:**

- revenue uplift
- cost savings
- margin improvement
- working-capital improvement where monetised
- efficiency gain converted into money using approved labour-rate policy
- risk avoidance *only where* there is approved monetisation logic and probability basis

**Soft-value ledger:**

- brand/reputation benefit
- employee satisfaction
- strategic optionality
- customer experience lift without agreed monetisation method

This hard/soft split is essential because IBM, Microsoft, and enterprise finance guidance all accept that AI and transformation generate both tangible and intangible value, but only tangible value should drive the CFO headline unless the tenant has explicitly approved a monetisation policy.

### Formula library

Consultify should support a formula library, with tenant-level policy on which formula is authoritative by initiative type:

- `Simple ROI = (realised hard value – actual cost) / actual cost`
- Payback period
- NPV
- IRR
- BCR
- Sector-specific custom formulas

The discount rate must be tenant-configurable and policy-bound.

### Forecast vs actual + variance analysis

The engine should always store forecast and actual **side by side**. Every initiative needs:

- Forecast: baseline, KPI path, cost, value, ROI
- Actual: baseline, KPI path, cost, value, ROI

**Variance analysis is mandatory** whenever actual differs materially from forecast, using reason codes such as: `volume`, `price`, `adoption`, `execution_delay`, `cost_inflation`, `quality_failure`, `data_restatement`, `external_shock`, `scope_change`.

### Sensitivity analysis

At minimum, each initiative should carry **base, downside, and upside scenarios** for the most important assumptions. This matters for both finance credibility and commercial design: if Consultify ever shares upside, it must know which assumptions are inside the vendor's control and which belong to macro conditions or client execution.

---

## AI workflow and executive operating system

AI should become the **interaction layer for the outcome contract, but not the signatory**. The assistant can draft, suggest, summarise, and alert, yet sign-off remains a user action.

### Creation flow

When the user says "start initiative X", AI should:

1. create a draft Initiative;
2. infer likely initiative type from context;
3. propose three primary and up to five secondary KPIs;
4. locate candidate baseline sources;
5. estimate initial budget buckets;
6. link existing decisions, tasks, reports, and research artifacts;
7. generate a missing-information checklist;
8. request named human sign-off on baseline and KPI definitions.

### Query flow (trust bundle)

Every AI answer about ROI should return a **trust bundle**:

- Source systems
- Effective dates
- Freshness
- Who entered/validated
- Confidence level
- Formula version
- Baseline version
- Whether the number is self-reported
- Whether the value is hard or soft

Without that, the AI answer is impossible to defend in a CFO or board setting.

### Proactive monitoring

AI should detect three classes of event:

| Event class | Definition |
| --- | --- |
| **Value drift** | Primary KPI down or flat for consecutive periods |
| **Confidence drift** | Fresh measurements absent or increasingly self-reported |
| **Economics drift** | Actual cost rising while forecast value weakens |

When triggered, the assistant should recommend one of a small set of **governed actions**: review session, sponsor escalation, re-baseline request, change order, pause, or kill recommendation.

### Executive surfaces per persona

**For the CFO:**
- Portfolio budget vs actual
- Realised hard value
- Realised ROI by initiative and programme
- Leakage view: forecast impact vs net P&L impact
- Persistence rate at 3/6/12 months
- Missing-sign-off and low-confidence exceptions

**For the CEO:**
- Board-proof initiatives authorised this quarter
- Top five delivered outcomes
- Failing initiatives requiring decision
- Lineage from decision to delivery to sustained value

**For the transformation officer:**
- Traffic-light portfolio view
- Gantt / timeline view
- Owner, risk, confidence, budget at completion, expected completion, top blockers
- Initiative lineage and dependency view

**For exports and board packs:**
- Scheduled dashboard delivery
- PDF board brief
- Audit appendix with formula assumptions and evidence gaps

---

## Proof generation, investor narrative, benchmark readout

### Case study and external proof generation

Consultify should **automatically score initiatives for advocacy readiness**. A practical candidate rule: delivered, measured, hard-value ROI above policy threshold, persistence passed, confidence not low, sponsor approved, and no unresolved support escalations.

### Anonymisation pipeline

Separate **pseudonymisation** from **publication-safe anonymisation**:

- Pseudonymisation is useful inside the workflow to reduce exposure.
- Publication-safe anonymisation requires stronger controls: PII identification, named-entity redaction, number banding or percentage ranges, industry-level generalisation, region generalisation where needed, and legal/tenant approval before external publication.

### Three-version case study output

Each case study should produce three versions:

1. Internal full-fidelity success file
2. Customer-branded version for the tenant
3. Platform proof version for Consultify demand generation

The platform should then measure effectiveness: influenced opportunities, engagement rate, case-study assist rate in closed-won deals, sales-cycle compression, and reference-to-win conversion.

### Investor and board reporting

The investor narrative should focus on **repeatability of delivered value**, not just on deployment count. The strongest platform-wide metrics:

- Total hard value delivered in period
- Weighted average realised ROI
- Six- and twelve-month persistence rates
- Share of initiatives with signed baselines
- Share of measurements at high confidence
- Ratio of forecast to actual value by cohort
- Top initiative archetypes by realised value
- Client tenure vs value persistence
- Client retention/expansion vs documented outcome attainment

### Moat evidence (incrementality)

For true moat evidence, Consultify should not rely only on pre/post anecdotes. It should **instrument incrementality** where possible: matched-baseline comparison, holdouts, staggered rollouts, or explicit control groups for recommendation classes. This is the cleanest way to answer a future investor question such as "did your AI recommendations cause the uplift, or did the client improve anyway?".

### Commercial guarantees

Outcome-based SLA later, but only for a narrow class of initiatives: short cycle time, high measurement confidence, low dependence on exogenous shocks, and explicit customer obligations. A generic "pay us only if ROI appears" promise is too coarse; a controlled guarantee on, say, measurable efficiency or cycle-time improvement is far more defensible.

---

## Benchmark readout

| Benchmark | What they show | What Consultify should add on top |
| --- | --- | --- |
| **Salesforce / IBM** | Front-end expectation: ROI calculators, hard/soft value framing, business-objective linkage, value-realisation language | Closed-loop contract from initiative creation through persistence proof |
| **McKinsey / BCG** | Methodology backbone: finance-linked baselines, standard KPIs, stage gates, validation of impact, disciplined tracking to net P&L | Platform-native enforcement, not consultant-dependent discipline |
| **Bain** | Loyalty-and-growth linkage: visible outcome metrics improve retention, expansion, referenceability | Mechanised: platform instruments the linkage, not the annual study |
| **monday.com / Asana / Adobe Workfront** | Surface benchmarks: portfolio dashboards, Gantt/timeline views, goals/progress, business cases, alignment scores | Baseline-locked, audit-traced, hard-value ROI ledger |
| **Looker / Tableau / Domo** | Distribution benchmark: scheduling and exporting recurring dashboards and PDF board packs | Match ease of dissemination, **but** with provenance attached to every number |

---

## Requirements catalogue

### P0 requirements

**R-OUTCOME-1 (P0)** — Initiative must be a first-class entity with immutable identity, lifecycle state, owner, sponsor, measurer, baseline reference, KPI set, cost ledger, value ledger, and evidence links.
Test: create an initiative, attach linked decisions/tasks/reports, and retrieve one record that resolves the whole business case.
Risk if absent: Consultify remains a collection of notes, not a defensible execution system.

**R-OUTCOME-2 (P0)** — Every initiative must have a signed baseline before execution can start.
Test: system blocks transition to `in_execution` until baseline snapshot is approved.
Risk: no reliable before/after comparison.

**R-OUTCOME-3 (P0)** — Baseline changes must only occur through formal change order with preserved history.
Test: baseline edit without change order is rejected; approved change order creates a new version and delta log.
Risk: audit failure and metric manipulation.

**R-OUTCOME-4 (P0)** — KPI definitions must include formula, unit, source, owner, cadence, and management-use statement.
Test: KPI cannot be activated with blank definition or source metadata.
Risk: inconsistent measurement and misleading reporting.

**R-OUTCOME-5 (P0)** — Every KPI measurement must store provenance: who, when, from where, via what method, with what evidence and validation status.
Test: measurement API rejects writes that omit provenance fields.
Risk: numbers cannot be trusted or audited.

**R-OUTCOME-6 (P0)** — Measurements without source-backed evidence must be labelled `self_reported` and excluded from external proof by default.
Test: self-reported measurement appears with lower-confidence badge and cannot enter case-study export until independently validated.
Risk: reputational damage and proof contamination.

**R-OUTCOME-7 (P0)** — Each initiative must support up to three primary and five secondary KPIs with explicit weighting and precedence.
Test: portfolio scoring and drift logic use weighted primary KPIs first.
Risk: teams drown in metric sprawl and cannot determine success.

**R-OUTCOME-8 (P0)** — Lifecycle must be a gated state machine with approval conditions per state.
Test: state transitions fail when gate conditions are unsatisfied.
Risk: initiatives appear "green" without finance, baseline, or measurement discipline.

**R-OUTCOME-9 (P0)** — ROI engine must separate hard value from soft value and compute headline ROI only from policy-approved hard-value components.
Test: brand value can be recorded but does not affect headline ROI unless tenant policy explicitly permits it.
Risk: CFO rejection of the model as non-defensible.

**R-OUTCOME-10 (P0)** — Formula library must support simple ROI, payback, NPV, IRR, and BCR, with tenant-configurable discount-rate policy.
Test: one initiative can be recalculated under multiple approved formulas without rewriting history.
Risk: the platform cannot support sector or finance-policy variation.

**R-OUTCOME-11 (P0)** — Forecast and actual must be stored side by side, with mandatory variance analysis for material deltas.
Test: initiative marked `measured` with >X% forecast variance requires structured commentary and reason codes.
Risk: no learning loop and no explanation for leakage.

**R-OUTCOME-12 (P0)** — Persistence tracking must run for at least six months after delivery.
Test: initiative cannot move to `sustained` until minimum policy window is passed and measured.
Risk: Consultify proves launch optics, not durable value.

**R-OUTCOME-13 (P0)** — AI may draft KPI and ROI structures but may not sign off on baseline, KPI approval, or realised value.
Test: assistant-generated drafts require named user approval events.
Risk: weak controls and unclear accountability.

**R-OUTCOME-14 (P0)** — Every AI ROI answer must include a trust bundle showing source, freshness, confidence, baseline version, and formula version.
Test: natural-language ROI response without trust bundle fails QA.
Risk: AI output sounds authoritative but is not defensible.

**R-OUTCOME-15 (P0)** — Executive dashboards must expose portfolio, timeline, financial, risk, and persistence views from the same initiative ledger.
Test: same initiative appears consistently across all views with identical values and timestamps.
Risk: dashboard fragmentation recreates today's decentralisation problem.

### P1 requirements

**R-OUTCOME-16 (P1)** — Drift detection must alert owners when primary KPIs, confidence, or economics deteriorate across policy thresholds.
Test: three consecutive under-target measurements trigger review recommendation.
Risk: value leakage is discovered too late.

**R-OUTCOME-17 (P1)** — Case-study candidate scoring must combine ROI, persistence, confidence, and sponsor approval.
Test: pipeline surfaces ranked candidates and excludes low-confidence or policy-conflicted initiatives.
Risk: marketing publishes weak or unsafe proof.

**R-OUTCOME-18 (P1)** — Anonymisation pipeline must support redaction, pseudonymisation, number banding, and approval workflow before publication.
Test: export cannot leave the tenant until required redaction and approval steps are complete.
Risk: privacy breach or customer-trust failure.

**R-OUTCOME-19 (P1)** — Initiative lineage must support expansion tracking from parent initiative to successor initiatives.
Test: portfolio view can show that initiative X led to Y and Z with inherited assumptions noted.
Risk: no compounding-learning narrative.

**R-OUTCOME-20 (P1)** — Scheduled board packs and monthly outcome briefs must be exportable with attached assumptions and exception logs.
Test: stakeholder can receive recurring PDF/email pack with direct links to measurement evidence.
Risk: manual reporting overhead returns.

**R-OUTCOME-21 (P1)** — Investor reporting must include cohort analysis, persistence rates, confidence coverage, and initiative-type mix.
Test: Q1'25 cohort can be compared with Q3'25 cohort using the same definitions.
Risk: no credible moat narrative at platform level.

**R-OUTCOME-22 (P1)** — Moat-evidence module must support holdout, matched-baseline, or staggered-rollout comparison for selected initiative archetypes.
Test: platform can compare AI-assisted and non-assisted outcomes on like-for-like cohorts where an experimental or quasi-experimental design exists.
Risk: Consultify cannot separate causation from anecdote.

### P2 requirements

**R-OUTCOME-23 (P2)** — Commercial engine should support hybrid outcome pricing schedules on selected initiatives, not only subscription pricing.
Test: contracts can encode fixed fee + upside share tied to agreed KPI evidence windows.
Risk: product architecture blocks future monetisation strategy.

**R-OUTCOME-24 (P2)** — External assurance-readiness package should support customer requests for attestation over selected KPI processes or controls.
Test: tenant can export control descriptions, measurement workflows, approval logs, and data lineage for audit review.
Risk: enterprise procurement treats the platform as operationally useful but financially non-trustworthy.

---

## Two-week MVP

The right MVP is not "all analytics"; it is **ten real initiatives through one complete value lifecycle**.

| Day range | Deliverable | Success criterion |
| --- | --- | --- |
| **Days 1–2** | Canonical data model: `Initiative`, `KpiDefinition`, `BaselineSnapshot`, `KpiMeasurement`, `RoiModel`, `PersistenceCheckpoint`, `EvidenceArtifact` | Ten existing initiatives mapped into the new schema without field loss |
| **Days 3–4** | Baseline capture and sign-off: sticky versioning + change order | One authorised user flow can propose, approve, and freeze a baseline; unauthorised edits blocked |
| **Days 5–6** | KPI definitions, measurement write paths, provenance capture, self-reported labelling, confidence bands | At least three KPIs per initiative can be measured with source metadata |
| **Days 7–8** | ROI engine: cost buckets, hard/soft value split, simple ROI, payback, forecast-vs-actual, variance reasons (NPV/IRR/BCR behind flags) | CFO can inspect ten initiatives and see budget, actual cost, hard value, soft value, ROI, variance |
| **Days 9–10** | Executive portfolio page + one AI trust-bundle answer path | CFO prompt "show Q1/Q3 spend and ROI by initiative" returns a portfolio answer with source freshness + confidence |
| **Days 11–12** | Persistence monitoring and drift alerts | Delivered initiatives monitored monthly and flagged on persistent KPI deterioration |
| **Days 13–14** | One board-pack export, one anonymised case-study draft, user acceptance with finance + transformation + executive users | At least one initiative exits `measured` with board-pack-ready evidence and one high-confidence initiative becomes a case-study candidate |

### Explicitly deferred from MVP

- Complex sector formula packs beyond a core finance set.
- Fully automated external-system integrations beyond one or two key sources.
- Generalised outcome-based billing.

Those are valid second-wave investments, but they should not delay the proof that Consultify can carry ten initiatives through a complete, auditable lifecycle.

---

## Compliance and auditability

**ROI and KPI reporting generally does not sit inside ICFR by default, so Consultify should not oversell this as "audited financial reporting".** The better language is **SOX-defensible operational and management reporting**.

### Practical SOX implications for Consultify

1. Use a recognised control framework and clear control objectives for KPI preparation, review, and change management.
2. Require **precision in management review controls** — the PCAOB explicitly says compensating controls must operate with enough precision to prevent or detect material misstatement.
3. Treat KPI definitions, assumptions, and restatements as controlled disclosures (SEC expects clear definitions, usefulness rationale, management-use explanation, disclosure of assumptions where omission would mislead).
4. Maintain system audit trails for all user and application actions affecting measurements, baselines, formulas, approvals, and exports.
5. Apply segregation of duties for preparer, reviewer, and approver on material initiatives.
6. Make evidence retention configurable to customer policy, but **never delete historical versions** of baselines, formulas, or signed measurements.

### Product-level shipping checklist

- Immutable event logs
- Approval records
- Formula versioning
- Measurement restatement workflow
- Exception dashboards
- Policy-based access control
- Export bundles that show exactly how a number was produced

### Bottom line

> The moat is not the model; it is **the outcome ledger**. If Consultify can make initiatives measurable before they start, govern what counts as value, trace every KPI measurement to evidence, show variance against promise, and prove persistence after delivery, it becomes materially different from a better chatbot, from a work-management suite, and from slide-led consulting.

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-OUTCOME-1 | P0 | Initiative as first-class entity (identity, lifecycle, roles, ledgers, evidence) |
| R-OUTCOME-2 | P0 | Signed baseline mandatory before execution starts |
| R-OUTCOME-3 | P0 | Baseline changes only via formal change order with history |
| R-OUTCOME-4 | P0 | KPI definition must include formula/unit/source/owner/cadence/management-use |
| R-OUTCOME-5 | P0 | KPI measurement provenance (who/when/from-where/method/evidence/validation) |
| R-OUTCOME-6 | P0 | Self-reported measurements labelled + excluded from external proof |
| R-OUTCOME-7 | P0 | Max 3 primary + 5 secondary KPIs with explicit weighting |
| R-OUTCOME-8 | P0 | Gated lifecycle state machine with approval conditions per state |
| R-OUTCOME-9 | P0 | Hard/soft value split; headline ROI = policy-approved hard value only |
| R-OUTCOME-10 | P0 | Formula library (simple ROI / payback / NPV / IRR / BCR) + tenant discount-rate policy |
| R-OUTCOME-11 | P0 | Forecast-vs-actual side-by-side + mandatory variance analysis with reason codes |
| R-OUTCOME-12 | P0 | Persistence tracking ≥ 6 months post-delivery |
| R-OUTCOME-13 | P0 | AI drafts, humans sign (baseline / KPI approval / realised value) |
| R-OUTCOME-14 | P0 | AI ROI answers carry trust bundle (source/freshness/confidence/baseline/formula version) |
| R-OUTCOME-15 | P0 | Exec dashboards: portfolio/timeline/financial/risk/persistence from one ledger |
| R-OUTCOME-16 | P1 | Drift detection + owner alerts on KPI / confidence / economics deterioration |
| R-OUTCOME-17 | P1 | Case-study candidate scoring (ROI × persistence × confidence × sponsor approval) |
| R-OUTCOME-18 | P1 | Anonymisation pipeline (redaction / pseudonym / banding / approval) |
| R-OUTCOME-19 | P1 | Initiative lineage / expansion tracking (parent → successors) |
| R-OUTCOME-20 | P1 | Scheduled board packs + monthly outcome briefs with assumptions/exceptions |
| R-OUTCOME-21 | P1 | Investor reporting: cohort analysis, persistence rates, confidence coverage, mix |
| R-OUTCOME-22 | P1 | Moat-evidence module: holdout / matched-baseline / staggered-rollout design |
| R-OUTCOME-23 | P2 | Hybrid outcome pricing on selected initiatives (platform fee + upside share) |
| R-OUTCOME-24 | P2 | External assurance-readiness export package for customer attestation |

**Totals:** 24 requirements — 15 × P0, 7 × P1, 2 × P2.

---

## ID reconciliation with the earlier research doc

The earlier `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` contained 8 high-level R-OUTCOME items. They are **subsumed** by this detailed document. Mapping:

| Old ID (Artifact/ROI/Onboard doc) | Old one-liner | Resolves to (this doc) | Notes |
| --- | --- | --- | --- |
| R-OUTCOME-1 (P0) | Initiative as first-class entity + lifecycle + relationships | **R-OUTCOME-1 + R-OUTCOME-8** | Lifecycle promoted to its own row (state-machine gates) |
| R-OUTCOME-2 (P0) | Sticky baseline (signed snapshot, change-order protocol) | **R-OUTCOME-2 + R-OUTCOME-3** | Split into "signed before execution" + "change order with history" |
| R-OUTCOME-3 (P0) | KPI measurement provenance + confidence | **R-OUTCOME-4 + R-OUTCOME-5 + R-OUTCOME-6** | Split: KPI definition contract + measurement provenance + self-reported handling |
| R-OUTCOME-4 (P0) | ROI engine — multiple methods + variance + discount-rate policy | **R-OUTCOME-9 + R-OUTCOME-10 + R-OUTCOME-11** | Split: hard/soft + formula library + forecast-vs-actual |
| R-OUTCOME-5 (P1) | AI drafts; humans sign | **R-OUTCOME-13** | Direct carry-over |
| R-OUTCOME-6 (P1) | Executive surfaces (portfolio/timeline/financial/risk/persistence/expansion) | **R-OUTCOME-15 + R-OUTCOME-19 + R-OUTCOME-20** | Split: unified dashboard + lineage + scheduled exports |
| R-OUTCOME-7 (P1) | Case-study pipeline (candidate → anon → approval → publish) | **R-OUTCOME-17 + R-OUTCOME-18** | Split: candidate scoring + anonymisation pipeline |
| R-OUTCOME-8 (P2) | Outcome-based pricing option | **R-OUTCOME-23** | Direct carry-over |

**New rows with no antecedent in the earlier doc:**
- R-OUTCOME-7 (primary/secondary KPI cap + weighting)
- R-OUTCOME-12 (persistence ≥ 6 months)
- R-OUTCOME-14 (AI ROI answer trust bundle)
- R-OUTCOME-16 (drift detection + owner alerts)
- R-OUTCOME-21 (investor reporting cohorts)
- R-OUTCOME-22 (moat evidence: incrementality design)
- R-OUTCOME-24 (external assurance-readiness export)

At plan-action time the earlier 8 rows close; this doc's 24 rows become the canonical ticket seeds.

---

## Cross-document linkage

- **Reasoning (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`):**
  - AI ROI trust bundle (R-OUTCOME-14) inherits the `TrustBundle` schema from R-REASON-16 (same object, new evidence slice).
  - ROI questions frequently land in `decision_review` or `reasoning_on_workspace` workload classes (R-REASON-1); fail-closed rule (R-REASON-12, R-REASON-15) applies when primary KPI evidence is missing or stale.
  - Every R-OUTCOME-5 measurement write produces a `reasoning.evidence_attached` event reusable as proof artifact.

- **Feedback / Learning (`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`):**
  - Longitudinal outcome feedback (R-LEARN-18) is the telemetry feed for R-OUTCOME-12 (persistence tracking) and R-OUTCOME-16 (drift detection).
  - Learned `kpi_definition` (R-LEARN-4 taxonomy) must **never** override a signed KPI definition (R-OUTCOME-4 sign-off policy) or a signed baseline (R-OUTCOME-2). Hard precedence graph from R-LEARN-10 applies.
  - Case-study pipeline (R-OUTCOME-17 / R-OUTCOME-18) passes through tenant-admin approval (R-LEARN-15) before external publication.

- **Agentic Chat / Runtime (`DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md`):**
  - Every lifecycle state transition (R-OUTCOME-8) is an `ExecutionProposalV1` mutation (R-AGENT-3) with severity inherited from the financial impact class.
  - Baseline change order (R-OUTCOME-3) is S3/S4-severity and requires approval barrier sequence (R-AGENT-9 + R-AGENT-6 mutation gateway).
  - KPI Sentinel (persistence monitoring, R-OUTCOME-12 + R-OUTCOME-16) runs on the `RunLedger` + scheduled agent infrastructure (R-AGENT-11 + R-AGENT-12).
  - Cost attribution (R-AGENT-16) supplies the AI/LLM cost bucket for the cost ledger (R-OUTCOME-10).

- **Artifact (`DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` §Artifact):**
  - Board-pack export (R-OUTCOME-20) is an approved Artifact version (R-ARTIFACT-4) with hash/watermark export integrity.
  - Case-study draft (R-OUTCOME-17) uses cross-artifact transformation (R-ARTIFACT-5) — internal success file → customer-branded → platform proof as typed lineage, not copy-paste.

- **Connectors (same file §Enterprise integrations):**
  - KPI `sourceSystem` (R-OUTCOME-4) resolves to a connector; freshness SLA (R-CONNECT-4) determines `freshnessDate` on measurements.
  - ACL (R-CONNECT-5) governs who can see initiative-level financial detail inside the tenant.
  - Disconnect-purge (R-CONNECT-6) must **not** purge historical measurements already signed — they are pinned by R-OUTCOME-5 provenance + SOX retention rules.

- **Onboarding (same file §Onboarding):**
  - CFO activation aha-moment (R-ONBOARD-1) is "baseline-to-ROI view, edit one assumption, variance updates with provenance" — this doc's R-OUTCOME-11 + R-OUTCOME-14 are the substrate.
  - Demo workspace (R-ONBOARD-2) needs a pre-populated portfolio of ~10 initiatives following this schema to demonstrate the moat within 5 minutes.

---

## What this document is NOT

- Not a ticket backlog (the next pass converts `R-OUTCOME-*` into tickets, flags, tests, CI invariants).
- Not an ERP replacement — Consultify does not become a book of record for financial statements; it is a governed **management reporting + value realisation** system.
- Not a pure ICFR system — the compliance posture is **SOX-defensible operational/management reporting**, with optional assurance-readiness for targeted attestation.
- Not a pricing model — R-OUTCOME-23 (hybrid outcome pricing) is a product capability, not a commercial recommendation to sell that way on day one.

## Next step

Turn this document into the canonical ROI Lifecycle implementation plan alongside Reasoning / Feedback / Agent Runtime / Artifact / Connectors / Onboarding:
1. **Close** the 8 `R-OUTCOME-*` rows from the earlier Artifact/Connectors/ROI/Onboarding doc (see mapping table above) — do not re-ticket them.
2. Assign each `R-OUTCOME-*` from *this* doc a ticket ID and block (likely dedicated `outcome` block in `ChatV9Block` union, or a dedicated `ChatV10Block`).
3. Register feature flags per requirement (`ff.outcome_initiative_entity`, `ff.outcome_signed_baseline`, `ff.outcome_change_order`, `ff.outcome_kpi_provenance`, `ff.outcome_self_reported_label`, `ff.outcome_hard_soft_split`, `ff.outcome_formula_library`, `ff.outcome_variance_analysis`, `ff.outcome_persistence_tracking`, `ff.outcome_trust_bundle`, `ff.outcome_drift_alerts`, `ff.outcome_case_study_pipeline`, `ff.outcome_anonymisation`, `ff.outcome_board_pack_export`, `ff.outcome_incrementality_design`, `ff.outcome_hybrid_pricing`, `ff.outcome_assurance_export`, etc.).
4. Draft `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy; split by sub-surface (Initiative / Baseline / KPI / ROI engine / Persistence / Proof generation / Investor surface).
5. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `outcome.*` event families (`outcome.initiative_created`, `outcome.baseline_signed`, `outcome.baseline_change_order_approved`, `outcome.kpi_defined`, `outcome.measurement_recorded`, `outcome.variance_flagged`, `outcome.drift_alert_fired`, `outcome.persistence_checkpoint_passed`, `outcome.case_study_candidate_surfaced`, `outcome.board_pack_exported`).
6. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-OUTCOME-*` → flag in registry,
   - every `outcome.*` event → section in telemetry contract,
   - every lifecycle state (`scoped`, `proposed`, `approved`, `funded`, `in_execution`, `delivered`, `measured`, `sustained`, `expanded`, `paused`, `killed`, `expired`) used in code matches the documented taxonomy,
   - every variance reason code (`volume`, `price`, `adoption`, `execution_delay`, `cost_inflation`, `quality_failure`, `data_restatement`, `external_shock`, `scope_change`) is bijective with the contract section,
   - every `confidence_band` value (`high`, `medium`, `low`) used in code matches the KPI measurement schema.
