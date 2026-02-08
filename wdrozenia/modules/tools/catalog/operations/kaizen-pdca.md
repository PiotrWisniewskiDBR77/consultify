# Kaizen / PDCA

## Metadata

- **Tool name**: Kaizen / PDCA
- **Slug**: `kaizen-pdca`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 30–90 minutes (single PDCA); 1–5 days (kaizen event); ongoing cycles
- **Best for**: Rapid continuous improvement, small-to-medium problems, building habits and learning loops
- **Not for**: Large cross-functional redesign without governance; issues requiring heavy statistical analysis (use DMAIC)
- **Primary outputs**: PDCA A3-lite, experiment plan, before/after results, standardized new method
- **Required inputs (minimum)**:
  - Problem statement + baseline observation
  - Target condition
- **Optional inputs**:
  - Process map, time data, defect counts, customer impact
- **Related tools (internal)**:
  - (ops) `dmaic.md`
  - (ops) `standard-work.md`
  - (ops) `root-cause-5whys-fishbone.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

PDCA (Plan–Do–Check–Act) is a learning loop to answer: **“What small change can we try next, and did it work?”** Kaizen is the cultural and practical system of continuous improvement powered by repeated PDCA cycles.

### 1.2 When to use

- You need quick improvements without heavy project overhead.
- Problems are local and testable in days/weeks.
- You want to build team capability and ownership.

### 1.3 When NOT to use (anti-patterns)

- You need enterprise-wide redesign and multi-stream governance.
- Root cause is unclear and requires deeper data validation (DMAIC).
- The team is unwilling to measure outcomes.

### 1.4 What “good” looks like

- Each cycle has a clear hypothesis and measurable success criteria.
- Experiments are timeboxed and low-risk.
- Gains are standardized (standard work) and monitored.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Plan**: define the problem, root cause hypothesis, and experiment.
- **Do**: run the experiment (pilot).
- **Check**: compare results to baseline; learn.
- **Act**: standardize if successful; adjust if not.

### 2.2 Glossary

| Term             | Definition                  | Notes                     |
| ---------------- | --------------------------- | ------------------------- |
| Target condition | Desired near-term state     | Not “perfect”, but better |
| Experiment       | Small test of change        | Designed to learn fast    |
| Standardize      | Make the new method default | SOP, training, controls   |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input    | Description   | Example               | Where in the app it can come from |
| -------- | ------------- | --------------------- | --------------------------------- |
| Problem  | Current pain  | “Packing errors 4%”   | Setup                             |
| Baseline | Current level | 4% error over 2 weeks | Metrics                           |
| Target   | Desired level | “<2% in 4 weeks”      | Metrics                           |

### 3.2 Optional inputs (improves quality)

| Input            | Description | Example           | Where in the app it can come from |
| ---------------- | ----------- | ----------------- | --------------------------------- |
| Root cause ideas | Hypotheses  | “Label confusion” | RCA link                          |
| Constraints      | Limits      | “No new hardware” | Notes                             |

### 3.3 Data quality checks

- Baseline period is representative; avoid one-off anomalies.
- Target is realistic and time-bound.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Plan: define the target condition and hypothesis

- Write hypothesis: “If we change X, then metric Y will improve because Z.”
- Define success criteria and measurement method.

### Step 2 — Plan: design the experiment (small + safe)

- Who/where/when; duration; what will be changed.
- Define rollback plan.

### Step 3 — Do: run the experiment

- Collect observations and any issues.

### Step 4 — Check: measure results vs baseline

- Compare before/after; note side effects.

### Step 5 — Act: standardize or iterate

- If successful: update standard work, train, add visual control.
- If not: adjust hypothesis and run next PDCA.

### Common mistakes & fixes

- **Mistake**: “Do” without baseline → **Fix**: measure first.
- **Mistake**: Big-bang changes → **Fix**: pilot one area/team.
- **Mistake**: No standardization → **Fix**: convert to standard work + monitoring.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable     | Description            | Format in the app     |
| --------------- | ---------------------- | --------------------- |
| PDCA record     | Plan/Do/Check/Act      | Stepper + notes       |
| Experiment log  | What changed + results | Table                 |
| Standard update | New SOP/standard       | Link to Standard Work |
| Initiative      | Scaled improvement     | Initiative draft      |

### 5.2 Definition of Done (DoD) checklist

- [ ] Baseline defined and measured
- [ ] Target condition defined (time + metric)
- [ ] Experiment is timeboxed and safe
- [ ] Results measured and documented
- [ ] Decision made (standardize vs iterate)

---

## 6. UI / Graphic specification

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

**Workspace (left column, 65% width):**

- Setup and configuration
- Main analysis workspace
- Results visualization

**Control Panel (right column, 35% width, sticky):**

- Status badge (Draft/In Review/Approved)
- DoD checklist (expandable)
- Action buttons: Review, Approve, Export PDF, Generate Initiatives
- Session metadata (created date, last updated, owner)

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

### 6.3 Interactions

**General interactions:**

- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

**Specific interactions:**

- Add/edit/delete items with confirmation dialogs
- Bulk actions: select multiple items for batch operations
- Context menus: right-click for additional options
- Tooltips: hover over elements for additional information

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

---

## 7. Worked example (End-to-end)

### 7.1 Context

Packing errors cause returns and rework; 4% error rate.

### 7.2 Inputs (filled)

- Baseline: 4.0% (2 weeks), target: <2.0% in 4 weeks
- Hypothesis: “If we add a two-step barcode confirmation, errors will halve.”

### 7.3 Analysis (filled)

- Pilot in one packing line for 1 week: errors drop to 1.8% with minimal time increase.

### 7.4 Insights

1. Biggest error class was SKU mix-ups; confirmation step prevented it.
2. Training + UI prompts matter more than extra staffing.

### 7.5 Initiatives derived

| Initiative title              | Rationale       | Expected impact | Effort | Risks      | First 2 steps     |
| ----------------------------- | --------------- | --------------- | ------ | ---------- | ----------------- |
| Roll out barcode confirmation | Proven in pilot | −2pp errors     | Medium | Resistance | Update SOP; train |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "problem": {
    "statement": "Packing errors 4%",
    "baseline": { "value": 0.04, "window": "2 weeks" }
  },
  "target": { "value": 0.02, "deadline": "2026-03-01" },
  "hypothesis": "If we add barcode confirmation, errors will halve because it prevents SKU mix-ups.",
  "experiment": { "scope": "Line A", "durationDays": 7, "measures": ["error_rate", "cycle_time"] },
  "results": { "errorRate": 0.018, "notes": "No major throughput loss" },
  "decision": { "action": "standardize", "standardWorkLink": "standard-work:pack-order-v2" },
  "initiativeDrafts": [
    {
      "title": "Roll out barcode confirmation",
      "rationale": "Validated PDCA experiment reduced errors from 4.0% to 1.8%",
      "metrics": ["packing_error_rate", "cycle_time_sec"],
      "traceability": { "source_type": "tool", "tool": "kaizen-pdca", "experimentId": "exp-1" }
    }
  ]
}
```

### 8.2 Steps & section mapping

- `setup` → `plan` → `do` → `check` → `act` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have baseline (value + window) and target (value + date).
- Must have hypothesis in “If X then Y because Z” form.
- Must have experiment scope + duration + measures.
- Must have results filled (at least the primary metric).
- Must have a decision: `standardize` or `iterate`, with notes.

### 8.4 Initiative generation spec

- Default: generate 1–5 initiatives from:
  - validated experiments (standardize),
  - or unresolved obstacles (iterate).
- Required fields: title, rationale, metric(s), owner, firstSteps, traceability (experimentId).

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Never accept “we tried it and it felt better” without measurement.
- Prefer smallest safe experiment that can produce learning quickly.
- Separate _hypothesis_ vs _result_ vs _decision_.
- If the proposed experiment is high risk, require rollback plan and limited scope.

### 9.2 Prompt outline

- Setup: restate the problem as a measurable statement; confirm baseline and target.
- Plan: generate 2–4 experiment hypotheses; recommend one by impact/risk/time.
- Do: provide execution checklist and data collection plan.
- Check: interpret results with before/after and note confounders.
- Act: propose standardization steps (SOP/training/audit) or next iteration.

### 9.3 Extraction schema (JSON)

```json
{
  "hypotheses": [
    {
      "ifChange": "string",
      "thenMetric": "string",
      "because": "string",
      "successCriteria": "string",
      "riskLevel": "low|medium|high"
    }
  ],
  "experimentPlan": {
    "scope": "string",
    "durationDays": 7,
    "measures": ["string"],
    "rollbackPlan": "string"
  },
  "standardizationSteps": ["string"]
}
```

### 9.4 Self-checks

- Is baseline measured with a defined window?
- Are success criteria measurable and time-bound?
- Does the recommendation include standardization (if successful)?

---

## 10. Consultant Report Specification (What goes into the final report)

- Problem + baseline + target
- PDCA cycles summary (what tried, what worked)
- Standard changes and control measures
- Initiative backlog

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
- **VO (PL)**: "Kaizen / PDCA pomaga zaplanować transformację."
- **VO (EN)**: "Kaizen / PDCA helps plan transformation."
- **On-screen text (PL)**: "Kaizen / PDCA = Plan transformacji"
- **On-screen text (EN)**: "Kaizen / PDCA = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Kaizen / PDCA już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Kaizen / PDCA today."
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

1. **What is the main purpose of Kaizen / PDCA?**
   A: Kaizen / PDCA helps PDCA (Plan–Do–Check–Act) is a learning loop to answer: \*\*“What small change can we try next, and did....

2. **When should I use Kaizen / PDCA?**
   A: Use it - You need quick improvements without heavy project overhead.

- Problems are local and testable in days/weeks.
- You want to build team capability and....

3. **What are the key outputs?**
   A: Key outputs include PDCA A3-lite, experiment plan, before/after results, standardized new method.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Kaizen / PDCA?**
   A: Kaizen / PDCA helps PDCA (Plan–Do–Check–Act) is a learning loop to answer: \*\*“What small change can we try next, and did....

2. **When should I use Kaizen / PDCA?**
   A: Use it You need quick improvements without heavy project overhead.
   Problems are local and testable in days/weeks.
   You want to build team capability and owner....

3. **What are the key outputs?**
   A: Key outputs include PDCA A3-lite, experiment plan, before/after results, standardized new method.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Kaizen / PDCA analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Kaizen / PDCA analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- DoD checklist (section 5)
- PDCA experiment checklist:
  - [ ] Hypothesis written (If–Then–Because)
  - [ ] Baseline window defined
  - [ ] Success criteria defined
  - [ ] Scope/timebox and rollback plan
  - [ ] Results captured and decision made

### Glossary (short)

- Baseline, target condition, hypothesis, experiment, standard work, confounder, leading indicator

---

## 13. Additional Resources & Learning Links

- ASQ PDCA overview: `https://asq.org`
- IHI Model for Improvement (PDSA): `https://www.ihi.org`

---

## 14. References (Authoritative Sources)

- Deming, W. Edwards. _Out of the Crisis_. MIT Press.
- Institute for Healthcare Improvement — PDSA / Model for Improvement resources: `https://www.ihi.org`
- American Society for Quality — PDCA resources: `https://asq.org`
