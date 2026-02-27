# DRD Assessment Pack v3 — workbench + maps + report/deck + initiatives (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** opisać DRD w standardzie Workbench (tak jak SIRI i ADMA).

## 0) Źródła kanoniczne (MUST)

Product SSOT:

- Standard pracy: `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- Tools flow: `docs/product/CONSULTING_TOOLS_V3.md`
- Evidence discipline: `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`

As-is anchors:

- UI editor: `src/components/assessment/drd/DRDAssessmentEditor.tsx`
- Structure: `src/services/drdStructure.ts`
- Knowledge (runtime): `src/services/assessmentKnowledge/drdKnowledge.ts`
- (legacy) simple form: `src/components/assessment/tools/DRDForm.tsx`

Tool KB packs:

- `knowledge/tool-kb/drd/**`

Wymagane packi (v3 DoD):

- `knowledge/tool-kb/drd/qbank/v1/*.md`
- `knowledge/tool-kb/drd/help/v1/*.md`

---

## 1) Assessment (workbench)

- oś → area → level (matrix)
- current (achieved level) + target
- evidence per level (links/attachments/notes)

---

## 2) Maps

- matrix view (primary)
- gap summary per axis
- progress/completion

---

## 3) Outputy

- report: podsumowanie + top gaps + inicjatywy
- deck: skrót + roadmap waves

---

## 4) Chat coach + video scripts (binding)

Źródło dla RAG i instruktażu:

- `knowledge/tool-kb/drd/help/v1/drd-help-chat-and-video.pl.md`

