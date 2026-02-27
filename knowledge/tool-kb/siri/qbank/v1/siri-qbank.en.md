# SIRI — QBank Pack (v1, EN)

## Pack meta

- **tool_slug**: `siri`
- **pack_type**: `qbank`
- **pack_version**: `1.0.0`
- **language**: `en`
- **source_kind**: `tool_pack`

## Provenance (sources)

- `knowledge/SIRI/[SIRI Assessor Training] Module 2.pdf` (framework, assessment matrix principles)
- `knowledge/SIRI/SIRI-PM Whitepaper.pdf` (prioritisation matrix inputs + TIER mechanics)
- `src/services/siriStructure.ts` (current app structure: 3 blocks → 8 dims → 16 prioritisation areas)
- `src/services/assessmentKnowledge/siriKnowledge.ts` (MVP questions/examples/tech/evidence guidance)

## Audience + use

- **Used by**: UI + AI (tool-scoped retrieval)
- **Do not use for**: final scoring decisions without evidence; treat as “guided checklist”

---

## Sections (chunk-friendly)

### [section_id:overview] Overview

- **Purpose**: provide consistent, evidence-first prompts for scoring SIRI dimensions and capturing rationale.
- **Canon reminder**: methodology is licensed; this pack is a compact operationalization and must not override official rules.

### [section_id:scoring] Scoring and evidence (global)

- **Scale**: 0–5.
- **Rule**: every score should have (a) rationale, (b) evidence references (links/attachments), or be marked as “unknown”.

### [section_id:qbank] Question bank (dimension-level)

> Bridge pack: minimal global prompts + references to existing in-app dimension-level content.

#### [dimension_id:all] All SIRI dimensions — global prompts

##### [level:0] Level 0 — Not Started

- **3 questions (yes/no)**:
  - Is there an absence of formal process/system support in this dimension?
  - Are activities mostly manual/ad-hoc with no consistent documentation?
  - Are there no measurable KPIs or monitoring practices for this dimension?
- **Evidence guidance**: lack of SOPs, lack of system logs, interviews corroborated by missing artifacts.
- **Common mistakes**:
  - Using “we have Excel” as proof of digitization without operational usage evidence.

##### [level:2] Level 2 — Digital

- **3 questions (yes/no)**:
  - Are core activities digitized in daily operations (system used by the team, not just purchased)?
  - Can we demonstrate basic monitoring/measurement (dashboards, reports, recurring reviews)?
  - Is data collected consistently, even if analysis is mainly descriptive?
- **Evidence guidance**: system screenshots, user logs, KPI exports, recurring review notes.

##### [level:3] Level 3 — Integrated

- **3 questions (yes/no)**:
  - Are systems/processes integrated across functions (data flows are defined and used)?
  - Is information available near real-time for decision-making in this dimension?
  - Can we show examples of cross-functional workflows enabled by integration?
- **Evidence guidance**: integration diagrams, API/event logs, cross-team workflow records.

##### [level:4] Level 4 — Automated

- **3 questions (yes/no)**:
  - Is automation proactive (predictive/prescriptive analytics) rather than just reactive reporting?
  - Are AI/analytics used to support decisions in this dimension with measurable outcomes?
  - Are exceptions handled with automated rules/alerts?
- **Evidence guidance**: model outputs, alerting rules, before/after KPI impact, ROI tracking.

##### [level:5] Level 5 — Intelligent

- **3 questions (yes/no)**:
  - Are there self-optimizing/autonomous capabilities (closed-loop control) in this dimension?
  - Is continuous improvement embedded with measurable learning cycles?
  - Does the organization outperform relevant benchmarks in this dimension?
- **Evidence guidance**: autonomous control evidence, continuous improvement logs, benchmark comparisons.

