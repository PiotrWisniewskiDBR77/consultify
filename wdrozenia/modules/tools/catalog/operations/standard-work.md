# Standard Work

## Metadata

- **Tool name**: Standard Work
- **Slug**: `standard-work`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 60–180 minutes per standard; continuous updates
- **Best for**: Stabilizing quality and throughput, training, reducing variation, enabling improvement
- **Not for**: One-off creative tasks; environments where work changes every hour without patterns
- **Primary outputs**: Standard Work Sheet, work sequence, standard WIP, quality checkpoints, training checklist
- **Required inputs (minimum)**:
  - Task/process to standardize + scope
  - Observed current best method (gemba)
- **Optional inputs**:
  - Time observations, defects/rework, safety risks, takt demand
- **Related tools (internal)**:
  - (ops) `kaizen-pdca.md`
  - (ops) `5s.md`
  - (ops) `spc-control-charts.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Standard Work answers: **“What is the best known method today, and how do we make it repeatable?”** It enables consistent outcomes, faster training, and a stable baseline for continuous improvement.

### 1.2 When to use

- A task outcome varies by person/shift (“it depends who is working”).
- Defects/rework occur because steps are performed differently.
- You need faster onboarding and skill transfer.
- You want to improve flow, but work is not stable enough to optimize.

### 1.3 When NOT to use (anti-patterns)

- The task is purely creative and not repeatable.
- The process changes daily with no stable pattern (first define process family/scope).
- You intend to “standardize” without frontline input (will not be adopted).

### 1.4 What “good” looks like

- Steps are **observable and unambiguous** (verbs, clear boundaries).
- Critical quality & safety points are explicit (what to check, how, and when).
- Standard WIP and materials/tools are defined (point-of-use).
- A simple audit routine exists and is actually used.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Standard**: the current best known method (not permanent; improves via PDCA).
- **Work sequence**: the order of tasks that produces the desired outcome.
- **Standard WIP**: minimal WIP required to keep flow (prevents starvation and overload).
- **Quality points**: checks that prevent defects at the source (built-in quality).
- **Takt / expected pace**: how fast work must be completed to meet demand (if applicable).

### 2.2 Glossary

| Term          | Definition                   | Notes                                                 |
| ------------- | ---------------------------- | ----------------------------------------------------- |
| SOP           | Standard Operating Procedure | Often longer; Standard Work is “at the point of work” |
| Quality point | A check that prevents escape | e.g., scan confirmation                               |
| Standard WIP  | Minimum WIP needed for flow  | Often 0–small in services                             |
| Audit         | Routine check of adherence   | Should be blame-free                                  |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input               | Description                           | Example                                  | Where in the app it can come from |
| ------------------- | ------------------------------------- | ---------------------------------------- | --------------------------------- |
| Task scope          | What task is standardized (start/end) | “Pack one customer order”                | Tool setup                        |
| Output definition   | What “done” means                     | “Order packed, labeled, scanned, staged” | Tool setup                        |
| Current best method | Observed best-practice sequence       | “Shift B method”                         | Gemba Walk notes                  |

### 3.2 Optional inputs (improves quality)

| Input        | Description                 | Example              | Where in the app it can come from |
| ------------ | --------------------------- | -------------------- | --------------------------------- |
| Timing       | Step times (median + range) | “Scan step 8–15s”    | Manual / CSV                      |
| Defect data  | Top error types             | “SKU mix-up 60%”     | RCA / data upload                 |
| Safety risks | hazards & controls          | “Knife handling PPE” | Notes                             |
| Demand pace  | takt / expected pace        | “1 order / 9 min”    | KPI panel                         |

### 3.3 Data quality checks

- Ensure the scope start/end is observable (no vague “process completed”).
- Ensure step timing uses a representative window (avoid one-off).
- If multiple variants exist, create separate standards by variant or add branching rules.

---

## 4. Step-by-step method

### Step 1 — Setup

- Define the task boundaries (start/end) and “Definition of Done”.
- Identify variants (e.g., fragile vs standard orders).

### Step 2 — Collect facts (gemba)

- Observe at least 3–5 cycles across shifts (or record video).
- Capture tools, layout, handoffs, and rework loops.

### Step 3 — Structure (write the standard)

- Convert the best known method into a step sequence.
- Use “one step = one observable action”.
- Add branching rules for variants (if any).

### Step 4 — Analyze (stability + risk points)

- Identify:
  - critical quality points (mistake-proofing opportunities),
  - safety points,
  - time losses from searching/motion.
- Define standard WIP and point-of-use tools/materials.

### Step 5 — Synthesize insights (make it usable)

- Create the Standard Work Sheet layout and attach visuals:
  - standard photo(s),
  - label examples,
  - “good vs bad” examples.

### Step 6 — Convert to initiatives

- Convert gaps into initiatives (examples):
  - “Add scan confirmation to prevent SKU mix-ups”
  - “Create shadow board for packing tools”
  - “Update training checklist and certification”

### Common mistakes & fixes

- **Mistake**: Steps are ambiguous (“handle item carefully”) → **Fix**: specify observable action and check.
- **Mistake**: Standard is written by management only → **Fix**: co-create with operators and test.
- **Mistake**: No audit → **Fix**: 2-minute daily checklist + weekly review.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable         | Description                             | Format in the app             |
| ------------------- | --------------------------------------- | ----------------------------- |
| Standard Work Sheet | Steps, timing (optional), tools, WIP    | Table + printable             |
| Quality checkpoints | Built-in checks and acceptance criteria | Inline “quality point” badges |
| Training checklist  | Onboarding steps and skill verification | Checklist                     |
| Audit routine       | Cadence and scoring                     | Audit checklist + trend       |

### 5.2 Definition of Done (DoD) checklist

- [ ] Scope and DoD defined (start/end, acceptance criteria)
- [ ] Steps are unambiguous and observable
- [ ] Quality points defined (what/when/how to check)
- [ ] Tools/materials and point-of-use locations defined
- [ ] Training checklist created and assigned to a role
- [ ] Audit cadence and owner defined (daily/weekly)

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

E-commerce warehouse, packing station. Problem: packing errors (SKU mix-ups) at 4.0% and long onboarding (2 weeks to reach target quality).

### 7.2 Inputs (filled)

- Task: “Pack one customer order”
- Definition of Done: correct items packed, label applied, scan confirmation passed, order staged for dispatch
- Demand pace: 250 orders/week; target pace 1 order / 9 minutes (for the constrained packing team)

### 7.3 Analysis (filled)

Standard Work Sheet (excerpt):

1. Verify tote ID on screen (quality point)
2. Pick item from tote and scan SKU (quality point)
3. Compare scan to order list; if mismatch → stop and escalate (quality point)
4. Pack with standard filler amount (visual guide)
5. Print label and place in marked zone
6. Scan label and confirm shipment
7. Stage order in lane by carrier (standard WIP: max 10 orders per lane)

### 7.4 Insights

1. The biggest defect driver is missing scan confirmation and unclear escalation rules.
2. Visual standards (label zone, filler guide) reduce rework and training time.
3. Standard WIP prevents congestion and lost packages at staging.

### 7.5 Initiatives derived

| Initiative title                         | Rationale                     | Expected impact    | Effort | Risks           | First 2 steps                        |
| ---------------------------------------- | ----------------------------- | ------------------ | ------ | --------------- | ------------------------------------ |
| Add scan confirmation + hard stop        | Prevent SKU mix-ups at source | −1.5–2.5pp defects | Medium | Throughput fear | Pilot one station; measure CT        |
| Create packing shadow board + label zone | Reduce searching/motion       | −30–60s per order  | Low    | Adoption        | Design layout; deploy 1 station      |
| Training certification checklist         | Faster onboarding             | −30–50% ramp time  | Low    | Compliance      | Write checklist; supervisor sign-off |

---

## 8. Implementation spec

### 8.1 Data model (JSON)

```json
{
  "setup": {
    "taskName": "Pack one customer order",
    "scopeStart": "tote_received",
    "scopeEnd": "order_staged",
    "definitionOfDone": [
      "Correct SKUs packed",
      "Label applied",
      "Scan confirmation passed",
      "Order staged to carrier lane"
    ],
    "variants": ["fragile", "standard"]
  },
  "steps": [
    { "id": "st1", "n": 1, "text": "Verify tote ID on screen", "timeSec": 8, "qualityPoint": true },
    {
      "id": "st2",
      "n": 2,
      "text": "Scan SKU and confirm match",
      "timeSec": 12,
      "qualityPoint": true
    },
    {
      "id": "st3",
      "n": 3,
      "text": "Pack with standard filler amount",
      "timeSec": 25,
      "qualityPoint": false
    }
  ],
  "standardWip": [{ "location": "carrier_lane", "limit": 10, "unit": "orders" }],
  "toolsAndLayout": [{ "type": "shadow_board", "location": "right_panel", "photo": "file://..." }],
  "training": {
    "checklist": ["Demonstrate scan", "Pack 10 orders with 0 defects"],
    "ownerRole": "Supervisor"
  },
  "audit": {
    "cadence": "weekly",
    "questions": ["Are scans always used?", "Is label zone respected?"]
  },
  "initiativeDrafts": [
    { "title": "Add scan confirmation + hard stop", "traceability": { "stepId": "st2" } }
  ]
}
```

### 8.2 Steps & sections mapping

- `setup` → `steps` → `quality-points` → `tools-layout` → `training` → `audit` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have setup boundaries and ≥3 steps.
- Must have ≥1 quality point and its acceptance criteria.
- Must define at least one audit cadence and owner role.

### 8.4 Initiative generation spec

- Initiatives are generated from:
  - missing quality points (“escape risks”),
  - missing tools/layout standards,
  - training and audit gaps.
- Required initiative fields: title, rationale, expectedImpact, effort, risks, firstSteps, traceability (stepId/area).

### 8.5 API surface (high-level)

- `POST /api/tools` (create)
- `PUT /api/tools/:id` (autosave)
- `POST /api/tools/:id/request-review`
- `POST /api/tools/:id/approve`
- `POST /api/tools/:id/generate-initiatives`

---

## 9. AI spec

### 9.1 Non-negotiable reasoning rules

- Write standards as observable actions (no vague adjectives).
- Prefer built-in quality (quality points + poka-yoke) over end-of-line inspection.
- Separate facts (observed steps) vs recommendations (improvements).
- Propose audit routines that are lightweight and sustainable.

### 9.2 Prompt outline

- Setup: confirm scope and definition of done; ask about variants.
- Steps: rewrite steps into clear verbs; flag ambiguity; propose timing only if data exists.
- Quality points: propose where errors can occur and how to prevent escape.
- Training: propose certification checklist.
- Audit: propose cadence and questions aligned to risks.

### 9.3 Extraction schema (JSON)

```json
{
  "rewrittenSteps": [
    { "n": 1, "text": "string", "qualityPoint": true, "acceptanceCriteria": "string" }
  ],
  "riskPoints": [{ "stepN": 2, "risk": "string", "pokaYokeIdea": "string" }],
  "auditPlan": { "cadence": "weekly", "questions": ["string"] },
  "trainingChecklist": ["string"]
}
```

### 9.4 Self-checks

- Are all steps observable?
- Do quality points cover the top defect escape risks?
- Does the standard include sustain mechanisms (audit + ownership)?

---

## 10. Consultant Report Specification

### 10.1 Report structure

1. Executive summary (why standardize, expected benefits)
2. Scope and Definition of Done
3. Standard Work Sheet (printable)
4. Quality points and defect-prevention logic
5. Tools/layout standards (photos and locations)
6. Training and certification checklist
7. Audit cadence and governance
8. Improvement backlog (initiatives) with traceability

### 10.2 Required visuals

- Standard Work Sheet (one-pager)
- Before/after: defects rate and/or cycle time (if measured)
- Audit trend (weekly score)

### 10.3 Quality checklist

- [ ] Standard is actionable and unambiguous
- [ ] Quality points prevent top defect escapes
- [ ] Training and audit routines are defined and owned
- [ ] Initiatives are traceable to step/risk

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
- **VO (PL)**: "Standard Work pomaga zaplanować transformację."
- **VO (EN)**: "Standard Work helps plan transformation."
- **On-screen text (PL)**: "Standard Work = Plan transformacji"
- **On-screen text (EN)**: "Standard Work = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Standard Work już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Standard Work today."
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

1. **What is the main purpose of Standard Work?**
   A: Standard Work helps Standard Work answers: **“What is the best known method today, and how do we make it repeatable?”** ....

2. **When should I use Standard Work?**
   A: Use it - A task outcome varies by person/shift (“it depends who is working”).

- Defects/rework occur because steps are performed differently.
- You need fast....

3. **What are the key outputs?**
   A: Key outputs include Standard Work Sheet, work sequence, standard WIP, quality checkpoints, training

### FAQ (at least 8)

1. **What is the main purpose of Standard Work?**
   A: Standard Work helps Standard Work answers: **“What is the best known method today, and how do we make it repeatable?”** ....

2. **When should I use Standard Work?**
   A: Use it A task outcome varies by person/shift (“it depends who is working”).
   Defects/rework occur because steps are performed differently.
   You need faster onb....

3. **What are the key outputs?**
   A: Key outputs include Standard Work Sheet, work sequence, standard WIP, quality checkpoints, training checklist.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Standard Work analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

10. **How do I ensure quality results?**
    A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

11. **What are common mistakes?**
    A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

12. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

13. **What makes a good Standard Work analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- Standard quality checklist:
  - [ ] Steps use clear verbs and are observable
  - [ ] Quality points defined (what to check, how to check)
  - [ ] Safety notes included where needed
  - [ ] Tools/materials listed (point-of-use)
  - [ ] Audit cadence + owner defined

### Glossary (short)

- Standard Work, SOP, quality point, audit, variation, PDCA

---

## 13. Additional Resources & Learning Links

- Lean Enterprise Institute: `https://www.lean.org`

---

## 14. References

- Liker, Jeffrey K. _The Toyota Way_. McGraw-Hill.
- Womack, James P.; Jones, Daniel T. _Lean Thinking_. Simon & Schuster.
- Lean Enterprise Institute resources: `https://www.lean.org`
