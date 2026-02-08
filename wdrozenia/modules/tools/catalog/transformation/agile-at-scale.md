# Agile at Scale (Ways of Working)

## Metadata

- **Tool name**: Agile at Scale (Ways of Working)
- **Slug**: `agile-at-scale`
- **Category**: Transformation
- **Level**: Advanced
- **Typical duration**: 60–180 minutes
- **Best for**: Aligning many teams on cadence/governance/flow and improving predictability.
- **Not for**: Copy-pasting frameworks without outcomes.
- **Primary outputs**: Ways of working, cadence, governance, flow metrics, improvement backlog.
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

- Cadence and planning horizons.
- Flow metrics (lead time/throughput).
- Governance and guardrails.

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

15 teams with conflicting priorities; delivery predictability is low.

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
  "artifact": { "type": "agile-at-scale" },
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
- **VO (PL)**: "Agile at Scale (Ways of Working) pomaga zaplanować transformację."
- **VO (EN)**: "Agile at Scale (Ways of Working) helps plan transformation."
- **On-screen text (PL)**: "Agile at Scale (Ways of Working) = Plan transformacji"
- **On-screen text (EN)**: "Agile at Scale (Ways of Working) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Agile at Scale (Ways of Working) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Agile at Scale (Ways of Working) today."
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

### FAQ (at least 8)

1. **What is Agile at Scale (Ways of Working) used for?**
   A: It's used to assess and improve agile practices at scale, define common ways of working, establish cadence and governance, and create an improvement backlog for agile transformation.

2. **What inputs are required?**
   A: Required inputs include company context and scope, target outcomes, current pain points, and optional inputs like KPIs, architecture inventory, and org structure.

3. **How do we validate outputs with evidence?**
   A: Each assessment score should be backed by evidence such as artifacts, KPIs, examples, or documented practices. Use an evidence register to track supporting materials.

4. **How do we handle missing data?**
   A: Document assumptions clearly, use best-effort estimates with confidence ranges, and prioritize collecting missing data as part of the improvement backlog.

5. **How do we convert outputs to initiatives?**
   A: Convert identified gaps into initiative candidates with clear rationale, expected impact, owners, and timelines. Link initiatives to specific gaps for traceability.

6. **Who owns the decisions?**
   A: Leadership team owns strategic decisions, while individual teams own implementation. Establish clear RACI matrix for decision-making and execution.

7. **How often should this be updated?**
   A: Review quarterly for cadence and governance adjustments, and annually for comprehensive reassessment. Update when significant changes occur in ways of working.

8. **What are common anti-patterns?**
   A: Common anti-patterns include treating it as a one-time exercise, focusing only on processes without culture change, and not linking improvements to business outcomes.

### Checklists

**DoD Checklist (Definition of Done):**

- [ ] Current ways of working assessed and documented
- [ ] Target ways of working defined
- [ ] Gaps identified with evidence
- [ ] Improvement backlog created with priorities
- [ ] Cadence and governance structures defined
- [ ] Flow metrics established
- [ ] Initiatives linked to gaps with owners
- [ ] Report exportable

**Common Mistakes Checklist:**

- [ ] One-size-fits-all approach → Fix: Adapt ways of working to context and team needs
- [ ] Process focus only → Fix: Include culture, mindset, and leadership aspects
- [ ] No evidence backing → Fix: Document evidence for each assessment score
- [ ] Unclear ownership → Fix: Define RACI matrix for decisions and execution
- [ ] No metrics → Fix: Establish flow metrics and track progress regularly

### Glossary (short)

| Term                | Definition                                                 | Example                                           |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Ways of Working     | Common practices and processes used by teams               | Sprint cadence, daily standups, retrospectives    |
| Cadence             | Regular rhythm of events and activities                    | Weekly sprint planning, monthly program increment |
| Flow Metrics        | Measures of work movement through system                   | Lead time, cycle time, throughput, WIP            |
| Agile at Scale      | Applying agile practices across multiple teams             | SAFe, LeSS, Nexus frameworks                      |
| Improvement Backlog | Prioritized list of initiatives to improve ways of working | "Implement cross-team retrospectives"             |

---

## 13. Additional Resources & Learning Links

- - See references: SAFe: https://scaledagileframework.com/

---

## 14. References (Authoritative Sources)

- SAFe: https://scaledagileframework.com/
- LeSS: https://less.works/
- DORA: https://dora.dev/
