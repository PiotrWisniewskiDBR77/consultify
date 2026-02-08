# DMAIC (Six Sigma Project Flow)

## Metadata

- **Tool name**: DMAIC
- **Slug**: `dmaic`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 2–8 weeks (lightweight); 2–4 months (full project)
- **Best for**: Reducing defects/variation, stabilizing performance, structured problem solving with measurement
- **Not for**: Purely creative ideation; “unknown unknowns” without measurable outcome; rapid firefighting without time to measure
- **Primary outputs**: Problem charter, baseline metrics, root-cause validated, improved process, control plan
- **Required inputs (minimum)**:
  - Problem statement + scope
  - Target metric (CTQ) and baseline measurement approach
- **Optional inputs**:
  - Process map/SIPOC/VSM, historical data, VOC, cost of poor quality (COPQ)
- **Related tools (internal)**:
  - (ops) `sipoc.md`
  - (ops) `root-cause-5whys-fishbone.md`
  - (ops) `spc-control-charts.md`
  - (ops) `process-capability-cpk.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

DMAIC provides a disciplined, data-driven flow to answer: **“What is causing the performance gap, and what change will reliably close it?”** It prevents jumping to solutions by forcing clarity, measurement, validation, and control.

### 1.2 When to use

- Defects, rework, delays, or variability are high and recurring.
- Multiple competing explanations exist; data is needed.
- You need a repeatable improvement method with governance.

### 1.3 When NOT to use (anti-patterns)

- The solution is obvious and safe to implement immediately (“just fix it”).
- You cannot define a measurable CTQ or collect data.
- The bottleneck is clearly capacity/flow (start with TOC/VSM/Kanban).

### 1.4 What “good” looks like

- Clear charter: scope, metric, baseline, target, timeline, owner.
- Root cause is validated with evidence (not opinions).
- Improvements are verified (before/after) with quantified gains.
- Control plan ensures the gain remains (SPC, standard work, audits).

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Define**: clarify CTQ, scope, customers, goals.
- **Measure**: create reliable baseline and measurement system.
- **Analyze**: identify and validate root causes.
- **Improve**: design and test changes; confirm improvement.
- **Control**: prevent regression; standardize and monitor.

### 2.2 Glossary

| Term         | Definition                  | Notes                        |
| ------------ | --------------------------- | ---------------------------- |
| CTQ          | Critical-to-Quality metric  | e.g., defect rate, lead time |
| COPQ         | Cost of Poor Quality        | rework, scrap, warranty      |
| MSA          | Measurement System Analysis | gauge R&R, data reliability  |
| Control plan | Monitoring + response plan  | SPC, audits, ownership       |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input      | Description                      | Example                | Where in the app it can come from |
| ---------- | -------------------------------- | ---------------------- | --------------------------------- |
| Problem    | What is wrong, where, since when | “Late deliveries +18%” | Setup                             |
| CTQ metric | Metric definition and unit       | “OTIF % weekly”        | KPI entry                         |
| Scope      | In/out boundaries                | “EU warehouse only”    | Setup                             |

### 3.2 Optional inputs (improves quality)

| Input           | Description          | Example               | Where in the app it can come from |
| --------------- | -------------------- | --------------------- | --------------------------------- |
| SIPOC/VSM       | Process context      | VSM current state     | Linked tool                       |
| Historical data | Baseline series      | last 26 weeks OTIF    | Upload/CSV                        |
| VOC             | Customer requirement | “Delivery within 48h” | Notes                             |

### 3.3 Data quality checks

- Metric definition is unambiguous (denominator, time window).
- Data source is stable; missing data rate is known.
- Baseline uses enough time (avoid “one bad week”).

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Define (Charter)

- Problem statement, CTQ, baseline period, target, scope, stakeholders.
- Hypotheses list (possible causes) without committing to one.

### Step 2 — Measure (Baseline + data plan)

- Define operational definitions for CTQ and key drivers.
- Collect baseline time series (enough points to see variation).
- If measurement uncertain: run MSA (lightweight checks).

### Step 3 — Analyze (Root cause validation)

- Use fishbone + 5 Whys to structure causes.
- Validate with data: stratification (by shift, product, channel), Pareto, correlation (careful).
- Select critical few causes (top 1–3) with strongest evidence.

### Step 4 — Improve (Design + test)

- Generate countermeasures for critical causes.
- Pilot changes with clear success criteria.
- Measure before/after; confirm not random noise.

### Step 5 — Control (Hold the gain)

- Standardize: SOP, training, visual controls.
- Monitoring: SPC chart for CTQ and leading indicators.
- Response plan: who reacts, thresholds, escalation.

### Common mistakes & fixes

- **Mistake**: Jumping to solutions → **Fix**: demand baseline + validated cause.
- **Mistake**: Too broad scope → **Fix**: narrow to one process/segment first.
- **Mistake**: “Correlation = cause” → **Fix**: triangulate with process evidence.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable             | Description                  | Format in the app |
| ----------------------- | ---------------------------- | ----------------- |
| DMAIC charter           | Problem, CTQ, scope, target  | Form + PDF        |
| Baseline dashboard      | Time series + stratification | Charts            |
| Root-cause pack         | Fishbone + validated causes  | Diagram + notes   |
| Improvement experiments | Pilots, results              | Table             |
| Control plan            | SPC + SOP + responses        | Checklist + chart |

### 5.2 Definition of Done (DoD) checklist

- [ ] Charter complete (CTQ, scope, target, owner, timeline)
- [ ] Baseline measured with defined data source and definitions
- [ ] Root causes validated with evidence (not just opinions)
- [ ] Improvement tested and quantified (before/after)
- [ ] Control plan defined (monitoring + response)

---

## 6. UI / Graphic specification (What the user sees)

### 6.1 Screens / views

- Workspace steps:
  1. Define (charter)
  2. Measure (metric definition + baseline charts)
  3. Analyze (fishbone + validation evidence)
  4. Improve (countermeasures + experiments)
  5. Control (SPC + SOP + response plan)
- Control panel:
  - Status + DoD
  - Export report
  - Generate initiatives from validated countermeasures

### 6.2 Visualization & graphics

- Baseline: line chart + run chart; Pareto for defects; stratification table.
- Analyze: fishbone diagram (editable) + “evidence cards”.
- Control: SPC chart templates and threshold markers.

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
- Interactive elements with hover states and feedback

  6.3 Interactions

- “Convert cause → initiative” only after cause marked “validated”.
- “Attach evidence” to causes (screenshots, data exports, notes).
- “Experiment template” wizard (hypothesis, change, metric, duration).

### 6.4 States

- Draft: editable; Review: comment-only; Approved: locks baseline & conclusions.

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

OTIF (on-time, in-full) dropped from 92% to 78% in one distribution center.

### 7.2 Inputs (filled)

- CTQ: OTIF % weekly, baseline last 12 weeks
- Target: restore to ≥90% within 8 weeks
- Scope: DC-1 outbound shipments

### 7.3 Analysis (filled)

- Pareto: 55% of misses caused by “late picking completion”
- Stratification: misses spike on Monday and for SKU family C
- Validated cause: replenishment not completed before picking wave; WIP overload

### 7.4 Insights

1. Biggest driver is flow timing mismatch (replenishment vs picking wave).
2. Variability is systematic (day-of-week + SKU family), not random.

### 7.5 Initiatives derived

| Initiative title           | Rationale                   | Expected impact | Effort | Risks      | First 2 steps          |
| -------------------------- | --------------------------- | --------------- | ------ | ---------- | ---------------------- |
| Replenishment cut-off rule | Align replenishment to wave | +8–12pp OTIF    | Low    | Exceptions | Define cut-off; train  |
| WIP limit for picking wave | Reduce overload             | +5–8pp OTIF     | Medium | Pushback   | Set WIP; monitor daily |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "define": { "ctq": "OTIF%", "scope": "DC-1 outbound", "target": 0.9, "baselineWeeks": 12 },
  "measure": {
    "dataSource": "WMS export",
    "baselineSeries": [{ "week": "2026-W01", "value": 0.78 }]
  },
  "analyze": {
    "fishbone": [{ "category": "Method", "cause": "Late replenishment" }],
    "validatedCauses": [{ "causeId": "c1", "evidence": ["Pareto", "Wave timing logs"] }]
  },
  "improve": { "experiments": [{ "change": "Replenishment cut-off", "result": "OTIF +9pp" }] },
  "control": { "spc": { "chart": "p-chart", "thresholds": { "lcl": 0.85, "ucl": 0.97 } } },
  "initiativeDrafts": [{ "title": "Replenishment cut-off rule", "sourceCauseId": "c1" }]
}
```

### 8.2 Steps & section mapping

- `define` → `measure` → `analyze` → `improve` → `control`

### 8.3 Validation rules (DoD)

- Define complete (CTQ + scope + target).
- Measure contains baseline series (min 8 points).
- Analyze has ≥1 validated cause with evidence.
- Improve has ≥1 experiment with measured result.
- Control has monitoring + response owner.

### 8.4 Initiative generation spec

- Only from validated causes and tested countermeasures.
- Require traceability back to cause + CTQ.

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Never propose “Improve” without confirming “Measure” and validated “Analyze”.
- Suggest the simplest statistical/analytical check that is sufficient.
- Highlight confounders and seasonality; recommend stratification.

### 9.2 Prompt outline

- Validate CTQ definition.
- Propose baseline data plan and minimum sample size.
- Generate fishbone hypotheses; ask for evidence to validate.
- Propose experiments with success criteria and control plan.

### 9.3 Extraction schema (JSON)

```json
{
  "ctqDefinition": { "metric": "string", "unit": "string", "window": "string" },
  "suspectedCauses": [{ "category": "string", "cause": "string", "evidenceNeeded": "string" }],
  "experiments": [
    { "change": "string", "metric": "string", "durationDays": 14, "successCriteria": "string" }
  ]
}
```

### 9.4 Self-checks

- Is the CTQ measurable and baseline adequate?
- Are causes validated (evidence attached)?
- Does control plan prevent regression?

---

## 10. Consultant Report Specification (What goes into the final report)

- Charter (Define)
- Baseline and measurement definitions (Measure)
- Root cause validation pack (Analyze)
- Improvements + experiment results (Improve)
- Control plan + monitoring (Control)
- Initiatives backlog (with traceability)

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
- **VO (PL)**: "DMAIC pomaga zaplanować transformację."
- **VO (EN)**: "DMAIC helps plan transformation."
- **On-screen text (PL)**: "DMAIC = Plan transformacji"
- **On-screen text (EN)**: "DMAIC = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij DMAIC już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start DMAIC today."
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

## 12. Knowledge base extraction pack

1. **What is the main purpose of DMAIC?**
   A: DMAIC helps DMAIC provides a disciplined, data-driven flow to answer: \*\*“What is causing the performance gap, an....

2. **When should I use DMAIC?**
   A: Use it - Defects, rework, delays, or variability are high and recurring.

- Multiple competing explanations exist; data is needed.
- You need a repeatable imp....

3. **What are the key outputs?**
   A: Key outputs include Problem charter, baseline metrics, root-cause validated, improved process, control plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of DMAIC?**
   A: DMAIC helps DMAIC provides a disciplined, data-driven flow to answer: \*\*“What is causing the performance gap, an....

2. **When should I use DMAIC?**
   A: Use it Defects, rework, delays, or variability are high and recurring.
   Multiple competing explanations exist; data is needed.
   You need a repeatable improveme....

3. **What are the key outputs?**
   A: Key outputs include Problem charter, baseline metrics, root-cause validated, improved process, control plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good DMAIC analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good DMAIC analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

**DoD Checklist (Definition of Done):**

- [ ] All required inputs provided
- [ ] Analysis completed according to method
- [ ] Key insights documented
- [ ] Recommendations generated
- [ ] Report exportable

**Common Mistakes Checklist:**

- [ ] Incomplete inputs → Fix: Ensure all required inputs are provided before starting
- [ ] Skipping validation → Fix: Validate results and check for consistency
- [ ] Unclear objectives → Fix: Define clear objectives and success criteria upfront

### Glossary (short)

| Term            | Definition                                     | Example                                   |
| --------------- | ---------------------------------------------- | ----------------------------------------- |
| Analysis        | Systematic examination of data and information | Conducting analysis to identify patterns  |
| Insights        | Key findings and conclusions from analysis     | Deriving insights from data patterns      |
| Recommendations | Actionable suggestions based on analysis       | Providing recommendations for improvement |

---

## 13. Additional Resources & Learning Links

- ASQ Six Sigma resources: `https://asq.org`
- iSixSigma DMAIC guides: `https://www.isixsigma.com`
- NIST/SEMATECH e-Handbook of Statistical Methods: `https://www.itl.nist.gov/div898/handbook/`

---

## 14. References (Authoritative Sources)

- NIST/SEMATECH e-Handbook of Statistical Methods: `https://www.itl.nist.gov/div898/handbook/`
- American Society for Quality (ASQ) — Six Sigma and DMAIC resources: `https://asq.org`
- Montgomery, Douglas C. _Introduction to Statistical Quality Control_. Wiley.
