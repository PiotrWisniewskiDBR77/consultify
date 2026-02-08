# Total Productive Maintenance (TPM)

## Metadata

- **Tool name**: Total Productive Maintenance (TPM)
- **Slug**: `tpm`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 2–6 weeks kickoff; 3–12 months maturity build
- **Best for**: Reducing breakdowns, stabilizing equipment, improving OEE availability, building operator-maintenance routines
- **Not for**: Fixing one-off failure only; environments without assets/critical equipment
- **Primary outputs**: Critical asset list, failure modes, autonomous maintenance routines, planned maintenance plan, KPIs (MTBF/MTTR/OEE)
- **Required inputs (minimum)**:
  - Asset scope and criticality ranking
  - Breakdown history (or at least top downtime reasons)
- **Optional inputs**:
  - Spare parts usage, preventive maintenance compliance, condition monitoring signals
- **Related tools (internal)**:
  - (ops) `oee.md`
  - (ops) `fmea.md`
  - (ops) `smed.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

TPM answers: **“How do we prevent equipment losses by making maintenance a system, not a department?”** It reduces unplanned downtime and quality losses by combining operator routines, planned maintenance, and continuous improvement.

### 1.2 When to use

- Unplanned downtime is a major driver of missed output or OTIF.
- Equipment performance is unstable (micro-stops, speed losses, recurring failures).
- Maintenance is reactive and firefighting dominates.
- You want to improve OEE availability sustainably.

### 1.3 When NOT to use (anti-patterns)

- Treating TPM as “more PM tasks” without ownership, routines, and KPIs.
- Rolling out everywhere at once without focusing on critical assets.
- Expecting operators to do maintenance without training and clear boundaries.

### 1.4 What “good” looks like

- Critical assets are explicitly chosen via Pareto/criticality.
- Failure modes are known and prioritized; actions are prevention-first.
- Autonomous maintenance routines exist (daily/weekly) with escalation rules.
- MTBF improves, MTTR improves, PM compliance improves, and downtime minutes drop.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Autonomous maintenance**: operators perform routine checks, cleaning, lubrication, inspection.
- **Planned maintenance**: scheduled preventive/predictive tasks.
- **MTBF/MTTR**: reliability metrics (mean time between failures / mean time to repair).
- **Six big losses**: breakdowns, setup/adjustment, idling/minor stops, reduced speed, defects, reduced yield.

### 2.2 Glossary

| Term                        | Definition                                     | Notes                    |
| --------------------------- | ---------------------------------------------- | ------------------------ |
| Criticality                 | How important an asset is to throughput/safety | Often A/B/C classes      |
| PM compliance               | % of planned tasks completed on time           | Key leading indicator    |
| Autonomous maintenance (AM) | Operator-led routine tasks                     | Cleaning/inspection only |
| Planned maintenance         | Preventive/predictive maintenance plan         | Maintenance-led          |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input                        | Description               | Example        | Where in the app it can come from |
| ---------------------------- | ------------------------- | -------------- | --------------------------------- |
| Asset scope                  | Which assets are included | “Press line 3” | Setup                             |
| Downtime history             | Unplanned downtime events | top 10 reasons | Upload / manual                   |
| Current maintenance baseline | PM plan + compliance      | 62% compliance | Upload / manual                   |

### 3.2 Optional inputs (improves quality)

| Input                | Description           | Example           | Where in the app it can come from |
| -------------------- | --------------------- | ----------------- | --------------------------------- |
| Spare parts          | Usage + stockouts     | seal stockouts    | Notes                             |
| Condition monitoring | signals               | vibration, temp   | Integrations                      |
| Quality loss data    | defects tied to asset | scrap after stops | QA data                           |

### 3.3 Data quality checks

- Use consistent downtime reason codes and separate planned vs unplanned.
- Ensure “asset scope” matches the boundary of the KPI (avoid mixing multiple lines unless intended).

---

## 4. Step-by-step method

### Step 1 — Setup (scope + criticality)

- Select assets using downtime Pareto and criticality (throughput/safety/quality).
- Define KPI baseline window (e.g., last 8–12 weeks).

### Step 2 — Collect facts (baseline)

- Capture: downtime minutes by reason, MTBF, MTTR, PM compliance.
- Identify the top 3–5 failure modes by impact.

### Step 3 — Structure (TPM system design)

- Define:
  - autonomous maintenance routine (operator tasks),
  - planned maintenance schedule (maintenance tasks),
  - escalation rules and abnormality tagging.

### Step 4 — Analyze (failure prevention)

- Run FMEA-lite for top failure modes:
  - causes, detection/prevention controls, and actions.
- Identify leading indicators for each failure mode (oil level, vibration thresholds).

### Step 5 — Synthesize insights (standards + governance)

- Publish checklists, visual standards, and “what abnormal looks like”.
- Set cadence: daily AM checks, weekly review, monthly reliability review.

### Step 6 — Convert to initiatives

- Convert top failure modes into initiatives:
  - “Implement AM checklist v1”
  - “Add condition monitoring threshold”
  - “Improve PM compliance with scheduling changes”

### Common mistakes & fixes

- **Mistake**: “TPM = maintenance does more PM” → **Fix**: create operator routines + escalation loop.
- **Mistake**: Too many assets → **Fix**: start with top Pareto critical assets.
- **Mistake**: No measurement → **Fix**: track MTBF/MTTR, downtime minutes, compliance.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable         | Description                                   | Format in the app     |
| ------------------- | --------------------------------------------- | --------------------- |
| Critical asset list | Scope + criticality rationale                 | Table                 |
| Downtime Pareto     | Top reasons and impact                        | Chart                 |
| AM checklist        | Operator checks (daily/weekly)                | Checklist + printable |
| PM plan             | Schedule + compliance tracking                | Calendar/table        |
| Reliability KPIs    | MTBF/MTTR, downtime minutes, OEE availability | Dashboard             |
| Improvement backlog | Initiatives tied to failure modes             | Initiative drafts     |

### 5.2 Definition of Done (DoD) checklist

- [ ] Critical assets identified (Pareto/criticality)
- [ ] Baseline captured (downtime + MTBF/MTTR + compliance)
- [ ] Top failure modes mapped (FMEA-lite) with prevention actions
- [ ] AM checklist published with cadence and owner role
- [ ] Escalation rules defined (abnormality response)
- [ ] KPIs baseline + targets defined

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

Press line is the bottleneck. Availability is 82% and unplanned breakdowns drive missed output.

### 7.2 Inputs (filled)

- Scope: Press line 3
- Baseline (8 weeks): downtime 420 min/week; top reason “hydraulic leak”
- PM compliance: 62%
- MTBF: 24h; MTTR: 2.2h

### 7.3 Analysis (filled)

- Pareto: hydraulic leaks + sensor failures = 65% downtime.
- FMEA-lite: seal wear is predictable; detection currently “when it fails”.
- AM routine: daily oil level/contamination check; weekly hose inspection; tagging abnormalities.

### 7.4 Insights

1. PM compliance and early detection are leading indicators; fixing them reduces breakdowns without capex.
2. Standardized AM routine shifts maintenance from reactive to preventive.

### 7.5 Initiatives derived

| Initiative title                | Rationale                   | Expected impact     | Effort | Risks    | First 2 steps                   |
| ------------------------------- | --------------------------- | ------------------- | ------ | -------- | ------------------------------- |
| Daily AM checks with escalation | Catch leaks early           | −20–35% downtime    | Medium | Adoption | Publish checklist; train shifts |
| Seal replacement interval + kit | Prevent recurring failure   | +MTBF               | Medium | Parts    | Define interval; stock kit      |
| PM compliance governance        | Improve schedule discipline | +10–20pp compliance | Low    | Fatigue  | Set weekly review; assign owner |

---

## 8. Implementation spec

```json
{
  "assets": [{ "id": "press-3", "criticality": "A" }],
  "baseline": { "availability": 0.82, "mtbfHours": 24, "mttrHours": 2.2 },
  "topFailures": [{ "mode": "Hydraulic leak", "downtimeMin": 420 }],
  "autonomousMaintenance": {
    "cadence": "daily",
    "checks": [{ "text": "Check oil level", "threshold": ">= min mark" }]
  },
  "plannedMaintenance": { "pmCompliancePct": 62, "schedule": "weekly" }
}
```

### 8.2 Steps & sections mapping

- `scope` → `baseline` → `failure-modes` → `am-checklists` → `pm-plan` → `initiatives`

### 8.3 Validation rules (DoD)

- Must include scope and baseline window.
- Must include at least one KPI baseline (downtime minutes or MTBF/MTTR).
- Must include AM checklist cadence and escalation rule.

### 8.4 Initiative generation spec

- Generate 3–10 initiatives from:
  - top downtime Pareto reasons,
  - highest-risk failure modes,
  - missing routine/compliance gaps.
- Traceability fields: `source_type='tool'`, `tool_session_id`, `assetId`, `failureMode`.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec

### 9.1 Non-negotiable reasoning rules

- Start with Pareto and criticality—do not optimize everything at once.
- Separate planned vs unplanned downtime.
- Suggest prevention-first actions and leading indicators.

### 9.2 Prompt outline

- Ask for asset scope and downtime history.
- Generate Pareto hypotheses (top reasons) and propose AM checklist items.
- Recommend FMEA-lite for top failure modes and a governance cadence.

### 9.3 Extraction schema (JSON)

```json
{
  "criticalAssets": [{ "assetId": "string", "why": "string" }],
  "amChecklist": { "cadence": "daily", "checks": [{ "text": "string", "threshold": "string" }] },
  "pmImprovements": ["string"],
  "initiativeCandidates": [
    { "title": "string", "traceability": { "assetId": "string", "failureMode": "string" } }
  ]
}
```

### 9.4 Self-checks

- Are we focusing on the true critical assets?
- Do initiatives target the biggest downtime drivers?
- Are escalation rules defined and practical?

---

## 10. Consultant Report Specification

### 10.1 Report structure

1. Executive summary (baseline, targets, expected gains)
2. Scope and critical asset selection (why these assets)
3. Baseline reliability (downtime Pareto, MTBF/MTTR, PM compliance)
4. Failure mode prevention plan (FMEA-lite)
5. AM routines (checklists, escalation)
6. PM plan and governance cadence
7. Roadmap and initiatives backlog (traceability)

### 10.2 Required visuals

- Downtime Pareto chart
- MTBF/MTTR trend
- AM checklist (printable)

### 10.3 Quality checklist

- [ ] Scope is explicit and KPI definitions are clear
- [ ] Top failures addressed with prevention actions
- [ ] Governance cadence and ownership defined

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
- **VO (PL)**: "Total Productive Maintenance (TPM) pomaga zaplanować transformację."
- **VO (EN)**: "Total Productive Maintenance (TPM) helps plan transformation."
- **On-screen text (PL)**: "Total Productive Maintenance (TPM) = Plan transformacji"
- **On-screen text (EN)**: "Total Productive Maintenance (TPM) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Total Productive Maintenance (TPM) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Total Productive Maintenance (TPM) today."
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

1. **What is the main purpose of Total Productive Maintenance (TPM)?**
   A: Total Productive Maintenance (TPM) helps TPM answers: \*\*“How do we prevent equipment losses by making maintenance a system, not a department?....

2. **When should I use Total Productive Maintenance (TPM)?**
   A: Use it - Unplanned downtime is a major driver of missed output or OTIF.

- Equipment performance is unstable (micro-stops, speed losses, recurring failures).
  ....

3. **What are the key outputs?**
   A: Key outputs include Critical asset list, failure modes, autonomous maintenance routines, planned maintenance plan, KPIs (MTBF/MTTR/OEE).

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Total Productive Maintenance (TPM)?**
   A: Total Productive Maintenance (TPM) helps TPM answers: \*\*“How do we prevent equipment losses by making maintenance a system, not a department?....

2. **When should I use Total Productive Maintenance (TPM)?**
   A: Use it Unplanned downtime is a major driver of missed output or OTIF.
   Equipment performance is unstable (micro-stops, speed losses, recurring failures).
   Main....

3. **What are the key outputs?**
   A: Key outputs include Critical asset list, failure modes, autonomous maintenance routines, planned maintenance plan, KPIs (MTBF/MTTR/OEE).

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Total Productive Maintenance (TPM) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Total Productive Maintenance (TPM) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- TPM starter checklist:
  - [ ] Critical assets selected (Pareto)
  - [ ] Top failure modes identified
  - [ ] Operator daily checklist published
  - [ ] Escalation rules defined
  - [ ] KPI dashboard live

### Glossary (short)

- Autonomous maintenance, planned maintenance, MTBF, MTTR, six big losses, PM compliance

---

## 13. Additional Resources & Learning Links

- TPM overview and pillars (book-based references)

---

## 14. References

- Nakajima, Seiichi. _Introduction to TPM: Total Productive Maintenance_. Productivity Press.
- Wireman, Terry. _Total Productive Maintenance_. Industrial Press.
- Hansen, Robert C. _Overall Equipment Effectiveness_. Industrial Press.
