# SIPOC (Process Scoping)

## Metadata

- **Tool name**: SIPOC
- **Slug**: `sipoc`
- **Category**: Operations
- **Level**: Basic
- **Typical duration**: 30–60 minutes
- **Best for**: Fast process scoping, aligning stakeholders, defining boundaries and “what is in/out”
- **Not for**: Deep root-cause analysis; detailed process design; performance optimization without data
- **Primary outputs**: SIPOC table, scope statement, stakeholders map, assumptions & open questions
- **Required inputs (minimum)**:
  - Process name and purpose
  - Start/end triggers
  - Customer(s) definition
- **Optional inputs**:
  - CTQs (Critical-to-Quality), SLAs, KPIs, known pain points
- **Related tools (internal)**:
  - (ops) `value-stream-mapping-vsm.md`
  - (ops) `dmaic.md`
  - (ops) `root-cause-5whys-fishbone.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

SIPOC helps teams quickly answer: **“What exactly is the process we are talking about?”** by defining Suppliers, Inputs, Process, Outputs, Customers—so improvement efforts start with aligned boundaries.

### 1.2 When to use

- At the start of an improvement project (Lean / Six Sigma / transformation).
- When stakeholders disagree on scope or ownership.
- When handoffs and customer definitions are unclear.

### 1.3 When NOT to use (anti-patterns)

- You already have a clear scoped value stream map and need quantification (use VSM).
- You need detailed steps and decision logic (use process mapping).
- You want to “fill a template” without making decisions about boundaries.

### 1.4 What “good” looks like

- A scope statement with **clear triggers and endpoints**.
- Outputs and customers reflect real “voice of customer” needs.
- Inputs include data/system inputs, not only physical materials.
- Open questions and assumptions are explicitly listed.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Supplier**: Internal/external party providing inputs.
- **Input**: Materials, data, approvals, resources required.
- **Process**: High-level 4–7 steps (not detailed mapping).
- **Output**: Deliverables produced by the process.
- **Customer**: Recipient of the outputs (internal/external).
- **CTQ**: Critical-to-Quality requirement for outputs.

### 2.2 Glossary

| Term     | Definition                    | Notes                  |
| -------- | ----------------------------- | ---------------------- |
| Trigger  | Event that starts the process | “Order received”       |
| Endpoint | Event that ends the process   | “Delivered & invoiced” |
| In/Out   | What is in scope vs excluded  | Avoid scope creep      |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input       | Description           | Example                          | Where in the app it can come from |
| ----------- | --------------------- | -------------------------------- | --------------------------------- |
| Process     | Name + purpose        | “Returns processing”             | Setup step                        |
| Trigger/End | Start/end definitions | “Return request → refund issued” | Setup step                        |
| Customer    | Who receives outputs  | Customer + Finance               | Context                           |

### 3.2 Optional inputs (improves quality)

| Input       | Description          | Example                  | Where in the app it can come from |
| ----------- | -------------------- | ------------------------ | --------------------------------- |
| CTQs        | Quality requirements | 48h refund SLA           | KPI entry                         |
| Pain points | Known issues         | “Manual approval delays” | Notes                             |
| Systems     | Tools involved       | ERP, CRM, WMS            | Context                           |

### 3.3 Data quality checks

- Confirm customers are real recipients (not “the company”).
- Validate trigger/end are observable events, not vague states.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Define the process boundary

- Name the process as **verb + object** (e.g., “Fulfill customer order”).
- Define trigger and endpoint.

### Step 2 — Fill Outputs and Customers first

- List 1–3 key outputs.
- For each output, specify customer and CTQs.

### Step 3 — Define the Process (4–7 high-level steps)

- Use high-level verbs: “Receive”, “Validate”, “Approve”, “Execute”, “Confirm”.

### Step 4 — Define Inputs and Suppliers

- For each step, list key inputs (data, approvals, materials).
- Identify suppliers and their reliability constraints.

### Step 5 — Capture assumptions and open questions

- “We assume X is always available” → mark for validation.

### Step 6 — Convert to next actions

- If scope unclear → run workshop to resolve ownership.
- If performance issue → proceed to VSM / DMAIC.

### Common mistakes & fixes

- **Mistake**: Too detailed steps → **Fix**: cap at 7 steps.
- **Mistake**: Customers = “management” → **Fix**: specify actual recipient and CTQ.
- **Mistake**: No CTQs → **Fix**: add at least 1 measurable requirement.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable     | Description          | Format in the app |
| --------------- | -------------------- | ----------------- |
| SIPOC table     | S/I/P/O/C with CTQs  | Table             |
| Scope statement | Trigger, end, in/out | Text + tags       |
| Open questions  | Risks/assumptions    | Checklist         |

### 5.2 Definition of Done (DoD) checklist

- [ ] Trigger and endpoint defined and agreed
- [ ] Outputs and customers defined with at least 1 CTQ
- [ ] Process described in 4–7 high-level steps
- [ ] Key inputs and suppliers listed
- [ ] Assumptions and open questions documented

---

## 6. UI / Graphic specification (What the user sees)

### 6.1 Screens / views

- **Workspace (left)**:
  1. Setup (process name, trigger/end, in/out)
  2. SIPOC table editor (inline)
  3. CTQs and KPIs
  4. Open questions → initiatives
- **Control panel (right)**:
  - Status + DoD checklist
  - Review/approve, export
  - Generate initiatives

### 6.2 Visualization & graphics

- Primary artifact: **SIPOC table** with fixed columns and row templates.
- Add “CTQ badges” on Output rows.
- Optional: simple “handoff ribbon” that shows supplier → customer chain.

###

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

  6.3 Interactions

- Add/remove rows; reorder process steps.
- “Convert open question to initiative” shortcut.
- “Import from VSM” (future enhancement): prefill steps.

### 6.4 States

- Draft editable; Approved locks structure but allows initiatives generation.

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

## 7. Worked example (End-to-end)

### 7.1 Context

E-commerce returns are slow and inconsistent; refund SLA breaches.

### 7.2 Inputs (filled)

- Trigger: “Customer submits return request”
- End: “Refund issued and inventory updated”
- CTQ: refund within 48 hours; return status visible to customer

### 7.3 Analysis (filled)

SIPOC table (excerpt):

- Suppliers: Customer, Carrier, WMS, Finance
- Inputs: return request form, tracking ID, item condition data
- Process: receive request → authorize → receive parcel → inspect → refund & restock
- Outputs: refund, updated inventory, customer notification
- Customers: Customer, Finance, Warehouse ops

### 7.4 Insights

1. Process boundary was missing “inspection” and inventory update—causing ownership gaps.
2. CTQ drives need for automation of authorization and notification.

### 7.5 Initiatives derived

| Initiative title                 | Rationale          | Expected impact      | Effort | Risks    | First 2 steps           |
| -------------------------------- | ------------------ | -------------------- | ------ | -------- | ----------------------- |
| Auto-authorize low-risk returns  | Meet 48h CTQ       | −30% cycle time      | Medium | Fraud    | Define rules; pilot     |
| Standardize inspection checklist | Reduce variability | +FPY, fewer disputes | Low    | Adoption | Create checklist; train |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "scope": {
    "processName": "Returns processing",
    "trigger": "Customer submits return request",
    "endpoint": "Refund issued and inventory updated",
    "inScope": ["authorization", "inspection", "refund", "restock"],
    "outOfScope": ["supplier warranty claims"]
  },
  "sipoc": [
    {
      "suppliers": ["Customer", "Carrier"],
      "inputs": ["Return request", "Tracking ID"],
      "processStep": "Authorize return",
      "outputs": ["Return authorization"],
      "customers": ["Customer"],
      "ctqs": ["Decision within 2 hours"]
    }
  ],
  "openQuestions": [{ "id": "q1", "text": "How to define low-risk returns?" }],
  "initiativeDrafts": [{ "title": "Auto-authorize low-risk returns", "source": "q1" }]
}
```

### 8.2 Steps & section mapping

- `setup` → `sipoc-table` → `ctq` → `questions` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have trigger, endpoint, ≥1 output, ≥1 customer, ≥4 process steps.

### 8.4 Initiative generation spec

- Convert CTQ gaps and open questions into initiatives with traceability.

### 8.5 API surface (high-level)

Canonical Tools API (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Force clarity on boundaries; avoid “scope creep”.
- Recommend next tool: VSM for flow, DMAIC for defects/variation.
- Translate CTQs into measurable metrics and rules.

### 9.2 Prompt outline

- Ask for trigger/end and customer CTQs.
- Propose 4–7 steps if user provides only a vague description.
- Identify missing customers/outputs and contradictions.

### 9.3 Extraction schema (JSON)

```json
{
  "sipoc": [
    { "processStep": "string", "outputs": ["string"], "customers": ["string"], "ctqs": ["string"] }
  ],
  "scopeRisks": ["string"],
  "nextTools": ["vsm", "dmaic"]
}
```

### 9.4 Self-checks

- Are trigger/end observable events?
- Are customers tied to outputs and CTQs?

---

## 10. Consultant Report Specification (What goes into the final report)

- Scope statement (in/out), trigger/end
- SIPOC table (final)
- CTQs and KPIs
- Open questions + recommended next analyses
- Initial improvement backlog (if any)

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
- **VO (PL)**: "SIPOC pomaga zaplanować transformację."
- **VO (EN)**: "SIPOC helps plan transformation."
- **On-screen text (PL)**: "SIPOC = Plan transformacji"
- **On-screen text (EN)**: "SIPOC = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij SIPOC już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start SIPOC today."
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

1. **What is the main purpose of SIPOC?**
   A: SIPOC helps SIPOC helps teams quickly answer: **“What exactly is the process we are talking about?”** by definin....

2. **When should I use SIPOC?**
   A: Use it - At the start of an improvement project (Lean / Six Sigma / transformation).

- When stakeholders disagree on scope or ownership.
- When handoffs and ....

3. **What are the key outputs?**
   A: Key outputs include SIPOC table, scope statement, stakeholders map, assumptions & open questions.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of SIPOC?**
   A: SIPOC helps SIPOC helps teams quickly answer: **“What exactly is the process we are talking about?”** by definin....

2. **When should I use SIPOC?**
   A: Use it At the start of an improvement project (Lean / Six Sigma / transformation).
   When stakeholders disagree on scope or ownership.
   When handoffs and custom....

3. **What are the key outputs?**
   A: Key outputs include SIPOC table, scope statement, stakeholders map, assumptions & open questions.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good SIPOC analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good SIPOC analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

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

- ASQ (Six Sigma basics, SIPOC overview): `https://asq.org`
- iSixSigma (practical examples): `https://www.isixsigma.com`

---

## 14. References (Authoritative Sources)

- American Society for Quality (ASQ) — SIPOC and Six Sigma resources: `https://asq.org`
- George, Michael L. _Lean Six Sigma_. McGraw-Hill.
- iSixSigma — SIPOC guidance and examples: `https://www.isixsigma.com`
