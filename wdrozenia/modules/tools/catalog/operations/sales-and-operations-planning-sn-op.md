# Sales & Operations Planning (S&OP)

## Metadata

- **Tool name**: Sales & Operations Planning (S&OP)
- **Slug**: `sales-and-operations-planning-sn-op`
- **Category**: Operations
- **Level**: Advanced
- **Typical duration**: 2–4 weeks to stand up; monthly cadence (ongoing)
- **Best for**: Aligning demand and supply plans, resolving trade-offs, improving forecast accuracy and service
- **Not for**: One-off firefighting; organizations unwilling to commit cross-functionally to a cadence and decisions
- **Primary outputs**: Consensus demand plan, supply plan, gap analysis, decision log, executive S&OP plan
- **Required inputs (minimum)**:
  - Demand forecast baseline (sales/marketing)
  - Supply/capacity baseline (ops)
  - Inventory positions and service targets
- **Optional inputs**:
  - Financial plan/budget, constraints, scenario options, portfolio assumptions
- **Related tools (internal)**:
  - (ops) `scor-model.md`
  - (ops) `abc-xyz-inventory.md`
  - (ops) `safety-stock-reorder-point.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

S&OP answers: **“What is our one aligned plan for demand, supply, and inventory—and what decisions must leadership make?”** It creates a monthly governance and decision system, not just spreadsheets.

### 1.2 When to use

- Sales and operations plans conflict and firefighting is constant.
- Inventory is high but service levels are still poor.
- You need a recurring executive decision forum for trade-offs.

### 1.3 When NOT to use (anti-patterns)

- Running meetings without a decision log and owners.
- Mixing inconsistent time buckets/hierarchies across functions.
- Treating S&OP as forecasting only (it’s reconciliation + decisions).

### 1.4 What “good” looks like

- One plan is published monthly with assumptions, constraints, and decisions.
- Gaps are explicitly addressed via scenarios.
- Accountability exists (owners, due dates, follow-up).

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Demand plan**: forecast by product/region/channel and time bucket.
- **Supply plan**: capacity, production/procurement plans, constraints.
- **Consensus plan**: agreed version after reconciliation.
- **Gap**: difference between demand and supply/inventory capability.
- **Decision log**: documented trade-offs and approvals.

Typical S&OP cycle:

1. Data gathering → 2) Demand review → 3) Supply review → 4) Pre-S&OP (reconciliation) → 5) Executive S&OP (decisions)

### 2.2 Glossary

| Term         | Definition                            | Notes                   |
| ------------ | ------------------------------------- | ----------------------- |
| Frozen zone  | Near-term period with limited changes | Prevents churn          |
| Scenario     | Option to close gap                   | cost/service/risk       |
| Decision log | Documented trade-offs                 | Must include owner/date |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input           | Description            | Example          |
| --------------- | ---------------------- | ---------------- |
| Forecast        | baseline demand        | 12-month rolling |
| Capacity        | production/procurement | hours, units     |
| Inventory       | on-hand + pipeline     | weeks of supply  |
| Service targets | required service       | OTIF 95%         |

### 3.2 Optional inputs

| Input       | Description           | Example               |
| ----------- | --------------------- | --------------------- |
| Financials  | revenue/margin plan   | budget                |
| Constraints | supplier/plant limits | MOQ, lead times       |
| Scenarios   | options to close gaps | overtime, outsourcing |

### 3.3 Data quality checks

- Single product hierarchy definition (SKU→family).
- One time bucket standard (week/month) and horizon.
- Clear “frozen” period vs flexible horizon.

---

## 4. Step-by-step method

### Step 1 — Setup (cadence + scope)

- Define cadence (monthly), horizon, time buckets, and product hierarchy.
- Define RACI and decision rights.

### Step 2 — Collect facts (baseline plans)

- Build demand plan baseline and assumptions.
- Build supply plan baseline (capacity, constraints, inventory policy).

### Step 3 — Structure (reconciliation)

- Align demand and supply in the same time buckets/hierarchy.
- Identify gaps and constraints explicitly.

### Step 4 — Analyze (scenarios)

- Create scenarios to close gaps (overtime, outsourcing, inventory, demand shaping).
- Quantify trade-offs: cost, service, risk, feasibility.

### Step 5 — Synthesize insights (one plan)

- Prepare the recommended plan and decision pack for leadership.
- Decide and publish the consensus plan.

### Step 6 — Convert to initiatives

- Convert decisions and recurring gaps into initiatives:
  - “Implement S&OP cadence and templates”
  - “Reduce supplier lead-time variability”
  - “Update safety stock by ABC/XYZ class”

Common mistakes: skipping executive decisions; mixing planning horizons; unclear ownership.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable    | Description                        | Format in the app    |
| -------------- | ---------------------------------- | -------------------- |
| Demand plan    | Baseline + overrides + assumptions | Table + chart        |
| Supply plan    | Capacity and constraints           | Table + chart        |
| Gap analysis   | Demand vs supply                   | Overlay chart + list |
| Scenarios      | Options and trade-offs             | Comparison table     |
| Decision log   | Executive approvals                | Log with owners      |
| Published plan | “One plan” snapshot                | Exportable report    |

### 5.2 Definition of Done (DoD) checklist

- [ ] Cadence and roles defined (RACI)
- [ ] Demand and supply plans aligned to same buckets/hierarchy
- [ ] Gaps identified with ≥2 scenarios for top gaps
- [ ] Decisions documented and communicated

---

## 6. UI / Graphic specification

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

**Workspace (left column, 65% width):**

- **Setup**: Cadence selector (monthly/quarterly), horizon slider (12–24 months), time bucket toggle (week/month), product hierarchy selector (SKU/family/region), RACI matrix editor
- **Demand Plan**: Table view + chart toggle
- **Supply Plan**: Table view + chart toggle
- **Gap Analysis**: Overlay chart + gap list table
- **Scenarios**: Comparison cards or table view
- **Executive Plan**: Decision pack summary + decision log

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

**Demand Plan Table:**

- Columns: Time Bucket | Product Family | Baseline Forecast | Override | Final Demand | Assumption | Actions (Edit/Delete)
- Sortable by: Time Bucket, Product Family, Gap %
- Filterable by: Product Family, Time Bucket range
- Editable cells: Override, Assumption (inline editing with save/cancel)
- Visual indicators: Override cells highlighted in yellow; assumptions shown as info icons with tooltips

**Supply Plan Table:**

- Columns: Time Bucket | Product Family | Capacity (units) | Constraints | Inventory Policy | Actions
- Sortable/filterable same as Demand Plan
- Constraints shown as badges (color-coded: red=critical, yellow=moderate, green=minor)
- Capacity cells editable with validation (must be ≥ 0)

**Gap Analysis View:**

- **Overlay Chart** (dual-axis line chart):
  - X-axis: Time buckets (months)
  - Left Y-axis: Demand (units, blue line)
  - Right Y-axis: Supply (units, orange line)
  - Gap areas shaded in red (negative) or green (positive)
  - Tooltips: hover shows exact values, gap calculation, % variance
  - Zoom/pan enabled for long horizons
- **Gap List Table** (below chart):
  - Columns: Time Bucket | Product Family | Demand | Supply | Gap (units) | Gap % | Priority | Actions
  - Sortable by: Gap % (descending), Priority, Time Bucket
  - Priority badges: Critical (red), High (orange), Medium (yellow), Low (green)
  - Click row → highlights corresponding point on chart
  - "Create Scenario" button per row

**Scenarios View:**

- **Comparison Mode** (default): Card layout (3 columns on desktop, 1 column on mobile)
  - Each card: Scenario name, Gap closed (units), Cost (€), Service impact, Risk level, Feasibility score (1–5), Select button
  - Selected scenario: highlighted border (blue), checkmark icon
  - "Compare Selected" button → opens side-by-side comparison modal
- **Table Mode** (toggle):
  - Columns: Scenario | Gap Closed | Cost | Service Impact | Risk | Feasibility | Select
  - Sortable by any column
  - Bulk selection for multi-scenario comparison
- **Scenario Detail Modal** (click card):
  - Full description, assumptions, timeline, dependencies, owner
  - Edit/Delete actions

**Decision Log:**

- Timeline view (vertical, left-aligned):
  - Each entry: Date | Decision text | Owner (avatar + name) | Status (Pending/Approved/Rejected) | Follow-up date | Actions
  - Status badges: color-coded
  - Filterable by: Owner, Status, Date range
  - "Add Decision" button → modal form
- **Decision Entry Form**:
  - Fields: Decision text (textarea), Owner (user picker), Follow-up date (date picker), Related scenarios (multi-select), Priority (dropdown)
  - Validation: decision text required, owner required

**Executive Plan View:**

- **Decision Pack Summary** (top section):
  - Key metrics cards: Total gaps, Scenarios evaluated, Decisions pending/approved, Estimated cost impact
  - Executive summary text (editable, AI-suggested)
- **Published Plan Snapshot** (below summary):
  - Read-only view of approved demand/supply plans
  - Export buttons: PDF, Excel
  - Lock icon indicates immutability after approval

### 6.3 Interactions

**Demand Plan:**

- Click "Override" cell → inline editor with number input + reason field
- Click assumption icon → tooltip with full assumption text
- "Add Override" button → modal form (time bucket, product family, override value, reason)
- Chart toggle: switch between table and line chart view

**Supply Plan:**

- Click constraint badge → tooltip with constraint details (type, impact, mitigation)
- "Add Constraint" button → modal form (time bucket, product family, constraint type, description)
- Capacity cells: inline editing with validation

**Gap Analysis:**

- Hover chart → tooltip with exact values
- Click gap row → highlights on chart, scrolls chart to that time bucket
- "Create Scenario" button → opens scenario creation wizard (pre-filled with gap details)

**Scenarios:**

- Click scenario card → detail modal
- Click "Select" → marks as preferred, updates decision log draft entry
- "Compare Selected" → side-by-side comparison modal with metrics table
- Drag to reorder scenarios (priority)

**Decision Log:**

- Click "Add Decision" → modal form
- Click decision entry → expandable detail view (full text, related scenarios, comments)
- Status change → confirmation dialog, updates timeline

**General:**

- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

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
- Published plan snapshot created (immutable)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Decision log entries cannot be deleted (only commented)

**Visual States:**

- Loading: skeleton screens for tables/charts
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary (1 page)
- Demand Plan (table + chart)
- Supply Plan (table + chart)
- Gap Analysis (chart + table)
- Scenarios Comparison (table)
- Decision Log (timeline)
- Action Plan (from initiatives)
- Appendices: Assumptions log, RACI matrix, definitions

**Excel Export:**

- Multiple sheets: Demand Plan, Supply Plan, Gaps, Scenarios, Decision Log
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- Page breaks at logical sections
- Headers/footers with page numbers

---

## 7. Worked example

### Context

**Company**: Mid-size manufacturing firm producing industrial components  
**Product Family A**: High-volume SKUs (A-100, A-200, A-300)  
**Current Performance**: OTIF 92% (target 95%), Inventory turns 6.2x, Forecast accuracy 78% (MAPE)

### Step 1: Setup

- **Cadence**: Monthly S&OP cycle
- **Horizon**: 18 months rolling
- **Time Bucket**: Monthly
- **Product Hierarchy**: Family-level planning (drill-down to SKU for execution)
- **RACI**:
  - Demand Owner: Sales Director
  - Supply Owner: Operations Director
  - Executive Sponsor: COO

### Step 2: Collect Facts

**Demand Plan Baseline (Q2 2026):**
| Month | Product Family | Baseline Forecast (units) | Override | Final Demand | Assumption |
|-------|----------------|---------------------------|----------|--------------|------------|
| 2026-04 | A | 10,000 | - | 10,000 | Historical trend +2% |
| 2026-05 | A | 11,000 | +1,000 | 12,000 | New customer ramp (Customer X) |
| 2026-06 | A | 11,500 | +500 | 12,000 | Promo campaign continuation |
| 2026-07 | A | 10,500 | - | 10,500 | Return to baseline |

**Supply Plan Baseline (Q2 2026):**
| Month | Product Family | Capacity (units) | Constraints | Inventory Policy |
|-------|----------------|------------------|-------------|------------------|
| 2026-04 | A | 10,000 | None | Safety stock: 2 weeks |
| 2026-05 | A | 10,000 | Line 2 maintenance (reduces capacity by 500 units) | Safety stock: 2 weeks |
| 2026-06 | A | 10,000 | None | Safety stock: 2 weeks |
| 2026-07 | A | 10,000 | None | Safety stock: 2 weeks |

**Current Inventory Position:**

- On-hand: 2,500 units (Family A)
- Pipeline: 1,000 units (arriving 2026-04-15)
- Total available: 3,500 units

**Service Targets:**

- OTIF: 95%
- Lead time: 2 weeks
- Fill rate: 98%

### Step 3: Structure (Reconciliation)

**Gap Analysis:**
| Month | Demand | Supply | Inventory Available | Gap (units) | Gap % | Priority |
|-------|--------|--------|---------------------|-------------|-------|----------|
| 2026-04 | 10,000 | 10,000 | 3,500 | 0 | 0% | - |
| 2026-05 | 12,000 | 9,500 | 3,500 | -1,000 | -10.5% | Critical |
| 2026-06 | 12,000 | 10,000 | 2,500 | -1,500 | -15.0% | Critical |
| 2026-07 | 10,500 | 10,000 | 1,000 | -500 | -5.0% | High |

**Key Findings:**

- Q2 shows critical gaps in May and June due to demand surge (+20% vs baseline) and maintenance constraint in May
- Inventory buffer insufficient to cover gaps
- Service level at risk (OTIF may drop to 85% if gaps not addressed)

### Step 4: Analyze (Scenarios)

**Scenario 1: Overtime**

- **Gap Closed**: 1,500 units (May: 500, June: 1,000)
- **Cost**: €60,000 (overtime premium: €40/unit × 1,500 units)
- **Service Impact**: Maintains OTIF 95%
- **Risk**: Low (proven capability, no quality issues)
- **Feasibility**: 5/5 (can start immediately)
- **Timeline**: Immediate (no lead time)
- **Assumptions**: Workers available, no union constraints

**Scenario 2: Outsourcing (Contract Manufacturer)**

- **Gap Closed**: 1,500 units (May: 500, June: 1,000)
- **Cost**: €75,000 (outsourcing premium: €50/unit × 1,500 units)
- **Service Impact**: OTIF 90% (longer lead time, quality risk)
- **Risk**: Medium (new supplier, quality validation needed, longer lead time)
- **Feasibility**: 3/5 (requires supplier qualification, 4-week lead time)
- **Timeline**: 4 weeks to start (supplier onboarding)
- **Assumptions**: Supplier capacity available, quality standards met

**Scenario 3: Demand Shaping (Promo Shift)**

- **Gap Closed**: 500 units (shift May promo to July)
- **Cost**: €5,000 (promo cost deferral, no additional cost)
- **Service Impact**: Maintains OTIF 95% for shifted demand
- **Risk**: Low (customer agreement needed)
- **Feasibility**: 4/5 (requires sales negotiation)
- **Timeline**: 2 weeks (customer approval)
- **Assumptions**: Customer X agrees to shift, no revenue impact

**Scenario 4: Hybrid (Overtime + Demand Shaping)**

- **Gap Closed**: 1,500 units (Overtime: 1,000, Demand Shaping: 500)
- **Cost**: €40,000 (overtime: €40/unit × 1,000 units)
- **Service Impact**: Maintains OTIF 95%
- **Risk**: Low
- **Feasibility**: 4/5 (requires customer agreement for demand shift)
- **Timeline**: 2 weeks (customer approval for shift)
- **Assumptions**: Customer X agrees, workers available

### Step 5: Synthesize Insights (One Plan)

**Recommended Plan:**

- **Approved Scenario**: Hybrid (Scenario 4)
- **Rationale**:
  - Lowest cost option that maintains service levels
  - Risk mitigation through demand shaping reduces overtime exposure
  - Feasible within timeline

**Decision Pack Summary:**

- **Total Gap**: 3,000 units across Q2
- **Recommended Solution**: Hybrid (Overtime + Demand Shaping)
- **Cost Impact**: €40,000
- **Service Impact**: OTIF maintained at 95%
- **Key Trade-offs**: Cost vs risk (outsourcing rejected due to risk/service impact)

**Decision Log Entry:**

```json
{
  "date": "2026-02-15",
  "decision": "Approve hybrid scenario (overtime + demand shaping) for Q2 2026 to close 1,500-unit gap. Authorize €40,000 overtime budget. Sales to negotiate with Customer X for May promo shift to July.",
  "owner": "COO",
  "status": "Approved",
  "followUpDate": "2026-03-15",
  "relatedScenarios": ["Scenario 4"],
  "priority": "High",
  "actionItems": [
    "Operations: Execute overtime plan for May-June (1,000 units)",
    "Sales: Negotiate Customer X promo shift (500 units)",
    "Finance: Allocate €40,000 overtime budget",
    "Supply Chain: Update safety stock policy for Family A (increase by 20% for AZ items)"
  ]
}
```

**Published Plan Snapshot:**

- **Consensus Demand Plan**: Q2 totals 34,000 units (April: 10,000, May: 11,500, June: 11,500, July: 10,500)
- **Consensus Supply Plan**: Q2 totals 34,000 units (overtime + demand shaping applied)
- **Gaps**: Closed via approved scenarios
- **Status**: Approved and published on 2026-02-15

### Step 6: Convert to Initiatives

**Generated Initiatives:**

1. **"Implement Monthly S&OP Cadence"**
   - Source: Governance gap identified
   - Owner: COO
   - Timeline: 90 days
   - Impact: Establishes recurring decision forum

2. **"Reduce Supplier Lead-Time Variability"**
   - Source: Recurring constraint (Line 2 maintenance)
   - Owner: Operations Director
   - Timeline: 180 days
   - Impact: Reduces capacity constraints

3. **"Update Safety Stock Policy for Family A (AZ Items)"**
   - Source: Decision log action item
   - Owner: Supply Chain Manager
   - Timeline: 30 days
   - Impact: Increases buffer for high-variability items

### Outcomes

- **Service Level**: OTIF maintained at 95% (vs 85% without action)
- **Cost Impact**: €40,000 (vs €60,000 for full overtime, €75,000 for outsourcing)
- **Risk**: Mitigated through demand shaping component
- **Governance**: Established monthly S&OP cadence for future cycles

---

## 8. Implementation spec

### 8.1 Data model (JSON)

**Full JSON Schema:**

```json
{
  "cadence": "monthly" | "quarterly",
  "horizonMonths": 12 | 18 | 24,
  "timeBucket": "week" | "month" | "quarter",
  "productHierarchy": "SKU" | "family" | "region" | "channel",
  "raci": {
    "demandOwner": "string (user ID or name)",
    "supplyOwner": "string (user ID or name)",
    "executiveSponsor": "string (user ID or name)",
    "reviewers": ["string (user IDs or names)"]
  },
  "demandPlan": [
    {
      "timeBucket": "YYYY-MM" | "YYYY-WW" | "YYYY-QQ",
      "productFamily": "string",
      "baselineForecast": "number (units, required, >= 0)",
      "override": "number | null (units, optional)",
      "finalDemand": "number (units, calculated: baselineForecast + override)",
      "assumption": "string (required if override present)",
      "assumptionDetails": "string (optional, full text)",
      "riskLevel": "low" | "medium" | "high" | null,
      "lastUpdated": "ISO 8601 datetime",
      "updatedBy": "string (user ID)"
    }
  ],
  "supplyPlan": [
    {
      "timeBucket": "YYYY-MM" | "YYYY-WW" | "YYYY-QQ",
      "productFamily": "string",
      "capacityUnits": "number (required, >= 0)",
      "constraints": [
        {
          "type": "maintenance" | "supplier" | "capacity" | "quality" | "other",
          "description": "string",
          "impactUnits": "number (negative if reduces capacity)",
          "severity": "critical" | "high" | "medium" | "low",
          "mitigation": "string (optional)"
        }
      ],
      "inventoryPolicy": {
        "safetyStockWeeks": "number (>= 0)",
        "reorderPointWeeks": "number (>= 0)",
        "abcClassification": "A" | "B" | "C" | null,
        "xyzClassification": "X" | "Y" | "Z" | null
      },
      "lastUpdated": "ISO 8601 datetime",
      "updatedBy": "string (user ID)"
    }
  ],
  "inventoryPosition": {
    "onHand": "number (units, >= 0)",
    "pipeline": "number (units, >= 0)",
    "totalAvailable": "number (units, calculated: onHand + pipeline)",
    "asOfDate": "ISO 8601 date"
  },
  "serviceTargets": {
    "otif": "number (0-100, percentage)",
    "fillRate": "number (0-100, percentage)",
    "leadTimeWeeks": "number (>= 0)",
    "targetDate": "ISO 8601 date"
  },
  "gaps": [
    {
      "timeBucket": "YYYY-MM" | "YYYY-WW" | "YYYY-QQ",
      "productFamily": "string",
      "demand": "number (units)",
      "supply": "number (units)",
      "inventoryAvailable": "number (units)",
      "gapUnits": "number (calculated: demand - supply - inventoryAvailable, negative = shortfall)",
      "gapPercent": "number (calculated: (gapUnits / demand) * 100)",
      "priority": "critical" | "high" | "medium" | "low" | null,
      "drivers": ["string (e.g., 'demand surge', 'capacity constraint')"],
      "lastCalculated": "ISO 8601 datetime"
    }
  ],
  "scenarios": [
    {
      "id": "string (UUID or slug)",
      "name": "string (required)",
      "description": "string (optional)",
      "gapClosed": "number (units, >= 0)",
      "gapIds": ["string (references to gap IDs)"],
      "costEur": "number (>= 0)",
      "costBreakdown": {
        "overtime": "number (>= 0)",
        "outsourcing": "number (>= 0)",
        "inventory": "number (>= 0)",
        "other": "number (>= 0)"
      },
      "serviceImpact": {
        "otifChange": "number (percentage points, can be negative)",
        "fillRateChange": "number (percentage points, can be negative)",
        "leadTimeChange": "number (weeks, can be negative)"
      },
      "riskLevel": "low" | "medium" | "high",
      "riskDescription": "string (optional)",
      "feasibilityScore": "number (1-5, integer)",
      "feasibilityNotes": "string (optional)",
      "timeline": {
        "startDate": "ISO 8601 date",
        "durationWeeks": "number (>= 0)",
        "leadTimeWeeks": "number (>= 0, time to start)"
      },
      "assumptions": ["string"],
      "dependencies": ["string (e.g., 'Customer X approval', 'Supplier capacity')"],
      "owner": "string (user ID or name, optional)",
      "status": "draft" | "evaluated" | "selected" | "rejected",
      "createdAt": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime"
    }
  ],
  "decisions": [
    {
      "id": "string (UUID)",
      "date": "ISO 8601 date",
      "decision": "string (required, full text)",
      "owner": "string (user ID or name, required)",
      "status": "pending" | "approved" | "rejected" | "deferred",
      "followUpDate": "ISO 8601 date | null",
      "relatedScenarioIds": ["string (references to scenario IDs)"],
      "relatedGapIds": ["string (references to gap IDs)"],
      "priority": "critical" | "high" | "medium" | "low",
      "actionItems": [
        {
          "text": "string",
          "owner": "string (user ID or name)",
          "dueDate": "ISO 8601 date",
          "status": "pending" | "in_progress" | "completed"
        }
      ],
      "comments": [
        {
          "text": "string",
          "author": "string (user ID or name)",
          "createdAt": "ISO 8601 datetime"
        }
      ],
      "createdAt": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime"
    }
  ],
  "publishedPlan": {
    "snapshotDate": "ISO 8601 date",
    "consensusDemandPlan": ["array (copy of demandPlan at snapshot time)"],
    "consensusSupplyPlan": ["array (copy of supplyPlan at snapshot time)"],
    "approvedScenarios": ["string (scenario IDs)"],
    "approvedDecisions": ["string (decision IDs)"],
    "status": "draft" | "published" | "superseded",
    "publishedBy": "string (user ID or name)",
    "publishedAt": "ISO 8601 datetime"
  },
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

1. **Time bucket consistency**: All `timeBucket` values in `demandPlan`, `supplyPlan`, and `gaps` must use the same format (week/month/quarter) as defined in root `timeBucket`.
2. **Product hierarchy consistency**: All `productFamily` values must exist in the same hierarchy level as defined in `productHierarchy`.
3. **Gap calculation**: `gapUnits` must equal `demand - supply - inventoryAvailable` (with inventory available at that time bucket).
4. **Scenario gap closure**: Sum of `gapClosed` for selected scenarios must cover all critical/high priority gaps (or explicit "no action" decision).
5. **Decision status**: Decisions with status "approved" must have `owner` and `followUpDate` set.
6. **Published plan immutability**: Once `publishedPlan.status` is "published", it cannot be modified (only superseded by new snapshot).

**Example (minimal valid instance):**

```json
{
  "cadence": "monthly",
  "horizonMonths": 18,
  "timeBucket": "month",
  "productHierarchy": "family",
  "raci": {
    "demandOwner": "sales-director",
    "supplyOwner": "ops-director",
    "executiveSponsor": "coo",
    "reviewers": []
  },
  "demandPlan": [
    {
      "timeBucket": "2026-06",
      "productFamily": "A",
      "baselineForecast": 11500,
      "override": 500,
      "finalDemand": 12000,
      "assumption": "Promo campaign continuation",
      "riskLevel": "medium",
      "lastUpdated": "2026-02-10T10:00:00Z",
      "updatedBy": "sales-director"
    }
  ],
  "supplyPlan": [
    {
      "timeBucket": "2026-06",
      "productFamily": "A",
      "capacityUnits": 10000,
      "constraints": [],
      "inventoryPolicy": {
        "safetyStockWeeks": 2,
        "reorderPointWeeks": 1.5,
        "abcClassification": "A",
        "xyzClassification": "Z"
      },
      "lastUpdated": "2026-02-10T10:00:00Z",
      "updatedBy": "ops-director"
    }
  ],
  "inventoryPosition": {
    "onHand": 2500,
    "pipeline": 1000,
    "totalAvailable": 3500,
    "asOfDate": "2026-02-01"
  },
  "serviceTargets": {
    "otif": 95,
    "fillRate": 98,
    "leadTimeWeeks": 2,
    "targetDate": "2026-12-31"
  },
  "gaps": [
    {
      "timeBucket": "2026-06",
      "productFamily": "A",
      "demand": 12000,
      "supply": 10000,
      "inventoryAvailable": 2500,
      "gapUnits": -1500,
      "gapPercent": -12.5,
      "priority": "critical",
      "drivers": ["demand surge", "insufficient capacity"],
      "lastCalculated": "2026-02-10T10:05:00Z"
    }
  ],
  "scenarios": [
    {
      "id": "s1",
      "name": "Overtime",
      "gapClosed": 1500,
      "gapIds": ["gap-2026-06-A"],
      "costEur": 60000,
      "costBreakdown": {
        "overtime": 60000,
        "outsourcing": 0,
        "inventory": 0,
        "other": 0
      },
      "serviceImpact": {
        "otifChange": 0,
        "fillRateChange": 0,
        "leadTimeChange": 0
      },
      "riskLevel": "low",
      "feasibilityScore": 5,
      "timeline": {
        "startDate": "2026-05-01",
        "durationWeeks": 8,
        "leadTimeWeeks": 0
      },
      "assumptions": ["Workers available", "No union constraints"],
      "status": "evaluated",
      "createdAt": "2026-02-10T11:00:00Z",
      "updatedAt": "2026-02-10T11:00:00Z"
    }
  ],
  "decisions": [
    {
      "id": "d1",
      "date": "2026-02-15",
      "decision": "Approve hybrid scenario (overtime + demand shaping) for Q2 2026",
      "owner": "coo",
      "status": "approved",
      "followUpDate": "2026-03-15",
      "relatedScenarioIds": ["s4"],
      "priority": "high",
      "actionItems": [
        {
          "text": "Execute overtime plan for May-June",
          "owner": "ops-director",
          "dueDate": "2026-04-01",
          "status": "pending"
        }
      ],
      "createdAt": "2026-02-15T14:00:00Z",
      "updatedAt": "2026-02-15T14:00:00Z"
    }
  ],
  "publishedPlan": {
    "snapshotDate": "2026-02-15",
    "consensusDemandPlan": [],
    "consensusSupplyPlan": [],
    "approvedScenarios": ["s4"],
    "approvedDecisions": ["d1"],
    "status": "published",
    "publishedBy": "coo",
    "publishedAt": "2026-02-15T15:00:00Z"
  },
  "metadata": {
    "createdAt": "2026-02-01T09:00:00Z",
    "createdBy": "sales-director",
    "lastUpdated": "2026-02-15T15:00:00Z",
    "lastUpdatedBy": "coo",
    "status": "approved",
    "version": 1
  }
}
```

### 8.2 Steps & sections mapping

- `setup` → `demand` → `supply` → `gaps` → `scenarios` → `decisions`

### 8.3 Validation rules (DoD)

- Must define time bucket/horizon and product hierarchy.
- Must have demand plan and supply plan for the same buckets.
- Must have at least one gap and at least one scenario (or explicit “no gaps”).

### 8.4 Initiative generation spec

- Initiatives come from:
  - recurring gap drivers (capacity, supplier, inventory),
  - governance improvements (templates, cadence, roles).
- Traceability: `source_type='tool'`, `tool_session_id`, `gapId`/`decisionId`.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, review/approve, generate initiatives).

---

## 9. AI spec

### 9.1 Non-negotiable reasoning rules

- Always check time bucket and hierarchy consistency.
- Scenarios must include trade-offs (cost/service/risk), not only “do more”.
- Decisions must be explicit and logged.

### 9.2 Prompt outline

- Validate scope/horizon/hierarchy.
- Summarize gaps and propose scenarios.
- Draft executive pack and decision log entries.

### 9.3 Extraction schema (JSON)

```json
{
  "gaps": [{ "month": "YYYY-MM", "family": "string", "gapUnits": 1000 }],
  "scenarios": [{ "name": "string", "gapClosed": 1000, "costEur": 60000, "risk": "string" }],
  "decisionPack": { "recommendation": "string", "keyTradeoffs": ["string"] }
}
```

### 9.4 Self-checks

- Are demand and supply plans aligned to the same buckets?
- Are scenario trade-offs explicit?
- Is there a decision and owner for top gaps?

---

## 10. Consultant Report Specification

### Report Structure

**1. Executive Summary (1 page)**

- **Purpose**: High-level overview for C-suite
- **Content**:
  - Current state: Key performance metrics (OTIF, inventory turns, forecast accuracy)
  - Key findings: Top 3 gaps, critical constraints, risk areas
  - Recommendations: Approved scenarios, cost impact, service impact
  - Decisions required: Executive decisions made, pending actions
- **Format**: Bullet points, key metrics cards, decision summary table
- **Example**:

  ```
  Executive Summary

  Current Performance:
  - OTIF: 92% (target 95%)
  - Inventory turns: 6.2x
  - Forecast accuracy: 78% MAPE

  Key Findings:
  - Q2 2026 shows critical gaps (3,000 units) due to demand surge (+20%) and maintenance constraints
  - Service level at risk without intervention (OTIF may drop to 85%)

  Recommendations:
  - Approved: Hybrid scenario (Overtime + Demand Shaping)
  - Cost impact: €40,000
  - Service impact: OTIF maintained at 95%

  Decisions Made:
  - COO approved hybrid scenario on 2026-02-15
  - €40,000 overtime budget authorized
  - Safety stock policy update for Family A (AZ items)
  ```

**2. Current Performance Context (2–3 pages)**

- **Purpose**: Establish baseline and context
- **Content**:
  - Service metrics: OTIF, fill rate, lead time (current vs target, trends)
  - Inventory metrics: Turns, days of supply, ABC/XYZ classification summary
  - Forecast accuracy: MAPE by product family, bias analysis
  - Operational constraints: Capacity utilization, supplier performance, quality metrics
- **Format**: Tables, trend charts, comparison charts (current vs target)
- **Example**:

  ```
  Current Performance Context

  Service Level Performance:
  | Metric | Current | Target | Gap |
  |--------|---------|--------|-----|
  | OTIF | 92% | 95% | -3% |
  | Fill Rate | 96% | 98% | -2% |
  | Lead Time | 2.5 weeks | 2 weeks | +0.5 weeks |

  Inventory Performance:
  - Inventory turns: 6.2x (industry benchmark: 8x)
  - Days of supply: 58 days (target: 45 days)
  - ABC classification: 70% of value in A items (20% of SKUs)

  Forecast Accuracy:
  - Overall MAPE: 78% (target: 75%)
  - Family A MAPE: 82% (highest variability)
  - Bias: +5% (tendency to over-forecast)
  ```

**3. Demand Plan Analysis (2–3 pages)**

- **Purpose**: Document demand assumptions and forecast quality
- **Content**:
  - Demand plan summary: Total by time bucket, product family breakdown
  - Assumptions log: Key assumptions per product family/time bucket
  - Forecast accuracy analysis: MAPE, bias, trend analysis
  - Overrides and rationale: Manual overrides, reasons, impact
  - Risk factors: Demand volatility, customer concentration, market trends
- **Format**: Tables, assumption log table, accuracy charts, risk heatmap
- **Example**:

  ```
  Demand Plan Analysis

  Q2 2026 Demand Summary:
  | Month | Product Family A | Product Family B | Total |
  |-------|------------------|------------------|-------|
  | April | 10,000 | 5,000 | 15,000 |
  | May | 12,000 | 5,500 | 17,500 |
  | June | 12,000 | 6,000 | 18,000 |
  | July | 10,500 | 5,200 | 15,700 |

  Key Assumptions:
  - May: +1,000 units override due to new customer ramp (Customer X)
  - June: +500 units override due to promo campaign continuation
  - Forecast accuracy: 78% MAPE (acceptable but room for improvement)

  Risk Factors:
  - High: Customer X ramp timing uncertainty
  - Medium: Promo campaign effectiveness
  - Low: Baseline demand stability
  ```

**4. Supply Plan Analysis (2–3 pages)**

- **Purpose**: Document capacity, constraints, and inventory policy
- **Content**:
  - Capacity plan: Available capacity by time bucket, product family
  - Constraints: Supplier limits, plant capacity, maintenance schedules, MOQ constraints
  - Inventory policy: Safety stock levels, reorder points, ABC/XYZ classification
  - Supply risks: Supplier reliability, lead time variability, quality issues
- **Format**: Tables, constraint matrix, capacity charts, risk assessment
- **Example**:

  ```
  Supply Plan Analysis

  Capacity Plan:
  | Month | Product Family A | Product Family B | Total Capacity |
  |-------|------------------|------------------|----------------|
  | April | 10,000 | 5,000 | 15,000 |
  | May | 9,500 | 5,000 | 14,500 |
  | June | 10,000 | 5,000 | 15,000 |
  | July | 10,000 | 5,200 | 15,200 |

  Constraints:
  - May: Line 2 maintenance reduces Family A capacity by 500 units
  - Supplier MOQ: Minimum 1,000 units per order (affects flexibility)
  - Lead time: 2 weeks standard (3 weeks for new suppliers)

  Inventory Policy:
  - Safety stock: 2 weeks of demand
  - Reorder point: 1.5 weeks of demand
  - ABC classification: A items (high value) have higher safety stock
  ```

**5. Gap Analysis (2–3 pages)**

- **Purpose**: Identify and quantify gaps between demand and supply
- **Content**:
  - Gap summary: Total gaps by time bucket, product family
  - Gap drivers: Root cause analysis (demand surge, capacity constraints, inventory shortfall)
  - Priority matrix: Criticality vs feasibility
  - Impact assessment: Service level impact, cost impact, risk impact
- **Format**: Gap table, overlay charts (demand vs supply), priority heatmap, impact matrix
- **Example**:

  ```
  Gap Analysis

  Gap Summary:
  | Month | Demand | Supply | Gap (units) | Gap % | Priority |
  |-------|--------|--------|-------------|-------|----------|
  | April | 10,000 | 10,000 | 0 | 0% | - |
  | May | 12,000 | 9,500 | -1,000 | -10.5% | Critical |
  | June | 12,000 | 10,000 | -1,500 | -15.0% | Critical |
  | July | 10,500 | 10,000 | -500 | -5.0% | High |

  Gap Drivers:
  - Demand surge: +20% vs baseline (new customer + promo)
  - Capacity constraint: Line 2 maintenance in May (-500 units)
  - Inventory buffer: Insufficient to cover gaps (only 3,500 units available)

  Impact Assessment:
  - Service level: OTIF may drop to 85% without intervention (vs 95% target)
  - Cost impact: Estimated €40,000–€75,000 depending on scenario
  - Risk: High customer dissatisfaction if service levels drop
  ```

**6. Scenarios & Trade-offs (2–3 pages)**

- **Purpose**: Present options to close gaps and decision rationale
- **Content**:
  - Scenario comparison: All scenarios evaluated, metrics comparison
  - Trade-off analysis: Cost vs service vs risk vs feasibility
  - Recommended scenario: Rationale, assumptions, timeline
  - Rejected scenarios: Reasons for rejection
- **Format**: Comparison table, trade-off matrix, scenario cards, decision tree
- **Example**:

  ```
  Scenarios & Trade-offs

  Scenario Comparison:
  | Scenario | Gap Closed | Cost | Service Impact | Risk | Feasibility | Status |
  |----------|------------|------|----------------|------|-------------|--------|
  | Overtime | 1,500 | €60k | Maintains 95% | Low | 5/5 | Considered |
  | Outsourcing | 1,500 | €75k | Drops to 90% | Medium | 3/5 | Rejected |
  | Demand Shaping | 500 | €5k | Maintains 95% | Low | 4/5 | Considered |
  | Hybrid | 1,500 | €40k | Maintains 95% | Low | 4/5 | Approved |

  Trade-off Analysis:
  - Cost: Hybrid lowest (€40k vs €60k–€75k)
  - Service: Hybrid maintains target (95% vs 90% for outsourcing)
  - Risk: Hybrid lowest (proven capability + demand shift)
  - Feasibility: Hybrid high (4/5, requires customer agreement)

  Recommended Scenario: Hybrid (Overtime + Demand Shaping)
  - Rationale: Lowest cost, maintains service, mitigates risk
  - Assumptions: Customer X agrees to promo shift, workers available
  - Timeline: 2 weeks (customer approval)
  ```

**7. Executive Decisions & Action Plan (2–3 pages)**

- **Purpose**: Document decisions made and actions required
- **Content**:
  - Decision log: All decisions with owners, dates, status, follow-up dates
  - Action plan: Specific actions, owners, due dates, dependencies
  - Governance: S&OP cadence, roles, escalation process
  - Next steps: Follow-up items, review dates, success metrics
- **Format**: Decision timeline, action plan table, RACI matrix, governance diagram
- **Example**:

  ```
  Executive Decisions & Action Plan

  Decision Log:
  | Date | Decision | Owner | Status | Follow-up |
  |------|----------|-------|--------|-----------|
  | 2026-02-15 | Approve hybrid scenario | COO | Approved | 2026-03-15 |
  | 2026-02-15 | Authorize €40k budget | CFO | Approved | 2026-03-15 |
  | 2026-02-15 | Update safety stock policy | Supply Chain | Pending | 2026-03-01 |

  Action Plan:
  | Action | Owner | Due Date | Status | Dependencies |
  |--------|-------|----------|--------|--------------|
  | Execute overtime plan | Operations | 2026-04-01 | Planned | Budget approval |
  | Negotiate Customer X shift | Sales | 2026-02-28 | In Progress | Customer agreement |
  | Allocate budget | Finance | 2026-02-20 | Completed | COO approval |
  | Update safety stock | Supply Chain | 2026-03-01 | Planned | Policy review |

  Governance:
  - S&OP Cadence: Monthly (first Monday of each month)
  - Roles: Demand Owner (Sales), Supply Owner (Ops), Executive Sponsor (COO)
  - Escalation: Issues unresolved in Pre-S&OP escalate to Executive S&OP
  ```

**8. Appendices (optional, 1–2 pages)**

- **Purpose**: Supporting details and references
- **Content**:
  - Assumptions log: Full list of assumptions
  - RACI matrix: Roles and responsibilities
  - Definitions: Key terms, acronyms
  - Data sources: Where data came from, last updated dates
- **Format**: Tables, lists

### Report Formatting Guidelines

- **Length**: 10–15 pages (excluding appendices)
- **Language**: Business English, clear and concise
- **Tone**: Professional, data-driven, actionable
- **Visuals**:
  - Charts: Line charts for trends, bar charts for comparisons, heatmaps for priorities
  - Tables: Formatted with headers, alternating row colors, sortable columns
  - Icons: Status badges, priority indicators, risk levels
- **Sections**: Numbered, with clear headings and subheadings
- **Page breaks**: At logical section boundaries
- **Headers/Footers**: Company name, report title, page numbers, date

---

## 11. Video storyboard

### 11.1 Audience & duration

- **Audience**: Operations leaders, supply chain managers, executives involved in S&OP
- **Duration**: 45–60 seconds intro
- **Style**: Professional, instructional, clear visuals

### 11.2 Scene list

**Scene 1: Hook & Problem (0–10s)**

- **Visual**: Split screen showing conflicting plans (sales forecast vs operations capacity), red warning indicators
- **VO (PL)**: "Czy Twoje plany sprzedażowe i operacyjne są ze sobą zsynchronizowane?"
- **VO (EN)**: "Are your sales and operations plans aligned?"
- **On-screen text (PL)**: "Konflikt planów = Problemy z dostępnością"
- **On-screen text (EN)**: "Plan conflict = Availability issues"

**Scene 2: Solution Intro (10–18s)**

- **Visual**: Tool logo/name appears, transition to S&OP dashboard overview
- **VO (PL)**: "Sales & Operations Planning to miesięczny proces, który tworzy jeden zsynchronizowany plan."
- **VO (EN)**: "Sales & Operations Planning is a monthly process that creates one aligned plan."
- **On-screen text (PL)**: "Jeden plan = Lepsza dostępność"
- **On-screen text (EN)**: "One plan = Better availability"

**Scene 3: Demand Plan (18–26s)**

- **Visual**: Demand plan table with forecast data, override cells highlighted, assumption tooltips
- **VO (PL)**: "Zacznij od planu popytu: prognoza, nadpisania i założenia."
- **VO (EN)**: "Start with the demand plan: forecast, overrides, and assumptions."
- **On-screen text (PL)**: "Plan popytu z założeniami"
- **On-screen text (EN)**: "Demand plan with assumptions"

**Scene 4: Supply Plan (26–34s)**

- **Visual**: Supply plan table with capacity data, constraint badges (red/yellow), inventory policy
- **VO (PL)**: "Następnie plan podaży: zdolności produkcyjne i ograniczenia."
- **VO (EN)**: "Then the supply plan: production capacity and constraints."
- **On-screen text (PL)**: "Plan podaży z ograniczeniami"
- **On-screen text (EN)**: "Supply plan with constraints"

**Scene 5: Gap Analysis (34–42s)**

- **Visual**: Overlay chart (demand vs supply lines), gap areas shaded red, gap list table below
- **VO (PL)**: "Analiza luk pokazuje różnice między popytem a podażą."
- **VO (EN)**: "Gap analysis shows differences between demand and supply."
- **On-screen text (PL)**: "Luki = Różnice między popytem a podażą"
- **On-screen text (EN)**: "Gaps = Differences between demand and supply"

**Scene 6: Scenarios (42–50s)**

- **Visual**: Scenario comparison cards, selected scenario highlighted, trade-off metrics visible
- **VO (PL)**: "Oceń scenariusze: koszt, wpływ na serwis, ryzyko."
- **VO (EN)**: "Evaluate scenarios: cost, service impact, risk."
- **On-screen text (PL)**: "Scenariusze z analizą trade-off"
- **On-screen text (EN)**: "Scenarios with trade-off analysis"

**Scene 7: Decision Log (50–56s)**

- **Visual**: Decision log timeline, approved decision entry with owner and status
- **VO (PL)**: "Zatwierdź decyzje i opublikuj jeden plan."
- **VO (EN)**: "Approve decisions and publish one plan."
- **On-screen text (PL)**: "Dziennik decyzji i zatwierdzony plan"
- **On-screen text (EN)**: "Decision log and approved plan"

**Scene 8: Export & CTA (56–60s)**

- **Visual**: PDF export preview, "Generate Initiatives" button highlighted
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij S&OP już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start S&OP today."
- **On-screen text (PL)**: "Eksportuj i generuj inicjatywy"
- **On-screen text (EN)**: "Export and generate initiatives"

### 11.3 Shot list

1. **Shot 1 (0–10s)**: Wide shot of split screen (sales vs ops), zoom to warning indicators
2. **Shot 2 (10–18s)**: Fade to tool logo, pan to dashboard overview
3. **Shot 3 (18–26s)**: Close-up of demand plan table, hover over assumption tooltip
4. **Shot 4 (26–34s)**: Pan across supply plan table, highlight constraint badges
5. **Shot 5 (34–42s)**: Zoom to overlay chart, pan down to gap list table
6. **Shot 6 (42–50s)**: Focus on scenario cards, click to select, show comparison
7. **Shot 7 (50–56s)**: Scroll through decision log timeline, highlight approved entry
8. **Shot 8 (56–60s)**: PDF preview overlay, fade to CTA button

### 11.4 Implementation notes

- **Screen recording**: Use actual tool interface (or high-fidelity mockup)
- **Transitions**: Smooth fades between scenes (0.5s)
- **Highlighting**: Use subtle glow/outline for interactive elements
- **Text overlays**: Bottom third of screen, semi-transparent background, readable font
- **VO**: Professional voiceover, clear pronunciation, moderate pace
- **Music**: Subtle background music (optional), non-distracting
- **Call-to-action**: End with tool name and "Get Started" button

---

## 12. Knowledge base extraction pack

1. **What is the main purpose of Sales & Operations Planning (S&OP)?**
   A: Sales & Operations Planning (S&OP) helps S&OP answers: \*\*“What is our one aligned plan for demand, supply, and inventory—and what decisions m....

2. **When should I use Sales & Operations Planning (S&OP)?**
   A: Use it - Sales and operations plans conflict and firefighting is constant.

- Inventory is high but service levels are still poor.
- You need a recurring exec....

3. **What are the key outputs?**
   A: Key outputs include Consensus demand plan, supply plan, gap analysis, decision log, executive S&OP plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Sales & Operations Planning (S&OP)?**
   A: Sales & Operations Planning (S&OP) helps S&OP answers: \*\*“What is our one aligned plan for demand, supply, and inventory—and what decisions m....

2. **When should I use Sales & Operations Planning (S&OP)?**
   A: Use it Sales and operations plans conflict and firefighting is constant.
   Inventory is high but service levels are still poor.
   You need a recurring executive ....

3. **What are the key outputs?**
   A: Key outputs include Consensus demand plan, supply plan, gap analysis, decision log, executive S&OP plan.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Sales & Operations Planning (S&OP) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Sales & Operations Planning (S&OP) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- S&OP readiness checklist:
  - [ ] Defined cadence and calendar
  - [ ] Roles and decision rights (RACI)
  - [ ] Standard templates and definitions (time buckets, hierarchy)
  - [ ] Scenario options for common gaps
  - [ ] Decision log and communication plan

### Glossary (short)

- Demand plan, supply plan, consensus plan, gap, scenario, executive S&OP, decision log

---

## 13. Additional Resources & Learning Links

- ASCM/APICS planning concepts (book-based)

---

## 14. References

- Wallace, Thomas F.; Stahl, Robert A. _Sales & Operations Planning: The How-To Handbook_. T.F. Wallace & Company.
- Tuomikangas, N.; Kaipia, R. “A coordination framework for sales and operations planning (S&OP).” _International Journal of Production Economics_.
- Chopra, Sunil; Meindl, Peter. _Supply Chain Management_. Pearson.
