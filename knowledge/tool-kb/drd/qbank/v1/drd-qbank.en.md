# DRD — QBank Pack (v1, EN)

## Pack meta

- **tool_slug**: `drd`
- **pack_type**: `qbank`
- **pack_version**: `1.0.0`
- **language**: `en`
- **source_kind**: `tool_pack`

## Provenance (sources)

- `src/services/drdStructure.ts` (area+level descriptions)
- `src/services/assessmentKnowledge/drdKnowledge.ts` (generated MVP questions/examples/tech rules)
- Product UX anchor: `src/components/assessment/drd/DRDAssessmentEditor.tsx`

## Audience + use

- **Used by**: UI + AI (tool-scoped retrieval)
- **Do not use for**: client-specific notes or scoring decisions without evidence

---

## Sections (chunk-friendly)

### [section_id:overview] Overview

- **Purpose**: provide a minimal, consistent set of questions per DRD area×level to guide evidence-based assessment.
- **Evidence discipline**: if a question cannot be answered with evidence, mark it as unknown and request evidence.

### [section_id:qbank] Question bank

> This pack is a **bridge**: it points to the canonical structure in code and can be expanded into fully curated content over time.

#### [area_id:DRD] DRD global (all areas)

##### [level:1] Level 1 — evidence checklist (generic)

- **3 questions (yes/no)**:
  - Do we have any written description of how this area is performed today (SOP, checklist, process map)?
  - Do we record basic operational data for this area (even if manually)?
  - Can a person outside the team understand the process from existing materials?
- **Evidence guidance**: SOPs, forms, screenshots, logs, KPI exports, training materials.
- **Common mistakes**:
  - Scoring based on opinions (“we’re quite advanced”) without artifacts.
  - Treating “we bought a tool” as “we use it”.

##### [level:3] Level 3 — evidence checklist (generic)

- **3 questions (yes/no)**:
  - Do we monitor this area with defined KPIs and regular reviews?
  - Are approvals/handovers tracked (workflow) rather than done ad-hoc?
  - Can we show reports proving the process is controlled end-to-end?
- **Evidence guidance**: KPI dashboards, workflow definitions, audit logs, recurring review notes.

##### [level:5] Level 5 — evidence checklist (generic)

- **3 questions (yes/no)**:
  - Is this area integrated with adjacent systems/processes (data flows, shared master data)?
  - Can we show automated alerts or exception handling based on data?
  - Do outcomes measurably improve due to digital controls (lead time, quality, cost)?
- **Evidence guidance**: integration diagrams, API/event logs, exception tickets, before/after metrics.

