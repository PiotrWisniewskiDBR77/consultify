# Competitive Benchmarking (Competitor Profiling & Gap Analysis)

## Metadata

- **Tool name**: Competitive Benchmarking
- **Slug**: `competitive-benchmarking`
- **Category**: Strategy
- **Level**: Core
- **Typical duration**: 2–8 hours (light); 1–2 weeks (deep, with research)
- **Best for**: Differentiation, pricing and positioning inputs, feature prioritization, risk detection
- **Not for**: Purely internal optimization without competitor context
- **Primary outputs**: Competitor landscape, competitor profiles, benchmark matrix, gaps and opportunities, strategic moves, initiatives
- **Required inputs (minimum)**:
  - Competitor list (3–10) + definition of “competitor”
  - Comparison dimensions (price, features, channels, operating model)
- **Optional inputs**:
  - Public financials, customer reviews, RFP/RFQ data, win/loss notes
- **Related tools (internal)**:
  - [`market-forces` (Porter)](../../frontend/07-tool-document-view.md)
  - [`customer-segmentation.md`](./customer-segmentation.md)
  - [`strategic-positioning.md`](./strategic-positioning.md)
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose

Competitive benchmarking compares your performance and offering against competitors to identify **gaps**, **differentiators**, and **strategic opportunities**.

---

## 2. Method (step-by-step)

1. Define scope (market + segment + geography).\n2) Identify competitors (direct, indirect, substitutes).\n3) Choose benchmark dimensions and metrics.\n4) Build competitor profiles (strategy, products, pricing, channels, operations, finances).\n5) Rate competitors and yourself; apply weights.\n6) Identify gaps, opportunities, and threats.\n7) Translate into strategic moves and initiatives.\n8) Set monitoring cadence (quarterly refresh).

---

## 3. Outputs & DoD

- Benchmark matrix (weighted)\n- Competitor one-pagers\n- Gap/opportunity list\n- Initiatives with traceability (which benchmark gap)

DoD:

- [ ] ≥3 competitors profiled\n- [ ] Benchmark dimensions weighted\n- [ ] Gaps prioritized\n- [ ] ≥3 initiatives created

---

## 4. UI / Graphic specification

- Competitor table (rows=competitors, cols=dimensions)\n- Weighted score rollups\n- “Gap heatmap”\n- Competitor profile drawer (one-pager)\n- Export: PDF one-pagers + CSV matrix

---

## 5. Implementation spec (JSON)

```json
{
  "competitors": [{ "id": "c1", "name": "Competitor A", "type": "direct" }],
  "dimensions": [{ "id": "d1", "name": "Price", "weight": 0.2 }],
  "scores": [{ "competitorId": "c1", "dimensionId": "d1", "score": 4, "notes": "..." }],
  "gaps": [{ "dimensionId": "d1", "gap": -2, "implication": "Pricing repositioning" }]
}
```

---

## 6. Worked example (quick)

### Context

B2B SaaS is losing deals to two competitors; leadership suspects “features,” sales believes “pricing,” customers mention onboarding.

### Benchmark dimensions (weighted)

- Price & packaging (20%)
- Time-to-value / onboarding (20%)
- Core features (20%)
- Integrations (15%)
- Trust (security, compliance) (15%)
- Service model (10%)

### Result

Largest gap is “time-to-value” and “integration readiness,” not feature depth.

### Initiatives

1. “2-week onboarding guarantee” (process + enablement)\n2. Integration starter packs for top 5 systems\n3. Pricing simplification for mid-market tier

---

## 7. References (sources)

- [Wikipedia: Competitor analysis (competitor array and profiling)](https://en.wikipedia.org/wiki/Competitor_analysis)
- [Qualtrics: Competitive benchmarking (overview)](https://www.qualtrics.com/articles/strategy-research/competitive-benchmarking/)
- [Porter (HBR): What Is Strategy? (competition vs strategy clarity)](https://hbr.org/1996/11/what-is-strategy)
