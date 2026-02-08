# Data Quality Management (DQ Dimensions & SLAs)

## Metadata

- **Tool name**: Data Quality Management (DQ Dimensions & SLAs)
- **Slug**: `data-quality-management`
- **Category**: Transformation
- **Level**: Advanced
- **Typical duration**: 60–180 minutes
- **Best for**: Defining DQ dimensions, rules, SLAs and remediation ownership for critical data.
- **Not for**: One-time profiling without controls.
- **Primary outputs**: DQ rules, SLAs, dashboards, remediation backlog, ownership model.
- **Required inputs (minimum)**:
  - Scope and outcomes
  - Evidence and constraints
  - Stakeholder ownership
- **Optional inputs**:
  - KPI baselines
  - Architecture/process inventories
  - Risk constraints
- **Related tools (internal)**:
  - (link) `./digital-transformation-assessment.md`
  - (link) `./transformation-roadmap.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Transformation tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Outputs are specific, evidence-backed, and produce an initiative backlog.

### 1.2 When to use

- You need a repeatable, documented way to make decisions.
- You must convert analysis into initiatives with traceability.

### 1.3 When NOT to use (anti-patterns)

- You cannot collect evidence and define scope.
- You want a one-off slide deck without follow-up.

### 1.4 What “good” looks like

- Outputs are specific, evidence-backed, and produce an initiative backlog.
- Trade-offs are explicit and owners are assigned.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- Critical data elements (CDE).
- DQ dimensions (accuracy, completeness, timeliness).
- DQ SLAs and monitoring.

### 2.2 Glossary

| Term         | Definition                           | Notes          |
| ------------ | ------------------------------------ | -------------- |
| Scope        | What is included in the tool session | Prevents creep |
| Evidence     | Artifacts backing claims             | Links required |
| Traceability | Link initiatives back to sources     | Audit-ready    |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input       | Description                  | Example          | Where in the app it can come from |
| ----------- | ---------------------------- | ---------------- | --------------------------------- |
| Scope       | Business unit/region/horizon | “EU, 18 months”  | Project context                   |
| Outcomes    | Measurable goals             | “Lead time -30%” | KPI panel                         |
| Constraints | Budget/risk/tech limits      | “No downtime”    | Notes                             |

### 3.2 Optional inputs (improves quality)

| Input     | Description      | Example          | Where in the app it can come from |
| --------- | ---------------- | ---------------- | --------------------------------- |
| Inventory | Apps/data/teams  | “420 apps”       | Upload                            |
| Evidence  | Policies/metrics | “DORA dashboard” | Attachments                       |

### 3.3 Data quality checks

- Use consistent time buckets and definitions.
- Separate facts vs assumptions and attach evidence where possible.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Setup

- Define scope, horizon, and outcomes.

### Step 2 — Collect facts

- Collect minimum evidence and baseline metrics.

### Step 3 — Structure

- Populate the tool artifact with consistent templates.

### Step 4 — Analyze

- Identify gaps, dependencies, and risks.

### Step 5 — Synthesize insights

- Write recommendations with trade-offs.

### Step 6 — Convert to initiatives

- Generate initiatives with owners, metrics, and traceability.

### Common mistakes & fixes

- **Mistake**: Outputs without evidence → **Fix**: require evidence register for key claims.
- **Mistake**: No trade-offs → **Fix**: every recommendation includes alternatives and risks.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable        | Description                  | Format in the app |
| ------------------ | ---------------------------- | ----------------- |
| Primary artifact   | Core transformation artifact | Structured view   |
| Decision log       | Trade-offs and approvals     | Table             |
| Initiative backlog | Actionable execution items   | Initiatives list  |

### 5.2 Definition of Done (DoD) checklist

- [ ] Scope and outcomes defined
- [ ] Evidence attached for key claims
- [ ] At least 3 decisions with owners
- [ ] Initiatives drafted with traceability

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

Analytics outputs are unreliable; teams argue about whose data is correct.

### 7.2 Inputs (filled)

- Scope: one business unit, 12 months.
- Outcome: reduce lead time, improve reliability.

### 7.3 Analysis (filled)

- Baseline captured; gaps prioritized; recommended actions sequenced.

### 7.4 Insights

1. Focus on the few highest-leverage constraints first.
2. Make ownership explicit to avoid “everyone owns it”.

### 7.5 Initiatives derived

| Initiative title                  | Rationale                | Expected impact   | Effort | Risks    | First 2 steps                  |
| --------------------------------- | ------------------------ | ----------------- | ------ | -------- | ------------------------------ |
| Establish governance cadence      | Ensure decisions happen  | less delay        | Low    | fatigue  | Define calendar; assign owners |
| Create initial initiative backlog | Move from plan to action | execution started | Medium | overload | Pick top 10; define KPIs       |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "setup": { "scope": "string", "horizonMonths": 12 },
  "artifact": { "type": "data-quality-management" },
  "decisions": [{ "text": "string", "ownerRole": "string" }],
  "initiativeDrafts": [{ "title": "string", "traceability": { "source": "artifact" } }]
}
```

### 8.2 Steps & sections mapping

`setup` → `artifact` → `decisions` → `initiatives`

### 8.3 Validation rules (DoD)

- Scope and outcomes defined
- Evidence attached for key claims
- At least 3 decisions with owners
- Initiatives drafted with traceability

### 8.4 Initiative generation spec

- Generate 3–12 initiatives based on gaps and decisions.
- Require owner, metric, and traceability for each initiative.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, request-review, approve, generate initiatives).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Separate facts vs assumptions.
- Always include trade-offs.
- Do not propose initiatives without metrics.

### 9.2 Prompt outline

- Confirm scope/outcomes.
- Request missing evidence.
- Generate structured artifact and decisions.
- Generate initiatives with traceability.

### 9.3 Extraction schema (JSON)

```json
{
  "decisions": [{ "text": "string", "ownerRole": "string", "tradeoffs": ["string"] }],
  "initiatives": [
    { "title": "string", "metrics": ["string"], "traceability": { "source": "string" } }
  ]
}
```

### 9.4 Self-checks

- Are decisions owned?
- Are claims evidence-backed?
- Are initiatives measurable?

---

## 10. Consultant Report Specification (What goes into the final report)

- - Executive summary
- - Method and scope
- - Artifact outputs and decisions
- - Initiative portfolio and next steps

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
- **VO (PL)**: "Data Quality Management (DQ Dimensions & SLAs) pomaga zaplanować transformację."
- **VO (EN)**: "Data Quality Management (DQ Dimensions & SLAs) helps plan transformation."
- **On-screen text (PL)**: "Data Quality Management (DQ Dimensions & SLAs) = Plan transformacji"
- **On-screen text (EN)**: "Data Quality Management (DQ Dimensions & SLAs) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Data Quality Management (DQ Dimensions & SLAs) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Data Quality Management (DQ Dimensions & SLAs) today."
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

###

### FAQ (at least 8)

1. **What is the main purpose of Data Quality Management (DQ Dimensions & SLAs)?**
   A: Data Quality Management (DQ Dimensions & SLAs) helps create structured, evidence-backed artifacts and convert gaps into initiatives.

2. **When should I use Data Quality Management (DQ Dimensions & SLAs)?**
   A: Use it you need a repeatable, documented way to make decisions.
   you must convert analysis into initiatives with traceability..

3. **What are the key outputs?**
   A: Key outputs include DQ rules, SLAs, dashboards, remediation backlog, ownership model..

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Data Quality Management (DQ Dimensions & SLAs) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   Checklists

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

- - See references: ISO 8000: https://www.iso.org/standard/81760.html

---

## 14. References (Authoritative Sources)

- ISO 8000: https://www.iso.org/standard/81760.html
- DAMA: https://www.dama.org/content/body-knowledge
- SRE SLOs: https://sre.google/sre-book/service-level-objectives/
