# Hypothesis-Driven Strategy (Answer-First, Test-and-Learn)

## Metadata

- **Tool name**: Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving)
- **Slug**: `hypothesis-driven-strategy`
- **Category**: Strategy
- **Level**: Core
- **Typical duration**: 2–6 weeks (in sprints); 60–120 minutes for initial hypothesis + test plan
- **Best for**: Fast decisions under uncertainty (growth, margin, pricing, market entry, transformation)
- **Not for**: Pure compliance decisions (rule-based), or situations where no tests/data can be obtained at all
- **Primary outputs**: Governing hypothesis, sub-hypotheses, test plan (minimal tests + thresholds), evidence log, decision-grade recommendation, initiative backlog
- **Required inputs (minimum)**:
  - Root decision question + timebox
  - Baseline KPI and target (or success criteria)
- **Optional inputs**:
  - Existing analyses (SWOT, Five Forces, BCG/portfolio, risk scenarios)
  - Data access map (what data exists, who owns it)
- **Related tools (internal)**:
  - [`mece-issue-tree.md`](./mece-issue-tree.md)
  - [`pyramid-principle.md`](./pyramid-principle.md)
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Hypothesis-driven strategy is an “answer-first” approach: you start with a plausible hypothesis about what will work, then run the **minimum set of tests** to validate or falsify it—iterating until you have **decision-grade confidence**.

### 1.2 When to use

- Time is limited and “full analysis” would be too slow.
- Stakeholders disagree; you need neutral tests to converge.
- You can run quick tests (data cuts, customer calls, pilots, A/B tests).
- You need to turn ambiguity into initiatives fast.

### 1.3 When NOT to use

- You cannot define success criteria (no KPI, no decision).
- You cannot test anything (no data, no experiments, no proxies) and must rely purely on judgment; you can still use the structure, but results will be weaker.
- Teams will treat the hypothesis as dogma (confirmation bias).

### 1.4 What “good” looks like

- A clear governing hypothesis + 3–5 supporting reasons.
- A MECE decomposition linking to testable sub-hypotheses.
- For each priority hypothesis: a test + evidence expectations + threshold + owner + timeline.
- A quantified bridge from current to target and an initiative plan.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Governing hypothesis**: your best current answer to the root question.
- **Sub-hypotheses**: what must be true for the governing hypothesis to hold.
- **Minimal test**: the fastest/cheapest way to learn something that could prove you wrong.
- **Decision threshold**: pre-defined rule for go/no-go/scale/pivot.
- **Decision-grade confidence**: enough confidence to act, not “certainty.”

### 2.2 Glossary

| Term         | Definition                                | Notes                               |
| ------------ | ----------------------------------------- | ----------------------------------- |
| Falsifiable  | Can be proven wrong                       | Must specify disconfirming evidence |
| Evidence log | Record of what was tested and results     | Prevents rework and bias            |
| Red team     | People tasked to challenge the hypothesis | Anti-bias mechanism                 |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input            | Description                  | Example                           | Where in the app it can come from |
| ---------------- | ---------------------------- | --------------------------------- | --------------------------------- |
| Root decision    | What decision are we making? | “Enter Segment X in 12 months?”   | Tool setup                        |
| Success criteria | KPI + threshold              | “CAC ≤ $340, payback ≤ 24 months” | KPI input                         |
| Timebox          | How long to decide           | “6 weeks”                         | Tool setup                        |

### 3.2 Optional inputs

| Input          | Description                  | Example                             | Where in the app it can come from |
| -------------- | ---------------------------- | ----------------------------------- | --------------------------------- |
| Prior analyses | SWOT, Five Forces, portfolio | “Porter: buyer power high”          | Existing tools                    |
| Constraints    | Non-negotiables              | “No layoffs; brand positioning”     | Context                           |
| Test inventory | What can be tested           | “Pricing A/B possible in 2 regions” | Ops/CRM                           |

### 3.3 Data quality checks

- Ensure test data matches scope and time horizon.
- Define measurement windows and confounders (seasonality, promotions).
- Pre-register thresholds to avoid moving goalposts.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Frame the decision

- Convert vague prompts into a decision question with scope and constraints.
- Define value at stake (rough estimate).

### Step 2 — Build the logic spine (issue/driver tree)

- Use a MECE tree to list drivers and where hypotheses will attach.
- Each leaf becomes a candidate sub-hypothesis.

### Step 3 — Draft the governing hypothesis + reasons

Template:

> “We believe we can achieve **[target]** primarily by **[3 levers]** because **[reasons]**.”

### Step 4 — Turn reasons into sub-hypotheses

For each reason:

- What must be true?
- What evidence would we see if true?
- What evidence would disprove it?

### Step 5 — Prioritize with Impact × Uncertainty

- Focus first on high-impact, high-uncertainty items.
- Defer low-impact items even if interesting.

### Step 6 — Design minimal tests + thresholds

For each priority hypothesis define:

- test type (data cut / interviews / pilot / A/B)
- metric(s) + measurement window
- decision threshold (“if uplift ≥ X then scale”)
- owner + deadline

### Step 7 — Run sprints and synthesize continuously

- Weekly synthesis: update hypotheses, kill disproven branches, deepen validated ones.
- Maintain a “hypothesis status board”: Draft → Testing → Validated / Rejected.

### Step 8 — Quantify the bridge to target

Convert validated hypotheses into a contribution bridge (ranges).

### Step 9 — Convert to initiatives and decide

Each validated lever becomes initiatives with owners and KPIs.
When confidence crosses the threshold, make the decision and commit.

### Common mistakes & fixes

- **Mistake**: Hypothesis too vague → **Fix**: make it falsifiable with numeric thresholds.
- **Mistake**: Testing everything → **Fix**: prioritize by impact×uncertainty.
- **Mistake**: Confirmation bias → **Fix**: require disconfirming evidence + red team.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs

| Deliverable          | Description                               | Format in the app        |
| -------------------- | ----------------------------------------- | ------------------------ |
| Governing hypothesis | One-sentence answer-first claim           | Card at top of workspace |
| Sub-hypotheses       | Leaves with tests                         | Table/board              |
| Test plan            | Minimal tests + thresholds                | Checklist + timeline     |
| Evidence log         | Results attached to hypotheses            | Attachments + notes      |
| Decision summary     | Recommendation + confidence               | Executive summary block  |
| Initiative backlog   | Initiatives derived from validated levers | Draft initiatives list   |

### 5.2 DoD checklist

- [ ] Root decision and success criteria defined
- [ ] Governing hypothesis written + 3–5 reasons
- [ ] MECE decomposition exists (issue/driver tree)
- [ ] ≥5 sub-hypotheses defined; top 3 prioritized
- [ ] Each priority hypothesis has test + threshold + owner + due date
- [ ] At least one sprint of tests completed OR explicitly documented why not
- [ ] Bridge-to-target quantified (ranges + assumptions)
- [ ] Initiatives generated with traceability

---

## 6. UI / Graphic specification (What the user sees)

### 6.1 Screens / views

- Setup
- Hypothesis canvas (governing hypothesis + reasons)
- Issue tree (embed/link to MECE tree)
- Hypothesis board (statuses)
- Test planner (timeline + thresholds)
- Bridge-to-target waterfall
- Initiatives

### 6.2 Layout

- Left: workspace stepper + content
- Right: status, DoD, review/approve, export, generate initiatives

### 6.3 Interactions

- “Create hypothesis from leaf” (one click)
- “Attach evidence” (upload, link, note)
- “Mark validated/rejected” with required rationale
- Waterfall click → show which hypotheses contributed

---

## 7. Worked example (End-to-end)

### 7.1 Context

Regional telecom considering expansion to 250k new homes. Decision needed in 10 weeks. Success: CAC ≤ $340, payback ≤ 24 months.

### 7.2 Governing hypothesis

> “We can proceed with the build-out and hit target economics primarily by (1) optimizing channel mix in 3 micro-markets, (2) tightening promo guardrails, and (3) improving onboarding to reduce early churn.”

### 7.3 Priority tests

1. Reallocate spend pilot (2 weeks) → CAC improvement threshold ≥ $60.
2. Promo cap A/B (2 weeks) → conversion retention ≥ 90% with ARPU ≥ +$2.
3. “White glove install” pilot (3 weeks) → early churn reduction ≥ 2.5pp.

### 7.4 Bridge to target

- Channel mix: −$80 CAC
- Promo guardrails: −$40 CAC; ARPU +$3
- Onboarding: churn −3.6pp; CAC +$12 but LTV +$110

### 7.5 Initiatives derived

| Initiative title         | Rationale              | Expected impact    | Effort | Risks             | First 2 steps                           |
| ------------------------ | ---------------------- | ------------------ | ------ | ----------------- | --------------------------------------- |
| Channel mix optimization | Validated pilot uplift | CAC −$80           | Medium | Attribution noise | Define micro-markets; reallocate budget |
| Promo guardrails         | Reduce discount drift  | CAC −$40; ARPU +$3 | Low    | Sales pushback    | Guardrails; deal approval workflow      |
| Onboarding playbook      | Reduce early churn     | churn −3pp         | Medium | Ops capacity      | Install SLA; training                   |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "decision": {
    "question": "Proceed with next 250k homes?",
    "successCriteria": [
      { "metric": "CAC", "threshold": "<= 340", "unit": "USD" },
      { "metric": "Payback", "threshold": "<= 24", "unit": "months" }
    ],
    "timeboxWeeks": 10
  },
  "governingHypothesis": {
    "statement": "We can proceed primarily by (1)...",
    "reasons": [
      { "id": "r1", "text": "Channel mix is misallocated" },
      { "id": "r2", "text": "Promo discount drift is high" },
      { "id": "r3", "text": "Onboarding drives early churn" }
    ]
  },
  "subHypotheses": [
    {
      "id": "h1",
      "reasonId": "r1",
      "statement": "In 3 micro-markets CAC is inflated by broad media overspend.",
      "status": "testing",
      "tests": [
        {
          "name": "Spend reallocation pilot",
          "threshold": "CAC improvement >= 60",
          "durationWeeks": 2
        }
      ]
    }
  ],
  "bridge": [{ "lever": "Channel mix", "value": -80, "unit": "CAC_USD" }],
  "initiativeDrafts": [{ "title": "Channel mix optimization", "sourceHypothesisId": "h1" }]
}
```

### 8.2 Validation rules (DoD)

- Must define decision + success criteria
- Must define ≥3 sub-hypotheses
- Each priority hypothesis must have a test + threshold
- At least one completed test OR written justification why tests are infeasible

### 8.3 Initiative generation spec

- Convert each validated hypothesis into 1–2 initiatives with traceability (`sourceHypothesisId`).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Reasoning rules

- Always propose falsifiable hypotheses.
- Require thresholds and disconfirming evidence.
- Use MECE decomposition for sub-hypotheses.
- Keep a live confidence estimate and explain assumptions.

### 9.2 Extraction schema (JSON)

```json
{
  "governingHypothesis": { "statement": "string", "reasons": ["string"] },
  "subHypotheses": [
    {
      "statement": "string",
      "tests": [{ "name": "string", "metric": "string", "threshold": "string" }]
    }
  ]
}
```

### 9.3 Self-checks

- Are hypotheses testable in the available timebox?
- Are thresholds defined before results arrive?
- Is there evidence against the hypothesis?

---

## 10. Video storyboard

1. Turn a messy question into a decision
2. Write a governing hypothesis
3. Build sub-hypotheses from a MECE tree
4. Design minimal tests with thresholds
5. Run a sprint and update the bridge
6. Generate initiatives with traceability

---

## 11. Knowledge base extraction pack

### TL;DR

Hypothesis-driven strategy is an answer-first method: write a governing hypothesis, break it into sub-hypotheses using a MECE tree, and run minimal tests with pre-defined thresholds. Iterate in sprints until you have decision-grade confidence, quantify the bridge to target, then generate initiatives linked to validated levers.

### References (sources)

- [Umbrex: Hypothesis-driven Problem Solving](https://umbrex.com/resources/frameworks/strategy-frameworks/hypothesis-driven-problem-solving/)\n+- [McKinsey Alumni: Barbara Minto and structured thinking](https://www.mckinsey.com/alumni/news-and-insights/global-news/alumni-news/barbara-minto-mece-i-invented-it-so-i-get-to-say-how-to-pronounce-it)\n+
