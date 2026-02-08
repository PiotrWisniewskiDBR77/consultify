# Safety Stock & Reorder Point

## Metadata

- **Tool name**: Safety Stock & Reorder Point
- **Slug**: `safety-stock-reorder-point`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 60–180 minutes (parameterization); monthly/quarterly refresh
- **Best for**: Setting inventory buffers to hit service levels under demand/lead-time uncertainty
- **Not for**: Items with no demand history without proxy; extremely intermittent demand without special methods
- **Primary outputs**: Safety stock, reorder point (ROP), service level assumptions, policy recommendations by class
- **Required inputs (minimum)**:
  - Demand mean and variability (per period)
  - Lead time mean and variability (or assumption)
  - Target service level
- **Optional inputs**:
  - MOQ, order cost, holding cost, shelf life, supply constraints
- **Related tools (internal)**:
  - (ops) `abc-xyz-inventory.md`
  - (ops) `sales-and-operations-planning-sn-op.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Safety stock and reorder point answer: **“How much buffer do we need so we don’t stock out, given uncertainty?”** It translates service level goals into concrete inventory parameters.

### 1.2 When to use

- You need consistent inventory buffers aligned to service targets.
- Demand and/or lead time is variable and stockouts are costly.
- You want class-based policies (ABC/XYZ) and clear assumptions.

### 1.3 When NOT to use (anti-patterns)

- Using formulas without validating units, definitions, or service metric (CSL vs fill rate).
- Applying the same buffer logic to intermittent demand without exception handling.
- Treating safety stock as a substitute for fixing lead time variability.

### 1.4 What “good” looks like

- Inputs and units are explicit and consistent.
- Service metric and target are documented.
- Exceptions are flagged and handled separately.
- Actions include reducing variability and lead time, not only increasing stock.

---

## 2. Concept & key definitions

### 2.1 Core concepts

Typical continuous review model:

- **Reorder point (ROP)** = demand during lead time + safety stock
- Safety stock often uses a z-score for target cycle service level:
  - \(SS = z \cdot \sigma\_{DLT}\)
  - where \(\sigma\_{DLT}\) is std dev of demand during lead time (considering demand and lead-time variability).

Key terms:

- **Cycle service level (CSL)**: probability of no stockout per replenishment cycle.
- **Fill rate**: % demand filled from stock (different metric).

### 2.2 Glossary

| Term      | Definition                    | Notes                           |
| --------- | ----------------------------- | ------------------------------- |
| ROP       | Reorder Point                 | Demand during LT + safety stock |
| CSL       | Cycle Service Level           | P(no stockout per cycle)        |
| Fill rate | % demand fulfilled from stock | Different target                |
| z-score   | Normal quantile for CSL       | Depends on metric/assumption    |

---

## 3. Inputs

| Input         | Description           | Example            |
| ------------- | --------------------- | ------------------ |
| Demand        | mean & std per period | mean=100/wk, sd=30 |
| Lead time     | mean & std            | mean=2 wks, sd=0.5 |
| Service level | target CSL            | 95%                |

Data checks: remove promotions/outliers or model separately; ensure units consistent.

---

## 4. Step-by-step method

### Step 1 — Setup

- Choose policy type (continuous vs periodic review).
- Choose service metric (CSL vs fill rate) and targets by SKU class.

### Step 2 — Collect facts

- Collect demand mean/std and lead time mean/std for the same time bucket.
- Identify exceptions: intermittent demand, new SKUs, shelf-life constraints.

### Step 3 — Structure

- Compute expected demand during lead time and its variability.
- Select z-score mapping based on chosen service metric and assumption.

### Step 4 — Analyze

- Compute safety stock (SS) and reorder point (ROP).
- Run scenario checks: lead time spikes, demand spikes, supplier disruption.

### Step 5 — Synthesize insights

- Recommend policy by class (AX vs AZ vs CZ):
  - service target,
  - review cadence,
  - SS/ROP parameters,
  - exception handling.

### Step 6 — Convert to initiatives

- Reduce the need for safety stock:
  - lead time reduction and reliability,
  - demand variability reduction,
  - forecast and planning improvements.

### Common mistakes & fixes

- **Mistake**: CSL vs fill rate confusion → **Fix**: pick one and document.
- **Mistake**: Units mismatch (weeks vs days) → **Fix**: enforce consistent units.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable          | Description                    | Format in the app  |
| -------------------- | ------------------------------ | ------------------ |
| SS/ROP results       | Safety stock and reorder point | Table by SKU/class |
| Assumptions register | service metric, z, window      | Notes              |
| Exceptions list      | special SKUs handling          | Table              |
| Improvement backlog  | reduce variability/LT          | Initiatives        |

### 5.2 Definition of Done (DoD) checklist

- [ ] Units consistent (period and lead time)
- [ ] Service metric and target stated
- [ ] SS and ROP computed and reviewed
- [ ] Exceptions flagged (intermittent demand, shelf life, new SKUs)

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

## 7. Worked example

Weekly demand mean 100, sd 30. Lead time mean 2 weeks, sd 0.5. Target CSL 95% → z≈1.65.
\(\sigma\_{DLT} = \sqrt{(2×30^2) + (100^2×0.5^2)} = \sqrt{1800 + 2500} ≈ 65.6\).
SS = 1.65×65.6 ≈ 108.
Mean demand during LT = 100×2 = 200.
ROP ≈ 308 units.

---

## 8. Implementation spec

```json
{
  "policy": { "type": "continuous_review", "serviceMetric": "CSL", "target": 0.95 },
  "inputs": {
    "demandMeanPerWeek": 100,
    "demandSdPerWeek": 30,
    "leadTimeMeanWeeks": 2,
    "leadTimeSdWeeks": 0.5
  },
  "computed": { "z": 1.65, "sigmaDLT": 65.6, "safetyStock": 108, "rop": 308 },
  "notes": { "exceptions": [] }
}
```

---

## 9. AI spec

- Validate units and the chosen service metric.
- Recommend class-based targets (A vs C; X vs Z).
- Flag intermittent demand and suggest alternative methods (Croston, min/max with review).

---

## 10. Consultant Report Specification

- Data window and assumptions
- SS/ROP results and recommended service levels
- Risk and exception SKUs
- Initiatives to reduce variability/lead time

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
- **VO (PL)**: "Safety Stock & Reorder Point pomaga zaplanować transformację."
- **VO (EN)**: "Safety Stock & Reorder Point helps plan transformation."
- **On-screen text (PL)**: "Safety Stock & Reorder Point = Plan transformacji"
- **On-screen text (EN)**: "Safety Stock & Reorder Point = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Safety Stock & Reorder Point już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Safety Stock & Reorder Point today."
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

1. **What is the main purpose of Safety Stock & Reorder Point?**
   A: Safety Stock & Reorder Point helps Safety stock and reorder point answer: \*\*“How much buffer do we need so we don’t stock out, given un....

2. **When should I use Safety Stock & Reorder Point?**
   A: Use it - You need consistent inventory buffers aligned to service targets.

- Demand and/or lead time is variable and stockouts are costly.
- You want class-b....

3. **What are the key outputs?**
   A: Key outputs include Safety stock, reorder point (ROP), service level assumptions, policy recommendations by class.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Safety Stock & Reorder Point?**
   A: Safety Stock & Reorder Point helps Safety stock and reorder point answer: \*\*“How much buffer do we need so we don’t stock out, given un....

2. **When should I use Safety Stock & Reorder Point?**
   A: Use it You need consistent inventory buffers aligned to service targets.
   Demand and/or lead time is variable and stockouts are costly.
   You want class-based p....

3. **What are the key outputs?**
   A: Key outputs include Safety stock, reorder point (ROP), service level assumptions, policy recommendations by class.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Safety Stock & Reorder Point analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Safety Stock & Reorder Point analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- Parameterization checklist:
  - [ ] Units consistent (period vs lead time)
  - [ ] Service metric chosen and target stated
  - [ ] SS and ROP computed
  - [ ] Exceptions flagged
  - [ ] Review cadence defined

### Glossary (short)

- Safety stock, reorder point, lead time, CSL, fill rate, z-score, variability

---

## 13. Additional Resources & Learning Links

- Inventory management textbooks (book-based)

---

## 14. References

- Silver, Edward A.; Pyke, David F.; Peterson, Rein. _Inventory Management and Production Planning and Scheduling_. Wiley.
- Chopra, Sunil; Meindl, Peter. _Supply Chain Management_. Pearson.
- NIST/SEMATECH handbook (distribution concepts): `https://www.itl.nist.gov/div898/handbook/`
