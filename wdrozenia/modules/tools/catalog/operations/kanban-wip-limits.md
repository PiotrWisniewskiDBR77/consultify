# Kanban & WIP Limits

## Metadata

- **Tool name**: Kanban & WIP Limits
- **Slug**: `kanban-wip-limits`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 60–120 minutes setup; 2–4 weeks stabilization
- **Best for**: Reducing multitasking, improving flow predictability, visualizing work, managing bottlenecks
- **Not for**: Projects where work is not repeatable at all; organizations unwilling to respect WIP limits
- **Primary outputs**: Kanban board design, explicit policies, WIP limits, flow metrics, improvement backlog
- **Required inputs (minimum)**:
  - Workflow states and definitions (start/end)
  - Current demand and capacity signal (rough)
- **Optional inputs**:
  - Historical lead time, throughput, arrival rate, blockers reasons
- **Related tools (internal)**:
  - (ops) `value-stream-mapping-vsm.md`
  - (ops) `bottleneck-analysis-toc.md`
  - (ops) `standard-work.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Kanban with WIP limits answers: **“How do we make flow visible and stable so we deliver faster with less chaos?”** It shifts focus from starting work to finishing work by limiting work-in-progress.

### 1.2 When to use

- Work is delayed due to multitasking and constant context switching.
- Priorities change often and you need transparency.
- Bottlenecks exist and queues are uncontrolled.

### 1.3 When NOT to use (anti-patterns)

- Board becomes a “task list” without WIP limits or policies.
- Teams use WIP limits but ignore them under pressure.
- Work items are too large (needs slicing first).

### 1.4 What “good” looks like

- Explicit workflow and policies; WIP limits respected.
- Flow metrics improve (lead time down, throughput stable).
- Blockers are visible with fast escalation.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Visualize work**: make workflow states explicit.
- **Limit WIP**: cap items per state to reduce queues and waiting.
- **Manage flow**: monitor lead time, throughput, WIP, blockers.
- **Explicit policies**: definitions of “ready/done”, classes of service.
- **Continuous improvement**: use data to evolve the system.

### 2.2 Glossary

| Term       | Definition                     | Notes                          |
| ---------- | ------------------------------ | ------------------------------ |
| WIP        | Items started but not finished | Primary driver of lead time    |
| Lead time  | Start → done elapsed time      | Key customer experience metric |
| Throughput | Items done per time            | Capacity signal                |
| Blocker    | Work cannot move forward       | Needs reason and owner         |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input          | Description             | Example                       | Where in the app it can come from |
| -------------- | ----------------------- | ----------------------------- | --------------------------------- |
| Workflow       | States and definitions  | To Do / Doing / Review / Done | Setup                             |
| Work item type | What is a “unit”        | “Order”, “Ticket”             | Setup                             |
| Capacity       | Rough capacity per week | 40 tickets/week               | KPI entry                         |

### 3.2 Optional inputs (improves quality)

| Input             | Description    | Example            | Where in the app it can come from |
| ----------------- | -------------- | ------------------ | --------------------------------- |
| Lead time history | Distribution   | median 6 days      | Upload                            |
| Arrival rate      | New items/time | 50/week            | Data                              |
| Blockers          | Top reasons    | “Waiting approval” | Notes                             |

### 3.3 Data quality checks

- Ensure work item is comparable (don’t mix tiny + huge).
- Define “start” and “done” consistently for lead time.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Define the workflow and policies

- 3–6 columns max.
- Define “Definition of Ready” and “Definition of Done”.

### Step 2 — Visualize current work and classify items

- Create items with size class (S/M/L) and class of service.

### Step 3 — Set initial WIP limits (start conservative)

Heuristic:

- WIP limit for “Doing” ≈ number of people × 1 (or 1.5 max).
- Add separate limits for “Review/Approval” to surface bottlenecks.

### Step 4 — Run daily flow routine

- Focus on unblocking and finishing, not starting.
- Pull new work only when below WIP limit.

### Step 5 — Measure flow and adjust

- Track lead time distribution, throughput, WIP, blocked time.
- Adjust WIP limits and policies to reduce waiting.

### Step 6 — Convert insights to initiatives

- If review queue is bottleneck: change policy, automate, add capacity.
- If item size too large: introduce slicing standard.

### Common mistakes & fixes

- **Mistake**: Too many columns → **Fix**: consolidate to show true flow.
- **Mistake**: WIP limit ignored → **Fix**: leadership enforces “stop starting”.
- **Mistake**: Items too big → **Fix**: standard slicing guidelines.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable         | Description           | Format in the app |
| ------------------- | --------------------- | ----------------- |
| Kanban design       | Columns + policies    | Board config      |
| WIP limits          | Per column            | Limits badges     |
| Flow metrics        | Lead time, throughput | Charts            |
| Improvement backlog | Bottleneck fixes      | Initiative drafts |

### 5.2 Definition of Done (DoD) checklist

- [ ] Workflow defined (≤6 columns) with explicit policies
- [ ] WIP limits set for key columns (Doing + Review)
- [ ] Daily flow routine defined (standup questions)
- [ ] Metrics configured (lead time + throughput)
- [ ] At least 3 improvement initiatives captured

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

Context: internal IT tickets. After WIP limits in “Doing” from unlimited to 8, median lead time drops from 12 to 6 days; review bottleneck becomes visible and fixed by rotating reviewer.

---

## 8. Implementation spec (How to build it in the app)

```json
{
  "workflow": [
    { "id": "todo", "name": "To Do" },
    { "id": "doing", "name": "Doing", "wipLimit": 8 },
    { "id": "review", "name": "Review", "wipLimit": 4 },
    { "id": "done", "name": "Done" }
  ],
  "policies": {
    "definitionOfReady": ["Clear owner", "Acceptance criteria"],
    "definitionOfDone": ["Tested", "Deployed"]
  },
  "items": [{ "id": "t1", "title": "Automate approval", "status": "doing", "blocked": false }]
}
```

Validation: workflow + at least one WIP limit + at least 5 items or explicit “empty board”.

---

## 9. AI spec

- Suggest initial WIP limits based on team size and bottlenecks.
- Detect anti-patterns (too many columns, huge items, review queue).
- Propose initiatives to reduce blocked time and queues.

---

## 10. Consultant Report Specification

- Workflow + policies
- Baseline metrics vs after (lead time, throughput)
- Bottlenecks and causes
- Recommendations and initiatives

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
- **VO (PL)**: "Kanban & WIP Limits pomaga zaplanować transformację."
- **VO (EN)**: "Kanban & WIP Limits helps plan transformation."
- **On-screen text (PL)**: "Kanban & WIP Limits = Plan transformacji"
- **On-screen text (EN)**: "Kanban & WIP Limits = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Kanban & WIP Limits już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Kanban & WIP Limits today."
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

1. **What is the main purpose of Kanban & WIP Limits?**
   A: Kanban & WIP Limits helps Kanban with WIP limits answers: \*\*“How do we make flow visible and stable so we deliver faster with ....

2. **When should I use Kanban & WIP Limits?**
   A: Use it - Work is delayed due to multitasking and constant context switching.

- Priorities change often and you need transparency.
- Bottlenecks exist and que....

3. **What are the key outputs?**
   A: Key outputs include Kanban board design, explicit policies, WIP limits, flow metrics, improvement backlog.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Kanban & WIP Limits?**
   A: Kanban & WIP Limits helps Kanban with WIP limits answers: \*\*“How do we make flow visible and stable so we deliver faster with ....

2. **When should I use Kanban & WIP Limits?**
   A: Use it Work is delayed due to multitasking and constant context switching.
   Priorities change often and you need transparency.
   Bottlenecks exist and queues ar....

3. **What are the key outputs?**
   A: Key outputs include Kanban board design, explicit policies, WIP limits, flow metrics, improvement backlog.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Kanban & WIP Limits analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Kanban & WIP Limits analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- Kanban setup checklist:
  - [ ] Workflow ≤6 columns
  - [ ] WIP limits set (Doing + Review)
  - [ ] Policies defined (DoR/DoD)
  - [ ] Blocker policy defined
  - [ ] Metrics enabled

### Glossary (short)

- WIP, lead time, throughput, blocker, class of service, DoR/DoD

---

## 13. Additional Resources & Learning Links

- Kanban Guide: `https://kanban.guides`
- Anderson, David J. — Kanban (book references)

---

## 14. References (Authoritative Sources)

- Little, John D.C. “A Proof for the Queuing Formula: L = λW.” _Operations Research_ (Little’s Law).
- Anderson, David J. _Kanban: Successful Evolutionary Change for Your Technology Business_. Blue Hole Press.
- Kanban Guides (official guides): `https://kanban.guides`
