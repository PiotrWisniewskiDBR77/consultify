# Inventory Classification (ABC/XYZ)

## Metadata

- **Tool name**: Inventory Classification (ABC/XYZ)
- **Slug**: `abc-xyz-inventory`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 60–180 minutes (analysis) + quarterly refresh
- **Best for**: Prioritizing inventory policies, focusing forecasting and service levels, reducing working capital
- **Not for**: One-off buying decisions; SKUs without consumption history (need proxies)
- **Primary outputs**: ABC class, XYZ variability class, policy recommendations, reorder parameters by class
- **Required inputs (minimum)**:
  - SKU list and historical demand/consumption
  - Unit cost (or value proxy)
- **Optional inputs**:
  - Lead times, MOQ, service level targets, shelf life, supplier constraints
- **Related tools (internal)**:
  - (ops) `safety-stock-reorder-point.md`
  - (ops) `sales-and-operations-planning-sn-op.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

ABC/XYZ answers: **“Which SKUs deserve the most attention and what policies should differ by class?”** ABC prioritizes by value; XYZ prioritizes by demand variability.

### 1.2 When to use

- You want differentiated inventory policies instead of one policy for all SKUs.
- Working capital is high or service levels are inconsistent.
- You need to focus forecasting effort on the SKUs that matter most.

### 1.3 When NOT to use (anti-patterns)

- Classifying without changing any policies (“analysis without action”).
- Using outdated demand windows that ignore lifecycle changes.
- Mixing different product hierarchies without a consistent SKU→family mapping.

### 1.4 What “good” looks like

- ABC and XYZ thresholds are documented and justified.
- The 9-box matrix directly maps to policy rules (service level, review cadence, replenishment method).
- Exceptions are flagged (new SKUs, intermittent demand, promo-driven demand).

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **ABC**: classification by annual consumption value (A=highest value).
- **XYZ**: classification by demand variability/predictability (X=stable, Z=highly variable).
- Common approach:
  - ABC by cumulative value: A ~ top 70–80% value, B next 15–25%, C remainder.
  - XYZ by coefficient of variation (CV): X low CV, Y medium, Z high CV.

### 2.2 Glossary

| Term              | Definition                          | Notes                           |
| ----------------- | ----------------------------------- | ------------------------------- |
| Consumption value | Annual units × unit cost            | ABC basis                       |
| CV                | Coefficient of variation (std/mean) | XYZ basis (common)              |
| Service level     | Target availability                 | Often higher for A, lower for C |
| Review cadence    | How often to re-evaluate parameters | Weekly/monthly/quarterly        |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input          | Description     | Example             | Where in the app it can come from |
| -------------- | --------------- | ------------------- | --------------------------------- |
| Demand history | Units by period | Weekly 52 weeks     | CSV upload                        |
| Unit cost      | Value proxy     | €12.50              | ERP export / manual               |
| SKU master     | Attributes      | lead time, supplier | CSV upload                        |

### 3.2 Optional inputs (improves quality)

| Input      | Description          | Example          | Where in the app it can come from |
| ---------- | -------------------- | ---------------- | --------------------------------- |
| Lead time  | mean and variability | 2 weeks (sd 0.5) | Procurement                       |
| MOQ        | ordering constraints | MOQ 500          | Supplier master                   |
| Shelf life | expiry constraints   | 90 days          | SKU master                        |

### 3.3 Data quality checks

- Handle missing weeks and outliers (promotions, stockouts).
- Flag lifecycle changes (new SKU, discontinued).
- Ensure cost and demand windows align (same currency/time frame).

---

## 4. Step-by-step method

### Step 1 — Setup

- Define window (e.g., last 52 weeks) and hierarchy (SKU vs family).
- Define ABC thresholds (cumulative value) and XYZ thresholds (CV).

### Step 2 — Collect facts

- Load demand history and unit costs.
- Clean data: adjust for promotions, stockouts, and missing periods.

### Step 3 — Structure

- Compute annual consumption value and cumulative value curve (ABC).
- Compute variability metric (CV) (XYZ).

### Step 4 — Analyze

- Assign A/B/C and X/Y/Z classes.
- Build the 9-box matrix (AX…CZ) and summarize value share and count share.

### Step 5 — Synthesize insights

- Define policy rules per class:
  - review cadence,
  - target service level,
  - replenishment method,
  - buffer strategy.

### Step 6 — Convert to initiatives

- Translate policy gaps into initiatives:
  - “Parameterize safety stock for AZ items”
  - “Reduce lead time variability for A items suppliers”
  - “Simplify replenishment for C items”

### Common mistakes & fixes

- **Mistake**: Treating classes as labels only → **Fix**: attach explicit policy rules.
- **Mistake**: Misclassifying promo-driven SKUs → **Fix**: separate promo periods or use segmentation.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable     | Description                    | Format in the app |
| --------------- | ------------------------------ | ----------------- |
| Classes per SKU | ABC, XYZ, combined class       | Table             |
| 9-box matrix    | Distribution and value share   | Heatmap           |
| Policy rules    | Recommended policies per class | Rules table       |
| Backlog         | Parameter updates & projects   | Initiatives       |

### 5.2 Definition of Done (DoD) checklist

- [ ] Data window defined and cleaned
- [ ] ABC and XYZ thresholds documented
- [ ] Matrix built with count/value shares
- [ ] Policies defined per class
- [ ] Initiatives created for top gaps (AZ/BZ and key A suppliers)

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

1,000 SKUs. Top 120 SKUs represent 78% annual value → class A. CV threshold: X<0.5, Y 0.5–1.0, Z>1.0. Result: AX SKUs get weekly review; AZ SKUs get higher safety stock and supplier lead-time projects.

---

## 8. Implementation spec

```json
{
  "windowWeeks": 52,
  "abcThresholds": { "aCumPct": 0.8, "bCumPct": 0.95 },
  "xyzThresholds": { "xCvMax": 0.5, "yCvMax": 1.0 },
  "skus": [
    {
      "sku": "SKU-1",
      "annualUnits": 12000,
      "unitCost": 12.5,
      "cv": 0.4,
      "abc": "A",
      "xyz": "X",
      "class": "AX"
    }
  ]
}
```

---

## 9. AI spec

- Suggest reasonable thresholds and warn about lifecycle changes.
- Recommend differentiated policies and reorder strategies by class.

---

## 10. Consultant Report Specification

- Data sources and window
- ABC Pareto and XYZ variability assumptions
- 9-box matrix and policy recommendations
- Backlog for parameter updates and forecasting/supplier initiatives

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
- **VO (PL)**: "Inventory Classification (ABC/XYZ) pomaga zaplanować transformację."
- **VO (EN)**: "Inventory Classification (ABC/XYZ) helps plan transformation."
- **On-screen text (PL)**: "Inventory Classification (ABC/XYZ) = Plan transformacji"
- **On-screen text (EN)**: "Inventory Classification (ABC/XYZ) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Inventory Classification (ABC/XYZ) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Inventory Classification (ABC/XYZ) today."
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

1. **What is the main purpose of Inventory Classification (ABC/XYZ)?**
   A: Inventory Classification (ABC/XYZ) helps ABC/XYZ answers: \*\*“Which SKUs deserve the most attention and what policies should differ by class?”....

2. **When should I use Inventory Classification (ABC/XYZ)?**
   A: Use it - You want differentiated inventory policies instead of one policy for all SKUs.

- Working capital is high or service levels are inconsistent.
- You n....

3. **What are the key outputs?**
   A: Key outputs include ABC class, XYZ variability class, policy recommendations, reorder parameters by class.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Inventory Classification (ABC/XYZ)?**
   A: Inventory Classification (ABC/XYZ) helps ABC/XYZ answers: \*\*“Which SKUs deserve the most attention and what policies should differ by class?”....

2. **When should I use Inventory Classification (ABC/XYZ)?**
   A: Use it You want differentiated inventory policies instead of one policy for all SKUs.
   Working capital is high or service levels are inconsistent.
   You need to....

3. **What are the key outputs?**
   A: Key outputs include ABC class, XYZ variability class, policy recommendations, reorder parameters by class.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Inventory Classification (ABC/XYZ) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Inventory Classification (ABC/XYZ) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- ABC/XYZ analysis checklist:
  - [ ] Data window defined and cleaned
  - [ ] Thresholds documented
  - [ ] 9-box matrix generated
  - [ ] Policies defined per class
  - [ ] Parameter changes and initiatives captured

### Glossary (short)

- ABC, XYZ, CV (coefficient of variation), service level, review frequency, policy

---

## 13. Additional Resources & Learning Links

- Classic inventory management textbooks and APICS resources (book-based)

---

## 14. References

- Silver, Edward A.; Pyke, David F.; Peterson, Rein. _Inventory Management and Production Planning and Scheduling_. Wiley.
- Chopra, Sunil; Meindl, Peter. _Supply Chain Management: Strategy, Planning, and Operation_. Pearson.
- APICS/ASCM body of knowledge references (inventory classification concepts).
