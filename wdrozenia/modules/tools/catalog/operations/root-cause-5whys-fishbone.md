# Root Cause Analysis (5 Whys + Fishbone)

## Metadata

- **Tool name**: Root Cause Analysis (5 Whys + Fishbone)
- **Slug**: `root-cause-5whys-fishbone`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 45–120 minutes (single incident); 1–2 days (recurring / complex)
- **Best for**: Defects, incidents, recurring operational problems, building evidence-based causality
- **Not for**: Vague problems without a defined “bad event”; strategy/portfolio questions; blaming people
- **Primary outputs**: Problem statement, cause tree, validated root cause(s), countermeasures, verification plan
- **Required inputs (minimum)**:
  - Clear problem statement (what/where/when/how big)
  - Evidence (data, photos, logs, examples)
- **Optional inputs**:
  - Process map / standard work, defect Pareto, time series, interviews
- **Related tools (internal)**:
  - (ops) `dmaic.md`
  - (ops) `kaizen-pdca.md`
  - (ops) `spc-control-charts.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

RCA helps a team answer: **“What caused this problem, and what change will prevent it from recurring?”** by systematically separating symptoms from causes and validating causality with evidence.

### 1.2 When to use

- A defect/incident repeats or has high impact.
- Different teams disagree on “what caused it”.
- You need countermeasures that prevent recurrence (not just firefighting).

### 1.3 When NOT to use (anti-patterns)

- The “problem” is a broad goal (e.g., “be more efficient”) without a specific bad event.
- You have no evidence and no plan to collect it.
- You want to attribute blame to individuals rather than fix the system.

### 1.4 What “good” looks like

- Problem statement is measurable and bounded.
- Cause chain is logical and supported by evidence.
- Root causes are actionable (you can change the system).
- Countermeasures are verified (before/after) and embedded in standard work/control.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **5 Whys**: iterative questioning to move from symptom to systemic cause.
- **Fishbone (Ishikawa)**: structured brainstorming by cause categories (6M: Man, Machine, Method, Material, Measurement, Mother Nature/Environment).
- **Root cause**: a cause that, if removed, prevents recurrence (or drastically reduces it).
- **Escape point**: where the problem should have been detected but wasn’t.

### 2.2 Glossary

| Term           | Definition              | Notes                           |
| -------------- | ----------------------- | ------------------------------- |
| Symptom        | What is observed        | e.g., “wrong label”             |
| Cause          | Why it happened         | e.g., “label template outdated” |
| Countermeasure | Change to prevent cause | e.g., template versioning       |
| Verification   | Proof it worked         | data, audits, SPC               |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input             | Description             | Example                          | Where in the app it can come from |
| ----------------- | ----------------------- | -------------------------------- | --------------------------------- |
| Problem statement | What/where/when/how big | “4% packing errors last 2 weeks” | Setup                             |
| Evidence          | Examples/data/logs      | 20 defect photos                 | Attachments                       |
| Context           | Process step & owner    | “Packing line A”                 | Context                           |

### 3.2 Optional inputs (improves quality)

| Input         | Description       | Example                 | Where in the app it can come from |
| ------------- | ----------------- | ----------------------- | --------------------------------- |
| Standard work | Expected method   | SOP link                | Standard Work tool                |
| Pareto        | Top defect types  | “SKU mix-up 60%”        | Upload/chart                      |
| Timeline      | Incident sequence | “shift change at 14:00” | Notes                             |

### 3.3 Data quality checks

- Evidence must include at least 3 examples of the problem.
- Confirm the metric definition (denominator, time window).
- Avoid mixing different problems in one RCA (split if needed).

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Write a measurable problem statement

Use: **What + Where + When + Magnitude + Impact**.

Example: “Packing label errors in Line A increased to 4% over the last 2 weeks, causing 120 returns and €18k rework cost.”

### Step 2 — Collect and attach evidence

- 5–20 examples (photos, tickets, logs).
- A small dataset if possible (counts by day/shift/SKU).

### Step 3 — Build a fishbone to enumerate plausible causes

- Use categories (6M) to avoid blind spots.
- Keep causes specific and observable.

### Step 4 — Run 5 Whys on the top suspected cause chains

Rules:

- Each “why” should be supported by evidence or marked as a hypothesis.
- Stop when the next “why” becomes non-actionable (“because people are careless” → invalid).

### Step 5 — Identify root causes + escape points

For each chain, capture:

- Root cause (systemic)
- Escape point (why it wasn’t caught)
- Leading indicator to monitor

### Step 6 — Define countermeasures and verification

- Countermeasures must change the system: poka-yoke, standard, automation, visual control, training + audit.
- Define verification: before/after metric + timeframe + owner.

### Common mistakes & fixes

- **Mistake**: “Root cause = human error” → **Fix**: ask what in the system allowed it.
- **Mistake**: No evidence → **Fix**: collect examples before concluding.
- **Mistake**: One RCA for multiple issues → **Fix**: split by defect family.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable     | Description                 | Format in the app |
| --------------- | --------------------------- | ----------------- |
| RCA summary     | Problem, impact, scope      | Report section    |
| Fishbone        | Structured cause map        | Diagram           |
| 5 Whys chains   | Cause chains with evidence  | Tree/table        |
| Root causes     | Validated systemic causes   | List with tags    |
| Countermeasures | Actions + verification plan | Initiative drafts |

### 5.2 Definition of Done (DoD) checklist

- [ ] Problem statement is measurable and bounded
- [ ] Evidence attached (≥3 examples)
- [ ] Fishbone completed with specific causes
- [ ] ≥1 cause chain validated with evidence
- [ ] Root cause(s) and escape point(s) identified
- [ ] Countermeasures defined with verification plan

---

## 6. UI / Graphic specification (What the user sees)

### 6.1 Screens / views

- Workspace:
  1. Setup (problem statement, scope, metric)
  2. Evidence (attachments + dataset)
  3. Fishbone builder (6M categories)
  4. 5 Whys chains (select causes → expand)
  5. Root cause + escape points
  6. Countermeasures → initiatives
- Control panel:
  - Status + DoD checklist
  - Review/approve
  - Export report PDF
  - Generate initiatives

### 6.2 Visualization & graphics

- Fishbone diagram:
  - Spine = problem
  - Bones = categories; sub-bones = causes
  - “Evidence badges” on causes (count, links)
- 5 Whys:
  - Vertical chain with evidence markers and “validated” toggles

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

- Convert cause → “Why chain start”
- Attach evidence to cause nodes
- Mark cause as validated (requires evidence link)
- Generate countermeasures suggestions (AI) but require user approval

### 6.4 States

- Draft editable; Review comment-only; Approved locks conclusions (but allows actions tracking).

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

Warehouse packing errors increased.

### 7.2 Inputs (filled)

- Problem: “SKU mix-up errors in Line A increased to 4% over 2 weeks.”
- Evidence: 18 defect photos; log by shift; top defect Pareto.

### 7.3 Analysis (filled)

Fishbone top causes: Method (unclear bin labels), Machine (scanner latency), Measurement (no confirmation), People (new hires), Environment (poor lighting).

5 Whys chain (validated):

1. Why wrong SKU shipped? → Picker selected wrong bin.
2. Why selected wrong bin? → Labels look similar and bins not standardized.
3. Why labels not standardized? → No labeling standard and no audit.
4. Why no standard? → Owner not assigned; onboarding missed it.
5. Why onboarding missed? → Training checklist outdated (no bin-label module).

Root cause: missing standard + audit for bin labeling; escape point: no scan confirmation before packing.

### 7.4 Insights

1. System allowed confusion (visual standard missing).
2. Detection failure (no poka-yoke) amplified errors.

### 7.5 Initiatives derived

| Initiative title                        | Rationale         | Expected impact    | Effort | Risks      | First 2 steps                 |
| --------------------------------------- | ----------------- | ------------------ | ------ | ---------- | ----------------------------- |
| Implement bin labeling standard + audit | Remove root cause | −1.5–2.5pp defects | Low    | Adoption   | Create standard; weekly audit |
| Add scan confirmation at pack-out       | Fix escape point  | −1.0–1.5pp defects | Medium | Throughput | Pilot line A; measure CT      |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "problem": {
    "statement": "SKU mix-up errors in Line A increased to 4% over 2 weeks",
    "metric": { "name": "packing_error_rate", "baseline": 0.04, "window": "14d" },
    "impact": { "returns": 120, "costEur": 18000 }
  },
  "evidence": [{ "type": "photo", "url": "file://...", "tags": ["mixup"] }],
  "fishbone": [
    {
      "category": "Method",
      "causes": [{ "id": "c1", "text": "Bins not labeled consistently", "evidenceIds": [] }]
    }
  ],
  "whyChains": [
    {
      "id": "w1",
      "startCauseId": "c1",
      "steps": [
        { "why": "Why wrong SKU shipped?", "answer": "Wrong bin picked", "evidenceIds": ["e1"] }
      ],
      "rootCause": "No labeling standard + no audit",
      "escapePoint": "No scan confirmation"
    }
  ],
  "countermeasures": [
    {
      "title": "Bin labeling standard + audit",
      "verifyMetric": "packing_error_rate",
      "verifyWindow": "4w"
    }
  ]
}
```

### 8.2 Steps & section mapping

- `setup` → `evidence` → `fishbone` → `5whys` → `root-causes` → `actions`

### 8.3 Validation rules (DoD)

- Must have: measurable problem + ≥1 evidence + ≥1 why chain with root cause + ≥1 countermeasure with verification metric.

### 8.4 Initiative generation spec

- One initiative per countermeasure; must include `sourceCauseId`/`whyChainId` traceability.

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Never accept “human error” as root cause.
- Ask for evidence; tag statements as facts vs assumptions.
- Identify escape points and propose poka-yoke options.

### 9.2 Prompt outline

- Clarify problem statement; request examples.
- Propose fishbone categories and candidate causes.
- Guide 5 Whys with hypothesis/evidence gating.
- Propose countermeasures and verification plan.

### 9.3 Extraction schema (JSON)

```json
{
  "candidateCauses": [
    { "category": "Method|Machine|People|Material|Measurement|Environment", "cause": "string" }
  ],
  "whyChain": { "steps": [{ "why": "string", "answer": "string", "evidenceNeeded": "string" }] },
  "countermeasures": [
    { "title": "string", "type": "standard|poka_yoke|training|automation|visual_control" }
  ]
}
```

### 9.4 Self-checks

- Are we mixing multiple problems?
- Is each “why” answer testable / evidenced?
- Do countermeasures address root cause and escape point?

---

## 10. Consultant Report Specification (What goes into the final report)

- Problem statement + impact
- Evidence summary
- Fishbone diagram
- Validated 5 Whys chain(s) with root cause + escape point
- Countermeasures with verification plan
- Initiatives backlog with traceability

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
- **VO (PL)**: "Root Cause Analysis (5 Whys + Fishbone) pomaga zaplanować transformację."
- **VO (EN)**: "Root Cause Analysis (5 Whys + Fishbone) helps plan transformation."
- **On-screen text (PL)**: "Root Cause Analysis (5 Whys + Fishbone) = Plan transformacji"
- **On-screen text (EN)**: "Root Cause Analysis (5 Whys + Fishbone) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Root Cause Analysis (5 Whys + Fishbone) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Root Cause Analysis (5 Whys + Fishbone) today."
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

1. **What is the main purpose of Root Cause Analysis (5 Whys + Fishbone)?**
   A: Root Cause Analysis (5 Whys + Fishbone) helps RCA helps a team answer: \*\*“What caused this problem, and what change will prevent it from recurring....

2. **When should I use Root Cause Analysis (5 Whys + Fishbone)?**
   A: Use it - A defect/incident repeats or has high impact.

- Different teams disagree on “what caused it”.
- You need countermeasures that prevent recurrence (no....

3. **What are the key outputs?**
   A: Key outputs include Problem statement, cause tree, validated root cause(s), countermeasures, verification plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Root Cause Analysis (5 Whys + Fishbone)?**
   A: Root Cause Analysis (5 Whys + Fishbone) helps RCA helps a team answer: \*\*“What caused this problem, and what change will prevent it from recurring....

2. **When should I use Root Cause Analysis (5 Whys + Fishbone)?**
   A: Use it A defect/incident repeats or has high impact.
   Different teams disagree on “what caused it”.
   You need countermeasures that prevent recurrence (not just....

3. **What are the key outputs?**
   A: Key outputs include Problem statement, cause tree, validated root cause(s), countermeasures, verification plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Root Cause Analysis (5 Whys + Fishbone) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Root Cause Analysis (5 Whys + Fishbone) analysis?**
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

- ASQ — Cause analysis / quality tools: `https://asq.org`
- iSixSigma — 5 Whys / fishbone guides: `https://www.isixsigma.com`

---

## 14. References (Authoritative Sources)

- Ishikawa, Kaoru. _Guide to Quality Control_. Asian Productivity Organization.
- Ohno, Taiichi. _Toyota Production System: Beyond Large-Scale Production_. Productivity Press.
- American Society for Quality (ASQ) — quality tools resources: `https://asq.org`
