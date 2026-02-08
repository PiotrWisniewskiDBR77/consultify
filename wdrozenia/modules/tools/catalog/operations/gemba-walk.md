# Gemba Walk

## Metadata

- **Tool name**: Gemba Walk
- **Slug**: `gemba-walk`
- **Category**: Operations
- **Level**: Basic
- **Typical duration**: 30–60 minutes per walk; weekly cadence
- **Best for**: Seeing real work, identifying waste, improving management routines, building problem-solving culture
- **Not for**: Replacing data analysis; “audit policing”; one-off theater without follow-through
- **Primary outputs**: Observation log, waste/themes, immediate fixes, improvement backlog, follow-up commitments
- **Required inputs (minimum)**:
  - Area/process to visit + purpose of the walk
  - Observation checklist (what to look for)
- **Optional inputs**:
  - Baseline metrics (safety, quality, delivery), prior issues, standard work
- **Related tools (internal)**:
  - (ops) `standard-work.md`
  - (ops) `root-cause-5whys-fishbone.md`
  - (ops) `5s.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Gemba Walk enables leaders to answer: **“What is actually happening where value is created?”** It turns assumptions into observations, surfaces obstacles, and creates a disciplined follow-up loop.

### 1.2 When to use

- Performance gaps persist despite meetings and reports.
- You need to validate how work is done vs documented.
- You want to build daily management routines.

### 1.3 When NOT to use (anti-patterns)

- Using it to blame individuals (“gotcha” audits).
- Doing walks without action tracking and follow-up.

### 1.4 What “good” looks like

- Observations focus on process, not people.
- Issues are converted into owners + due dates.
- Trends are tracked across walks (recurring waste themes).

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Gemba**: “The real place” where work happens.
- **Go see**: observe directly, ask why, show respect.
- **Waste lenses**: waiting, motion, transport, defects, overprocessing, inventory, overproduction, unused talent.

### 2.2 Glossary

| Term      | Definition                     | Notes                  |
| --------- | ------------------------------ | ---------------------- |
| Theme     | Recurring observation category | e.g., “handoff delays” |
| Quick win | Fixable within 24–72h          | e.g., label placement  |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input     | Description     | Example                | Where in the app it can come from |
| --------- | --------------- | ---------------------- | --------------------------------- |
| Area      | Where to walk   | “Packing line A”       | Setup                             |
| Purpose   | What to learn   | “Why errors spike?”    | Setup                             |
| Checklist | What to observe | Safety, flow, standard | Template                          |

### 3.2 Optional inputs (improves quality)

| Input         | Description     | Example     | Where in the app it can come from |
| ------------- | --------------- | ----------- | --------------------------------- |
| Metrics       | Baseline KPIs   | defects/day | KPI panel                         |
| Standard work | Expected method | SOP link    | Standard Work tool                |

### 3.3 Data quality checks

- Ensure observations record time, location, and evidence (photo/quote).
- Avoid leading questions; capture facts first.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Define purpose and scope (timeboxed)

- Pick one question and one area.
- Timebox: 30–60 minutes.

### Step 2 — Observe flow and work content

- Follow the flow unit end-to-end.
- Note waits, queues, rework loops, unclear signals.

### Step 3 — Ask “why” respectfully

- Ask operators: “What makes your work hard today?”
- Capture obstacles and ideas.

### Step 4 — Record observations with evidence

- Use structured log: observation → impact → suspected cause → suggestion.

### Step 5 — Convert to actions

- Quick wins: assign owner + due date (48–72h).
- Larger issues: create initiatives or start RCA/DMAIC.

### Step 6 — Follow-up and close the loop

- Review commitments next walk; mark closed/open.

### Common mistakes & fixes

- **Mistake**: Only “touring” → **Fix**: follow flow unit + checklist.
- **Mistake**: No follow-up → **Fix**: action tracker and review cadence.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable     | Description          | Format in the app |
| --------------- | -------------------- | ----------------- |
| Observation log | Evidence-based notes | Table             |
| Themes          | Grouped issues       | Tags + counts     |
| Action tracker  | Owners/dates         | Checklist         |
| Initiatives     | Larger improvements  | Initiative drafts |

### 5.2 Definition of Done (DoD) checklist

- [ ] Purpose and area defined
- [ ] ≥10 observations recorded with evidence
- [ ] Themes identified (top 3)
- [ ] ≥3 actions assigned (incl. at least 1 quick win)
- [ ] Follow-up date set

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

Context: packing errors. Observations show label printer far away (motion), unclear SKU bins (defects), and batch release causes queues (waiting). Actions: move printer, relabel bins, introduce WIP limit and FIFO.

---

## 8. Implementation spec (How to build it in the app)

```json
{
  "setup": { "area": "Packing Line A", "purpose": "Reduce errors", "timeboxMin": 45 },
  "observations": [
    {
      "text": "Printer 20m away → extra walking",
      "waste": "motion",
      "evidence": "photo",
      "impact": "CT +15%"
    }
  ],
  "actions": [{ "title": "Move label printer", "owner": "Ops Lead", "due": "2026-02-10" }]
}
```

Validation: ≥5 observations + ≥1 action.

---

## 9. AI spec (How to behave like a world-class consultant)

- Cluster observations into themes; propose quick wins vs projects.
- Recommend next tool (5S, Standard Work, RCA) based on waste type.

---

## 10. Consultant Report Specification (What goes into the final report)

- Purpose, area, checklist used
- Observations (with evidence) and themes
- Actions/initiatives with owners and dates
- Follow-up outcomes (closed/open)

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
- **VO (PL)**: "Gemba Walk pomaga zaplanować transformację."
- **VO (EN)**: "Gemba Walk helps plan transformation."
- **On-screen text (PL)**: "Gemba Walk = Plan transformacji"
- **On-screen text (EN)**: "Gemba Walk = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Gemba Walk już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Gemba Walk today."
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

1. **What is the main purpose of Gemba Walk?**
   A: Gemba Walk helps Gemba Walk enables leaders to answer: **“What is actually happening where value is created?”** It tu....

2. **When should I use Gemba Walk?**
   A: Use it - Performance gaps persist despite meetings and reports.

- You need to validate how work is done vs documented.
- You want to build daily management r....

3. **What are the key outputs?**
   A: Key outputs include Observation log, waste/themes, immediate fixes, improvement backlog, follow-up commitments.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Gemba Walk?**
   A: Gemba Walk helps Gemba Walk enables leaders to answer: **“What is actually happening where value is created?”** It tu....

2. **When should I use Gemba Walk?**
   A: Use it Performance gaps persist despite meetings and reports.
   You need to validate how work is done vs documented.
   You want to build daily management routine....

3. **What are the key outputs?**
   A: Key outputs include Observation log, waste/themes, immediate fixes, improvement backlog, follow-up commitments.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Gemba Walk analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Gemba Walk analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- Gemba walk checklist (starter):
  - [ ] Purpose defined (one question)
  - [ ] Flow unit followed end-to-end
  - [ ] ≥10 observations captured with evidence
  - [ ] Themes tagged (waste categories)
  - [ ] Actions assigned with owners/dates
  - [ ] Follow-up scheduled

### Glossary (short)

- Gemba, go see, waste, theme, quick win, follow-up loop

---

## 13. Additional Resources & Learning Links

- Lean Enterprise Institute (gemba / lean basics): `https://www.lean.org`

---

## 14. References (Authoritative Sources)

- Womack, James P.; Jones, Daniel T. _Lean Thinking_. Simon & Schuster.
- Lean Enterprise Institute — lean leadership/gemba resources: `https://www.lean.org`
- Liker, Jeffrey K. _The Toyota Way_. McGraw-Hill.
