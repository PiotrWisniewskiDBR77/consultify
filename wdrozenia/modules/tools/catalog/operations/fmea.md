# FMEA (Failure Modes & Effects Analysis)

## Metadata

- **Tool name**: Failure Modes & Effects Analysis (FMEA)
- **Slug**: `fmea`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 2–6 hours (single process); 1–3 days (system/product); continuous updates
- **Best for**: Proactive risk prevention, prioritizing failure prevention actions, designing control plans
- **Not for**: Purely retrospective blame; very early ideation without a defined process/system
- **Primary outputs**: FMEA table, prioritized risks (RPN or AP), recommended actions, control plan inputs
- **Required inputs (minimum)**:
  - System/process scope and steps/functions
  - Known failure modes (brainstorm + history)
- **Optional inputs**:
  - Defect history, warranty/incident data, detection controls, severity criteria definitions
- **Related tools (internal)**:
  - (ops) `root-cause-5whys-fishbone.md`
  - (ops) `tpm.md`
  - (ops) `spc-control-charts.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

FMEA answers: **“What could fail, what would happen, how bad would it be, and what controls prevent or detect it?”** It turns risk thinking into a prioritized prevention action plan.

### 1.2 When to use

- You want to prevent failures proactively (new process, change, or recurring defects).
- You need to prioritize risk-reduction actions with clear rationale.
- You are building a control plan (SPC, audits, poka-yoke).

### 1.3 When NOT to use (anti-patterns)

- Filling a table as bureaucracy without actions and owners.
- Using FMEA to assign blame after an incident (use RCA first).
- Copy-pasting generic failure modes without evidence or controls.

### 1.4 What “good” looks like

- Scope and steps/functions are clear.
- Rating criteria are defined and used consistently.
- High-risk rows have prevention-first actions with verification.
- FMEA is updated after changes and incidents (living document).

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Failure mode**: how a step/component can fail.
- **Effect**: consequence to customer/process/safety.
- **Cause**: why the failure might occur.
- **Controls**: prevention and detection mechanisms.
- **Severity (S)**, **Occurrence (O)**, **Detection (D)**: ratings (often 1–10).
- **RPN**: Risk Priority Number = S × O × D (classic). Many organizations also use AIAG/VDA **Action Priority (AP)** instead of RPN.

### 2.2 Glossary

| Term               | Definition                       | Notes                 |
| ------------------ | -------------------------------- | --------------------- |
| Prevention control | Control that reduces occurrence  | poka-yoke, standard   |
| Detection control  | Control that increases detection | inspection, test      |
| RPN                | S×O×D prioritization             | Has known limitations |
| AP                 | Action Priority (AIAG/VDA)       | Modern alternative    |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input           | Description             | Example         |
| --------------- | ----------------------- | --------------- |
| Scope           | Process/system boundary | “Pack-out step” |
| Steps/functions | What the step does      | “Label & ship”  |
| Failure modes   | What can go wrong       | “Wrong label”   |

### 3.2 Optional inputs

| Input            | Description           | Example    |
| ---------------- | --------------------- | ---------- |
| Rating criteria  | Definitions for S/O/D | 1–10 scale |
| Control evidence | Current controls      | scan check |
| History          | Frequencies/defects   | 4% errors  |

### 3.3 Data quality checks

- Use consistent rating criteria (documented).
- Don’t compare RPN across different scales/teams without alignment.

---

## 4. Step-by-step method

### Step 1 — Setup

- Define scope and break into steps/functions.
- Define rating criteria (S/O/D or AP) and scale meaning.

### Step 2 — Collect facts

- Use history (defects/returns/incidents) to seed failure modes.
- Capture current controls (prevention/detection) and evidence.

### Step 3 — Structure

- For each step: list failure modes, effects, causes, controls.

### Step 4 — Analyze

- Rate S/O/D (or AP) using the defined criteria.
- Prioritize top risks (highest RPN/AP, but sanity-check).

### Step 5 — Synthesize insights

- Define prevention-first actions (design out, poka-yoke, standard work).
- Define detection improvements only where prevention is not feasible.

### Step 6 — Convert to initiatives

- Convert recommended actions into initiatives with owners, due dates, and verification method.

### Common mistakes & fixes

- **Mistake**: Ratings are opinions → **Fix**: define criteria and use evidence.
- **Mistake**: Only detection actions → **Fix**: require prevention-first options.
- **Mistake**: FMEA never updated → **Fix**: update on every change and incident.

Common mistakes: using S/O/D as opinions; focusing only on detection; never updating after changes.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable         | Description                        | Format in the app   |
| ------------------- | ---------------------------------- | ------------------- |
| FMEA table          | Full rows and ratings              | Table               |
| Risk ranking        | RPN/AP sorted list                 | Ranking view        |
| Action plan         | Recommended actions with ownership | Initiative drafts   |
| Control plan inputs | Controls/metrics to monitor        | Links to SPC/audits |

### 5.2 Definition of Done (DoD) checklist

- [ ] Scope and steps/functions defined
- [ ] Rating criteria documented
- [ ] ≥1 failure mode per critical step
- [ ] Top risks have prevention-first actions assigned
- [ ] Verification method defined for each action

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

Warehouse pack-out has customer complaints due to wrong labels and mis-shipments.

### 7.2 Inputs (filled)

- Scope: “Label shipment” step in pack-out
- History: 4% errors; main type “wrong label”
- Current controls: visual check only

### 7.3 Analysis (filled)

- Failure mode: wrong label applied
- Effect: wrong delivery → return cost → customer dissatisfaction
- Cause: bins mislabeled; manual selection; no confirmation gate
- Ratings: S=7, O=5, D=7 → RPN=245 (high)

### 7.4 Insights

1. Prevention is feasible via scan confirmation / system validation.
2. Current detection is weak and depends on individual attention.

### 7.5 Initiatives derived

| Initiative title                  | Rationale                          | Expected impact          | Effort | Risks           | First 2 steps                 |
| --------------------------------- | ---------------------------------- | ------------------------ | ------ | --------------- | ----------------------------- |
| Add scan confirmation at pack-out | Prevention + detection improvement | −2–3pp errors            | Medium | Throughput fear | Pilot 1 line; measure CT      |
| Standardize bin labeling + audit  | Reduce occurrence                  | fewer selection mistakes | Low    | Adoption        | Create standard; weekly audit |

---

## 8. Implementation spec

### 8.1 Data model (JSON)

```json
{
  "scope": "Warehouse pack-out",
  "ratingScale": { "min": 1, "max": 10, "notes": "1=low, 10=high" },
  "rows": [
    {
      "step": "Label shipment",
      "failureMode": "Wrong label",
      "effects": ["Wrong delivery", "Returns"],
      "causes": ["Bins mislabeled", "Manual selection"],
      "controls": { "prevention": ["Training"], "detection": ["Visual check"] },
      "ratings": { "severity": 7, "occurrence": 5, "detection": 7 },
      "rpn": 245,
      "recommendedActions": [
        { "title": "Add scan confirmation", "owner": "Ops", "due": "2026-03-01" }
      ]
    }
  ]
}
```

### 8.2 Steps & sections mapping

- `scope` → `rows` → `ranking` → `actions` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have rating criteria defined.
- Must have at least one row with S/O/D and at least one recommended action.
- Block approval if top risk rows have no owner/due date.

### 8.4 Initiative generation spec

- Convert actions into initiatives and include traceability: `sourceRowId`.
- Batch size default 5, max 15 (risk portfolio).

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec

### 9.1 Non-negotiable reasoning rules

- Prevention-first; detection-only is second-best.
- Require rating criteria consistency.
- Flag “copy-paste” risks and missing verification.

### 9.2 Prompt outline

- Ask for scope, steps, and defect history.
- Propose failure modes and effects.
- Suggest controls and actions with prevention priority.

### 9.3 Extraction schema (JSON)

```json
{
  "rows": [
    {
      "step": "string",
      "failureMode": "string",
      "effects": ["string"],
      "causes": ["string"],
      "ratings": { "severity": 7, "occurrence": 5, "detection": 7 },
      "recommendedActions": [{ "type": "prevention|detection", "title": "string" }]
    }
  ]
}
```

### 9.4 Self-checks

- Are ratings consistent with the criteria?
- Are top risks covered by prevention actions?
- Is verification defined?

---

## 10. Consultant Report Specification

- Scope and rating criteria
- Top 10 risks and why they matter
- Action plan (prevention/detection) with traceability
- Control plan metrics for sustained risk reduction

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
- **VO (PL)**: "Failure Modes & Effects Analysis (FMEA) pomaga zaplanować transformację."
- **VO (EN)**: "Failure Modes & Effects Analysis (FMEA) helps plan transformation."
- **On-screen text (PL)**: "Failure Modes & Effects Analysis (FMEA) = Plan transformacji"
- **On-screen text (EN)**: "Failure Modes & Effects Analysis (FMEA) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Failure Modes & Effects Analysis (FMEA) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Failure Modes & Effects Analysis (FMEA) today."
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

### TL;DR (5–8 sentences)

FMEA (Failure Mode and Effects Analysis) is an operations tool that systematically identifies potential failure modes, their effects, and causes to prioritize preventive actions. It helps reduce risk by rating severity, occurrence, and detection, then calculating Risk Priority Number (RPN) or Action Priority. Key outputs include a complete FMEA table with ratings, risk ranking, action plan with ownership, and control plan inputs. Use it when you need to proactively identify and mitigate risks before they occur, especially for critical processes or products. The tool ensures evidence-based risk assessment and creates actionable improvement plans. Success depends on thorough process knowledge, clear rating criteria, and prevention-first mindset.

### FAQ (at least 8)

1. FMEA vs RCA: when do we use each?
2. What is a failure mode vs a cause vs an effect?
3. How do we define and standardize rating criteria for S/O/D?
4. What are the limitations of RPN and when to use Action Priority?
5. Why is “prevention first” critical in FMEA?
6. How do we link FMEA actions to a control plan (SPC, audits)?
7. How often should we review and update FMEA?
8. What are common FMEA anti-patterns (copy-paste tables, no owners)?

### Checklists

- FMEA DoD checklist (section 5)
- Action quality checklist:
  - [ ] Owner and due date assigned
  - [ ] Action type specified (prevention vs detection)
  - [ ] Verification method defined
  - [ ] FMEA updated after completion

### Glossary (short)

| Term            | Definition                   | Example                   |
| --------------- | ---------------------------- | ------------------------- |
| Failure Mode    | How something fails          | "Wrong label applied"     |
| Effect          | Consequence of failure       | "Wrong delivery, returns" |
| Cause           | Why failure occurs           | "Bins mislabeled"         |
| Severity (S)    | Impact rating (1-10)         | 10 = catastrophic         |
| Occurrence (O)  | Frequency rating (1-10)      | 10 = very frequent        |
| Detection (D)   | Detection rating (1-10)      | 10 = cannot detect        |
| RPN             | Risk Priority Number (S×O×D) | Higher = more critical    |
| Action Priority | Prioritization method        | Considers severity first  |

---

## 13. Additional Resources & Learning Links

- AIAG/VDA FMEA handbook references (industry standard; book-based)

---

## 14. References

- AIAG & VDA. _FMEA Handbook_ (1st ed., 2019).
- Stamatis, D.H. _Failure Mode and Effect Analysis: FMEA from Theory to Execution_. ASQ Quality Press.
- IEC 60812. _Failure modes and effects analysis (FMEA and FMECA)_ standard.
