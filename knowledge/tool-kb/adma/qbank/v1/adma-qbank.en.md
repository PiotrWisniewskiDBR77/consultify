# ADMA — QBank Pack (v1, EN)

## Pack meta

- **tool_slug**: `adma`
- **pack_type**: `qbank`
- **pack_version**: `1.0.0`
- **language**: `en`
- **source_kind**: `tool_pack`

## Provenance (sources)

- `wdrozenia/modules/assessment/13-ADMA-METHOD.md` (method description + mapping)
- `src/services/admaStructure.ts` (5 pillars, 12 dimensions, scale 1–5)
- `src/services/assessmentKnowledge/admaKnowledge.ts` (MVP questions/examples/tech/evidence guidance)

## Audience + use

- **Used by**: UI + AI (tool-scoped retrieval)
- **Do not use for**: scoring without evidence; treat as guided prompts

---

## Sections (chunk-friendly)

### [section_id:overview] Overview

- **Purpose**: enforce consistent evidence-first prompting for ADMA scoring (1–5).
- **Scale reminder**: ADMA starts at **1** (not 0). “1” can mean either “newcomer” or “unassessed default” depending on UI/data handling.

### [section_id:scoring] Scoring and evidence (global)

- **Rule**: treat “current=1” as assessed only when evidence/notes exist (avoid silent defaults).
- **Evidence**: attachments/links + short rationale explaining why this level (not higher).

### [section_id:qbank] Question bank (dimension-level)

#### [dimension_id:all] All ADMA dimensions — global prompts

##### [level:1] Level 1 — Newcomer

- **3 questions (yes/no)**:
  - Are activities primarily manual/traditional with minimal digital tool usage?
  - Is there no defined digital roadmap or governance for this dimension?
  - Are there no relevant KPIs or measurement routines for this dimension?
- **Evidence guidance**: absence of systems/artifacts, interviews corroborated by missing documentation.

##### [level:3] Level 3 — Intermediate

- **3 questions (yes/no)**:
  - Are digital tools integrated into core activities for this dimension (daily usage)?
  - Do we have dashboards/reports and recurring reviews that drive decisions?
  - Are cross-functional workflows established (not isolated pilots)?
- **Evidence guidance**: usage screenshots/logs, KPI dashboards, process/workflow records.

##### [level:5] Level 5 — Expert

- **3 questions (yes/no)**:
  - Are capabilities advanced and scalable (platformized), not just single projects?
  - Is there measurable value creation with governance and continuous optimization?
  - Can we demonstrate benchmark-leading practices or differentiated digital advantage?
- **Evidence guidance**: portfolio evidence, ROI tracking, benchmark comparisons, governance artifacts.

