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

- [ ] Boundaries defined (product/customer/geo/time)\n- [ ] At least 2 sizing methods used\n- [ ] TAM/SAM/SOM produced as ranges\n- [ ] Top assumptions listed with evidence\n- [ ] Sensitivity analysis completed\n- [ ] At least 3 initiatives derived

---

## 6. UI / Graphic specification

- **TAM/SAM/SOM funnel view** with editable assumptions
- **Assumptions register** (table: assumption, value, source, confidence)
- **Sensitivity tornado chart** (optional) and scenario toggles
- **Export**: PDF and CSV of assumptions + outputs

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

1. Build channel partnerships in DACH/PL\n2. Product packaging for 50–200 employee segment\n3. Proof-of-value program to reduce sales cycle

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
    { "key": "totalAccounts", "value": 40000, "source": "TBD", "confidence": "medium" },
    { "key": "serviceableGeoShare", "value": 0.6, "source": "TBD", "confidence": "medium" },
    { "key": "somShareYear5", "value": 0.06, "source": "TBD", "confidence": "low" }
  ],
  "results": { "tam": 480000000, "sam": 288000000, "somYear5": 17280000 }
}
```

---

## 9. AI spec

- Ask for missing boundaries (product/customer/geo/time).\n- Propose 2–3 sizing methods and flag where evidence is required.\n- Always output ranges and identify top sensitivities.\n

---

## 10. Video storyboard

1. Define boundaries\n2) Build TAM\n3) Apply constraints → SAM\n4) Realistic capture → SOM\n5) Sensitivity\n6) Initiatives

---

## 11. References (sources)

- [Corporate Finance Institute: Total Addressable Market (TAM) + methods + TAM/SAM/SOM](https://corporatefinanceinstitute.com/resources/management/total-addressable-market-tam/)\n- [Umbrex: Market Sizing Playbook (methods and QA/triangulation)](https://umbrex.com/resources/market-sizing-playbook/)\n- [Investopedia: Market share (related concept)](https://www.investopedia.com/terms/m/marketshare.asp)\n+
