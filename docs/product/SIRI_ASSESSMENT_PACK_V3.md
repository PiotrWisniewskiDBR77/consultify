# SIRI Assessment Pack v3 — workbench + maps + report/deck + initiatives (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** opisać kanonicznie SIRI w Consultify w tym samym formacie pracy co DRD/ADMA.

## 0) Źródła kanoniczne (MUST)

- Methodology pack (kanon): `knowledge/SIRI/[SIRI Assessor Training] Module 2.pdf`
- Prioritisation Matrix (kanon): `knowledge/SIRI/SIRI-PM Whitepaper.pdf`
- Facilitation (kanon operacyjny): `knowledge/SIRI/[SIRI Assessor Training] Module 5.pdf`
- Benchmarking context: `knowledge/SIRI/wef_the_global_smart_industry_readiness_index_initiative_2022.pdf`

Product SSOT:

- Standard pracy: `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- Tools flow: `docs/product/CONSULTING_TOOLS_V3.md`
- Evidence discipline: `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`

As-is anchors:

- UI editor: `src/components/assessment/siri/SIRIAssessmentEditor.tsx`
- Map: `src/components/assessment/maps/SIRIAssessmentMap.tsx`
- Report template: `src/components/assessment/reports/templates/SIRIReportTemplate.tsx`
- Runtime structure: `src/services/siriStructure.ts` (8 dims + 16 prioritisation areas)
- Tool KB packs: `knowledge/tool-kb/siri/**`

Wymagane packi (v3 DoD):

- `knowledge/tool-kb/siri/qbank/v1/*.md`
- `knowledge/tool-kb/siri/help/v1/*.md`

---

## 1) Canon vs runtime

**Canon:** 16 dimensions (Assessment Matrix) + PM (Prioritisation Matrix).  
**Runtime UX:** 8 dimensions + 16 prioritisation areas (helper view).

**SSOT decision (v3):**

- Workbench UX trzyma 8 dims + PM input, ale raport/deck musi umieć pokazać 16D view jako “kanoniczny” (agregacja 16→8 jawna i wersjonowana).

---

## 2) Assessment (workbench)

- Current/Target per dimension (0–5)
- Evidence per dimension
- PM inputs: cost/KPI/horizon/bench (wg whitepaper)

---

## 3) Maps

- building blocks overview
- dimension gaps
- prioritisation heatmap (16 areas)
- legal notice (EDB)

---

## 4) Outputy

- report: executive summary + 8D + PM + priorities + initiatives
- deck: skrót + roadmap waves

---

## 5) Chat coach + video scripts (binding)

Źródło dla RAG i instruktażu:

- `knowledge/tool-kb/siri/help/v1/siri-help-chat-and-video.pl.md`

