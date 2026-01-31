# SCOR Model (Supply Chain Operations Reference)

## Metadata

- **Tool name**: SCOR Model (Supply Chain Operations Reference)
- **Slug**: `scor-model`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 2–6 hours (baseline mapping); 2–8 weeks (improvement roadmap)
- **Best for**: Standardizing supply chain process taxonomy, benchmarking KPIs, aligning improvement roadmap
- **Not for**: Deep redesign without data; local process mapping without end-to-end alignment
- **Primary outputs**: SCOR process map (Plan/Source/Make/Deliver/Return/Enable), KPI baseline, gaps, initiatives roadmap
- **Required inputs (minimum)**:
  - Supply chain scope (products/regions)
  - Current process overview
- **Optional inputs**:
  - KPI data (reliability, responsiveness, agility, cost, asset management), org structure, systems landscape
- **Related tools (internal)**:
  - (ops) `sales-and-operations-planning-sn-op.md`
  - (ops) `value-stream-mapping-vsm.md`
  - (ops) `abc-xyz-inventory.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

SCOR answers: **“How do we describe our supply chain in a standard language, measure it consistently, and build a coherent improvement roadmap?”** It provides a reference model for processes and KPIs.

### 1.2 When to use

- You need a common process taxonomy across teams/regions.
- KPIs are inconsistent and benchmarking is impossible.
- You want an end-to-end roadmap aligned to standard domains.

### 1.3 When NOT to use (anti-patterns)

- Mapping taxonomy without KPI baselines and actions.
- Using SCOR as a replacement for local process improvement (it’s a framework, not the fix).
- Going too deep too early (L3/L4) without clear objective.

### 1.4 What “good” looks like

- Scope and depth are clear (L1/L2).
- KPIs are defined consistently and baselined.
- Gaps lead to domain-owned initiatives and governance cadence.

---

## 2. Concept & key definitions

### 2.1 Core concepts

**SCOR Top-Level Processes (L1):**

SCOR organizes supply chain processes into six top-level domains:

- **Plan (P)**: Balance aggregate demand and supply, establish/communicate plans
- **Source (S)**: Procure goods and services to meet planned or actual demand
- **Make (M)**: Transform product to a finished state to meet planned or actual demand
- **Deliver (D)**: Provide finished goods and services to meet planned or actual demand
- **Return (R)**: Return or receive returned products for any reason
- **Enable (E)**: Supporting capabilities (processes, systems, people, infrastructure)

**SCOR Process Levels:**

- **Level 1 (L1)**: Top-level process categories (Plan, Source, Make, Deliver, Return, Enable)
- **Level 2 (L2)**: Process categories (e.g., P1 Plan Supply Chain, P2 Plan Source, P3 Plan Make, P4 Plan Deliver)
- **Level 3 (L3)**: Process elements (detailed process steps, e.g., P1.1 Identify, prioritize, and aggregate supply chain requirements)
- **Level 4 (L4)**: Process element details (implementation-specific practices)

**Best Practice**: Start at L1/L2 for most assessments. Go deeper (L3/L4) only when needed for specific process redesign or detailed implementation.

**SCOR Process Categories (L2) - Examples:**

**Plan (P):**

- P1: Plan Supply Chain
- P2: Plan Source
- P3: Plan Make
- P4: Plan Deliver
- P5: Plan Return

**Source (S):**

- S1: Source Stocked Products
- S2: Source Make-to-Order Products
- S3: Source Engineer-to-Order Products

**Make (M):**

- M1: Make-to-Stock
- M2: Make-to-Order
- M3: Engineer-to-Order
- M4: Make-to-Repair

**Deliver (D):**

- D1: Deliver Stocked Products
- D2: Deliver Make-to-Order Products
- D3: Deliver Engineer-to-Order Products
- D4: Deliver Retail Products

**Return (R):**

- R1: Return Defective Products
- R2: Return MRO Products
- R3: Return Excess Products

**Enable (E):**

- E1: Enable Supply Chain Performance
- E2: Enable Supply Chain Risk
- E3: Enable Supply Chain Relationships
- E4: Enable Supply Chain Compliance
- E5: Enable Supply Chain Assets
- E6: Enable Supply Chain Technology
- E7: Enable Supply Chain Network
- E8: Enable Supply Chain Workforce
- E9: Enable Supply Chain Knowledge

**SCOR Performance Attributes:**

SCOR measures performance across five attributes:

1. **Reliability**: Ability to perform tasks as expected (e.g., OTIF, Perfect Order Fulfillment)
2. **Responsiveness**: Speed at which tasks are performed (e.g., Order Fulfillment Cycle Time, Source Cycle Time)
3. **Agility**: Ability to respond to external influences (e.g., Upside Supply Chain Flexibility, Upside Supply Chain Adaptability)
4. **Cost**: Costs associated with operating the supply chain (e.g., Cost of Goods Sold, Total Supply Chain Management Cost)
5. **Asset Management Efficiency**: Effectiveness of asset utilization (e.g., Cash-to-Cash Cycle Time, Return on Supply Chain Fixed Assets)

**Example KPIs by Attribute:**

- **Reliability**: OTIF (On-Time In-Full), Perfect Order Fulfillment, Order Fulfillment Accuracy
- **Responsiveness**: Order Fulfillment Cycle Time, Source Cycle Time, Make Cycle Time
- **Agility**: Upside Supply Chain Flexibility, Upside Supply Chain Adaptability, Downside Supply Chain Adaptability
- **Cost**: Cost of Goods Sold, Total Supply Chain Management Cost, Value-Added Productivity
- **Asset Management**: Cash-to-Cash Cycle Time, Return on Supply Chain Fixed Assets, Inventory Days of Supply

### 2.2 Glossary

| Term      | Definition                      | Notes                             |
| --------- | ------------------------------- | --------------------------------- |
| Domain    | SCOR category (Plan/Source/...) | Used to group initiatives         |
| Attribute | KPI category                    | reliability, responsiveness, etc. |
| Level     | Depth of mapping (L1/L2/...)    | Choose minimal needed             |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input            | Description      | Example             | Where in the app it can come from |
| ---------------- | ---------------- | ------------------- | --------------------------------- |
| Scope            | products/regions | EU spare parts      | Setup                             |
| Process overview | current model    | plan→source→deliver | Notes                             |
| KPI baseline     | current metrics  | OTIF, lead time     | Upload                            |

### 3.2 Optional inputs (improves quality)

| Input             | Description      | Example         | Where in the app it can come from |
| ----------------- | ---------------- | --------------- | --------------------------------- |
| Benchmarks        | target values    | OTIF 95%        | Notes                             |
| Systems landscape | ERP/WMS/TMS      | integration map | Notes                             |
| Org structure     | owners by domain | Plan owner      | Setup                             |

### 3.3 Data quality checks

- Ensure KPI definitions are consistent (same denominator and window).
- Use the same time window across KPIs where possible.

---

## 4. Step-by-step method

### Step 1 — Setup

- Define scope, objective (benchmarking vs roadmap), and depth (L1/L2).

### Step 2 — Collect facts

- Capture current process overview and baseline KPIs.

### Step 3 — Structure

- Map processes into SCOR domains (Plan/Source/Make/Deliver/Return/Enable).
- Select KPI set aligned to SCOR attributes.

### Step 4 — Analyze

- Identify gaps vs targets/benchmarks.
- Link each gap to likely SCOR domains and drivers.

### Step 5 — Synthesize insights

- Build a coherent roadmap grouped by SCOR domains and time horizons.

### Step 6 — Convert to initiatives

- Convert gaps into initiatives with owners and dependencies across domains.

### Common mistakes & fixes

- **Mistake**: Too deep mapping → **Fix**: stay at L1/L2 unless needed.
- **Mistake**: No baseline data → **Fix**: define KPI operational definitions first.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable  | Description                   | Format in the app |
| ------------ | ----------------------------- | ----------------- |
| SCOR map     | Domains and subprocesses      | Swimlane map      |
| KPI baseline | By attribute                  | Dashboard         |
| Gap heatmap  | KPIs vs target                | Heatmap           |
| Roadmap      | Initiatives by domain/horizon | Timeline + list   |

### 5.2 Definition of Done (DoD) checklist

- [ ] Scope defined and mapped to SCOR domains
- [ ] KPI set defined with operational definitions
- [ ] Baseline measured and gaps defined
- [ ] Roadmap created with domain ownership

---

## 6. UI / Graphic specification

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

**Workspace (left column, 65% width):**

- **Setup**: Scope selector (products/regions), objective toggle (benchmarking/roadmap), depth selector (L1/L2/L3), org structure editor (domain owners)
- **SCOR Map**: Swimlane diagram
- **KPI Baseline**: Dashboard with attribute grouping
- **Gap Analysis**: Heatmap + gap list table
- **Roadmap**: Timeline + list view

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

**SCOR Map (Swimlane Diagram):**

- **Layout**: Horizontal swimlanes, one per SCOR domain (Plan, Source, Make, Deliver, Return, Enable)
- **Visual Design**:
  - Each domain: colored header bar (Plan=blue, Source=green, Make=orange, Deliver=purple, Return=red, Enable=gray)
  - Subprocesses (L2): boxes within swimlanes, labeled with code (e.g., "P1 - Plan Supply Chain")
  - Process flow: arrows between domains showing typical flow (Plan → Source → Make → Deliver)
  - Click subprocess → expands to show L3 process elements (if depth allows)
  - Hover subprocess → tooltip with description
- **Interactions**:
  - Drag-and-drop to map existing processes to SCOR subprocesses
  - Click subprocess → opens detail modal (description, owner, related KPIs)
  - Zoom/pan for large maps
  - Toggle L2/L3 visibility
- **Color Coding**:
  - Mapped processes: solid fill
  - Unmapped processes: dashed outline
  - Gaps (no process mapped): red highlight

**KPI Baseline Dashboard:**

- **Layout**: Grid of cards, grouped by SCOR performance attributes (5 groups: Reliability, Responsiveness, Agility, Cost, Asset Management)
- **Card Design**:
  - Header: Attribute name (e.g., "Reliability")
  - Content: List of KPIs for that attribute
  - Each KPI row: Name | Current Value | Target | Unit | Trend (↑/↓) | Status badge
  - Click KPI → opens detail modal (definition, calculation, data source, historical trend chart)
- **Visual Indicators**:
  - Status badges: Green (meets target), Yellow (within 10% of target), Red (below target)
  - Trend arrows: Up (improving), Down (declining), Flat (stable)
- **Interactions**:
  - Click "Add KPI" → modal form (name, attribute, definition, current value, target, unit)
  - Edit KPI values inline (with validation)
  - Filter by attribute (dropdown)
  - Sort by: Name, Value, Gap %

**Gap Analysis View:**

- **Heatmap (top section)**:
  - X-axis: SCOR Performance Attributes (Reliability, Responsiveness, Agility, Cost, Asset Management)
  - Y-axis: KPIs (grouped by attribute)
  - Cells: Color-coded by gap severity (red=critical gap, yellow=moderate gap, green=no gap/meets target)
  - Tooltip: Hover shows KPI name, current value, target, gap, affected domains
  - Click cell → highlights related domains on SCOR map, scrolls to gap detail
- **Gap List Table (below heatmap)**:
  - Columns: KPI | Current Value | Target | Gap | Gap % | Priority | Affected Domains | Actions
  - Sortable by: Gap %, Priority, KPI name
  - Filterable by: Attribute, Priority, Domain
  - Affected Domains: Badges showing which SCOR domains are impacted (e.g., "Deliver", "Source")
  - Priority badges: Critical (red), High (orange), Medium (yellow), Low (green)
  - "Draft Initiative" button per row → opens initiative creation wizard (pre-filled with gap and domain info)
- **Interactions**:
  - Click gap row → highlights on heatmap, highlights domains on SCOR map
  - Click domain badge → filters roadmap to show initiatives for that domain

**Roadmap View:**

- **Timeline Mode (default)**:
  - Horizontal timeline (months/quarters)
  - Initiatives grouped by SCOR domain (color-coded bars)
  - Dependencies shown as arrows between initiatives
  - Milestones: Key decision points, go-live dates
  - Hover initiative → tooltip (title, owner, status, dependencies)
  - Click initiative → opens detail modal (full description, owner, timeline, dependencies, expected impact)
- **List Mode (toggle)**:
  - Grouped by SCOR domain (collapsible sections)
  - Each initiative: Title | Domain | Owner | Timeline | Status | Dependencies | Actions
  - Sortable by: Domain, Timeline, Priority, Owner
  - Filterable by: Domain, Status, Timeline range
- **Initiative Card/Row Details**:
  - Title, description, rationale
  - Domain badge, owner (avatar + name)
  - Timeline: Start date, duration, milestones
  - Dependencies: Links to other initiatives (clickable)
  - Expected impact: KPIs expected to improve, target values
  - Status: Planned, In Progress, Completed, Blocked
- **Interactions**:
  - Drag initiatives on timeline to adjust dates
  - Click "Add Initiative" → modal form (pre-filled with gap/domain if clicked from gap)
  - Click dependency link → scrolls to related initiative
  - Bulk actions: Select multiple initiatives → change status, assign owner

### 6.3 Interactions

**SCOR Map:**

- Click subprocess → detail modal (description, owner, related KPIs, related gaps)
- Drag existing process name → drop on SCOR subprocess to map
- Hover subprocess → tooltip with description
- Click domain header → filters roadmap/KPIs to that domain

**KPI Baseline:**

- Click KPI card → detail modal (definition, calculation, data source, historical trend, related gaps)
- Click "Add KPI" → modal form
- Edit value inline → auto-saves, updates gap calculations
- Filter by attribute → updates dashboard view

**Gap Analysis:**

- Click heatmap cell → highlights on map, scrolls to gap detail
- Click gap row → highlights domains on SCOR map, filters roadmap
- Click "Draft Initiative" → opens wizard (pre-filled with gap, domain, expected impact)
- Click domain badge → filters roadmap to that domain

**Roadmap:**

- Click initiative → detail modal
- Drag on timeline → adjusts dates (with dependency validation)
- Click dependency link → navigates to related initiative
- Click "Add Initiative" → modal form
- Bulk select → change status, assign owner, adjust timeline

**General:**

- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

### 6.4 States

**Draft:**

- All sections editable
- SCOR map: Can add/remove mappings, change depth
- KPI baseline: Can add/edit KPIs, update values
- Gap analysis: Auto-calculates gaps, can manually adjust
- Roadmap: Can add/edit initiatives, adjust timeline
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**

- Sections locked (read-only) except for comments/annotations
- SCOR map: Read-only (snapshot taken)
- KPI baseline: Read-only (snapshot taken)
- Gap analysis: Read-only (snapshot taken)
- Roadmap: Read-only (snapshot taken)
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**

- All sections locked (read-only)
- SCOR map: Immutable snapshot
- KPI definitions: Immutable snapshot (baseline values locked)
- Gap analysis: Immutable snapshot
- Roadmap: Immutable snapshot (initiatives can be tracked separately)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**

- Loading: skeleton screens for maps/dashboards
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary (1 page)
- SCOR Process Map (swimlane diagram, full page)
- KPI Baseline (dashboard view, grouped by attributes)
- Gap Analysis (heatmap + gap list table)
- Roadmap (timeline + initiative details)
- Appendices: KPI definitions, SCOR domain descriptions, org structure

**Excel Export:**

- Multiple sheets: SCOR Map (process list), KPI Baseline, Gaps, Roadmap
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- SCOR map: Full page, landscape orientation
- Page breaks at logical sections
- Headers/footers with page numbers

---

## 7. Worked example

### Context

**Company**: Mid-size manufacturing firm producing industrial components  
**Scope**: EU spare parts supply chain (Product Families: A, B, C)  
**Objective**: Benchmark current performance and build improvement roadmap  
**Depth**: L1/L2 (top-level domains and process categories)

### Step 1: Setup

- **Scope**: EU region, spare parts (Families A, B, C)
- **Objective**: Roadmap (improvement focus, not just benchmarking)
- **Depth**: L2 (process categories, e.g., P1, P2, S1, S2, D1, D2)
- **Org Structure**:
  - Plan Owner: Supply Chain Director
  - Source Owner: Procurement Manager
  - Make Owner: Operations Director
  - Deliver Owner: Logistics Manager
  - Return Owner: Customer Service Manager
  - Enable Owner: IT Director

### Step 2: Collect Facts

**Current Process Overview:**

- **Plan**: Monthly demand planning (Excel-based), no formal S&OP
- **Source**: Direct suppliers (EU-based), 2-week lead time standard, some variability
- **Make**: Make-to-stock for high-volume items (Family A), make-to-order for low-volume (Families B, C)
- **Deliver**: Central warehouse (EU), 2-day delivery to customers, some stockouts
- **Return**: Defective returns handled ad-hoc, no formal process
- **Enable**: ERP system (SAP), basic WMS, no advanced analytics

**KPI Baseline Data:**

**Reliability Attributes:**
| KPI | Current Value | Target | Unit | Gap | Status |
|-----|---------------|--------|------|-----|--------|
| OTIF (On-Time In-Full) | 78% | 95% | % | -17% | Critical |
| Perfect Order Fulfillment | 72% | 98% | % | -26% | Critical |
| Order Fulfillment Accuracy | 96% | 99% | % | -3% | Medium |

**Responsiveness Attributes:**
| KPI | Current Value | Target | Unit | Gap | Status |
|-----|---------------|--------|------|-----|--------|
| Order Fulfillment Cycle Time | 3.5 days | 2 days | days | +1.5 days | High |
| Source Cycle Time | 14 days | 10 days | days | +4 days | High |
| Make Cycle Time | 5 days | 3 days | days | +2 days | Medium |

**Agility Attributes:**
| KPI | Current Value | Target | Unit | Gap | Status |
|-----|---------------|--------|------|-----|--------|
| Upside Supply Chain Flexibility | 15% | 25% | % | -10% | Medium |
| Upside Supply Chain Adaptability | 8 weeks | 4 weeks | weeks | +4 weeks | High |

**Cost Attributes:**
| KPI | Current Value | Target | Unit | Gap | Status |
|-----|---------------|--------|------|-----|--------|
| Total Supply Chain Management Cost | €2.5M | €2.0M | € | +€500k | High |
| Cost of Goods Sold | €18M | €17M | € | +€1M | Medium |

**Asset Management Attributes:**
| KPI | Current Value | Target | Unit | Gap | Status |
|-----|---------------|--------|------|-----|--------|
| Cash-to-Cash Cycle Time | 65 days | 45 days | days | +20 days | High |
| Inventory Days of Supply | 58 days | 45 days | days | +13 days | Medium |
| Return on Supply Chain Fixed Assets | 12% | 18% | % | -6% | Medium |

### Step 3: Structure (SCOR Mapping)

**SCOR Process Map (L2):**

**Plan (P):**

- P1: Plan Supply Chain (mapped, basic Excel-based planning)
- P2: Plan Source (mapped, informal)
- P3: Plan Make (mapped, basic)
- P4: Plan Deliver (mapped, basic)
- P5: Plan Return (not mapped, ad-hoc)

**Source (S):**

- S1: Source Stocked Products (mapped, EU suppliers, 2-week lead time)
- S2: Source Make-to-Order Products (mapped, same suppliers, longer lead time)
- S3: Source Engineer-to-Order Products (not applicable)

**Make (M):**

- M1: Make-to-Stock (mapped, Family A)
- M2: Make-to-Order (mapped, Families B, C)
- M3: Engineer-to-Order (not applicable)
- M4: Make-to-Repair (not applicable)

**Deliver (D):**

- D1: Deliver Stocked Products (mapped, central warehouse, 2-day delivery)
- D2: Deliver Make-to-Order Products (mapped, longer lead time)
- D3: Engineer-to-Order (not applicable)
- D4: Retail Products (not applicable)

**Return (R):**

- R1: Return Defective Products (mapped, ad-hoc process)
- R2: Return MRO Products (not mapped)
- R3: Return Excess Products (not mapped)

**Enable (E):**

- E1: Enable Supply Chain Performance (mapped, basic reporting)
- E2: Enable Supply Chain Risk (not mapped)
- E3: Enable Supply Chain Relationships (mapped, basic)
- E4: Enable Supply Chain Compliance (mapped, basic)
- E5: Enable Supply Chain Assets (mapped, basic)
- E6: Enable Supply Chain Technology (mapped, ERP/WMS)
- E7: Enable Supply Chain Network (not mapped)
- E8: Enable Supply Chain Workforce (mapped, basic)
- E9: Enable Supply Chain Knowledge (not mapped)

### Step 4: Analyze (Gap Analysis)

**Gap Summary by Domain:**

**Plan Domain:**

- Gaps: No formal S&OP (affects OTIF, forecast accuracy)
- Drivers: Excel-based planning, no cross-functional alignment
- Impact: High (affects all downstream processes)

**Source Domain:**

- Gaps: Source Cycle Time (+4 days), supplier lead-time variability
- Drivers: No supplier performance management, limited supplier base
- Impact: High (affects OTIF, inventory levels)

**Deliver Domain:**

- Gaps: OTIF 78% (vs 95% target), Order Fulfillment Cycle Time (+1.5 days)
- Drivers: Stockouts, warehouse picking inefficiencies, delivery routing
- Impact: Critical (direct customer impact)

**Return Domain:**

- Gaps: No formal return process (affects customer satisfaction)
- Drivers: Ad-hoc handling, no RMA system
- Impact: Medium (low volume but high customer impact)

**Enable Domain:**

- Gaps: Limited analytics, no risk management, no network optimization
- Drivers: Basic systems, limited capabilities
- Impact: Medium (enables improvement but not direct customer impact)

**Top 5 Gaps (Priority):**

1. **OTIF 78% (vs 95%)** - Deliver domain, affects Reliability
2. **Perfect Order Fulfillment 72% (vs 98%)** - Deliver domain, affects Reliability
3. **Source Cycle Time 14 days (vs 10 days)** - Source domain, affects Responsiveness
4. **Order Fulfillment Cycle Time 3.5 days (vs 2 days)** - Deliver domain, affects Responsiveness
5. **Total Supply Chain Management Cost €2.5M (vs €2.0M)** - Multiple domains, affects Cost

### Step 5: Synthesize Insights (Roadmap)

**Roadmap by Domain and Horizon:**

**Plan Domain (0–90 days):**

1. **"Implement Monthly S&OP Cadence"**
   - Owner: Supply Chain Director
   - Timeline: 90 days
   - Dependencies: None
   - Expected Impact: OTIF +5%, Forecast accuracy +10%
   - Status: Planned

**Source Domain (90–180 days):** 2. **"Reduce Supplier Lead-Time Variability"**

- Owner: Procurement Manager
- Timeline: 120 days
- Dependencies: Supplier performance dashboard (Enable domain)
- Expected Impact: Source Cycle Time -2 days, OTIF +3%
- Status: Planned

3. **"Implement Supplier Performance Management"**
   - Owner: Procurement Manager
   - Timeline: 90 days
   - Dependencies: None
   - Expected Impact: Source Cycle Time -1 day, OTIF +2%
   - Status: Planned

**Deliver Domain (0–180 days):** 4. **"Optimize Warehouse Flow and Picking"**

- Owner: Logistics Manager
- Timeline: 60 days
- Dependencies: None
- Expected Impact: Order Fulfillment Cycle Time -0.5 days, OTIF +3%
- Status: Planned

5. **"Implement Demand-Driven Replenishment"**
   - Owner: Logistics Manager
   - Timeline: 180 days
   - Dependencies: S&OP cadence (Plan domain)
   - Expected Impact: OTIF +7%, Inventory Days -5 days
   - Status: Planned

**Return Domain (90–180 days):** 6. **"Implement Formal Return Process (RMA System)"**

- Owner: Customer Service Manager
- Timeline: 90 days
- Dependencies: None
- Expected Impact: Customer satisfaction +10%, Return processing time -50%
- Status: Planned

**Enable Domain (0–180 days):** 7. **"Deploy Supply Chain Analytics Dashboard"**

- Owner: IT Director
- Timeline: 120 days
- Dependencies: None
- Expected Impact: Enables data-driven decisions, supports other initiatives
- Status: Planned

8. **"Implement Supply Chain Risk Management"**
   - Owner: IT Director
   - Timeline: 180 days
   - Dependencies: Analytics dashboard
   - Expected Impact: Risk mitigation, supply chain resilience
   - Status: Planned

**Roadmap Summary:**

- **Total Initiatives**: 8
- **Timeline**: 0–180 days (phased approach)
- **Expected Impact**: OTIF improvement from 78% to 90%+ (target 95%), Cost reduction €300k+, Cycle time improvements
- **Dependencies**: S&OP enables demand-driven replenishment; Analytics enables risk management

### Step 6: Convert to Initiatives

**Generated Initiatives (from roadmap):**

1. **"Implement Monthly S&OP Cadence"**
   - Source: Plan domain gap (no formal S&OP)
   - Rationale: Establishes cross-functional alignment, improves forecast accuracy
   - Domain: Plan
   - Expected Impact: OTIF +5%, Forecast accuracy +10%
   - Dependencies: None
   - Owner: Supply Chain Director
   - Timeline: 90 days

2. **"Reduce Supplier Lead-Time Variability"**
   - Source: Source domain gap (Source Cycle Time +4 days)
   - Rationale: Reduces uncertainty, improves OTIF
   - Domain: Source
   - Expected Impact: Source Cycle Time -2 days, OTIF +3%
   - Dependencies: Supplier performance dashboard
   - Owner: Procurement Manager
   - Timeline: 120 days

3. **"Optimize Warehouse Flow and Picking"**
   - Source: Deliver domain gap (Order Fulfillment Cycle Time +1.5 days, OTIF 78%)
   - Rationale: Improves delivery speed and accuracy
   - Domain: Deliver
   - Expected Impact: Order Fulfillment Cycle Time -0.5 days, OTIF +3%
   - Dependencies: None
   - Owner: Logistics Manager
   - Timeline: 60 days

4. **"Implement Demand-Driven Replenishment"**
   - Source: Deliver domain gap (OTIF 78%, Inventory Days +13 days)
   - Rationale: Balances inventory and service levels
   - Domain: Deliver
   - Expected Impact: OTIF +7%, Inventory Days -5 days
   - Dependencies: S&OP cadence
   - Owner: Logistics Manager
   - Timeline: 180 days

5. **"Deploy Supply Chain Analytics Dashboard"**
   - Source: Enable domain gap (limited analytics)
   - Rationale: Enables data-driven decisions, supports other initiatives
   - Domain: Enable
   - Expected Impact: Enables improvement tracking, supports other initiatives
   - Dependencies: None
   - Owner: IT Director
   - Timeline: 120 days

### Outcomes

- **SCOR Mapping**: Complete L2 mapping across all 6 domains, identified gaps in Plan (S&OP) and Return (formal process)
- **KPI Baseline**: 15 KPIs measured across 5 attributes, 8 critical/high priority gaps identified
- **Gap Analysis**: Top gaps in Deliver (OTIF, Perfect Order) and Source (Cycle Time), linked to domains
- **Roadmap**: 8 initiatives across 5 domains, phased 0–180 days, dependencies mapped
- **Expected Impact**: OTIF improvement from 78% to 90%+ (toward 95% target), cost reduction €300k+, cycle time improvements

---

## 8. Implementation spec

### 8.1 Data model (JSON)

**Full JSON Schema:**

```json
{
  "scope": {
    "region": "string (e.g., 'EU', 'US', 'Global')",
    "productFamily": "string | array (e.g., 'spare_parts' or ['A', 'B', 'C'])",
    "description": "string (optional)"
  },
  "objective": "benchmarking" | "roadmap" | "both",
  "depth": "L1" | "L2" | "L3" | "L4",
  "orgStructure": {
    "planOwner": "string (user ID or name)",
    "sourceOwner": "string (user ID or name)",
    "makeOwner": "string (user ID or name)",
    "deliverOwner": "string (user ID or name)",
    "returnOwner": "string (user ID or name)",
    "enableOwner": "string (user ID or name)"
  },
  "processMap": [
    {
      "domain": "Plan" | "Source" | "Make" | "Deliver" | "Return" | "Enable",
      "subprocess": "string (L2 code, e.g., 'P1', 'S1', 'D2')",
      "subprocessName": "string (e.g., 'Plan Supply Chain', 'Source Stocked Products')",
      "mapped": "boolean (true if process exists, false if gap)",
      "description": "string (optional, current process description)",
      "owner": "string (user ID or name, optional)",
      "level": "L1" | "L2" | "L3" | "L4",
      "relatedKpiIds": ["string (references to KPI IDs)"],
      "relatedGapIds": ["string (references to gap IDs)"]
    }
  ],
  "kpis": [
    {
      "id": "string (UUID)",
      "name": "string (required, e.g., 'OTIF', 'Perfect Order Fulfillment')",
      "attribute": "Reliability" | "Responsiveness" | "Agility" | "Cost" | "Asset Management",
      "definition": "string (required, operational definition)",
      "calculation": "string (optional, formula or method)",
      "currentValue": "number (required)",
      "targetValue": "number (required)",
      "unit": "string (e.g., '%', 'days', '€', 'units')",
      "baselineDate": "ISO 8601 date",
      "dataSource": "string (optional, where data comes from)",
      "industryBenchmark": "number | null (optional)",
      "trend": "improving" | "declining" | "stable" | null,
      "relatedDomainIds": ["string (references to processMap domain/subprocess)"],
      "lastUpdated": "ISO 8601 datetime",
      "updatedBy": "string (user ID)"
    }
  ],
  "gaps": [
    {
      "id": "string (UUID)",
      "kpiId": "string (reference to KPI ID)",
      "kpiName": "string (for display)",
      "currentValue": "number",
      "targetValue": "number",
      "gap": "number (calculated: currentValue - targetValue, negative = shortfall)",
      "gapPercent": "number (calculated: (gap / targetValue) * 100)",
      "priority": "critical" | "high" | "medium" | "low",
      "affectedDomains": ["Plan" | "Source" | "Make" | "Deliver" | "Return" | "Enable"],
      "drivers": ["string (root cause descriptions)"],
      "impact": "string (description of impact)",
      "relatedInitiativeIds": ["string (references to roadmap initiative IDs)"],
      "lastCalculated": "ISO 8601 datetime"
    }
  ],
  "roadmap": [
    {
      "id": "string (UUID)",
      "title": "string (required)",
      "description": "string (optional)",
      "rationale": "string (required, why this initiative)",
      "domain": "Plan" | "Source" | "Make" | "Deliver" | "Return" | "Enable",
      "owner": "string (user ID or name, required)",
      "timeline": {
        "startDate": "ISO 8601 date",
        "durationDays": "number (>= 0)",
        "endDate": "ISO 8601 date (calculated or explicit)",
        "horizon": "0-90d" | "90-180d" | "180d+" | null
      },
      "dependencies": ["string (references to other initiative IDs)"],
      "expectedImpact": {
        "kpiImprovements": [
          {
            "kpiId": "string (reference to KPI ID)",
            "kpiName": "string",
            "improvement": "string (e.g., '+5%', '-2 days')",
            "targetValue": "number (optional)"
          }
        ],
        "costSavings": "number | null (€)",
        "riskReduction": "string | null (description)"
      },
      "status": "planned" | "in_progress" | "completed" | "blocked" | "cancelled",
      "milestones": [
        {
          "name": "string",
          "date": "ISO 8601 date",
          "status": "pending" | "completed"
        }
      ],
      "relatedGapIds": ["string (references to gap IDs)"],
      "createdAt": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime"
    }
  ],
  "metadata": {
    "createdAt": "ISO 8601 datetime",
    "createdBy": "string (user ID)",
    "lastUpdated": "ISO 8601 datetime",
    "lastUpdatedBy": "string (user ID)",
    "status": "draft" | "in_review" | "approved",
    "version": "number (integer, increments on major changes)"
  }
}
```

**Validation Rules:**

1. **Scope consistency**: All processMap entries must reference valid SCOR domains.
2. **KPI attribute consistency**: All KPIs must have valid SCOR performance attributes.
3. **Gap calculation**: `gap` must equal `currentValue - targetValue` for the referenced KPI.
4. **Roadmap domain consistency**: All roadmap initiatives must reference valid SCOR domains.
5. **Dependency validation**: Roadmap dependencies must reference valid initiative IDs (no circular dependencies).
6. **Process mapping depth**: If `depth` is L1, only L1 processes should be mapped; if L2, L1 and L2, etc.

**Example (minimal valid instance):**

```json
{
  "scope": {
    "region": "EU",
    "productFamily": "spare_parts"
  },
  "objective": "roadmap",
  "depth": "L2",
  "orgStructure": {
    "planOwner": "supply-chain-director",
    "sourceOwner": "procurement-manager",
    "makeOwner": "ops-director",
    "deliverOwner": "logistics-manager",
    "returnOwner": "customer-service-manager",
    "enableOwner": "it-director"
  },
  "processMap": [
    {
      "domain": "Plan",
      "subprocess": "P1",
      "subprocessName": "Plan Supply Chain",
      "mapped": true,
      "description": "Basic Excel-based planning",
      "level": "L2"
    },
    {
      "domain": "Deliver",
      "subprocess": "D1",
      "subprocessName": "Deliver Stocked Products",
      "mapped": true,
      "description": "Central warehouse, 2-day delivery",
      "level": "L2"
    }
  ],
  "kpis": [
    {
      "id": "kpi-1",
      "name": "OTIF",
      "attribute": "Reliability",
      "definition": "On-Time In-Full: Percentage of orders delivered on time and in full",
      "currentValue": 0.78,
      "targetValue": 0.95,
      "unit": "%",
      "baselineDate": "2026-01-31",
      "industryBenchmark": 0.92,
      "trend": "stable",
      "lastUpdated": "2026-01-31T10:00:00Z",
      "updatedBy": "supply-chain-director"
    }
  ],
  "gaps": [
    {
      "id": "gap-1",
      "kpiId": "kpi-1",
      "kpiName": "OTIF",
      "currentValue": 0.78,
      "targetValue": 0.95,
      "gap": -0.17,
      "gapPercent": -17.9,
      "priority": "critical",
      "affectedDomains": ["Deliver", "Source"],
      "drivers": ["Stockouts", "Warehouse picking inefficiencies"],
      "impact": "Direct customer impact, affects service level",
      "lastCalculated": "2026-01-31T10:05:00Z"
    }
  ],
  "roadmap": [
    {
      "id": "init-1",
      "title": "Implement Monthly S&OP Cadence",
      "rationale": "Establishes cross-functional alignment, improves forecast accuracy",
      "domain": "Plan",
      "owner": "supply-chain-director",
      "timeline": {
        "startDate": "2026-02-01",
        "durationDays": 90,
        "endDate": "2026-05-01",
        "horizon": "0-90d"
      },
      "dependencies": [],
      "expectedImpact": {
        "kpiImprovements": [
          {
            "kpiId": "kpi-1",
            "kpiName": "OTIF",
            "improvement": "+5%",
            "targetValue": 0.83
          }
        ],
        "costSavings": null,
        "riskReduction": null
      },
      "status": "planned",
      "relatedGapIds": ["gap-1"],
      "createdAt": "2026-01-31T11:00:00Z",
      "updatedAt": "2026-01-31T11:00:00Z"
    }
  ],
  "metadata": {
    "createdAt": "2026-01-31T09:00:00Z",
    "createdBy": "supply-chain-director",
    "lastUpdated": "2026-01-31T11:00:00Z",
    "lastUpdatedBy": "supply-chain-director",
    "status": "draft",
    "version": 1
  }
}
```

### 8.2 Steps & sections mapping

- `setup` → `map` → `kpis` → `gaps` → `roadmap`

### 8.3 Validation rules (DoD)

- Must have scope and at least one mapped domain.
- Must have at least one KPI definition and baseline value.
- Must have at least one gap or an explicit “no gaps” statement.

### 8.4 Initiative generation spec

- Initiatives must include: title, rationale, domain, expected impact, dependencies, owner.
- Traceability: domain + gapId.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec

### 9.1 Non-negotiable reasoning rules

- Keep mapping depth minimal and objective-driven.
- Always propose KPI definitions, not only KPI names.
- Roadmap must be coherent and dependency-aware.

### 9.2 Prompt outline

- Confirm scope and objective.
- Recommend KPI set per attribute and define metrics.
- Propose domain-level initiatives to close gaps.

### 9.3 Extraction schema (JSON)

```json
{
  "kpiSet": [{ "name": "string", "attribute": "string", "definition": "string" }],
  "gaps": [{ "kpi": "string", "gap": -0.1, "domains": ["Deliver"] }],
  "roadmap": [{ "domain": "Plan", "initiative": "string", "horizon": "0-90d|90-180d|180d+" }]
}
```

### 9.4 Self-checks

- Do we have consistent KPI definitions?
- Are initiatives mapped to the right domains and gaps?

---

## 10. Consultant Report Specification

### Report Structure

**1. Executive Summary (1 page)**

- **Purpose**: High-level overview for leadership
- **Content**:
  - Current state: Scope, key performance metrics (top 3–5 KPIs)
  - Key findings: Top gaps, critical domains, risk areas
  - Recommendations: Roadmap summary, expected impact, timeline
  - Next steps: Governance, ownership, success metrics
- **Format**: Bullet points, key metrics cards, roadmap summary table
- **Example**:

  ```
  Executive Summary

  Scope: EU spare parts supply chain (Families A, B, C)

  Current Performance:
  - OTIF: 78% (target 95%) - Critical gap
  - Perfect Order Fulfillment: 72% (target 98%) - Critical gap
  - Source Cycle Time: 14 days (target 10 days) - High gap

  Key Findings:
  - Deliver domain shows critical gaps (OTIF, Perfect Order)
  - Source domain shows high gaps (Cycle Time)
  - Plan domain lacks formal S&OP process

  Recommendations:
  - 8 initiatives across 5 SCOR domains
  - Phased approach: 0–180 days
  - Expected impact: OTIF 78% → 90%+ (toward 95% target)

  Next Steps:
  - Establish S&OP cadence (Plan domain)
  - Optimize warehouse flow (Deliver domain)
  - Reduce supplier variability (Source domain)
  ```

**2. SCOR Process Map (2–3 pages)**

- **Purpose**: Visual representation of current process taxonomy
- **Content**:
  - SCOR map diagram: Swimlane view showing all 6 domains (Plan, Source, Make, Deliver, Return, Enable)
  - Process categories mapped: L2 subprocesses (e.g., P1, P2, S1, S2, D1, D2)
  - Process gaps: Unmapped or missing processes (highlighted)
  - Process flow: Arrows showing typical flow between domains
- **Format**: Full-page swimlane diagram, process list table, gap summary
- **Example**:

  ```
  SCOR Process Map

  Plan Domain:
  - P1: Plan Supply Chain (mapped, basic Excel-based planning)
  - P2: Plan Source (mapped, informal)
  - P3: Plan Make (mapped, basic)
  - P4: Plan Deliver (mapped, basic)
  - P5: Plan Return (not mapped, ad-hoc) - GAP

  Source Domain:
  - S1: Source Stocked Products (mapped, EU suppliers, 2-week lead time)
  - S2: Source Make-to-Order Products (mapped, same suppliers)

  Deliver Domain:
  - D1: Deliver Stocked Products (mapped, central warehouse, 2-day delivery)
  - D2: Deliver Make-to-Order Products (mapped, longer lead time)

  Process Gaps Identified:
  - P5: Plan Return (no formal process)
  - R2: Return MRO Products (not mapped)
  - R3: Return Excess Products (not mapped)
  - E2: Enable Supply Chain Risk (not mapped)
  ```

**3. KPI Baseline & Benchmarking (3–4 pages)**

- **Purpose**: Document current performance and targets
- **Content**:
  - KPI summary: All KPIs grouped by SCOR performance attributes (Reliability, Responsiveness, Agility, Cost, Asset Management)
  - Current vs target: Gap analysis for each KPI
  - Benchmarking: Industry benchmarks (if available)
  - Trend analysis: Historical performance (if available)
- **Format**: Tables, comparison charts, trend charts, gap summary
- **Example**:

  ```
  KPI Baseline & Benchmarking

  Reliability Attributes:
  | KPI | Current | Target | Gap | Status | Industry Benchmark |
  |-----|---------|--------|-----|--------|-------------------|
  | OTIF | 78% | 95% | -17% | Critical | 92% |
  | Perfect Order Fulfillment | 72% | 98% | -26% | Critical | 95% |
  | Order Fulfillment Accuracy | 96% | 99% | -3% | Medium | 98% |

  Responsiveness Attributes:
  | KPI | Current | Target | Gap | Status | Industry Benchmark |
  |-----|---------|--------|-----|--------|-------------------|
  | Order Fulfillment Cycle Time | 3.5 days | 2 days | +1.5 days | High | 2.2 days |
  | Source Cycle Time | 14 days | 10 days | +4 days | High | 11 days |
  | Make Cycle Time | 5 days | 3 days | +2 days | Medium | 3.5 days |

  Key Insights:
  - Reliability shows critical gaps (OTIF -17%, Perfect Order -26%)
  - Responsiveness shows high gaps (Cycle times +1.5 to +4 days)
  - Cost shows high gap (Total SCM Cost +€500k)
  ```

**4. Gap Analysis (2–3 pages)**

- **Purpose**: Identify and prioritize gaps
- **Content**:
  - Gap summary: All gaps by KPI, priority, affected domains
  - Gap drivers: Root cause analysis (why gaps exist)
  - Domain impact: Which SCOR domains are most affected
  - Priority matrix: Criticality vs feasibility
- **Format**: Gap table, heatmap, priority matrix, driver analysis
- **Example**:

  ```
  Gap Analysis

  Top 5 Gaps (Priority):
  1. OTIF 78% (vs 95%) - Deliver domain, Reliability attribute
     - Drivers: Stockouts, warehouse picking inefficiencies, delivery routing
     - Impact: Critical (direct customer impact)

  2. Perfect Order Fulfillment 72% (vs 98%) - Deliver domain, Reliability attribute
     - Drivers: Order accuracy issues, delivery timing, incomplete orders
     - Impact: Critical (direct customer impact)

  3. Source Cycle Time 14 days (vs 10 days) - Source domain, Responsiveness attribute
     - Drivers: Supplier lead-time variability, limited supplier base, no performance management
     - Impact: High (affects OTIF, inventory levels)

  4. Order Fulfillment Cycle Time 3.5 days (vs 2 days) - Deliver domain, Responsiveness attribute
     - Drivers: Warehouse flow inefficiencies, picking processes, delivery routing
     - Impact: High (affects customer satisfaction)

  5. Total Supply Chain Management Cost €2.5M (vs €2.0M) - Multiple domains, Cost attribute
     - Drivers: Inefficiencies across domains, lack of optimization, high inventory
     - Impact: High (affects profitability)

  Domain Impact Summary:
  - Deliver: 3 critical/high gaps (OTIF, Perfect Order, Cycle Time)
  - Source: 1 high gap (Cycle Time)
  - Plan: Process gap (no formal S&OP)
  - Return: Process gap (no formal process)
  ```

**5. Improvement Roadmap (3–4 pages)**

- **Purpose**: Present phased improvement plan
- **Content**:
  - Roadmap overview: Timeline, initiatives by domain, dependencies
  - Initiative details: Title, owner, timeline, expected impact, dependencies
  - Phased approach: 0–90 days, 90–180 days, 180+ days
  - Expected outcomes: KPI improvements, cost savings, risk reduction
- **Format**: Timeline diagram, initiative table, dependency graph, impact summary
- **Example**:

  ```
  Improvement Roadmap

  Phase 1 (0–90 days):
  - Implement Monthly S&OP Cadence (Plan domain)
    - Owner: Supply Chain Director
    - Expected Impact: OTIF +5%, Forecast accuracy +10%

  - Optimize Warehouse Flow and Picking (Deliver domain)
    - Owner: Logistics Manager
    - Expected Impact: Order Fulfillment Cycle Time -0.5 days, OTIF +3%

  Phase 2 (90–180 days):
  - Reduce Supplier Lead-Time Variability (Source domain)
    - Owner: Procurement Manager
    - Dependencies: Supplier performance dashboard
    - Expected Impact: Source Cycle Time -2 days, OTIF +3%

  - Implement Demand-Driven Replenishment (Deliver domain)
    - Owner: Logistics Manager
    - Dependencies: S&OP cadence
    - Expected Impact: OTIF +7%, Inventory Days -5 days

  - Deploy Supply Chain Analytics Dashboard (Enable domain)
    - Owner: IT Director
    - Expected Impact: Enables data-driven decisions

  Expected Outcomes:
  - OTIF: 78% → 90%+ (toward 95% target)
  - Perfect Order Fulfillment: 72% → 90%+ (toward 98% target)
  - Source Cycle Time: 14 days → 11 days (toward 10 days target)
  - Cost Reduction: €300k+ (Total SCM Cost)
  ```

**6. Governance & Next Steps (1–2 pages)**

- **Purpose**: Define ownership, cadence, and success metrics
- **Content**:
  - Governance structure: Domain owners, RACI matrix, review cadence
  - Success metrics: KPIs to track, target values, review frequency
  - Next steps: Immediate actions, follow-up dates, escalation process
- **Format**: RACI matrix, success metrics table, action plan
- **Example**:

  ```
  Governance & Next Steps

  Domain Ownership:
  - Plan: Supply Chain Director
  - Source: Procurement Manager
  - Make: Operations Director
  - Deliver: Logistics Manager
  - Return: Customer Service Manager
  - Enable: IT Director

  Review Cadence:
  - Monthly: Domain owners review progress
  - Quarterly: Executive review of roadmap and KPIs
  - Annual: Full SCOR reassessment

  Success Metrics:
  | Metric | Current | Target (90d) | Target (180d) | Owner |
  |--------|---------|-------------|---------------|-------|
  | OTIF | 78% | 83% | 90% | Logistics Manager |
  | Perfect Order Fulfillment | 72% | 80% | 90% | Logistics Manager |
  | Source Cycle Time | 14 days | 13 days | 11 days | Procurement Manager |

  Next Steps:
  - Week 1: Kick-off S&OP implementation (Supply Chain Director)
  - Week 2: Warehouse flow assessment (Logistics Manager)
  - Week 4: Supplier performance baseline (Procurement Manager)
  - Month 2: First S&OP meeting (Supply Chain Director)
  ```

**7. Appendices (optional, 1–2 pages)**

- **Purpose**: Supporting details and references
- **Content**:
  - KPI definitions: Full operational definitions, calculation formulas
  - SCOR domain descriptions: Brief descriptions of each domain
  - Org structure: Domain owners, reporting structure
  - Data sources: Where data came from, last updated dates
- **Format**: Tables, lists

### Report Formatting Guidelines

- **Length**: 12–18 pages (excluding appendices)
- **Language**: Business English, clear and concise
- **Tone**: Professional, data-driven, actionable
- **Visuals**:
  - SCOR map: Full-page swimlane diagram (landscape orientation)
  - Charts: Bar charts for KPI comparisons, line charts for trends, heatmaps for gaps
  - Tables: Formatted with headers, alternating row colors, sortable columns
  - Icons: Domain badges, priority indicators, status badges
- **Sections**: Numbered, with clear headings and subheadings
- **Page breaks**: At logical section boundaries
- **Headers/Footers**: Company name, report title, page numbers, date

---

## 11. Video storyboard

### 11.1 Audience & duration

- **Audience**: Supply chain leaders, transformation leads, operations executives
- **Duration**: 45–60 seconds intro
- **Style**: Professional, instructional, clear visuals

### 11.2 Scene list

**Scene 1: Hook & Problem (0–10s)**

- **Visual**: Split screen showing inconsistent KPIs across teams, red warning indicators, fragmented process maps
- **VO (PL)**: "Czy Twoje zespoły używają tego samego języka do opisu łańcucha dostaw?"
- **VO (EN)**: "Do your teams use the same language to describe your supply chain?"
- **On-screen text (PL)**: "Brak wspólnej taksonomii = Niespójne KPI"
- **On-screen text (EN)**: "No shared taxonomy = Inconsistent KPIs"

**Scene 2: Solution Intro (10–18s)**

- **Visual**: Tool logo/name appears, transition to SCOR domains overview (6 domains: Plan, Source, Make, Deliver, Return, Enable)
- **VO (PL)**: "SCOR Model to standardowa taksonomia procesów łańcucha dostaw i spójny zestaw KPI."
- **VO (EN)**: "SCOR Model is a standard taxonomy for supply chain processes and a consistent set of KPIs."
- **On-screen text (PL)**: "Standardowa taksonomia = Wspólny język"
- **On-screen text (EN)**: "Standard taxonomy = Shared language"

**Scene 3: SCOR Map (18–26s)**

- **Visual**: SCOR swimlane diagram, subprocesses mapped (P1, S1, D1 highlighted), click to expand detail
- **VO (PL)**: "Zmapuj swoje procesy do domen SCOR: Plan, Source, Make, Deliver, Return, Enable."
- **VO (EN)**: "Map your processes to SCOR domains: Plan, Source, Make, Deliver, Return, Enable."
- **On-screen text (PL)**: "Mapa procesów SCOR"
- **On-screen text (EN)**: "SCOR process map"

**Scene 4: KPI Baseline (26–34s)**

- **Visual**: KPI dashboard grouped by attributes (Reliability, Responsiveness, Agility, Cost, Asset Management), current vs target values, status badges
- **VO (PL)**: "Zmierz KPI pogrupowane według atrybutów wydajności SCOR."
- **VO (EN)**: "Measure KPIs grouped by SCOR performance attributes."
- **On-screen text (PL)**: "KPI pogrupowane według atrybutów"
- **On-screen text (EN)**: "KPIs grouped by attributes"

**Scene 5: Gap Analysis (34–42s)**

- **Visual**: Gap heatmap (KPI × Attribute matrix), red/yellow/green cells, click cell to see gap detail, affected domains highlighted on SCOR map
- **VO (PL)**: "Analiza luk pokazuje różnice między aktualną a docelową wydajnością."
- **VO (EN)**: "Gap analysis shows differences between current and target performance."
- **On-screen text (PL)**: "Luki = Różnice między aktualną a docelową wydajnością"
- **On-screen text (EN)**: "Gaps = Differences between current and target performance"

**Scene 6: Roadmap (42–50s)**

- **Visual**: Roadmap timeline, initiatives grouped by SCOR domain (color-coded bars), dependencies shown as arrows, click initiative to see details
- **VO (PL)**: "Zbuduj roadmapę inicjatyw pogrupowanych według domen SCOR."
- **VO (EN)**: "Build a roadmap of initiatives grouped by SCOR domains."
- **On-screen text (PL)**: "Roadmapa według domen SCOR"
- **On-screen text (EN)**: "Roadmap by SCOR domains"

**Scene 7: Export & CTA (50–60s)**

- **Visual**: PDF export preview, "Generate Initiatives" button highlighted
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij mapowanie SCOR już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start SCOR mapping today."
- **On-screen text (PL)**: "Eksportuj i generuj inicjatywy"
- **On-screen text (EN)**: "Export and generate initiatives"

### 11.3 Shot list

1. **Shot 1 (0–10s)**: Wide shot of split screen (inconsistent KPIs), zoom to warning indicators
2. **Shot 2 (10–18s)**: Fade to tool logo, pan to SCOR domains overview (6 domains)
3. **Shot 3 (18–26s)**: Close-up of SCOR swimlane diagram, click subprocess to expand
4. **Shot 4 (26–34s)**: Pan across KPI dashboard, highlight attribute groups, hover over KPI card
5. **Shot 5 (34–42s)**: Zoom to gap heatmap, click cell, highlight affected domains on SCOR map
6. **Shot 6 (42–50s)**: Focus on roadmap timeline, scroll to show initiatives, click initiative
7. **Shot 7 (50–60s)**: PDF preview overlay, fade to CTA button

### 11.4 Implementation notes

- **Screen recording**: Use actual tool interface (or high-fidelity mockup)
- **Transitions**: Smooth fades between scenes (0.5s)
- **Highlighting**: Use subtle glow/outline for interactive elements (SCOR domains, KPIs, gaps, initiatives)
- **Text overlays**: Bottom third of screen, semi-transparent background, readable font
- **VO**: Professional voiceover, clear pronunciation, moderate pace
- **Music**: Subtle background music (optional), non-distracting
- **Call-to-action**: End with tool name and "Get Started" button

---

## 12. Knowledge base extraction pack

1. **What is the main purpose of SCOR Model (Supply Chain Operations Reference)?**
   A: SCOR Model (Supply Chain Operations Reference) helps SCOR answers: \*\*“How do we describe our supply chain in a standard language, measure it consistently....

2. **When should I use SCOR Model (Supply Chain Operations Reference)?**
   A: Use it - You need a common process taxonomy across teams/regions.

- KPIs are inconsistent and benchmarking is impossible.
- You want an end-to-end roadmap al....

3. **What are the key outputs?**
   A: Key outputs include SCOR process map (Plan/Source/Make/Deliver/Return/Enable), KPI baseline, gaps, initiatives roadmap.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of SCOR Model (Supply Chain Operations Reference)?**
   A: SCOR Model (Supply Chain Operations Reference) helps SCOR answers: \*\*“How do we describe our supply chain in a standard language, measure it consistently....

2. **When should I use SCOR Model (Supply Chain Operations Reference)?**
   A: Use it You need a common process taxonomy across teams/regions.
   KPIs are inconsistent and benchmarking is impossible.
   You want an end-to-end roadmap aligned ....

3. **What are the key outputs?**
   A: Key outputs include SCOR process map (Plan/Source/Make/Deliver/Return/Enable), KPI baseline, gaps, initiatives roadmap.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good SCOR Model (Supply Chain Operations Reference) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good SCOR Model (Supply Chain Operations Reference) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- SCOR implementation checklist:
  - [ ] Scope defined (products/regions)
  - [ ] Processes mapped to SCOR domains
  - [ ] KPI definitions standardized
  - [ ] Baseline measured and gaps defined
  - [ ] Roadmap and owners assigned

### Glossary (short)

- SCOR, Plan/Source/Make/Deliver/Return/Enable, attribute, KPI baseline, roadmap

---

## 13. Additional Resources & Learning Links

- ASCM SCOR resources (membership/official materials; link as reference point): `https://www.ascm.org`

---

## 14. References

- ASCM (formerly APICS) — SCOR framework materials: `https://www.ascm.org`
- Bolstorff, Peter; Rosenbaum, Robert. _Supply Chain Excellence: A Handbook for Dramatic Improvement Using the SCOR Model_. AMACOM.
- Huan, S. H.; Sheoran, S. K.; Wang, G. “A review and analysis of supply chain operations reference (SCOR) model.” _Supply Chain Management: An International Journal_.
