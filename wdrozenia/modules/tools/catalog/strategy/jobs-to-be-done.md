# Jobs To Be Done (JTBD)

## Metadata

- **Tool name**: Jobs To Be Done (JTBD)
- **Slug**: `jobs-to-be-done`
- **Category**: Strategy
- **Level**: Core
- **Typical duration**: 2–6 hours (initial); 1–2 weeks (with interviews)
- **Best for**: Product strategy, customer insight, differentiation, innovation, reducing feature-bloat
- **Not for**: Pure segmentation by demographics (JTBD is about circumstances and progress)
- **Primary outputs**: Job statement, job map, forces of progress, key struggles, opportunity areas, initiatives
- **Required inputs**: target decision (what are we trying to improve?), target user/customer context
- **Optional inputs**: interviews, usage data, churn/win-loss notes
- **Related tools**:
  - [`customer-segmentation.md`](./customer-segmentation.md)
  - [`strategic-positioning.md`](./strategic-positioning.md)
  - [`business-model-canvas.md`](./business-model-canvas.md)
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

JTBD helps teams answer **why customers choose** (or reject) products/services by framing demand around the **progress people want to make in a specific situation**. It enables decisions such as:

- what to improve (reduce struggle),
- what to build (new capability),
- what to stop building (feature bloat),
- how to position and message value (against “real competitors” customers hire).

### 1.2 When to use

- You have ambiguous demand: customers ask for features, but adoption/retention doesn’t improve.
- You need differentiated positioning beyond “more features” or “lower price.”
- You want to innovate while staying anchored in real customer behavior (stories, not opinions).
- You are doing win/loss, churn, or product-market fit work and need a reusable structure.

### 1.3 When NOT to use (anti-patterns)

- You only want demographic segmentation (“age, industry”) without understanding situations/struggles.
- You are already committed to a solution and are looking for justification.
- You cannot access any customer stories or proxy evidence (at least internal narratives).

### 1.4 What “good” looks like

- A clear **job statement** (progress + situation + outcome) validated on multiple real stories.
- A job map that makes “struggle moments” and constraints explicit.
- A ranked list of opportunities tied to unmet needs (not feature requests).
- Initiatives with traceability: story → struggle → opportunity → initiative.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Job**: progress toward a goal in a specific circumstance.
- **Hire**: customers “hire” products/services to do the job; they “fire” alternatives.
- **Struggling moment**: a point where the current approach breaks down (trigger to change).
- **Forces of progress**: why change happens now:
  - **Push** (pain with current situation),
  - **Pull** (attraction to a new solution),
  - **Habit** (status quo inertia),
  - **Anxiety** (fear/uncertainty about switching).
- **Job map**: steps from defining the task to executing it and monitoring results.

### 2.2 Glossary

| Term               | Definition                                       | Notes                          |
| ------------------ | ------------------------------------------------ | ------------------------------ |
| Job statement      | A precise description of progress in a situation | Must include circumstance      |
| Struggle moment    | Trigger where current solution fails             | Often emotional + functional   |
| Forces of progress | Drivers/inhibitors of change                     | Use as a diagnostic            |
| Job map            | Standardized job steps                           | Useful for opportunity mapping |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input                | Description                     | Example                            | Where in the app it can come from |
| -------------------- | ------------------------------- | ---------------------------------- | --------------------------------- |
| Target decision      | What you want to improve/decide | “Reduce churn in onboarding”       | Tool setup                        |
| Target user context  | Who + in what situation         | “New ops manager in first 30 days” | Project context                   |
| 3+ stories (minimum) | Narrative of a real choice      | Win/loss notes, support tickets    | Attachments / notes               |

### 3.2 Optional inputs (improves quality)

| Input               | Description                       | Example                  | Where in the app it can come from |
| ------------------- | --------------------------------- | ------------------------ | --------------------------------- |
| Interviews          | JTBD interview transcripts        | 8–12 interviews          | Upload / notes                    |
| Usage evidence      | Funnels, events, activation/churn | Activation rate          | Analytics                         |
| Competitive context | What customers hire instead       | “Spreadsheet + WhatsApp” | Benchmarking                      |

### 3.3 Data quality checks

- At least 3 stories must be **concrete**: situation, trigger, constraints, outcome.
- Avoid “opinions about features” without context (“I want X”); always ask “when/why?”
- Include both **success** and **failure** stories (adopted + churned).

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Define scope (decision + audience)

- Define the decision to enable (e.g., “what should we build/change?”).
- Define the actor and situation (role + context + constraints).

### Step 2 — Capture stories (timeline cards)

For each story capture:

- Trigger (“what happened that made change necessary?”)
- Previous solution (“what did you use before?”)
- Struggle moments (functional + emotional)
- What was hired/fired and why
- Success criteria (“how did you judge it worked?”)

### Step 3 — Write job statements

Use the pattern:

> “Help me **[make progress]** when **[situation + constraints]** so I can **[desired outcome]**.”

Validate by checking if different personas can share the same job in different contexts.

### Step 4 — Build a job map

Typical job map steps:

1. Define / frame the job
2. Locate inputs
3. Prepare
4. Execute
5. Monitor
6. Modify / iterate
7. Conclude / maintain

Attach struggles/opportunities to steps.

### Step 5 — Forces of progress (2×2)

Fill:

- Pushes (pain today)
- Pulls (attraction to a better outcome)
- Habits (why status quo persists)
- Anxieties (risks/fears of switching)

### Step 6 — Identify opportunities and rank them

For each opportunity:

- unmet need (what’s hard today),
- impact (1–5),
- evidence strength (high/medium/low),
- initiative candidate.

### Common mistakes & fixes

- **Mistake**: writing jobs as solutions (“hire CRM”) → **Fix**: rewrite as progress (“retain customers despite…”).
- **Mistake**: skipping stories → **Fix**: enforce minimum 3 concrete stories before synthesis.
- **Mistake**: treating forces of progress as a brainstorm → **Fix**: tie each item to story evidence.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs

- Job statement(s) + scope
- Job map with struggles and opportunity areas
- Forces of progress diagram
- Ranked opportunity backlog
- 3–7 initiative drafts with traceability

### 5.2 DoD checklist

- [ ] Target decision + audience defined
- [ ] 3+ concrete stories captured (success + failure preferred)
- [ ] Job statement validated (clear situation + outcome)
- [ ] Job map completed with tagged struggles
- [ ] Forces of progress filled from evidence
- [ ] Opportunities ranked and initiatives drafted

---

## 6. UI / Graphic specification

### 6.1 Workspace steps (left)

1. Setup → 2) Stories → 3) Job statement → 4) Job map → 5) Forces → 6) Opportunities → 7) Initiatives

### 6.2 Core visuals (how it should look)

- **Story timeline**: cards in chronological order with tags (trigger / struggle / hired / outcome).
- **Job statement builder**: structured fields + live preview.
- **Job map**: horizontal steps, each step has “struggles” chips and “opportunities” chips.
- **Forces of progress**: 2×2 board (Push / Pull / Habit / Anxiety) with evidence tags.
- **Opportunity backlog**: table with impact, evidence strength, and initiative linkage.

###

### 6.2 Layout requirements

**Two-column layout:**

- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

**Visual design:**

- Clean, modern interface wi

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
- Tooltips: hover over elemen

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

ts for additional information

th consistent spacing

- Color-coded elements for different states and categories
- Clear typography hierarchy (headings, body text, labels)
- Interactive elements with hover states and feedback

  6.3 Best practices for graphics

- Keep one “hero” diagram in the report: job map + 2–3 highlighted struggles.
- Use consistent colors: Push (red), Pull (green), Habit (gray), Anxiety (amber).
- Every card must show a “source” link back to a story.

---

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

## 7. Worked example

### Context (classic “moving lives”)

A condo developer assumed buyers “wanted premium features.” JTBD interviews revealed buyers were hiring the condo to **“move my life to a new stage with less anxiety”** while downsizing, especially around meaningful possessions (e.g., dining table).

### Job statement (validated)

“Help me **relocate to a new home with confidence** when **downsizing and emotionally attached to key possessions** so I can **start the next life chapter without regret**.”

### Forces of progress (summary)

- Push: current home too big to maintain, time pressure
- Pull: simpler lifestyle + proximity to family
- Habit: attachment to possessions + routines
- Anxiety: fear of losing identity + regret about what to keep

### Initiatives derived

1. **Moving & storage concierge** (bundle)
2. “Keep what matters” decision kit (guided checklist + service)
3. Onboarding journey redesign focused on anxieties (not features)

---

## 8. Implementation spec

### 8.1 Data model (JSON)

```json
{
  "decision": { "goal": "Reduce churn in onboarding", "horizonMonths": 6 },
  "audience": { "role": "Ops Manager", "context": "first 30 days" },
  "stories": [
    {
      "id": "s1",
      "title": "Switched from spreadsheets",
      "trigger": "Audit failure due to inconsistent process",
      "previousSolution": "Spreadsheet + email approvals",
      "struggles": ["No visibility", "Slow approvals", "Fear of blame"],
      "hired": "Our tool",
      "hiredBecause": ["Centralized workflow", "Audit trail"],
      "successCriteria": ["Approvals < 24h", "Audit-ready evidence"],
      "evidenceLinks": ["attachment:file-123"]
    }
  ],
  "jobStatements": [
    {
      "id": "j1",
      "statement": "Help me get approvals reliably when compliance pressure is high so I can pass audits with confidence.",
      "functional": ["Get approvals fast", "Keep audit trail"],
      "emotional": ["Feel safe", "Avoid blame"],
      "social": ["Look competent"]
    }
  ],
  "jobMap": [
    {
      "step": "Define",
      "struggles": ["Unclear requirements"],
      "opportunities": ["Guided intake templates"]
    },
    {
      "step": "Execute",
      "struggles": ["Chasing approvals"],
      "opportunities": ["Automated reminders + escalation"]
    }
  ],
  "forcesOfProgress": {
    "push": ["Audit pressure", "Rework cost"],
    "pull": ["Confidence", "Visibility"],
    "habit": ["Email approvals"],
    "anxiety": ["Implementation effort", "Learning curve"]
  },
  "opportunities": [
    {
      "id": "o1",
      "title": "Guided onboarding for compliance setup",
      "impact": 5,
      "evidence": "medium"
    }
  ],
  "initiativeDrafts": [
    {
      "title": "Compliance-first onboarding templates",
      "rationale": "Addresses top struggle in Define step"
    }
  ]
}
```

### 8.2 Statuses & lifecycle (suggested)

- `DRAFT` → `REVIEW` → `APPROVED` → `GENERATED` (initiatives)

---

## 9. AI spec

### 9.1 Prompting goals

- Turn raw stories/interviews into structured job statements and forces of progress.
- Detect contradictions (multiple jobs mixed) and suggest splitting scopes.
- Propose opportunity areas and initiatives with traceability.

### 9.2 JSON extraction

AI must output updates matching the JSON model above (stories, jobStatements, jobMap, forces, opportunities, initiativeDrafts).

### 9.3 Guardrails

- Do not invent “facts” (if evidence is missing, mark confidence low).
- Avoid solution-first statements; enforce “progress + situation + outcome.”

---

## 10. Consultant Report Specification (What goes into the final report)

### 10.1 Report structure

1. Executive summary (job + key struggles + top initiatives)
2. Context & scope (decision, audience, evidence set)
3. Job statement(s) + validation summary
4. Job map (with highlighted struggles/opportunities)
5. Forces of progress (push/pull/habit/anxiety)
6. Opportunity ranking + evidence strength
7. Recommended initiatives + roadmap + success metrics
8. Appendix: story cards / interview notes

### 10.2 Required visuals

- Job map (one-page)
- Forces of progress (2×2)
- Opportunity backlog table

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
- **VO (PL)**: "Jobs To Be Done (JTBD) pomaga zaplanować transformację."
- **VO (EN)**: "Jobs To Be Done (JTBD) helps plan transformation."
- **On-screen text (PL)**: "Jobs To Be Done (JTBD) = Plan transformacji"
- **On-screen text (EN)**: "Jobs To Be Done (JTBD) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Jobs To Be Done (JTBD) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Jobs To Be Done (JTBD) today."
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

## 12. Knowledge Base Extraction Pack

### 12.1 TL;DR

JTBD helps you design and position products around customer progress in real situations. It turns stories into job statements, maps struggles, and produces ranked opportunities and initiatives.

### 12.2 FAQ

- **What’s the “job”?**
  - The progress the customer wants in a specific situation, including functional, social, and emotional outcomes.
- **How is this different from personas?**
  - Personas describe people; JTBD describes **situations and progress**, which often cut across personas.
- **How many interviews do I need?**
  - You can start with 3 concrete stories, but 8–12 interviews typically improves confidence significantly.
- **What is the biggest failure mode?**
  - Writing solution statements (“hire product X”) instead of progress statements with situation and outcome.

### 12.3

6. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data.

7. **How long does it typically take?**
   A: 2–6 hours (initial); 1–2 weeks (with interviews)

8. **What makes a good Jobs To Be Done (JTBD) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

### FAQ (at least 8)

1. **What is the main purpose of Jobs To Be Done (JTBD)?**
   A: Jobs To Be Done (JTBD) helps JTBD helps teams answer **why customers choose** (or reject) products/services by framing demand aro....

2. **When should I use Jobs To Be Done (JTBD)?**
   A: Use it You have ambiguous demand: customers ask for features, but adoption/retention doesn’t improve.
   You need differentiated positioning beyond “more featur....

3. **What are the key outputs?**
   A: Key outputs include Job statement, job map, forces of progress, key struggles, opportunity areas, initiatives.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Jobs To Be Done (JTBD) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   Checklists

- **DoD checklist**
  - Scope defined; 3+ stories; job statement validated; job map completed; forces filled; ranked opportunities; initiatives drafted.

### 12.4 Glossary

| Term               | Definition                     | Notes                     |
| ------------------ | ------------------------------ | ------------------------- |
| Job statement      | Progress + situation + outcome | Avoid solution language   |
| Forces of progress | Push/Pull/Habit/Anxiety        | Evidence-linked           |
| Struggle moment    | Trigger + pain point           | Highest leverage insights |

---

## 13. Additional Resources & Learning Links

### 13.1 Internal (suggested)

- Knowledge base article derived from this file.
- Cross-links: segmentation, positioning, business model canvas.

### 13.2 External

- Christensen Institute resources on JTBD
- Ulwick’s ODI / JTBD materials

---

## 14. References (Authoritative Sources)

- [Clayton M. Christensen et al.: _Competing Against Luck_ (publisher page)](https://www.harperacademic.com/book/9780062435613/competing-against-luck/)
- [Christensen Institute: _Competing Against Luck_ (book page)](https://www.christenseninstitute.org/book/competing-against-luck/)
- [Wikipedia: Outcome-Driven Innovation (background; not primary)](https://en.wikipedia.org/wiki/Outcome-Driven_Innovation)

### Academic & Theoretical

- [Add academic sources]

---

## 8. References (sources)

- [Christensen Institute: Jobs to Be Done Theory (definition, forces, examples)](https://www.christenseninstitute.org/theory/jobs-to-be-done/)\n+
