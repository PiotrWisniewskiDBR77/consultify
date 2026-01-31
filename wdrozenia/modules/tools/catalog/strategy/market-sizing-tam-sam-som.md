# Market Sizing (TAM / SAM / SOM)

## Metadata

- **Tool name**: Market Sizing (TAM/SAM/SOM)
- **Slug**: `market-sizing-tam-sam-som`
- **Category**: Strategy
- **Level**: Core
- **Typical duration**: 2–6 hours (single market); 1–2 days (multi-segment + scenarios)
- **Best for**: Market entry, investment cases, product strategy, valuation sanity checks
- **Not for**: Precise forecasting without data (it’s an estimate with ranges)
- **Primary outputs**: TAM/SAM/SOM estimates (ranges), assumptions register, triangulation checks, sensitivity analysis, initiative ideas (go-to-market)
- **Required inputs (minimum)**:
  - Market definition (product, customer, geography, time period)
  - Pricing / revenue model (ASP, ARPA, subscription, etc.)
- **Optional inputs**:
  - Customer counts, adoption rates, competitor shares, capacity constraints
- **Related tools (internal)**:
  - [`customer-segmentation.md`](./customer-segmentation.md)
  - [`competitive-benchmarking.md`](./competitive-benchmarking.md)
  - [`mece-issue-tree.md`](./mece-issue-tree.md) (driver trees)
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose

### 1.1 Goal

Market sizing answers: **How big is the opportunity?** and **How much can we realistically capture?** It supports decisions about:

- whether to enter a market,
- where to focus (segments/geographies),
- how to size investments,
- and how to set credible targets.

### 1.2 When to use

- Market entry / expansion
- New product / new segment
- Investor/board case for investment
- M&A and valuation sanity checks

### 1.3 When NOT to use

- As a single-number “truth.” Use ranges and uncertainty.
- When you cannot define boundaries (first define the market).

---

## 2. Definitions

- **TAM (Total Addressable Market)**: total revenue opportunity if you had 100% share.
- **SAM (Serviceable Available/Addressable Market)**: portion of TAM you can serve with your current scope and capabilities (constraints applied).
- **SOM (Serviceable Obtainable Market)**: realistic share of SAM in a defined horizon (e.g., 3–5 years).

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input           | Description                      | Example                                                         |
| --------------- | -------------------------------- | --------------------------------------------------------------- |
| Market boundary | What’s included/excluded         | “EU mid-market manufacturers (50–500) needing maintenance SaaS” |
| Revenue model   | Price × units or ARPA × accounts | “€12k/account/year”                                             |

### 3.2 Optional inputs

| Input                | Description                    | Example                      |
| -------------------- | ------------------------------ | ---------------------------- |
| Customer universe    | number of target customers     | 42,000 companies             |
| Adoption assumptions | penetration rate               | 8% by year 5                 |
| Constraints          | capacity, channels, regulation | “Only DACH + PL in year 1–2” |

---

## 4. Method (step-by-step)

### Step 1 — Define market boundaries (MECE)

Define:

- product scope (what solution counts),
- customer scope (segment),
- geographic scope,
- time period (annual revenue baseline).

### Step 2 — Choose sizing approach (use 2+)

Use at least **two** approaches and triangulate:

- **Top-down**: start from known industry totals and filter down.
- **Bottom-up**: accounts × price (or units × price).
- **Value theory**: estimate value created and willingness to pay.

### Step 3 — Build TAM

Compute TAM as a range (low/base/high).
Example bottom-up:
TAM = (Total potential accounts) × (ARPA)

### Step 4 — Convert TAM → SAM

Apply constraints:

- geographies you can serve,
- product fit limitations,
- regulatory constraints,
- channel access.

### Step 5 — Convert SAM → SOM

SOM is a share of SAM over a horizon:

- build a go-to-market capacity model (sales reps, cycle length),
- or use adoption S-curve assumptions,
- include competitive response.

### Step 6 — Triangulate and stress-test

- order-of-magnitude checks,
- compare with competitor revenues and shares,
- sensitivity analysis on key assumptions.

### Step 7 — Translate into strategy & initiatives

From SOM and constraints, derive initiatives:

- segment prioritization,
- channel strategy,
- product packaging/pricing,
- partnerships.

---

## 5. Outputs & DoD

### Outputs

- TAM/SAM/SOM (low/base/high) with assumptions
- Sensitivity table (top 5 drivers)
- Narrative summary + implications
- Initiative candidates (go-to-market)

### DoD checklist

- [ ] Boundaries defined (product/customer/geo/time)
- [ ] At least 2 sizing methods used
- [ ] TAM/SAM/SOM produced as ranges
- [ ] Top assumptions listed with evidence
- [ ] Sensitivity analysis completed
- [ ] At least 3 initiatives derived

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

### Context

SaaS for predictive maintenance targeting EU mid-market manufacturers.

### Assumptions (base)

- Target accounts in EU: 40,000
- ARPA: €12,000/year
- Addressable geos (initial): 60% of EU accounts
- SOM in 5 years: 6% of SAM

### Results

- TAM = 40,000 × 12,000 = €480M/year
- SAM = 0.6 × 480M = €288M/year
- SOM (5y) = 0.06 × 288M = €17.3M/year

### Initiatives

1. Build channel partnerships in DACH/PL
2. Product packaging for 50–200 employee segment
3. Proof-of-value program to reduce sales cycle

---

## 8. Implementation spec

### Data model (JSON)

```json
{
  "marketDefinition": {
    "productScope": "Predictive maintenance SaaS",
    "customerScope": "EU manufacturers (50-500 employees)",
    "geoScope": ["EU"],
    "timeBasis": "annual"
  },
  "pricingModel": { "type": "ARPA", "value": 12000, "currency": "EUR" },
  "assumptions": [
    {
      "key": "totalAccounts",
      "value": 40000,
      "source": "Assumption (triangulate with Eurostat enterprise counts by size class + internal ICP estimates)",
      "confidence": "medium"
    },
    {
      "key": "serviceableGeoShare",
      "value": 0.6,
      "source": "Assumption (initial go-to-market focus geographies; refine from channel access + language + compliance readiness)",
      "confidence": "medium"
    },
    {
      "key": "somShareYear5",
      "value": 0.06,
      "source": "Assumption (GTM capacity model + comparable SaaS penetration benchmarks; validate via bottom-up pipeline plan)",
      "confidence": "low"
    }
  ],
  "results": { "tam": 480000000, "sam": 288000000, "somYear5": 17280000 }
}
```

---

## 9. AI spec

### 9.1 Prompting goals

- Ask for missing boundaries (product/customer/geo/time) and enforce MECE segmentation.
- Require at least **two** methods (top‑down + bottom‑up) and call out inconsistencies.
- Always output **ranges** (low/base/high) and identify top sensitivities (top 5 drivers).
- Produce initiative candidates with traceability to constraints/opportunities.

### 9.2 JSON extraction (canonical output)

The AI must return a strict JSON payload (no prose outside JSON) for storage in `tool_sessions.answers_json`:

```json
{
  "marketSizing": {
    "boundaries": {
      "productScope": "string",
      "customerScope": "string",
      "geoScope": ["string"],
      "timeBasis": "annual|monthly|quarterly"
    },
    "methods": [
      {
        "type": "top_down|bottom_up|value_theory",
        "logic": "string",
        "inputs": [
          { "key": "string", "value": "number|string", "unit": "string", "source": "string" }
        ],
        "outputs": { "tam": { "low": 0, "base": 0, "high": 0, "currency": "string" } }
      }
    ],
    "assumptions": [
      {
        "key": "string",
        "value": "number|string",
        "unit": "string",
        "rationale": "string",
        "confidence": "high|medium|low",
        "source": "string"
      }
    ],
    "results": {
      "tam": { "low": 0, "base": 0, "high": 0, "currency": "string" },
      "sam": { "low": 0, "base": 0, "high": 0, "currency": "string" },
      "som": { "horizonMonths": 60, "low": 0, "base": 0, "high": 0, "currency": "string" }
    },
    "sensitivities": [
      { "driver": "string", "low": "number|string", "high": "number|string", "impactOnSomPct": 0 }
    ],
    "insights": ["string"],
    "initiativeDrafts": [
      {
        "title": "string",
        "summary": "string",
        "rationale": "string",
        "expectedImpact": "string",
        "confidence": "high|medium|low"
      }
    ]
  }
}
```

### 9.3 Guardrails & self-check

- Never output a single TAM/SAM/SOM point estimate without a range.
- Always include units and currency.
- If sources are missing: mark as **assumption** + set confidence explicitly (do not leave “TBD”).
- Self-check: \( \text{SOM} \le \text{SAM} \le \text{TAM} \).

---

## 10. Consultant Report Specification (What goes into the final report)

### 10.1 Report structure (executive-ready)

1. **Executive summary (1 page)**

- Final TAM/SAM/SOM ranges + key “why it matters”
- Top 3 sensitivities
- Top 3 recommendations / initiatives

2. **Scope & definitions**

- Market boundaries + inclusions/exclusions
- Time basis + currency/units

3. **Methods & triangulation**

- Top-down method: sources + filters
- Bottom-up method: account universe + pricing + adoption logic
- Reconciliation and explanation of gaps

4. **Results**

- TAM/SAM/SOM tables (low/base/high)
- Scenario notes (best/base/worst)

5. **Assumptions register (audit-ready)**

- Assumption, value, rationale, source, confidence

6. **Sensitivity analysis**

- Top drivers and their impact on SOM (e.g., tornado chart)

7. **Strategic implications & initiatives**

- Segment/geography focus
- GTM capacity implications (sales, channels, partnerships)
- Initiative candidates with traceability to drivers/constraints

### 10.2 Minimum required visuals

- TAM/SAM/SOM funnel
- Assumptions register table
- Sensitivity chart (tornado or spider)

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
- **VO (PL)**: "Market Sizing (TAM/SAM/SOM) pomaga zaplanować transformację."
- **VO (EN)**: "Market Sizing (TAM/SAM/SOM) helps plan transformation."
- **On-screen text (PL)**: "Market Sizing (TAM/SAM/SOM) = Plan transformacji"
- **On-screen text (EN)**: "Market Sizing (TAM/SAM/SOM) = Transformation plan"

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
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Market Sizing (TAM/SAM/SOM) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Market Sizing (TAM/SAM/SOM) today."
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

Market sizing (TAM/SAM/SOM) is a structured way to estimate opportunity size using ranges, triangulate with at least two methods, and convert results into concrete go‑to‑market initiatives.

### 12.2 FAQ

- **What’s the difference between TAM, SAM, and SOM?**
  - **TAM** is the full theoretical opportunity; **SAM** is what you can serve given scope/capabilities; **SOM** is what you can realistically capture in a defined horizon.
- **Do I need exact numbers?**
  - No — you need **credible ranges** and explicit assumptions, plus sensitivity on the drivers that matter most.
- **What are common mistakes?**
  - Vague market boundaries, using only one method, reporting a single number, and hiding assumptions.
- **How do I know it’s “good enough”?**
  - When two methods triangulate within an acceptable band and your top assumptions have either sources or clearly labeled confidence levels.

### 12.3

### FAQ (at least 8)

1. **What is the main purpose of Market Sizing (TAM/SAM/SOM)?**
   A: Market Sizing (TAM/SAM/SOM) helps Market sizing answers: **How big is the opportunity?** and \*_How much can we realistically capture?_....

2. **When should I use Market Sizing (TAM/SAM/SOM)?**
   A: Use it market entry / expansion
   new product / new segment
   investor/board case for investment
   m&a and valuation sanity checks.

3. **What are the key outputs?**
   A: Key outputs include TAM/SAM/SOM estimates (ranges), assumptions register, triangulation checks, sensitivity analysis, initiative ideas (go-to-market).

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Market Sizing (TAM/SAM/SOM) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   Checklists

- **DoD checklist**
  - Boundaries defined; 2+ methods; ranges produced; assumptions logged; sensitivity done; initiatives drafted.

### 12.4 Glossary

| Term | Definition                     | Notes                        |
| ---- | ------------------------------ | ---------------------------- |
| TAM  | Total Addressable Market       | Full theoretical revenue     |
| SAM  | Serviceable Addressable Market | Constraints applied          |
| SOM  | Serviceable Obtainable Market  | Realistic capture in horizon |

---

## 13. Additional Resources & Learning Links

### 13.1 Internal (suggested)

- “Market sizing” knowledge base article derived from this file.
- Cross-links: segmentation, benchmarking, issue trees.

### 13.2 External

- Corporate Finance Institute — TAM definition & methods
- Umbrex — market sizing playbooks and QA heuristics
- Similarweb — market sizing walkthrough (practical)

---

## 14. References (Authoritative Sources)

- [Corporate Finance Institute: Total Addressable Market (TAM) + TAM/SAM/SOM](https://corporatefinanceinstitute.com/resources/management/total-addressable-market-tam/)
- [Umbrex: Market Sizing Playbook](https://umbrex.com/resources/market-sizing-playbook/)
- [Similarweb: Market Sizing (TAM/SAM/SOM)](https://www.similarweb.com/blog/research/market-research/market-sizing/)
