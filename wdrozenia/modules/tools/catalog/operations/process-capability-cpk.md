# Process Capability (Cp/Cpk)

## Metadata

- **Tool name**: Process Capability (Cp/Cpk)
- **Slug**: `process-capability-cpk`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 60–180 minutes (analysis); recurring quarterly/monthly reviews
- **Best for**: Quantifying how well a stable process meets specifications, prioritizing improvement, setting realistic targets
- **Not for**: Unstable processes (use SPC first); metrics without spec limits; very small sample sizes
- **Primary outputs**: Capability indices (Cp/Cpk), capability report, improvement priorities
- **Required inputs (minimum)**:
  - Specification limits (USL/LSL) and metric definition
  - Sufficient sample data from a stable process
- **Optional inputs**:
  - Stratifiers (machine/shift), measurement system notes (MSA), target Cp/Cpk
- **Related tools (internal)**:
  - (ops) `spc-control-charts.md`
  - (ops) `dmaic.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Capability analysis answers: **“Is the process capable of meeting specs, and is it centered?”** Cp measures potential capability (spread vs specs); Cpk accounts for centering (mean shift).

### 1.2 When to use

- You have valid specification limits (LSL/USL) and want to know if the process can meet them.
- The process is stable (or you have defined a stable window) and you want to quantify improvement priority.
- You need to compare machines/shifts or validate a process change.

### 1.3 When NOT to use (anti-patterns)

- Running capability on an unstable process (use SPC first).
- Using too few points or mixing different conditions in one dataset.
- Treating Cp/Cpk as “the goal” rather than a diagnostic to drive actions.

### 1.4 What “good” looks like

- Specs and metric definitions are unambiguous and agreed.
- Stability is confirmed (control chart shows in-control window).
- Results clearly state whether the issue is variation (Cp) or centering (Cpk).
- Improvement actions and control plan follow from results.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Cp** = \((USL - LSL) / 6\sigma\)
- **Cpk** = \(\min\left(\frac{USL-\mu}{3\sigma}, \frac{\mu-LSL}{3\sigma}\right)\)
- **Stable process required**: if out of control, indices are misleading.

Rule-of-thumb interpretations (context-dependent):

- Cpk < 1.0: not capable
- 1.0–1.33: marginal
- ≥1.33: capable (common industrial target)
- ≥1.67: high capability (critical processes)

### 2.2 Glossary

| Term                    | Definition                      | Notes                            |
| ----------------------- | ------------------------------- | -------------------------------- |
| LSL/USL                 | Lower/Upper Specification Limit | Customer/engineering requirement |
| Sigma (σ)               | Process standard deviation      | Must match the stable window     |
| Centering               | Mean location vs target         | Drives Cpk                       |
| Short-term vs long-term | Within vs over time variation   | Context-specific                 |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input  | Description      | Example         |
| ------ | ---------------- | --------------- |
| Metric | What is measured | “Diameter (mm)” |
| Specs  | LSL/USL          | 9.95 / 10.05    |
| Data   | Sample values    | n=50            |

### 3.2 Optional inputs

| Input          | Description         | Example        |
| -------------- | ------------------- | -------------- |
| Stratification | Compare sources     | Machine A vs B |
| MSA            | Measurement quality | gauge R&R      |
| Target         | Capability goal     | Cpk ≥ 1.33     |

### 3.3 Data quality checks

- Confirm process stability with SPC.
- Ensure measurements are independent and from comparable conditions.
- Minimum sample size: typically ≥30–50 for a first pass.

---

## 4. Step-by-step method

### Step 1 — Setup

- Define metric and specification limits (LSL/USL).
- Define the stable window and process conditions (machine/product/shift).

### Step 2 — Collect facts

- Confirm stability using SPC (or explicitly select an in-control window).
- Collect sufficient sample data from the stable window.

### Step 3 — Structure

- Decide method:
  - normal capability (common) or
  - non-normal / transformation methods if distribution is non-normal (note assumptions).

### Step 4 — Analyze

- Compute mean, sigma, Cp, Cpk.
- Optional: stratify (machine/shift/material batch) to isolate drivers.

### Step 5 — Synthesize insights

- Interpret outcomes:
  - Cp low → reduce variation (σ)
  - Cpk much lower than Cp → center the process (μ shift)

### Step 6 — Convert to initiatives

- Generate actions based on which lever matters:
  - reduce variation (standard work, equipment stability, SPC controls),
  - center process (calibration, setpoint adjustment).

### Common mistakes & fixes

- **Mistake**: No stability check → **Fix**: require SPC evidence.
- **Mistake**: Mixing conditions → **Fix**: stratify by machine/shift.
- **Mistake**: Assuming normal distribution blindly → **Fix**: document method and check residuals.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable            | Description               | Format in the app |
| ---------------------- | ------------------------- | ----------------- |
| Cp/Cpk results         | Values + assumptions      | KPI cards         |
| Spec overlay histogram | Distribution vs LSL/USL   | Chart             |
| Stratified comparison  | Machine/shift comparisons | Boxplots/table    |
| Improvement backlog    | Actions derived           | Initiative drafts |

### 5.2 Definition of Done (DoD) checklist

- [ ] Specs defined and valid (LSL/USL)
- [ ] Stability confirmed (or stable window documented)
- [ ] Sample size adequate and documented
- [ ] Cp/Cpk computed with method noted
- [ ] Actions defined (variation vs centering)

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

Machining operation produces a shaft diameter with tight tolerance. Customer rejects are rising.

### 7.2 Inputs (filled)

- Spec: 10.00mm ± 0.05mm → LSL 9.95, USL 10.05
- Stable window: 2 weeks “in control” confirmed via SPC
- Sample: n=50, mean 10.03, sigma 0.01

### 7.3 Analysis (filled)

- Cp = (0.10) / (6×0.01) = 1.67 (spread is good)
- Cpk = min((10.05-10.03)/(0.03), (10.03-9.95)/(0.03)) = min(0.67, 2.67) = 0.67
  Interpretation: process is not centered (risk of USL violations).

### 7.4 Insights

1. Variation is acceptable; the main lever is centering (mean shift).
2. Calibration/setpoint drift is likely; verify offsets and tooling.

### 7.5 Initiatives derived

| Initiative title              | Rationale                     | Expected impact   | Effort | Risks           | First 2 steps                       |
| ----------------------------- | ----------------------------- | ----------------- | ------ | --------------- | ----------------------------------- |
| Re-center machine setpoint    | Fix mean shift to improve Cpk | Cpk → ≥1.33       | Low    | Over-correction | Adjust offset; validate on 20 parts |
| Add SPC gate after changeover | Prevent drift recurrence      | fewer out-of-spec | Medium | Compliance      | Define rule; train                  |

---

## 8. Implementation spec

### 8.1 Data model (JSON)

```json
{
  "metric": { "name": "diameter_mm" },
  "spec": { "lsl": 9.95, "usl": 10.05, "targetCpk": 1.33 },
  "data": [10.02, 10.03, 10.01],
  "results": { "mean": 10.03, "sigma": 0.01, "cp": 1.67, "cpk": 0.67 },
  "notes": { "stabilityConfirmed": true, "distributionAssumption": "normal" }
}
```

### 8.2 Steps & sections mapping

- `setup` → `data` → `stability` → `results` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have LSL and USL, and a metric definition.
- Must have stability confirmation (or an explicit stable window selection + reason).
- Must have minimum sample size (default 30; warn if lower).

### 8.4 Initiative generation spec

- Generate initiatives based on root lever:
  - **Cp low** → variation reduction initiatives,
  - **Cpk low with Cp ok** → centering/calibration initiatives.
- Traceability: `source_type='tool'`, `tool_session_id`, `finding='cp_low|cpk_low'`.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec

### 9.1 Non-negotiable reasoning rules

- Capability requires stability (SPC gate).
- Distinguish centering vs variation and recommend actions accordingly.
- Document assumptions (distribution, window).

### 9.2 Prompt outline

- Confirm metric + specs + stable window.
- Recommend sample size and stratifiers.
- Compute and interpret Cp/Cpk and propose actions.

### 9.3 Extraction schema (JSON)

```json
{
  "finding": { "cp": 1.67, "cpk": 0.67, "issue": "centering|variation|both" },
  "recommendedActions": [{ "type": "center|reduce_variation|control", "title": "string" }],
  "assumptions": ["string"]
}
```

### 9.4 Self-checks

- Is the process stable?
- Are specs and units correct?
- Are actions consistent with the lever (centering vs variation)?

---

## 10. Consultant Report Specification

- Specs, data window, stability evidence
- Cp/Cpk results and interpretation (variation vs centering)
- Improvement roadmap (center, reduce sigma, control plan)

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
- **VO (PL)**: "Process Capability (Cp/Cpk) pomaga zaplanować transformację."
- **VO (EN)**: "Process Capability (Cp/Cpk) helps plan transformation."
- **On-screen text (PL)**: "Process Capability (Cp/Cpk) = Plan transformacji"
- **On-screen text (EN)**: "Process Capability (Cp/Cpk) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Process Capability (Cp/Cpk) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Process Capability (Cp/Cpk) today."
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

1. **What is the main purpose of Process Capability (Cp/Cpk)?**
   A: Process Capability (Cp/Cpk) helps Capability analysis answers: **“Is the process capable of meeting specs, and is it centered?”** Cp m....

2. **When should I use Process Capability (Cp/Cpk)?**
   A: Use it - You have valid specification limits (LSL/USL) and want to know if the process can meet them.

- The process is stable (or you have defined a stable w....

3. **What are the key outputs?**
   A: Key outputs include Capability indices (Cp/Cpk), capability report, improvement priorities.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Process Capability (Cp/Cpk)?**
   A: Process Capability (Cp/Cpk) helps Capability analysis answers: **“Is the process capable of meeting specs, and is it centered?”** Cp m....

2. **When should I use Process Capability (Cp/Cpk)?**
   A: Use it You have valid specification limits (LSL/USL) and want to know if the process can meet them.
   The process is stable (or you have defined a stable windo....

3. **What are the key outputs?**
   A: Key outputs include Capability indices (Cp/Cpk), capability report, improvement priorities.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Process Capability (Cp/Cpk) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Process Capability (Cp/Cpk) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- Capability analysis checklist:
  - [ ] LSL/USL defined and valid
  - [ ] Stable window confirmed
  - [ ] Sample size documented
  - [ ] Cp/Cpk computed and interpreted
  - [ ] Improvement actions defined

### Glossary (short)

- Cp, Cpk, sigma, stability, LSL/USL, centering, variation

---

## 13. Additional Resources & Learning Links

- NIST/SEMATECH handbook (process capability): `https://www.itl.nist.gov/div898/handbook/`

---

## 14. References

- NIST/SEMATECH e-Handbook of Statistical Methods: `https://www.itl.nist.gov/div898/handbook/`
- Montgomery, Douglas C. _Introduction to Statistical Quality Control_. Wiley.
- Wheeler, Donald J. _Understanding Variation_. SPC Press.
