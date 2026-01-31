# Customer Segmentation (STP: Segmenting → Targeting → Positioning)

## Metadata

- **Tool name**: Customer Segmentation (STP)
- **Slug**: `customer-segmentation`
- **Category**: Strategy
- **Level**: Core
- **Typical duration**: 2–8 hours (single market); 1–2 weeks (with research)
- **Best for**: Focus decisions, go-to-market design, pricing strategy inputs, product prioritization
- **Not for**: Making a strategy without evidence (segmentation requires validation)
- **Primary outputs**: Segment map, segment attractiveness scoring, target selection, positioning hypotheses, initiative backlog
- **Required inputs (minimum)**:
  - Market scope (industry/geo) and customer universe definition
  - Candidate segmentation variables
- **Optional inputs**:
  - Customer interviews, CRM data, usage data, willingness-to-pay
- **Related tools (internal)**:
  - [`market-sizing-tam-sam-som.md`](./market-sizing-tam-sam-som.md)
  - [`strategic-positioning.md`](./strategic-positioning.md)
  - [`jobs-to-be-done.md`](./jobs-to-be-done.md)
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose

Customer segmentation structures a market into meaningful groups with different needs and value drivers. It enables choosing the best segments to serve (targeting) and crafting a differentiated story (positioning).

---

## 2. Concept & definitions

### 2.1 STP

- **Segmenting**: identify and profile customer groups using variables (e.g., firmographics, behaviors).
- **Targeting**: choose which segments to pursue.
- **Positioning**: define the differentiated promise for the chosen segments.

### 2.2 Quality criteria (good segments)

Measurable, accessible, sustainable/profitable, actionable.

---

## 3. Inputs

- Market scope, customer universe, and segmentation variables.
- Minimum: 2 data sources (CRM + interviews, or CRM + desk research).

---

## 4. Method (step-by-step)

1. **Define the market boundary** (what customers and use cases are included).\n2) **Choose segmentation variables** (B2B: industry, size, tech stack, process maturity; B2C: demographics, psychographics, behavior).\n3) **Generate candidate segments** (initial hypothesis-based segmentation).\n4) **Validate segments** with data/interviews (do customers within segment share needs and behaviors?).\n5) **Score segments** (attractiveness + fit): size, growth, willingness-to-pay, competitive intensity, access, strategic fit.\n6) **Select targets** (primary/secondary).\n7) **Draft positioning hypotheses** per target segment.\n8) **Translate into initiatives**: channel plan, pricing packaging, product priorities, sales enablement.

---

## 5. Outputs & DoD

### Outputs

- Segment list + profiles\n- Segment attractiveness scorecard\n- Target choice rationale\n- Positioning hypotheses\n- Go-to-market initiatives

### DoD

- [ ] ≥4 segments defined and profiled\n- [ ] Segment scoring completed (attractiveness + fit)\n- [ ] Target segments selected\n- [ ] Positioning hypotheses drafted\n- [ ] ≥3 initiatives derived

---

## 6. UI / Graphic specification

- Segment cards (name, needs, size, growth, WTP, access)\n- 2×2 matrix: attractiveness × fit\n- Target selection controls + “positioning statement” editor\n- Export: segment one-pagers PDF

---

## 7. Worked example

Industrial SaaS targeting manufacturing maintenance teams.

- Segments: (1) asset-intensive plants, (2) regulated industries, (3) SMB manufacturers, (4) enterprise multi-site.\n- Target: regulated + enterprise.\n- Positioning: “compliance-ready predictive maintenance with audit trails.”\n- Initiatives: compliance templates, enterprise integrations, partner channel.

---

## 8. Implementation spec (JSON)

```json
{
  "segments": [
    {
      "id": "s1",
      "name": "Regulated manufacturers",
      "criteria": { "industry": ["pharma", "food"], "size": "mid-enterprise" },
      "needs": ["audit trail", "downtime reduction"],
      "score": { "attractiveness": 4, "fit": 4 }
    }
  ],
  "targets": ["s1"],
  "positioning": { "s1": { "statement": "Compliance-ready predictive maintenance..." } }
}
```

---

## 9. References (sources)

- [Wikipedia: Segmenting-targeting-positioning (STP)](https://en.wikipedia.org/wiki/Segmenting-targeting-positioning)
- [Saylor Academy: Segmenting, Targeting, and Positioning (Principles of Marketing)](https://learn.saylor.org/course/view.php?id=82&section=5)
- [Pressbooks: Segmentation, Targeting, and Positioning (STP)](https://iu.pressbooks.pub/mktgwip/part/chapter-5-segmentation-targeting-and-positioning-stp/)
