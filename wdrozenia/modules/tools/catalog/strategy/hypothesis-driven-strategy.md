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

###

### 6.2 Layout requirements

**Two-column layout:**

- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

**Visual design:**

- Clean, modern interface with consistent spacing
- Color-coded elements for different states and categories
- Clear typography hierarchy (headings, body text, labels)
- Int

### 6.4 States

**Draft:**

- All sections editable
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**

- Sections locked (read-only) except for comments/annotations
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**

- All sections locked (read-only)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**

- Loading: skeleton screens for tables/charts
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves
- Empty: helpful prompts with examples and guidance

eractive elements with hover states and feedback

6.3 Interactions

- “Create hypothesis from leaf” (one click)
- “Attach evidence” (upload, link, note)
- “Mark validated/rejected” with required rationale
- Waterfall click → show which hypotheses contributed

---

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary
- Analysis results
- Recommendations
- Action Plan (from initiatives)
- Appendices: Definitions, references

**Excel Export:**

- Multiple sheets: Data, Analysis, Results
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- Page breaks at logical sections
- Headers/footers with page numbers

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

## 10. Consultant Report Specification (What goes into the final report)

### 10.1 Report Structure

The Hypothesis-Driven Strategy analysis should produce a structured consultant report with the following sections:

#### **Executive Summary (1–2 pages)**

- Root decision question and success criteria
- Governing hypothesis (the answer)
- Key validated sub-hypotheses (top 3–5)
- Bridge-to-target summary (quantified contributions)
- Recommendation and confidence level
- Next steps and initiatives

#### **Section 1: Decision Framing**

- Root decision question (with scope, constraints, timebox)
- Success criteria (KPIs and thresholds)
- Value at stake (rough estimate)
- Context (why this decision matters now)

#### **Section 2: Governing Hypothesis & Logic Spine**

- **Governing hypothesis**: Full statement with 3–5 supporting reasons
- **Issue tree**: MECE decomposition showing how sub-hypotheses connect
- **Visual**: Include issue tree diagram (exported from tool or MECE tree tool)

#### **Section 3: Hypothesis Testing & Validation**

- For each priority hypothesis (top 5–10):
  - Hypothesis statement
  - Test design (type, metric, measurement window)
  - Decision threshold (pre-defined)
  - Test results and interpretation
  - Status (validated/rejected/inconclusive)
  - Evidence log (data sources, interviews, pilots)
  - Confidence level and assumptions
- Summary table: All hypotheses with status, impact scores, and evidence quality

#### **Section 4: Bridge to Target**

- **Visual**: Waterfall chart showing contribution of each validated lever
- **Narrative**:
  - Quantified contribution per lever (with ranges)
  - Cumulative effect and gap closure
  - Key assumptions and risks
  - Sensitivity analysis (what if assumptions change)

#### **Section 5: Strategic Recommendations**

- **Decision summary**: Recommendation with confidence level
- **Initiative portfolio**:
  - For each initiative:
    - Title and description
    - Rationale (linked to validated hypothesis)
    - Expected impact (range)
    - Effort/resources required
    - Timeline and dependencies
    - Risks and mitigations
    - Owner and success metrics
- **Implementation roadmap**: Phased approach (quick wins, medium-term, long-term)
- **Governance**: Review cadence, decision gates, success criteria

#### **Section 6: Appendices**

- Detailed hypothesis test results
- Evidence log (all attachments, links, notes)
- Assumptions register
- Glossary of terms

### 10.2 Report Formatting Standards

- **Length**: 20–35 pages (excluding appendices)
- **Visuals required**:
  - Issue tree diagram (Section 2) — **mandatory**
  - Bridge-to-target waterfall (Section 4) — **mandatory**
  - Hypothesis status board (Section 3)
  - Initiative prioritization matrix (Section 5)
- **Tone**: Executive-ready, data-driven, test-and-learn focused
- **Language**: Clear, jargon-free (explain hypothesis-driven terms)

### 10.3 Report Quality Checklist

- [ ] Root decision and success criteria are decision-grade
- [ ] Governing hypothesis is falsifiable and testable
- [ ] MECE decomposition exists (issue/driver tree)
- [ ] At least 3 hypotheses tested with evidence
- [ ] Bridge-to-target is quantified (numbers, not just direction)
- [ ] Initiatives are traceable to validated hypotheses
- [ ] Assumptions and risks are explicit
- [ ] Report is exportable as PDF with proper formatting

---

## 11. Video storyboard

### 11.1 Audience & duration

- **Audience**: Transformation leaders, IT executives, change managers, digital strategists
- **Duration**: 45–60 seconds intro
- **Style**: Professional, instructional, clear visuals

### 11.2 Scene list

**Scene 1: Hook & Problem (0–10s)**

- **Visual**: Split screen showing current state vs target state
- **VO (PL)**: "Czy potrzebujesz transformacji cyfrowej?"
- **VO (EN)**: "Do you need digital transformation?"
- **On-screen text (PL)**: "Transformacja = Zmiana"
- **On-screen text (EN)**: "Transformation = Change"

**Scene 2: Solution Intro (10–18s)**

- **Visual**: Tool logo/name appears, transition to transformation roadmap
- **VO (PL)**: "Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) pomaga zaplanować transformację."
- **VO (EN)**: "Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) helps plan transformation."
- **On-screen text (PL)**: "Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) = Plan transformacji"
- **On-screen text (EN)**: "Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) = Transformation plan"

**Scene 3: Key Feature 1 (18–26s)**

- **Visual**: main analysis view
- **VO (PL)**: "Przeanalizuj sytuację krok po kroku."
- **VO (EN)**: "Analyze the situation step by step."
- **On-screen text (PL)**: "Analiza krok po kroku"
- **On-screen text (EN)**: "Step-by-step analysis"

**Scene 4: Key Feature 2 (26–34s)**

- **Visual**: results visualization
- **VO (PL)**: "Zobacz wyniki i wnioski."
- **VO (EN)**: "See results and insights."
- **On-screen text (PL)**: "Wyniki i wnioski"
- **On-screen text (EN)**: "Results and insights"

**Scene 5: Key Feature 3 (34–42s)**

- **Visual**: initiatives generation
- **VO (PL)**: "Generuj inicjatywy na podstawie analizy."
- **VO (EN)**: "Generate initiatives based on analysis."
- **On-screen text (PL)**: "Generuj inicjatywy"
- **On-screen text (EN)**: "Generate initiatives"

**Scene 6: Results (42–50s)**

- **Visual**: metrics dashboard showing improvements
- **VO (PL)**: "Osiągnij lepsze wyniki dzięki systematycznemu podejściu."
- **VO (EN)**: "Achieve better results through systematic approach."
- **On-screen text (PL)**: "Lepsze wyniki"
- **On-screen text (EN)**: "Better results"

**Scene 7: Export & CTA (50–60s)**

- **Visual**: PDF export preview, "Generate Initiatives" button highlighted
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) today."
- **On-screen text (PL)**: "Eksportuj i generuj inicjatywy"
- **On-screen text (EN)**: "Export and generate initiatives"

### 11.3 Shot list

1. **Shot 1 (0–10s)**: Wide shot showing problem, zoom to solution
2. **Shot 2 (10–18s)**: Fade to tool logo, pan to transformation roadmap
3. **Shot 3 (18–26s)**: Close-up of main analysis view
4. **Shot 4 (26–34s)**: Focus on results visualization
5. **Shot 5 (34–42s)**: Zoom to initiatives generation
6. **Shot 6 (42–50s)**: Pan across metrics dashboard showing improvements
7. **Shot 7 (50–60s)**: PDF preview overlay, fade to CTA button

### 11.4 Implementation notes

- **Screen recording**: Use actual tool interface (or high-fidelity mockup)
- **Transitions**: Smooth fades between scenes (0.5s)
- **Highlighting**: Use subtle glow/outline for interactive elements
- **Text overlays**: Bottom third of screen, semi-transparent background, readable font
- **VO**: Professional voiceover, clear pronunciation, moderate pace
- **Music**: Subtle background music (optional), non-distracting
- **Call-to-action**: End with tool name and "Get Started" button

## 12. Knowledge Base Extraction Pack

### 12.1 TL;DR (Executive Summary)

Hypothesis-driven strategy is an answer-first method: write a governing hypothesis, break it into sub-hypotheses using a MECE tree, and run minimal tests with pre-defined thresholds. Iterate in sprints until you have decision-grade confidence, quantify the bridge to target, then generate initiatives linked to validated levers.

### 12.2 FAQ (Frequently Asked Questions)

**Q1: Why start with an answer instead of analyzing first?**
A: Starting with a hypothesis focuses your tests and speeds up learning. You can always pivot if tests disprove it. Analysis-first often leads to "analysis paralysis" and delayed decisions.

**Q2: What makes a hypothesis "falsifiable"?**
A: A falsifiable hypothesis specifies what evidence would prove it wrong. Example: "Channel mix explains ≥40% of CAC gap" is falsifiable if you can test it. "We need better marketing" is not falsifiable.

**Q3: How do I prioritize which hypotheses to test first?**
A: Use Impact × Uncertainty × Speed. Focus on high-impact, high-uncertainty items that are quick to test. Defer low-impact items even if interesting.

**Q4: What if I can't test anything (no data, no experiments)?**
A: Use proxy indicators, expert judgment, or small pilots. Document assumptions explicitly. A hypothesis with assumptions is better than no hypothesis. You can refine as data arrives.

**Q5: Should I test all hypotheses or just the top ones?**
A: Test the top 5–10 hypotheses first. Set a timebox (e.g., "test top 5 in 2 weeks") and move forward even with imperfect data. You can test more later if needed.

**Q6: What if a test disproves my hypothesis?**
A: That's valuable learning! Update the hypothesis (pivot) or kill that branch. Update the bridge-to-target and move to the next priority hypothesis. Don't fall into confirmation bias.

**Q7: How do I define a "decision threshold"?**
A: Set it BEFORE running the test. Ask: "What result would make us proceed vs. stop?" Example: "If CAC improvement ≥ $60, we proceed; if < $60, we stop or pivot."

**Q8: How long should a test sprint be?**
A: Typically 1–4 weeks, depending on test type. Data cuts: 1–2 days. Interviews: 1 week. Pilots: 2–4 weeks. A/B tests: 2–4 weeks. Set deadlines and stick to them.

**Q9: What's "decision-grade confidence"?**
A: Enough confidence to act, not "certainty." Typically 70–80% confidence is enough. If you wait for 100% certainty, you'll miss the window of opportunity.

**Q10: How do I convert validated hypotheses into initiatives?**
A: Each validated hypothesis becomes 1–2 initiatives. Link the initiative rationale to the hypothesis, use the bridge-to-target numbers for expected impact, define effort, risks, and first 2–3 steps.

### 12.3

6. **What inputs are required?**
   A: - Root decision question + timebox

- Baseline KPI and target (or success criteria)
- **Optional inputs**:
  - Existing analyses (SWOT, Five Forces, BCG/portfolio, risk scenarios)
  - Data access map...

7. **How long does it typically take?**
   A: 2–6 weeks (in sprints); 60–120 minutes for initial hypothesis + test plan

8. **What makes a good Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

9. **What inputs are required?**
   A: - Root decision question + timebox

- Baseline KPI and target (or success criteria)
- **Optional inputs**:
  - Existing analyses (SWOT, Five Forces, BCG/portfolio, risk scenarios)
  - Data access map...

10. **How long does it typically take?**
    A: 2–6 weeks (in sprints); 60–120 minutes for initial hypothesis + test plan

11. **What makes a good Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

### FAQ (at least 8)

1. **What is the main purpose of Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving)?**
   A: Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) helps Hypothesis-driven strategy is an “answer-first” approach: you start with a plausible hypothesis abou....

2. **When should I use Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving)?**
   A: Use it Time is limited and “full analysis” would be too slow.
   Stakeholders disagree; you need neutral tests to converge.
   You can run quick tests (data cuts, ....

3. **What are the key outputs?**
   A: Key outputs include Governing hypothesis, sub-hypotheses, test plan (minimal tests + thresholds), evidence log, decision-grade recommendation, initiative backlog.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Hypothesis-Driven Strategy (Hypothesis-Driven Problem Solving) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   Checklists

**DoD Checklist (Definition of Done):**

- [ ] Root decision and success criteria defined
- [ ] Governing hypothesis written + 3–5 reasons
- [ ] MECE decomposition exists (issue/driver tree)
- [ ] ≥5 sub-hypotheses defined; top 3 prioritized
- [ ] Each priority hypothesis has test + threshold + owner + due date
- [ ] At least one sprint of tests completed OR explicitly documented why not
- [ ] Bridge-to-target quantified (ranges + assumptions)
- [ ] Initiatives generated with traceability

**Common Mistakes Checklist:**

- [ ] Hypothesis too vague → Fix: make it falsifiable with numeric thresholds
- [ ] Testing everything → Fix: prioritize by impact×uncertainty
- [ ] Confirmation bias → Fix: require disconfirming evidence + red team
- [ ] No thresholds → Fix: define thresholds BEFORE tests
- [ ] Waiting for certainty → Fix: act at 70–80% confidence

### 12.4 Glossary (Quick Reference)

| Term                      | Definition                                                         | Example                                              |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Governing hypothesis      | The main answer to the decision question                           | "We can proceed by optimizing channel mix..."        |
| Sub-hypothesis            | Testable statement derived from governing hypothesis               | "Channel mix misallocation explains ≥40% of CAC gap" |
| Minimal test              | Fastest/cheapest way to learn something that could prove you wrong | "2-week pilot in 2 regions"                          |
| Decision threshold        | Pre-defined rule for go/no-go/scale/pivot                          | "If CAC improvement ≥ $60, proceed"                  |
| Decision-grade confidence | Enough confidence to act (typically 70–80%)                        | Not "certainty," but "good enough to decide"         |

---

## 13. Additional Resources & Learning Links

### 13.1 Knowledge Base Articles (Internal)

- **Hypothesis-Driven Strategy Deep Dive**: `/knowledge-base/strategy/hypothesis-driven-strategy`
- **Test Design Guide**: `/knowledge-base/methods/test-design`
- **MECE Tree Integration**: `/knowledge-base/methods/mece-trees`
- **Bridge-to-Target Examples**: `/knowledge-base/examples/bridge-to-target`

### 13.2 External Learning Resources

**Official Sources:**

- [Umbrex: Hypothesis-driven Problem Solving](https://umbrex.com/resources/frameworks/strategy-frameworks/hypothesis-driven-problem-solving/) — Methodology overview
- [McKinsey Alumni: Barbara Minto and structured thinking](https://www.mckinsey.com/alumni/news-and-insights/global-news/alumni-news/barbara-minto-mece-i-invented-it-so-i-get-to-say-how-to-pronounce-it) — MECE and hypothesis-driven approach

**Tutorials & Examples:**

- Search YouTube: "Hypothesis-driven problem solving" — Multiple tutorial videos
- Search YouTube: "Test and learn strategy" — Growth and product management examples
- [Medium: Hypothesis-Driven Development](https://medium.com/@davefontenot/hypothesis-driven-development-5b0c5e5c5e5c) — Product management perspective

**Practice Tools:**

- [Miro Template: Hypothesis Board](https://miro.com/templates/hypothesis-board/) — Collaborative hypothesis tracking
- [Notion Template: Hypothesis-Driven Strategy](https://www.notion.so/templates/hypothesis-driven-strategy) — Tracking template

### 13.3 Related Tools in This Catalog

- [`mece-issue-tree.md`](./mece-issue-tree.md) — Uses issue trees as logic spine
- [`pyramid-principle.md`](./pyramid-principle.md) — Uses pyramid for communication

---

## 14. References (Authoritative Sources)

### Primary Sources

- [Umbrex: Hypothesis-driven Problem Solving](https://umbrex.com/resources/frameworks/strategy-frameworks/hypothesis-driven-problem-solving/) — Methodology overview and application guide
- [McKinsey Alumni: Barbara Minto and structured thinking](https://www.mckinsey.com/alumni/news-and-insights/global-news/alumni-news/barbara-minto-mece-i-invented-it-so-i-get-to-say-how-to-pronounce-it) — MECE and hypothesis-driven approach from McKinsey

### Methodology & Application

- [Harvard Business Review: The Hypothesis-Driven Organization](https://hbr.org/2014/04/the-hypothesis-driven-organization) — Organizational application
- Search YouTube: "Hypothesis-driven problem solving McKinsey" — Case examples

### Academic & Theoretical

- Popper, Karl. _The Logic of Scientific Discovery_ (1934) — Falsifiability principle (foundational)
- Christensen, Clayton. _The Innovator's Dilemma_ (1997) — Hypothesis-driven innovation

---
