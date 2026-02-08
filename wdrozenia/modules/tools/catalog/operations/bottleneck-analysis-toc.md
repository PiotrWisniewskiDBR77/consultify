# Theory of Constraints (TOC) Bottleneck Analysis

## Metadata

- **Tool name**: Theory of Constraints (TOC) Bottleneck Analysis
- **Slug**: `bottleneck-analysis-toc`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 60–180 minutes (diagnosis); 2–6 weeks (stabilize/execute)
- **Best for**: Throughput improvement, capacity constraints, flow prioritization, focusing improvement efforts
- **Not for**: Problems dominated by quality variation without clear constraint; one-off incidents
- **Primary outputs**: Identified constraint, constraint exploitation plan, subordinate rules, elevation backlog, throughput forecast
- **Required inputs (minimum)**:
  - Defined flow unit and end-to-end process
  - Basic throughput and queue/WIP indicators
- **Optional inputs**:
  - Step capacities, downtime, changeover, yield, demand pattern, variability data
- **Related tools (internal)**:
  - (ops) `value-stream-mapping-vsm.md`
  - (ops) `kanban-wip-limits.md`
  - (ops) `smed.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

TOC bottleneck analysis answers: **“What single constraint limits throughput right now, and what is the fastest path to increase system throughput?”** It prevents spreading effort across non-constraints.

### 1.2 When to use

- Backlogs and missed delivery dates despite “working harder”.
- WIP piles up in certain areas; lead time keeps growing.
- You need throughput gains quickly.

### 1.3 When NOT to use (anti-patterns)

- No stable flow unit or process definition.
- Trying to optimize every step equally (“local efficiency”).

### 1.4 What “good” looks like

- Constraint is explicitly identified (not guessed) with evidence.
- A clear exploitation plan improves throughput without major investment.
- Non-constraints are subordinated (rules change).
- Elevation decisions are justified by ROI and throughput impact.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Constraint**: the limiting factor that caps system throughput.
- **Throughput**: rate at which the system generates value (units/time).
- **Drum-Buffer-Rope (DBR)**: scheduling logic—constraint sets the pace (drum), buffer protects it, rope controls release.
- **Five focusing steps**: Identify → Exploit → Subordinate → Elevate → Repeat.

### 2.2 Glossary

| Term        | Definition                      | Notes                        |
| ----------- | ------------------------------- | ---------------------------- |
| Exploit     | Use constraint time effectively | reduce downtime/changeover   |
| Subordinate | Align all else to constraint    | release rules, priorities    |
| Elevate     | Add capacity to constraint      | investment/hiring/automation |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input         | Description            | Example                  | Where in the app it can come from |
| ------------- | ---------------------- | ------------------------ | --------------------------------- |
| Flow unit     | Unit that flows        | “Order”, “Batch”         | Setup                             |
| Process steps | High-level flow        | 5–12 steps               | VSM link/manual                   |
| WIP/queues    | Where work accumulates | 700 units before packing | Manual                            |

### 3.2 Optional inputs (improves quality)

| Input                 | Description       | Example        | Where in the app it can come from |
| --------------------- | ----------------- | -------------- | --------------------------------- |
| Capacity per step     | Units/hour        | 45/h at step X | Data                              |
| Downtime & changeover | Availability loss | 30% changeover | Logs                              |
| Yield                 | Rework/defects    | 92% FPY        | QA data                           |

### 3.3 Data quality checks

- Use same measurement window across steps.
- Separate demand spikes from structural constraints.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Identify the constraint (facts)

- Look for the longest persistent queue and highest utilization.
- Confirm with throughput data: system output ≈ constraint output.

### Step 2 — Exploit the constraint (no investment first)

Typical moves:

- Reduce changeover (SMED)
- Reduce downtime (TPM)
- Ensure best people/tools at constraint
- Prioritize high-throughput work mix

### Step 3 — Subordinate everything else

- Release work based on constraint capacity (rope).
- Implement buffers to protect constraint from starvation.
- Stop producing excess upstream inventory.

### Step 4 — Elevate (add capacity) if needed

- Add shift, equipment, automation, outsourcing, redesign.
- Justify by throughput gain and payback.

### Step 5 — Repeat

- New constraint will emerge; re-run steps.

### Common mistakes & fixes

- **Mistake**: “Constraint = the slowest machine” without system view → **Fix**: confirm via queues + throughput.
- **Mistake**: Improve non-constraint first → **Fix**: subordinate and focus on constraint.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable               | Description                    | Format in the app |
| ------------------------- | ------------------------------ | ----------------- |
| Constraint identification | Step + evidence                | Summary card      |
| Exploitation plan         | Actions to use constraint time | Checklist         |
| Subordination rules       | Release/WIP policies           | Policy list       |
| Elevation options         | Investments with ROI           | Table             |
| Throughput forecast       | Expected output gain           | Chart             |

### 5.2 Definition of Done (DoD) checklist

- [ ] Flow unit and steps defined
- [ ] Constraint identified with evidence (queue + utilization/throughput)
- [ ] Exploitation actions defined (≥3)
- [ ] Subordination policies defined (release + buffer)
- [ ] Elevation options assessed (if needed)

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

Distribution center: packing is constraint (10 min CT, WIP 700). Exploit: reduce changeover and downtime; subordinate: WIP limit upstream, release waves. Result: throughput +20%, lead time −30%.

---

## 8. Implementation spec (How to build it in the app)

```json
{
  "flowUnit": "order",
  "steps": [{ "id": "packing", "queueWip": 700, "capacityPerHour": 6 }],
  "constraintStepId": "packing",
  "exploitActions": [{ "title": "Reduce changeover", "linkTool": "smed" }],
  "subordinationPolicies": [{ "type": "release_rule", "text": "Release only if buffer < 300" }],
  "elevationOptions": [{ "title": "Add shift", "capGainPct": 15, "cost": 50000 }]
}
```

---

## 9. AI spec

- Identify likely constraint from WIP + capacity; ask for missing data.
- Propose exploitation actions first; only then elevation.
- Generate DBR-style buffer/release suggestions.

---

## 10. Consultant Report Specification

- Constraint evidence, focusing steps plan, expected throughput gain, initiatives with ROI.

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
- **VO (PL)**: "Theory of Constraints (TOC) Bottleneck Analysis pomaga zaplanować transformację."
- **VO (EN)**: "Theory of Constraints (TOC) Bottleneck Analysis helps plan transformation."
- **On-screen text (PL)**: "Theory of Constraints (TOC) Bottleneck Analysis = Plan transformacji"
- **On-screen text (EN)**: "Theory of Constraints (TOC) Bottleneck Analysis = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Theory of Constraints (TOC) Bottleneck Analysis już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Theory of Constraints (TOC) Bottleneck Analysis today."
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

1. **What is the main purpose of Theory of Constraints (TOC) Bottleneck Analysis?**
   A: Theory of Constraints (TOC) Bottleneck Analysis helps TOC bottleneck analysis answers: \*\*“What single constraint limits throughput right now, and what is ....

2. **When should I use Theory of Constraints (TOC) Bottleneck Analysis?**
   A: Use it - Backlogs and missed delivery dates despite “working harder”.

- WIP piles up in certain areas; lead time keeps growing.
- You need throughput gains q....

3. **What are the key outputs?**
   A: Key outputs include Identified constraint, constraint exploitation plan, subordinate rules, elevation backlog, throughput forecast.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Theory of Constraints (TOC) Bottleneck Analysis?**
   A: Theory of Constraints (TOC) Bottleneck Analysis helps TOC bottleneck analysis answers: \*\*“What single constraint limits throughput right now, and what is ....

2. **When should I use Theory of Constraints (TOC) Bottleneck Analysis?**
   A: Use it Backlogs and missed delivery dates despite “working harder”.
   WIP piles up in certain areas; lead time keeps growing.
   You need throughput gains quickly....

3. **What are the key outputs?**
   A: Key outputs include Identified constraint, constraint exploitation plan, subordinate rules, elevation backlog, throughput forecast.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Theory of Constraints (TOC) Bottleneck Analysis analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Theory of Constraints (TOC) Bottleneck Analysis analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- TOC focusing steps checklist:
  - [ ] Constraint identified with evidence
  - [ ] Exploitation plan created
  - [ ] Release/buffer policies defined
  - [ ] Elevation options evaluated
  - [ ] Metrics and cadence defined

### Glossary (short)

- Constraint, bottleneck, throughput, buffer, Drum-Buffer-Rope, exploitation, subordination, elevation

---

## 13. Additional Resources & Learning Links

- Goldratt Institute / TOC overview references (book-based)

---

## 14. References (Authoritative Sources)

- Goldratt, Eliyahu M. _The Goal: A Process of Ongoing Improvement_. North River Press.
- Goldratt, Eliyahu M. _Critical Chain_. North River Press.
- Cox, James F.; Schleier, John G. _Theory of Constraints Handbook_. McGraw-Hill.
