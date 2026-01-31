# Pyramid Principle (Minto) — Storylining for Strategy

## Metadata

- **Tool name**: Pyramid Principle (Minto) — Storylining
- **Slug**: `pyramid-principle`
- **Category**: Strategy
- **Level**: Core
- **Typical duration**: 30–90 minutes (one storyline); 1–2 days (full deck/report refactor)
- **Best for**: Executive communication, strategy recommendations, aligning teams on “the answer”
- **Not for**: Raw brainstorming, exploratory research notes (use after analysis)
- **Primary outputs**: Governing thought, pyramid of supporting arguments, SCQ framing, MECE grouping, slide/story outline
- **Required inputs (minimum)**:
  - Audience + decision question
  - Key findings (facts) from analysis
- **Optional inputs**:
  - Alternatives considered, risks, constraints, stakeholder concerns
- **Related tools (internal)**:
  - [`mece-issue-tree.md`](./mece-issue-tree.md)
  - [`hypothesis-driven-strategy.md`](./hypothesis-driven-strategy.md)
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

The Pyramid Principle is a method for structuring thinking and communication so that the main point is immediately clear, and all supporting arguments are logically grouped beneath it. It is the core “consulting writing” technique for memos, reports, and decks.

### 1.2 When to use

- You need to communicate a recommendation to executives.
- Your analysis is correct but your narrative is unclear.
- Stakeholders ask: “So what? What do we do?”

### 1.3 When NOT to use

- Early exploration when you don’t yet have an answer.
- Brainstorming without evidence.

### 1.4 What “good” looks like

- One governing recommendation at the top.
- 3–5 supporting points that are MECE and each backed by evidence.
- A clear “reader question” framed via SCQ (Situation–Complication–Question).

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Pyramid**: a hierarchy of ideas where the top is a summary of the supporting ideas below.
- **Governing thought**: the single main message (“the answer”).
- **MECE grouping**: supporting points must not overlap and must cover the logic needed.
- **SCQ**: Situation → Complication → Question, used to surface the question in the reader’s mind.

### 2.2 Glossary

| Term              | Definition                            | Notes                         |
| ----------------- | ------------------------------------- | ----------------------------- |
| Governing thought | The main point                        | One sentence, decision-grade  |
| Key line          | Governing thought + supporting points | Often the “Executive Summary” |
| SCQ               | Situation, Complication, Question     | Creates context and urgency   |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input             | Description           | Example                       | Where in the app it can come from |
| ----------------- | --------------------- | ----------------------------- | --------------------------------- |
| Audience          | Who decides           | CEO, CFO                      | Tool setup                        |
| Decision question | What must be decided  | “Should we enter segment X?”  | Tool setup                        |
| Findings          | Evidence-backed facts | Margin drivers, market forces | From other tools                  |

### 3.2 Optional inputs

| Input        | Description        | Example         | Where in the app it can come from |
| ------------ | ------------------ | --------------- | --------------------------------- |
| Objections   | Likely pushback    | “Risk too high” | Stakeholder notes                 |
| Alternatives | Options considered | A/B/C           | Portfolio/initiative context      |

---

## 4. Step-by-step method

### Step 1 — Define the answer first (governing thought)

Write one sentence:

> “We recommend **X** because **A, B, C**, therefore we will achieve **Y** within **T**.”

### Step 2 — Build SCQ to frame the reader’s question

- **Situation**: what is true today (facts)
- **Complication**: what changed or why this matters (tension)
- **Question**: what must we decide?

### Step 3 — Group supporting points (MECE)

Create 3–5 supporting points. They can be grouped by:

- time (now/next/later)
- stakeholder (customer/ops/finance)
- value drivers (revenue/cost/risk)
- options (A/B/C)

Rule: supporting points must be MECE and collectively justify the top claim.

### Step 4 — For each supporting point, build sub-arguments

For each point:

- claim
- evidence
- implication (“so what?”)
- recommended action

### Step 5 — Convert into an outline (report/deck)

Recommended default outline:

1. Executive summary (key line)
2. Context (SCQ)
3. Findings (supporting points + evidence)
4. Options (if relevant)
5. Recommendation (decision + rationale)
6. Risks & mitigations
7. Initiatives & roadmap

### Common mistakes & fixes

- **Mistake**: Starting with background → **Fix**: start with the answer.
- **Mistake**: Overlapping supporting points → **Fix**: re-group using MECE.
- **Mistake**: No implication/action → **Fix**: add “so what” and next steps.

---

## 5. Outputs & DoD

### Outputs

| Deliverable   | Description                      | Format in the app      |
| ------------- | -------------------------------- | ---------------------- |
| Key line      | Governing thought + 3–5 supports | Executive summary card |
| SCQ           | Situation/Complication/Question  | Context section        |
| Story outline | Sections and slide titles        | Outline view           |
| Evidence map  | Which facts support which claims | Links/attachments      |

### DoD checklist

- [ ] Governing thought is decision-grade (actionable)
- [ ] SCQ is complete and factual
- [ ] 3–5 supporting points are MECE
- [ ] Each point has evidence + implication + action
- [ ] Outline maps to initiatives/roadmap

---

## 6. UI / Graphic specification (What the user sees)

### 6.1 Workspace steps (left)

1. Setup (audience, decision question)
2. SCQ builder
3. Key line (governing thought + supports)
4. Evidence mapping
5. Outline & export
6. Initiatives

### 6.2 Visualization & Graphics Design

#### 6.2.1 Pyramid Diagram Visualization

**Visual Structure:**

- **Layout**: Inverted pyramid (top = governing thought, widens downward with supporting points)
- **Node shapes**:
  - Governing thought: Large rounded rectangle at top (bold border, primary color #2563eb)
  - Supporting points (3–5): Medium rectangles below (secondary color #64748b)
  - Sub-arguments: Smaller rectangles nested under each supporting point (tertiary color #94a3b8)
  - Evidence badges: Small circular badges attached to nodes (icon-based, color-coded by source type)
- **Color coding**:
  - Governing thought: Primary brand color (#2563eb)
  - Supporting points: Neutral gray (#64748b)
  - Evidence badges:
    - Data/analysis: Blue (#3b82f6)
    - Interviews: Green (#10b981)
    - External sources: Orange (#f59e0b)
    - Assumptions: Yellow (#eab308)
- **Connectors**: Horizontal lines connecting supporting points to governing thought; vertical lines connecting sub-arguments to supporting points
- **Node content**: Each node shows:
  - Title/claim (bold, 14–16px)
  - Evidence count badge (if evidence attached)
  - MECE validation indicator (green checkmark or red warning)

**Best Practices for Pyramid Graphics:**

1. **Answer-first placement**: Governing thought must be at the top, clearly visible
2. **Limit supporting points**: 3–5 maximum; if more, group them into higher-level categories
3. **MECE validation**: Visual indicators (color borders) flag overlapping supporting points
4. **Evidence mapping**: Each supporting point should show evidence badges; click to expand evidence list
5. **Hierarchy depth**: Maximum 3 levels (governing thought → supporting points → sub-arguments)
6. **Export formats**: PNG (presentation-ready), SVG (editable), PDF (document-ready)

**Example Pyramid Layout:**

```
                    [Governing Thought]
                    "We recommend X because..."
                              |
        ┌─────────────────────┼─────────────────────┐
        |                     |                     |
[Supporting Point 1]  [Supporting Point 2]  [Supporting Point 3]
"Economics favor..."   "Capabilities ready"  "Timing is right"
        |                     |                     |
    [Evidence]            [Evidence]            [Evidence]
    [Sub-arg]            [Sub-arg]            [Sub-arg]
```

#### 6.2.2 SCQ Framework Visualization

**Visual Structure:**

- **Layout**: Three connected boxes (left to right or top to bottom)
- **Boxes**:
  - **Situation**: What is true today (facts, baseline)
  - **Complication**: What changed or why this matters (tension, urgency)
  - **Question**: What must we decide? (decision question)
- **Connectors**: Arrows showing flow: Situation → Complication → Question
- **Content per box**:
  - Bullet points (3–5 facts per Situation, 2–3 complications, 1 clear question)
  - Icons: Situation (info), Complication (warning), Question (question mark)

**Best Practices:**

1. **Keep Situation factual**: No opinions, only verifiable facts
2. **Complication creates urgency**: Must explain why action is needed now
3. **Question is decision-grade**: Must be answerable with "yes/no" or clear recommendation
4. **Visual flow**: Use arrows and color progression (neutral → warning → action)

#### 6.2.3 Story Outline View

**Visual Structure:**

- **Format**: Hierarchical list (sections → subsections → slide titles)
- **Indentation**: 3 levels (section, subsection, slide)
- **Icons**:
  - Section: Folder icon
  - Subsection: Document icon
  - Slide: Slide icon
- **Status badges**: Draft / Review / Approved per section
- **Drag-and-drop**: Reorder sections/slides

**Best Practices:**

1. **Default outline structure**: Executive Summary → Context (SCQ) → Findings → Options → Recommendation → Risks → Initiatives
2. **Slide count guidance**: 10–15 slides for executive presentation, 20–30 for full report
3. **Section completeness**: Each section should map to at least one supporting point from the pyramid

### 6.3 Interactions

- Drag-and-drop reorder supporting points (maintains MECE grouping)
- "MECE check" button → highlights overlaps/gaps with tooltips
- Click evidence badge → opens evidence panel (source, notes, attachments)
- Click supporting point → expands to show sub-arguments and evidence
- "Generate outline" button → creates default report/deck structure from pyramid
- Export pyramid as PNG/SVG/PDF with customizable styling

### 6.4 States

- **Draft**: Fully editable (add/delete/reorder points, edit SCQ, attach evidence)
- **Review**: Read-only except comments; can add evidence attachments
- **Approved**: Read-only; outline export allowed; pyramid locked for versioning

---

## 7. Worked example

### Context

Manufacturing company deciding whether to enter a premium segment in Europe.

### Governing thought (answer first)

> “We should enter the premium segment in Europe within 12 months because it improves margin by 250–350 bps, our capabilities are close to readiness, and competitor moves create a narrow window—therefore we prioritize three initiatives now.”

### SCQ

- Situation: Core segment growth is flat; product quality improved; EU demand for premium features rising.\n- Complication: Competitors are launching premium SKUs; margin pressure in core.\n- Question: Should we enter premium segment now, and how?

### Supporting points (MECE)

1. Economics: margin uplift and payback\n2. Capability gaps: what must be built\n3. Competitive timing: window and risks

### Initiatives

1. Premium SKU pilot in 2 regions\n2) Capability build: quality + service model\n3) Pricing and channel playbook

---

## 8. Implementation spec

### Data model (JSON)

```json
{
  "audience": "CEO",
  "decisionQuestion": "Enter premium segment in EU within 12 months?",
  "scq": { "situation": ["..."], "complication": ["..."], "question": "..." },
  "governingThought": "We recommend ...",
  "supportingPoints": [
    {
      "id": "p1",
      "title": "Economics",
      "evidence": ["link:analysis-1"],
      "implication": "...",
      "actions": ["..."]
    }
  ],
  "outline": ["Executive summary", "Context", "Findings", "Recommendation", "Risks", "Initiatives"]
}
```

### Validation (DoD)

- Governing thought present\n- SCQ complete\n- ≥3 supporting points\n- Evidence attached to each point

---

## 9. AI spec

### Rules

- Force answer-first; never hide the recommendation.\n- Enforce MECE for supporting points.\n- Ask clarifying questions if audience/decision is missing.\n- Flag unsupported claims.\n

### Extraction schema (JSON)

```json
{
  "governingThought": "string",
  "supportingPoints": [
    {
      "title": "string",
      "evidenceNeeded": ["string"],
      "implication": "string",
      "actions": ["string"]
    }
  ],
  "scq": { "situation": ["string"], "complication": ["string"], "question": "string" }
}
```

---

## 10. Video storyboard

1. Why execs need answer-first\n2) Build SCQ\n3) Write governing thought\n4) Make points MECE\n5) Map evidence\n6) Export outline + initiatives

---

## 11. Knowledge base extraction pack

### TL;DR

The Pyramid Principle is a consulting method to present the answer first and support it with MECE arguments. Use SCQ to frame the reader’s question, then build 3–5 supporting points with evidence, implications, and actions. Convert the pyramid into an executive-ready outline and initiatives.

---

## 12. References (sources)

- [Minto Books: The Minto Pyramid Principle Concept](https://www.barbaraminto.com/concept.html)\n+
