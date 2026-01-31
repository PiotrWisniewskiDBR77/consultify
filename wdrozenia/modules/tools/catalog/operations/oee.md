# Overall Equipment Effectiveness (OEE)

## Metadata

- **Tool name**: Overall Equipment Effectiveness (OEE)
- **Slug**: `oee`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 60–120 minutes setup; ongoing daily/weekly monitoring
- **Best for**: Improving equipment productivity, diagnosing availability/performance/quality losses, prioritizing maintenance and process improvements
- **Not for**: Pure service processes without “equipment” analog (unless mapped to “system uptime/performance/quality”); one-off incidents
- **Primary outputs**: OEE baseline, loss tree, prioritized loss-reduction backlog, target plan
- **Required inputs (minimum)**:
  - Planned production time
  - Good count vs total count
  - Ideal cycle time or target rate
  - Downtime events (or at least total downtime)
- **Optional inputs**:
  - Reason codes for downtime and speed losses, scrap categories, micro-stops, changeovers
- **Related tools (internal)**:
  - (ops) `tpm.md`
  - (ops) `smed.md`
  - (ops) `spc-control-charts.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

OEE answers: **“Where are we losing equipment effectiveness—availability, speed, or quality—and what should we fix first?”** It provides a consistent KPI and a loss breakdown that can be converted into an actionable improvement backlog.

### 1.2 When to use

- You have chronic downtime, speed losses, or scrap/rework and need a consistent lens.
- You want to prioritize maintenance vs process vs quality work using data.
- You need a daily/weekly operating routine that links losses to actions.

### 1.3 When NOT to use (anti-patterns)

- Reporting OEE without a loss breakdown and action follow-up.
- Gaming inputs (ideal cycle time, planned time definitions) to “improve” the number.
- Using OEE for non-repeatable processes without defining a comparable “unit”.

### 1.4 What “good” looks like

- Definitions are explicit (planned time, downtime, ideal rate, good count).
- Top losses are coded and Pareto-ranked.
- Initiatives are linked to the highest-impact losses with owners and timelines.

---

## 2. Concept & key definitions

OEE is defined as:

\[
\text{OEE} = \text{Availability} \times \text{Performance} \times \text{Quality}
\]

- **Availability** = Operating Time / Planned Production Time
- **Performance** = (Ideal Cycle Time × Total Count) / Operating Time
- **Quality** = Good Count / Total Count

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input         | Description    | Example         | Where in the app it can come from |
| ------------- | -------------- | --------------- | --------------------------------- |
| Planned time  | Scheduled time | 480 min/day     | Manual / integration              |
| Downtime      | Total downtime | 60 min          | Logs                              |
| Ideal cycle   | Target rate    | 1.2 sec/unit    | Engineering                       |
| Output counts | Good/total     | 22,000 / 24,000 | MES export                        |

### 3.2 Optional inputs

| Input            | Description       | Example               |
| ---------------- | ----------------- | --------------------- |
| Downtime reasons | Categorize losses | changeover, breakdown |
| Scrap reasons    | Quality loss tree | scratches, misfill    |
| Micro-stops      | Short stops       | < 5 min events        |

### 3.3 Data quality checks

- Ensure ideal cycle time is realistic and stable.
- Use consistent definitions for downtime vs planned stops.

---

## 4. Step-by-step method (How the user works with it)

1. Define scope: equipment line, period, shift rules.
2. Capture baseline inputs and compute Availability/Performance/Quality.
3. Build a loss tree:
   - Availability losses: breakdowns, changeovers, waiting
   - Performance losses: minor stops, reduced speed
   - Quality losses: scrap, rework
4. Pareto top losses and quantify impact on OEE.
5. Convert top losses into initiatives (TPM, SMED, process improvements).
6. Set targets and monitoring cadence (daily OEE, weekly loss review).

Common mistakes: gaming ideal cycle time; mixing planned stops; ignoring micro-stops.

---

## 5. Outputs & Definition of Done

- Outputs: OEE dashboard, loss Pareto, backlog, targets.
- DoD:
  - [ ] OEE computed with clear definitions
  - [ ] Top 5 losses identified with quantified impact
  - [ ] ≥3 initiatives created with owners and timeline

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

Packaging line produces single SKU family. Leadership believes “we need more machines”, but downtime and speed losses are suspected. Goal: increase OEE and throughput without major capex.

### 7.2 Inputs (filled)

Daily baseline (one shift):

- Planned production time: 480 min
- Downtime: 60 min (breakdowns 35, changeovers 25)
- Operating time: 420 min
- Ideal cycle time: 1.0 sec/unit
- Total count: 24,000 units
- Good count: 22,000 units

### 7.3 Analysis (filled)

- Availability = 420 / 480 = 0.875
- Performance = (1.0 × 24,000 sec) / (420 × 60 sec) = 24,000 / 25,200 = 0.952
- Quality = 22,000 / 24,000 = 0.917
- OEE = 0.875 × 0.952 × 0.917 ≈ 0.764

Loss notes:

- Biggest availability loss: breakdown minutes (35) → TPM focus
- Biggest setup loss: changeovers (25) → SMED focus
- Quality loss: scrap 2,000 units (8.3%) → SPC + RCA focus

### 7.4 Insights

1. Availability and quality dominate losses; adding capacity would hide, not solve, the constraints.
2. Changeovers are material (25 minutes) and are a high-ROI SMED target.
3. Scrap rate suggests instability—SPC needed before capability targets.

### 7.5 Initiatives derived

| Initiative title                  | Rationale                 | Expected impact     | Effort | Risks         | First 2 steps                           |
| --------------------------------- | ------------------------- | ------------------- | ------ | ------------- | --------------------------------------- |
| TPM daily checks + failure Pareto | Reduce breakdown downtime | +3–6pp availability | Medium | Adoption      | Build checklist; pilot 2 weeks          |
| SMED changeover kaizen            | Reduce setup loss         | +2–4pp availability | Medium | Quality drift | Record setup; convert internal→external |
| SPC chart + top scrap RCA         | Stabilize quality losses  | +2–5pp quality      | Medium | Data issues   | Define sampling; run chart 4 weeks      |

---

## 8. Implementation spec

```json
{
  "scope": { "asset": "Line-3", "period": "2026-01", "shiftModel": "2x8h" },
  "inputs": {
    "plannedMinutes": 480,
    "downtimeMinutes": 60,
    "idealCycleTimeSec": 1.0,
    "totalCount": 24000,
    "goodCount": 22000
  },
  "computed": { "availability": 0.875, "performance": 0.952, "quality": 0.917, "oee": 0.764 },
  "losses": [{ "type": "availability", "reason": "changeover", "minutes": 25 }]
}
```

### 8.2 Steps & sections mapping

- `setup` → `data` → `compute` → `loss-tree` → `backlog`

### 8.3 Validation rules (DoD)

- Must have planned time, downtime, total count, good count, and ideal cycle time/rate.
- Must have at least one loss category with minutes/counts (or explicitly “unknown” with data plan).
- Block approval if definitions are missing (planned vs unplanned downtime).

### 8.4 Initiative generation spec

- Generate 3–7 initiatives maximum from:
  - top availability losses (TPM),
  - top setup losses (SMED),
  - top quality losses (SPC/RCA).
- Traceability fields: `source_type='tool'`, `tool_session_id`, `lossCategory`, `lossReason`.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec

- Validate units; flag implausible results and request correction.
- Suggest loss coding schema and prioritization.
- Recommend linked tools (TPM for breakdowns, SMED for changeovers, SPC for quality).

---

## 10. Consultant Report Specification

- OEE baseline (A/P/Q) and definitions
- Loss breakdown and Pareto
- Root-cause hypotheses for top losses
- Roadmap of initiatives and expected OEE gain

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
- **VO (PL)**: "Overall Equipment Effectiveness (OEE) pomaga zaplanować transformację."
- **VO (EN)**: "Overall Equipment Effectiveness (OEE) helps plan transformation."
- **On-screen text (PL)**: "Overall Equipment Effectiveness (OEE) = Plan transformacji"
- **On-screen text (EN)**: "Overall Equipment Effectiveness (OEE) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Overall Equipment Effectiveness (OEE) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Overall Equipment Effectiveness (OEE) today."
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

1. **What is the main purpose of Overall Equipment Effectiveness (OEE)?**
   A: Overall Equipment Effectiveness (OEE) helps OEE answers: \*\*“Where are we losing equipment effectiveness—availability, speed, or quality—and what....

2. **When should I use Overall Equipment Effectiveness (OEE)?**
   A: Use it - You have chronic downtime, speed losses, or scrap/rework and need a consistent lens.

- You want to prioritize maintenance vs process vs quality work....

3. **What are the key outputs?**
   A: Key outputs include OEE baseline, loss tree, prioritized loss-reduction backlog, target plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Overall Equipment Effectiveness (OEE)?**
   A: Overall Equipment Effectiveness (OEE) helps OEE answers: \*\*“Where are we losing equipment effectiveness—availability, speed, or quality—and what....

2. **When should I use Overall Equipment Effectiveness (OEE)?**
   A: Use it You have chronic downtime, speed losses, or scrap/rework and need a consistent lens.
   You want to prioritize maintenance vs process vs quality work usi....

3. **What are the key outputs?**
   A: Key outputs include OEE baseline, loss tree, prioritized loss-reduction backlog, target plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Overall Equipment Effectiveness (OEE) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Overall Equipment Effectiveness (OEE) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- OEE data checklist:
  - [ ] Planned time defined
  - [ ] Downtime captured with reason codes
  - [ ] Ideal cycle time/rate validated
  - [ ] Good vs total counts reliable

### Glossary (short)

- Availability, Performance, Quality, loss tree, micro-stop, ideal cycle time

---

## 13. Additional Resources & Learning Links

- Vorne Industries (OEE basics and examples): `https://www.oee.com`

---

## 14. References

- Nakajima, Seiichi. _Introduction to TPM: Total Productive Maintenance_. Productivity Press.
- Vorne Industries — OEE definition and loss categories: `https://www.oee.com`
- Hansen, Robert C. _Overall Equipment Effectiveness_. Industrial Press.
