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

## 10. Consultant Report Specification (What goes into the final report)

### 10.1 Report Structure

The Pyramid Principle analysis should produce a structured consultant report or executive presentation with the following sections:

#### **Executive Summary / Key Line (1 page or 1 slide)**

- Governing thought (the answer/recommendation) — **bold, prominent**
- 3–5 supporting points (the "key line") — bullet list
- Bottom-line impact and next steps

#### **Section 1: Context (SCQ)**

- **Situation**: What is true today (facts, baseline metrics, current state)
  - Use bullet points (3–5 facts)
  - Include quantitative baseline where relevant
- **Complication**: What changed or why action is needed (tension, urgency, risks of inaction)
  - 2–3 key complications
  - Explain why "status quo" is no longer viable
- **Question**: What must we decide? (decision question)
  - One clear, decision-grade question

#### **Section 2: Findings (Supporting Points)**

- For each of the 3–5 supporting points:
  - **Claim**: The supporting point statement (as a section heading)
  - **Evidence**: Data, analysis, interviews, benchmarks that support the claim
    - Use tables, charts, or bullet lists
    - Cite sources (internal analysis, external data, expert input)
  - **Implication**: "So what?" — what this means for the decision
  - **Sub-arguments**: If needed, break down into sub-points with their own evidence

**Visual requirement**: Include the pyramid diagram in this section or in the executive summary.

#### **Section 3: Recommendation**

- Restate governing thought with full rationale
- Link back to supporting points (show how evidence leads to recommendation)
- Address alternatives considered (if relevant)
- Risks and mitigations

#### **Section 4: Implementation**

- **Initiatives**: Action items derived from the recommendation
  - For each initiative: title, owner, timeline, success metrics, dependencies
- **Roadmap**: Phased approach (immediate, short-term, medium-term)
- **Governance**: Review cadence, decision gates, success criteria

#### **Section 5: Appendices (if needed)**

- Detailed evidence tables
- Methodology notes
- Glossary

### 10.2 Report Formatting Standards

- **Length**:
  - Executive presentation: 10–15 slides
  - Full report: 15–25 pages (excluding appendices)
- **Visuals required**:
  - Pyramid diagram (Section 2 or Executive Summary) — **mandatory**
  - SCQ framework diagram (Section 1)
  - Evidence summary table (Section 2)
- **Tone**: Executive-ready, answer-first, data-driven
- **Language**: Clear, jargon-free (explain technical terms)

### 10.3 Report Quality Checklist

- [ ] Governing thought is decision-grade (actionable, specific, time-bound)
- [ ] SCQ is complete and factual (no opinions in Situation)
- [ ] 3–5 supporting points are MECE (validated, no overlaps)
- [ ] Each supporting point has evidence (data, analysis, or expert input)
- [ ] Each point has implication ("so what?") and recommended action
- [ ] Outline maps to initiatives/roadmap
- [ ] Report is exportable as PDF/PPTX with proper formatting
- [ ] Pyramid diagram is included and clearly labeled

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
- **VO (PL)**: "Pyramid Principle (Minto) — Storylining pomaga zaplanować transformację."
- **VO (EN)**: "Pyramid Principle (Minto) — Storylining helps plan transformation."
- **On-screen text (PL)**: "Pyramid Principle (Minto) — Storylining = Plan transformacji"
- **On-screen text (EN)**: "Pyramid Principle (Minto) — Storylining = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Pyramid Principle (Minto) — Storylining już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Pyramid Principle (Minto) — Storylining today."
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

### 12.1 TL;DR (Executive Summary)

The Pyramid Principle is a consulting method to present the answer first and support it with MECE arguments. Use SCQ (Situation–Complication–Question) to frame the reader's question, then build 3–5 supporting points with evidence, implications, and actions. Convert the pyramid into an executive-ready outline and initiatives.

### 12.2 FAQ (Frequently Asked Questions)

**Q1: Why put the answer first?**
A: Executives read top-down and want the recommendation immediately. Answer-first saves time and ensures your key message isn't lost in details.

**Q2: How many supporting points should I have?**
A: 3–5 is optimal. Fewer than 3 may miss key logic; more than 5 becomes hard to remember and may indicate poor grouping.

**Q3: What if my supporting points overlap?**
A: Reframe the grouping dimension. Instead of "customers" and "products" (which overlap), use "revenue drivers" vs. "cost drivers" or "short-term" vs. "long-term."

**Q4: Can I use SCQ without the pyramid?**
A: Yes, SCQ is useful on its own for framing context. But the full power comes from combining SCQ (context) with the pyramid (answer + proof).

**Q5: What if I don't have evidence for a supporting point?**
A: Either find evidence (data, interviews, analysis) or remove the point. Unsupported claims weaken the entire pyramid.

**Q6: How do I convert the pyramid into slides?**
A: One supporting point = one section of slides (2–4 slides). Each slide should have: claim, evidence, implication. The pyramid diagram becomes your executive summary slide.

**Q7: Can I have multiple governing thoughts?**
A: No. If you have multiple recommendations, create separate pyramids or make one the "master" and others become supporting points.

**Q8: What if my audience disagrees with the answer?**
A: The pyramid structure helps: if they disagree with the answer, they must disagree with at least one supporting point. Use that to focus the discussion on evidence.

**Q9: How detailed should sub-arguments be?**
A: Sub-arguments should be one level deeper than supporting points. If supporting points are strategic, sub-arguments are tactical. Don't go deeper than 3 levels total.

**Q10: Can I use the Pyramid Principle for presentations?**
A: Yes. The pyramid structure maps directly to presentation flow: opening slide (governing thought), section slides (supporting points), detail slides (sub-arguments + evidence).

### 12.3

6. **What inputs are required?**
   A: - Audience + decision question

- Key findings (facts) from analysis
- **Optional inputs**:
  - Alternatives considered, risks, constraints, stakeholder concerns
- **Related tools (internal)**:
  - [...

7. **How long does it typically take?**
   A: 30–90 minutes (one storyline); 1–2 days (full deck/report refactor)

8. **What makes a good Pyramid Principle (Minto) — Storylining analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

9. **What inputs are required?**
   A: - Audience + decision question

- Key findings (facts) from analysis
- **Optional inputs**:
  - Alternatives considered, risks, constraints, stakeholder concerns
- **Related tools (internal)**:
  - [...

10. **How long does it typically take?**
    A: 30–90 minutes (one storyline); 1–2 days (full deck/report refactor)

11. **What makes a good Pyramid Principle (Minto) — Storylining analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, and actionable insights.

### FAQ (at least 8)

1. **What is the main purpose of Pyramid Principle (Minto) — Storylining?**
   A: Pyramid Principle (Minto) — Storylining helps The Pyramid Principle is a method for structuring thinking and communication so that the main point ....

2. **When should I use Pyramid Principle (Minto) — Storylining?**
   A: Use it You need to communicate a recommendation to executives.
   Your analysis is correct but your narrative is unclear.
   Stakeholders ask: “So what? What do we....

3. **What are the key outputs?**
   A: Key outputs include Governing thought, pyramid of supporting arguments, SCQ framing, MECE grouping, slide/story outline.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Pyramid Principle (Minto) — Storylining analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   Checklists

**DoD Checklist (Definition of Done):**

- [ ] Governing thought is decision-grade (actionable, specific, time-bound)
- [ ] SCQ is complete and factual (no opinions in Situation)
- [ ] 3–5 supporting points are MECE (validated, no overlaps)
- [ ] Each supporting point has evidence (data, analysis, or expert input)
- [ ] Each point has implication ("so what?") and recommended action
- [ ] Outline maps to initiatives/roadmap
- [ ] Report/presentation is exportable with proper formatting

**Common Mistakes Checklist:**

- [ ] Starting with background → Fix: start with the answer
- [ ] Overlapping supporting points → Fix: re-group using MECE
- [ ] No implication/action → Fix: add "so what" and next steps
- [ ] Unsupported claims → Fix: attach evidence or remove point
- [ ] Too many supporting points → Fix: group into 3–5 categories

### 12.4 Glossary (Quick Reference)

| Term              | Definition                                | Example                          |
| ----------------- | ----------------------------------------- | -------------------------------- |
| Governing thought | The main answer/recommendation            | "We recommend X because A, B, C" |
| Key line          | Governing thought + 3–5 supporting points | Executive summary content        |
| SCQ               | Situation, Complication, Question         | Context framework                |
| Supporting point  | MECE argument supporting the answer       | "Economics favor entry"          |
| Sub-argument      | Detail under a supporting point           | "Margin uplift is 250–350 bps"   |

---

## 13. Additional Resources & Learning Links

### 13.1 Knowledge Base Articles (Internal)

- **Pyramid Principle Deep Dive**: `/knowledge-base/strategy/pyramid-principle`
- **SCQ Framework Guide**: `/knowledge-base/methods/scq-framework`
- **Executive Communication Templates**: `/knowledge-base/templates/executive-communication`
- **MECE Grouping Examples**: `/knowledge-base/examples/mece-grouping`

### 13.2 External Learning Resources

**Official Sources:**

- [Minto Books: The Minto Pyramid Principle Concept](https://www.barbaraminto.com/concept.html) — Official concept page, SCQ framework
- [Minto Books: The Minto Pyramid Principle Textbook](https://www.barbaraminto.com/textbook.html) — Definitive guide (12 chapters, 3 appendices)
- [Minto Books: Online Course](https://www.barbaraminto.com/online_course.html) — Self-paced training

**Tutorials & Examples:**

- [Medium: Lessons from McKinsey — The Pyramid Principle](https://medium.com/lessons-from-mckinsey/the-pyramid-principle-f0885dd3c5c7) — Practical guide
- Search YouTube: "Pyramid Principle Minto" — Multiple tutorial videos
- Search YouTube: "SCQ framework consulting" — SCQ-specific tutorials

**Practice Tools:**

- [Miro Template: Pyramid Structure](https://miro.com/templates/pyramid-structure/) — Collaborative pyramid builder
- [Lucidchart: Pyramid Diagram Template](https://www.lucidchart.com/pages/templates/pyramid-diagram) — Diagramming tool

### 13.3 Related Tools in This Catalog

- [`mece-issue-tree.md`](./mece-issue-tree.md) — Uses MECE for problem structuring
- [`hypothesis-driven-strategy.md`](./hypothesis-driven-strategy.md) — Uses pyramid for communication

---

## 14. References (Authoritative Sources)

### Primary Sources

- [Minto Books: The Minto Pyramid Principle Concept](https://www.barbaraminto.com/concept.html) — Official concept page, SCQ framework explanation
- [Minto Books: The Minto Pyramid Principle Textbook](https://www.barbaraminto.com/textbook.html) — Definitive guide: "The Minto Pyramid Principle: Logic in Writing, Thinking and Problem Solving" (1996 edition, 12 chapters, 3 appendices)
- [McKinsey Alumni: Barbara Minto — MECE and Pyramid Principle](https://www.mckinsey.com/alumni/news-and-insights/global-news/alumni-news/barbara-minto-mece-i-invented-it-so-i-get-to-say-how-to-pronounce-it) — Origin story from McKinsey's first female MBA hire

### Methodology & Application

- [Medium: Lessons from McKinsey — The Pyramid Principle](https://medium.com/lessons-from-mckinsey/the-pyramid-principle-f0885dd3c5c7) — Practical guide with examples
- [Wikipedia: Barbara Minto](https://en.wikipedia.org/wiki/Barbara_Minto) — Overview and historical context

### Academic & Theoretical

- Minto, Barbara. _The Minto Pyramid Principle: Logic in Writing, Thinking and Problem Solving_ (1996 edition) — Definitive textbook, standard text for consulting firms

---
