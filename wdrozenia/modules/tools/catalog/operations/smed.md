# SMED (Setup Reduction)

## Metadata

- **Tool name**: SMED (Single-Minute Exchange of Die)
- **Slug**: `smed`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 2–6 hours (analysis); 1–3 days (kaizen event); 2–6 weeks implementation
- **Best for**: Reducing changeover/setup time, increasing flexibility, enabling smaller batches, improving throughput
- **Not for**: Environments without repeatable setups; purely administrative problems without a repeatable “setup” analog
- **Primary outputs**: Setup breakdown, internal vs external tasks, redesigned setup standard, verified time savings, rollout backlog
- **Required inputs (minimum)**:
  - A defined setup/changeover to study (scope and “start/end”)
  - At least one recorded observation (video or time log)
- **Optional inputs**:
  - Historical setup time distribution, defect rate after changeover, tool availability, staffing constraints
- **Related tools (internal)**:
  - (ops) `bottleneck-analysis-toc.md`
  - (ops) `kaizen-pdca.md`
  - (ops) `standard-work.md`
  - (ops) `tpm.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

SMED answers: **“How do we reduce setup time so we can run smaller batches and improve responsiveness?”** It increases throughput and flexibility by converting “machine stopped” work into “machine running” work and by standardizing the best method.

### 1.2 When to use

- Changeovers are a major contributor to downtime and missed delivery.
- You run large batches mainly to “avoid setups”.
- The bottleneck/constraint loses a lot of time to setup/adjustment.

### 1.3 When NOT to use (anti-patterns)

- The “setup” is not repeatable (no stable sequence to improve).
- You have unstable quality after setup and must first stabilize the process (SPC/RCA).
- You try to do SMED without observing real work (gemba/video).

### 1.4 What “good” looks like

- Setup work is decomposed into a clear step list with timings.
- Internal vs external classification is explicit and agreed.
- A redesigned setup method is validated and documented as standard work.
- Time reduction is verified and does not create quality escapes.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Internal setup**: tasks that require the equipment to be stopped.
- **External setup**: tasks that can be completed while equipment is running.
- **Conversion**: redesigning tasks so they become external.
- **Streamlining**: simplifying remaining internal tasks (eliminate, parallelize, quick clamps, presets, mistake-proofing).
- **First-piece approval**: explicit quality gate to prevent “faster but wrong”.

### 2.2 Glossary

| Term          | Definition                                    | Notes                              |
| ------------- | --------------------------------------------- | ---------------------------------- |
| Changeover    | Switching from one product/variant to another | Includes adjustment + verification |
| Preset        | Pre-adjusted tooling/parameters               | Reduces trial-and-error            |
| Quick clamp   | Faster fastening method                       | Often mechanical/pneumatic         |
| Parallel work | Two people/tasks in parallel                  | Requires role clarity and tooling  |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input         | Description             | Example                              | Where in the app it can come from |
| ------------- | ----------------------- | ------------------------------------ | --------------------------------- |
| Setup scope   | Start/end and equipment | “Last good piece → first good piece” | Setup step                        |
| Observation   | Video/time log          | 1 recorded changeover                | Attachment                        |
| Baseline time | Total setup time        | 90 min                               | Manual entry                      |

### 3.2 Optional inputs (improves quality)

| Input               | Description                    | Example                      | Where in the app it can come from |
| ------------------- | ------------------------------ | ---------------------------- | --------------------------------- |
| Defects after setup | Quality escapes and rework     | scrap spike after changeover | QA data                           |
| Tooling readiness   | Tool availability and location | missing wrench causes delays | Gemba notes                       |
| Staffing            | Roles during setup             | 1 vs 2 operators             | Notes                             |

### 3.3 Data quality checks

- Define setup timing boundaries consistently (include/exclude warm-up and first-piece approval explicitly).
- Record at least one “typical” setup, not the best or worst outlier.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Setup

- Choose the target setup based on frequency × impact (downtime minutes or lost throughput).
- Define timing boundaries and quality gate (first good piece).

### Step 2 — Collect facts

- Record the setup (video) or run a detailed time log.
- Capture: tools used, walking/searching, waiting, adjustments, checks.

### Step 3 — Structure

- Create the full step list in order with time per step.
- Tag each step as internal vs external.

### Step 4 — Analyze

- Pareto the largest time contributors.
- Identify conversion opportunities (internal → external).
- Identify streamlining opportunities (quick clamps, presets, parallel work).

### Step 5 — Synthesize insights

- Design the new setup method:
  - pre-staging checklist and tool cart,
  - standardized sequence,
  - quality gate rules.

### Step 6 — Convert to initiatives

- Convert the new method into initiatives:
  - “Build tool cart and shadow board”
  - “Install quick clamps”
  - “Create preset parameters and first-piece checklist”

### Common mistakes & fixes

- **Mistake**: “We already know what to do” → **Fix**: record and time it; surprises are common.
- **Mistake**: Faster setup causes defects → **Fix**: define first-piece approval and stability checks.
- **Mistake**: Gains disappear after a week → **Fix**: standard work + training + audit.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable             | Description                           | Format in the app  |
| ----------------------- | ------------------------------------- | ------------------ |
| Setup breakdown         | Steps, times, internal/external       | Table              |
| Improved setup standard | New sequence + checklist              | Printable standard |
| Verified improvement    | Before/after timings + quality impact | KPI cards + notes  |
| Rollout backlog         | Scaling plan to other lines/products  | Initiative list    |

### 5.2 Definition of Done (DoD) checklist

- [ ] Baseline and after measurements recorded (≥1 each)
- [ ] Internal/external split completed
- [ ] ≥3 conversion or streamlining actions defined
- [ ] New standard work published (checklist + roles)
- [ ] Quality gate defined (first-piece approval)

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

Injection molding line is the constraint. Changeovers happen 4×/week and average 90 minutes. Goal: reduce to ≤45 minutes without increasing scrap.

### 7.2 Inputs (filled)

- Setup boundary: last good part of product A → first good part of product B
- Baseline: 90 minutes (1 recorded setup)
- Key losses: tool search/walking (12 min), adjustment trial-and-error (18 min), clamping/unclamping (15 min)

### 7.3 Analysis (filled)

Internal vs external:

- External candidates: pre-stage tools, pre-heat mold, prepare parameters, material staging.
- Streamlining: quick-release clamps, parallel work with two operators, preset parameter sheet.

After improvements:

- External pre-staging reduces internal time by 15 min.
- Quick clamps reduce clamp time by 8 min.
- Presets reduce adjustments by 20 min.
  Total after: ~45 min; scrap unchanged (first-piece approval still required).

### 7.4 Insights

1. Most “setup time” was not technical—tooling readiness and walking dominated.
2. Presets and checklists reduce variability more than “experience”.
3. Quality gate prevents speed improvements from becoming hidden scrap.

### 7.5 Initiatives derived

| Initiative title                               | Rationale                      | Expected impact  | Effort | Risks      | First 2 steps                 |
| ---------------------------------------------- | ------------------------------ | ---------------- | ------ | ---------- | ----------------------------- |
| Tool cart + shadow board                       | Remove searching/walking       | −10–15 min/setup | Low    | Adoption   | Design layout; pilot          |
| Quick clamps retrofit                          | Reduce clamp/unclamp time      | −5–10 min/setup  | Medium | Fit issues | Spec clamps; install 1 mold   |
| Preset parameter sheet + first-piece checklist | Reduce adjustments and defects | −15–25 min/setup | Low    | Compliance | Create sheet; train operators |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "setup": {
    "name": "Mold changeover",
    "boundary": "last_good_to_first_good",
    "asset": "Molding Line 1"
  },
  "baseline": { "totalMin": 90, "date": "2026-01-15", "evidence": ["video://..."] },
  "steps": [
    {
      "id": "s1",
      "text": "Fetch tools",
      "timeMin": 12,
      "type": "external_after",
      "evidence": "t=00:03:10"
    },
    { "id": "s2", "text": "Remove mold", "timeMin": 18, "type": "internal" }
  ],
  "after": { "totalMin": 45, "qualityGate": "first_piece_approved" },
  "standard": { "checklist": ["Pre-stage tools", "Verify clamps", "First-piece approval"] },
  "initiativeDrafts": [{ "title": "Tool cart + shadow board", "traceability": { "stepId": "s1" } }]
}
```

### 8.2 Steps & sections mapping

- `setup` → `observe` → `breakdown` → `improve` → `standardize` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have boundary definition and baseline total time.
- Must have ≥5 steps with time and internal/external classification.
- Must have “after” target or plan and a quality gate definition.

### 8.4 Initiative generation spec

- Generate 3–7 initiatives max; require traceability to:
  - top time-loss step(s),
  - conversion opportunities,
  - sustain actions (standard/audit).

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Always demand a timed breakdown before recommending solutions.
- Prefer conversion (internal→external) before investment-heavy actions.
- Protect quality with explicit gates (first-piece approval).

### 9.2 Prompt outline

- Ask for boundaries and baseline timing.
- Propose step decomposition and internal/external tagging.
- Generate conversion ideas and quick wins (tool staging, presets, checklists).
- Recommend sustain plan (standard work + audit).

### 9.3 Extraction schema (JSON)

```json
{
  "conversionIdeas": [{ "stepId": "string", "idea": "string", "expectedMinSaved": 10 }],
  "streamliningIdeas": [{ "idea": "string", "costLevel": "low|medium|high", "risk": "string" }],
  "standardChecklist": ["string"]
}
```

### 9.4 Self-checks

- Are boundaries defined consistently?
- Are suggestions linked to the biggest time-loss steps?
- Is quality protection explicitly included?

---

## 10. Consultant report spec

- Baseline (frequency × minutes lost) and economics
- Breakdown table and Pareto
- Internal vs external split and conversion plan
- Before/after results (time and quality)
- Rollout roadmap and initiatives backlog

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
- **VO (PL)**: "SMED (Single-Minute Exchange of Die) pomaga zaplanować transformację."
- **VO (EN)**: "SMED (Single-Minute Exchange of Die) helps plan transformation."
- **On-screen text (PL)**: "SMED (Single-Minute Exchange of Die) = Plan transformacji"
- **On-screen text (EN)**: "SMED (Single-Minute Exchange of Die) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij SMED (Single-Minute Exchange of Die) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start SMED (Single-Minute Exchange of Die) today."
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

1. **What is the main purpose of SMED (Single-Minute Exchange of Die)?**
   A: SMED (Single-Minute Exchange of Die) helps SMED answers: \*\*“How do we reduce setup time so we can run smaller batches and improve responsivenes....

2. **When should I use SMED (Single-Minute Exchange of Die)?**
   A: Use it - Changeovers are a major contributor to downtime and missed delivery.

- You run large batches mainly to “avoid setups”.
- The bottleneck/constraint l....

3. **What are the key outputs?**
   A: Key outputs include Setup breakdown, internal vs external tasks, redesigned setup standard, verified time savings, rollout backlog.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of SMED (Single-Minute Exchange of Die)?**
   A: SMED (Single-Minute Exchange of Die) helps SMED answers: \*\*“How do we reduce setup time so we can run smaller batches and improve responsivenes....

2. **When should I use SMED (Single-Minute Exchange of Die)?**
   A: Use it Changeovers are a major contributor to downtime and missed delivery.
   You run large batches mainly to “avoid setups”.
   The bottleneck/constraint loses a....

3. **What are the key outputs?**
   A: Key outputs include Setup breakdown, internal vs external tasks, redesigned setup standard, verified time savings, rollout backlog.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good SMED (Single-Minute Exchange of Die) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good SMED (Single-Minute Exchange of Die) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- SMED DoD checklist (section 5)
- Setup observation checklist:
  - [ ] Video/time log captured
  - [ ] Steps listed in order with times
  - [ ] Internal/external tagged
  - [ ] Top 3 steps targeted for conversion
  - [ ] New checklist and training created

### Glossary (short)

- Changeover, internal setup, external setup, conversion, streamlining, first-piece approval

---

## 13. Additional resources

- Shingo Institute (history and principles): `https://shingo.org`
- Lean Enterprise Institute (setup reduction topics): `https://www.lean.org`

---

## 14. References

- Shingo, Shigeo. _A Revolution in Manufacturing: The SMED System_. Productivity Press.
- Liker, Jeffrey K. _The Toyota Way_. McGraw-Hill.
- Black, J. T. _The Design of the Factory with a Future_. McGraw-Hill.
