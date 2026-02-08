# Tool Documentation Template (Strategic Tools Catalog)

> Location: `wdrozenia/modules/tools/catalog/strategy/<tool-slug>.md`
>
> This template is intentionally long. It is designed to be a **single source of truth** for:
>
> - Product/UX implementation
> - Knowledge base articles
> - Video scripts / training scenarios
>
> Rules:
>
> - Write in **English**.
> - Every section is required. If something is unknown, write **assumptions** and mark as `TBD`.
> - Always include **at least one worked example** with realistic numbers and constraints.
> - Always include **sources** at the end.

---

## Metadata

- **Tool name**:
- **Slug**:
- **Category**: Strategy
- **Level**: Basic | Core | Advanced
- **Typical duration**: 30–60 min | 1–2 hours | 1 day workshop | Multi-session
- **Best for**:
- **Not for**:
- **Primary outputs**:
- **Required inputs (minimum)**:
- **Optional inputs**:
- **Related tools (internal)**:
  - (link) `./<other-tool>.md`
- **Created**: YYYY-MM-DD
- **Last updated**: YYYY-MM-DD
- **Owner**: (team/person)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

- Describe the decision this tool enables.

### 1.2 When to use

- Bullet list of situations.

### 1.3 When NOT to use (anti-patterns)

- Bullet list of situations.

### 1.4 What “good” looks like

- Measurable criteria (clarity, evidence, alignment, testability).

---

## 2. Concept & key definitions

### 2.1 Core concepts

- Define the key constructs.

### 2.2 Glossary

| Term | Definition | Notes |
| ---- | ---------- | ----- |
|      |            |       |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input | Description | Example | Where in the app it can come from |
| ----- | ----------- | ------- | --------------------------------- |
|       |             |         |                                   |

### 3.2 Optional inputs (improves quality)

| Input | Description | Example | Where in the app it can come from |
| ----- | ----------- | ------- | --------------------------------- |
|       |             |         |                                   |

### 3.3 Data quality checks

- What must be validated, and how.

---

## 4. Step-by-step method (How the user works with it)

> This section must be written so a user can execute it without a consultant.

### Step 1 — Setup

- What to decide / define first.

### Step 2 — Collect facts

- What to gather; avoid opinions.

### Step 3 — Structure

- How to structure information (MECE where relevant).

### Step 4 — Analyze

- Rules, scoring, classifications, heuristics.

### Step 5 — Synthesize insights

- How to turn analysis into conclusions.

### Step 6 — Convert to initiatives

- How to phrase initiatives; expected fields; how to prioritize.

### Common mistakes & fixes

- Mistake → Fix

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable | Description | Format in the app |
| ----------- | ----------- | ----------------- |
|             |             |                   |

### 5.2 Definition of Done (DoD) checklist

- [ ] …
- [ ] …

---

## 6. UI / Graphic specification (What the user sees)

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

- **Tool Hub card**: name, one-line purpose, “Start”
- **Tool Workspace**:
  - Left column: steps + content
  - Right column: status, DoD, review/approve, export, initiative generation
- **Preview / visualization**: what chart/matrix/tree is used

### 6.2 Layout requirements

- Left panel sections and order (stepper)
- Right panel controls and order

### 6.3 Interactions

- Click/hover/drag behavior
- Keyboard shortcuts (if any)
- Deep links (e.g., clicking a cell navigates to a specific step/section)

### 6.4 States

- Empty state
- Loading state
- Error state
- Draft vs Review vs Approved (read-only rules)

### 6.5 Export formats

- PDF / PPTX / CSV (TBD if not planned)

---

## 7. Worked example (End-to-end)

### 7.1 Context

- Company, industry, size, constraints.

### 7.2 Inputs (filled)

- Provide the actual filled-in inputs.

### 7.3 Analysis (filled)

- Show the result (table/matrix/tree) in text form.

### 7.4 Insights

- 3–7 key insights.

### 7.5 Initiatives derived

| Initiative title | Rationale | Expected impact | Effort | Risks | First 2 steps |
| ---------------- | --------- | --------------- | ------ | ----- | ------------- |
|                  |           |                 |        |       |               |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

- **Tool session** fields and tool-specific payload schema.
- Include example JSON.

### 8.2 Steps & sections mapping

- Step IDs (stable) and section anchors.

### 8.3 Validation rules (DoD)

- Exact rules that block review/approval.

### 8.4 Initiative generation spec

- Required fields in generated initiatives.
- Batch sizing rules (defaults, max).
- Traceability fields (source links).

### 8.5 API surface (high-level)

- `POST /api/tools` (create)
- `PUT /api/tools/:id` (autosave)
- `POST /api/tools/:id/request-review`
- `POST /api/tools/:id/approve`
- `POST /api/tools/:id/generate-initiatives`

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- MECE where relevant.
- Ask clarifying questions when inputs are missing.
- Separate facts vs assumptions.
- Provide confidence and cite evidence (internal sources).

### 9.2 Prompt outline

- System prompt goals
- User prompt structure per step

### 9.3 Extraction schema (JSON)

- Provide an explicit schema + example output.

### 9.4 Self-checks

- Consistency checks
- Red flags / hallucination guards

---

## 10. Video storyboard (script-ready)

### 10.1 Audience & duration

- Who is the video for; target length.

### 10.2 Scene list

1. Context and goal
2. Inputs
3. Method steps
4. Visualization
5. Insights
6. Initiatives export

### 10.3 On-screen cues

- Which screen, what to highlight.

---

## 11. Knowledge base extraction pack

### TL;DR (5–8 sentences)

### FAQ (at least 8)

1. …

### Checklists

- DoD checklist
- “Common mistakes” checklist

### Glossary (short)

- Term → definition

---

## 12. References (sources)

> Provide authoritative sources (original authors / reputable institutions) where possible.

- (link) …
- (link) …
