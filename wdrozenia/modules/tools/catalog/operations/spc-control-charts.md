# SPC Control Charts

## Metadata

- **Tool name**: Statistical Process Control (SPC) Control Charts
- **Slug**: `spc-control-charts`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 60–180 minutes setup; ongoing monitoring cadence
- **Best for**: Detecting special-cause variation, monitoring stability, preventing drift, supporting control plans
- **Not for**: Root cause analysis alone; processes with no repeatable measurement; one-time “reporting”
- **Primary outputs**: Selected chart type, control limits, signals rules, response plan, dashboard
- **Required inputs (minimum)**:
  - Metric definition and sampling plan
  - Time-ordered data (enough points)
- **Optional inputs**:
  - Stratification (shift/product), measurement system notes, spec limits
- **Related tools (internal)**:
  - (ops) `dmaic.md`
  - (ops) `process-capability-cpk.md`
  - (ops) `standard-work.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

SPC answers: **“Is the process stable, and are changes real or just noise?”** Control charts distinguish common-cause variation from special causes and define when to intervene.

### 1.2 When to use

- You need to detect drift before it becomes defects, downtime, or missed SLAs.
- You want a control plan that defines “when to react”.
- You need to separate special causes from normal variation.

### 1.3 When NOT to use (anti-patterns)

- Reacting to every up/down data point (tampering).
- Using spec limits as control limits.
- Mixing different process conditions (different machines/products) into one chart without stratification.

### 1.4 What “good” looks like

- Metric and sampling plan are defined and stable.
- Chart type matches data type and subgroup logic.
- Response plan exists and is executed when signals occur.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Common-cause variation**: natural process noise; requires systemic change to improve.
- **Special-cause variation**: unusual signal; requires investigation and corrective action.
- **Control limits**: statistically derived bounds (not spec limits).
- **Spec limits**: customer/engineering requirements (USL/LSL), separate from control limits.

Common chart types:

| Data type               | Chart             |
| ----------------------- | ----------------- |
| Continuous (individual) | I-MR              |
| Continuous (subgroups)  | X̄-R / X̄-S         |
| Defectives proportion   | p-chart           |
| Defects per unit        | u-chart / c-chart |

### 2.2 Glossary

| Term        | Definition                          | Notes                       |
| ----------- | ----------------------------------- | --------------------------- |
| Center line | The process average on the chart    | Not a target                |
| UCL/LCL     | Upper/lower control limits          | Statistical, not specs      |
| Tampering   | Over-adjusting in response to noise | Makes variation worse       |
| Run rule    | Pattern-based signal rule           | e.g., long run above center |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input       | Description               | Example            | Where in the app it can come from |
| ----------- | ------------------------- | ------------------ | --------------------------------- |
| Metric      | What is measured          | “Cycle time (sec)” | Setup                             |
| Sampling    | How often / subgroup size | hourly, n=5        | Setup                             |
| Data series | Time-ordered data         | 30 points          | Upload                            |

### 3.2 Optional inputs

| Input       | Description      | Example    |
| ----------- | ---------------- | ---------- |
| Spec limits | USL/LSL          | USL=10 sec |
| Stratifiers | Shift/product    | shift=A/B  |
| MSA notes   | data reliability | gauge R&R  |

### 3.3 Data quality checks

- Data must be time-ordered and from one stable definition.
- Minimum points: typically ≥20–30 for initial limits (rule-of-thumb).
- Validate measurement system if data is noisy or subjective.

---

## 4. Step-by-step method

### Step 1 — Setup

- Define metric, unit, and operational definition.
- Define sampling cadence and subgroup logic (if applicable).

### Step 2 — Collect facts

- Collect time-ordered data (typically ≥20–30 points minimum for initial limits).
- If measurement is subjective/noisy, add MSA notes.

### Step 3 — Structure

- Choose chart type based on data type:
  - continuous individual → I‑MR
  - continuous subgroups → X̄‑R / X̄‑S
  - defectives proportion → p-chart
  - defects per unit → u/c chart

### Step 4 — Analyze

- Compute center line and control limits.
- Apply signal rules (beyond limits, runs, trends).

### Step 5 — Synthesize insights

- Write stability conclusion:
  - “In control” (common cause) or
  - “Out of control” (special cause present).

### Step 6 — Convert to initiatives

- For recurring special causes: RCA and systemic countermeasures.
- For common-cause but poor performance: improvement project (DMAIC/Kaizen).

Common mistakes: using spec limits as control limits; recalculating too often; reacting to noise.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable         | Description                          | Format in the app   |
| ------------------- | ------------------------------------ | ------------------- |
| Control chart       | Chart with limits and signal markers | Chart + annotations |
| Signals log         | Signals with cause and action        | Table               |
| Stability statement | In control vs out of control         | Summary card        |
| Response plan       | What to do on signal                 | Checklist + owner   |

### 5.2 Definition of Done (DoD) checklist

- [ ] Chart type matches the data type and sampling plan
- [ ] Limits computed from sufficient data
- [ ] Signal rules enabled
- [ ] Response plan defined (owner + actions)

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

## 7. Worked example

### 7.1 Context

Packaging machine cycle time (sec) is drifting and causing missed output. Goal: detect drift early and respond consistently.

### 7.2 Inputs (filled)

- Metric: cycle time (sec), sampled hourly (individual values)
- Chart: I‑MR
- Data: 30 points baseline; after a tooling change, values trend up

### 7.3 Analysis (filled)

- Baseline limits computed from stable window.
- Signal: point beyond UCL + run of 8 points above center line after tooling change.
- Response: stop and check tooling alignment; log corrective action.

### 7.4 Insights

1. The drift is a special cause triggered by tooling change, not random noise.
2. A defined response plan prevents delays and avoids over-adjustment.

### 7.5 Initiatives derived

| Initiative title          | Rationale                          | Expected impact   | Effort | Risks      | First 2 steps             |
| ------------------------- | ---------------------------------- | ----------------- | ------ | ---------- | ------------------------- |
| Tooling change checklist  | Prevent special cause introduction | fewer UCL signals | Low    | Compliance | Write checklist; train    |
| Weekly SPC review routine | Sustain response discipline        | faster detection  | Low    | Fatigue    | Set cadence; assign owner |

---

## 8. Implementation spec

### 8.1 Data model (JSON)

```json
{
  "metric": { "name": "cycle_time_sec", "type": "continuous" },
  "chartType": "I-MR",
  "data": [{ "t": "2026-01-02T10:00:00Z", "value": 8.2 }],
  "limits": { "center": 8.0, "ucl": 9.4, "lcl": 6.6 },
  "signals": [{ "t": "2026-01-05T12:00:00Z", "rule": "beyond_ucl" }],
  "responsePlan": { "owner": "Shift Lead", "actions": ["Stop line", "Check tooling", "Log cause"] }
}
```

### 8.2 Steps & sections mapping

- `setup` → `data` → `chart` → `signals` → `control-plan` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have metric definition and sampling plan.
- Must have ≥20 points for initial limits (or user marks “pilot” with reason).
- Must have response plan owner and actions.

### 8.4 Initiative generation spec

- Initiatives generated from repeated signal patterns and missing response plan elements.
- Traceability: `source_type='tool'`, `tool_session_id`, `signalRule`, `signalTimestamp`.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec

### 9.1 Non-negotiable reasoning rules

- Never confuse spec limits with control limits.
- Warn against tampering (reacting to noise).
- Enforce response plan: every signal must map to an action and owner.

### 9.2 Prompt outline

- Confirm metric and sampling.
- Recommend chart type and minimum sample size.
- Explain detected signals and propose investigation checklist.
- Suggest control plan and initiative candidates for recurring causes.

### 9.3 Extraction schema (JSON)

```json
{
  "recommendedChart": { "type": "I-MR|Xbar-R|p|u|c", "why": "string" },
  "signals": [{ "t": "string", "rule": "string", "interpretation": "string" }],
  "responsePlan": { "ownerRole": "string", "actions": ["string"] }
}
```

### 9.4 Self-checks

- Is the chart type appropriate to the data?
- Is there enough data to compute limits?
- Are we recommending systemic change for common-cause issues?

---

## 10. Consultant Report Specification

- Metric definitions + sampling plan
- Chart type and limits
- Stability assessment
- Signals log with causes and corrective actions
- Control plan

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
- **VO (PL)**: "Statistical Process Control (SPC) Control Charts pomaga zaplanować transformację."
- **VO (EN)**: "Statistical Process Control (SPC) Control Charts helps plan transformation."
- **On-screen text (PL)**: "Statistical Process Control (SPC) Control Charts = Plan transformacji"
- **On-screen text (EN)**: "Statistical Process Control (SPC) Control Charts = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Statistical Process Control (SPC) Control Charts już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Statistical Process Control (SPC) Control Charts today."
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

1. **What is the main purpose of Statistical Process Control (SPC) Control Charts?**
   A: Statistical Process Control (SPC) Control Charts helps SPC answers: **“Is the process stable, and are changes real or just noise?”** Control charts disting....

2. **When should I use Statistical Process Control (SPC) Control Charts?**
   A: Use it - You need to detect drift before it becomes defects, downtime, or missed SLAs.

- You want a control plan that defines “when to react”.
- You need to ....

3. **What are the key outputs?**
   A: Key outputs include Selected chart type, control limits, signals rules, response plan, dashboard.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Statistical Process Control (SPC) Control Charts?**
   A: Statistical Process Control (SPC) Control Charts helps SPC answers: **“Is the process stable, and are changes real or just noise?”** Control charts disting....

2. **When should I use Statistical Process Control (SPC) Control Charts?**
   A: Use it You need to detect drift before it becomes defects, downtime, or missed SLAs.
   You want a control plan that defines “when to react”.
   You need to separa....

3. **What are the key outputs?**
   A: Key outputs include Selected chart type, control limits, signals rules, response plan, dashboard.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Statistical Process Control (SPC) Control Charts analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Statistical Process Control (SPC) Control Charts analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- SPC setup checklist:
  - [ ] Metric definition and sampling plan documented
  - [ ] Correct chart type selected
  - [ ] Limits computed from adequate data
  - [ ] Signal rules enabled
  - [ ] Response plan assigned (owner + actions)

### Glossary (short)

- Control limit, spec limit, common cause, special cause, run rule, stability

---

## 13. Additional Resources & Learning Links

- NIST/SEMATECH Statistical Methods Handbook (SPC): `https://www.itl.nist.gov/div898/handbook/`

---

## 14. References

- NIST/SEMATECH e-Handbook of Statistical Methods (SPC): `https://www.itl.nist.gov/div898/handbook/`
- Montgomery, Douglas C. _Introduction to Statistical Quality Control_. Wiley.
- Wheeler, Donald J. _Understanding Variation: The Key to Managing Chaos_. SPC Press.
