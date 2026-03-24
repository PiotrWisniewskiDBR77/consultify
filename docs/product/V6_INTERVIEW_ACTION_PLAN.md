# V6 Interview Action Plan — Change Register -> Program wdrożenia

> **Status:** Draft  
> **Owner:** Piotr + team  
> **Last updated:** 2026-03-08  
>
> **Cel:** zamienić kierunek V6 dla `Interview` na jeden kompletny rejestr zmian: co trzeba dowieźć, dlaczego i do jakich tasków to mapujemy.

## 0) Źródła wejściowe (KANON)

- `docs/product/INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md`
- `docs/product/INTERVIEW_TEMPLATES_LIBRARY_V6.md`
- `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `docs/INTERVIEW_MODULE.md`
- `docs/INTERVIEW_TEMPLATES_AND_AI_ASSIST.md`
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
- `docs/ui-standards/README.md`

---

## 1) Jak czytać ten dokument

### 1.1 Coverage statuses

- **COVERED** — zmiana ma pełne mapowanie do tasków V6 i nie ma braków produktowych.
- **PARTIAL** — taski istnieją, ale zakres lub acceptance są jeszcze niepełne.
- **MISSING** — brak taska, brak decyzji lub brak wdrożenia.

### 1.2 Definition of done for a change

Zmiana jest domknięta dopiero, gdy:

- istnieje mapowanie do tasków w `docs/product/V6_INTERVIEW_IMPLEMENTATION_PROGRAM.md`,
- respektuje `docs/ui-standards/**`,
- ma jawny kontrakt danych i traceability,
- ma smoke scenariusz i acceptance.

---

## 2) Master Change Register

> Format: **CR-ID -> Change -> SSOT refs -> V6 task mapping -> Coverage**

### 2.1 Foundations / architecture

- **CR-V6-001 — Rozdzielenie Interview na 3 surfaces**
  - **Change:** Templates Studio / Interview Runtime / Insight Report jako osobne doświadczenia
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` sekcje 1, 4, 5, 6
  - **V6 task mapping:** `V6-A01`, `V6-A02`, `V6-E01`
  - **Coverage:** MISSING

- **CR-V6-002 — V6 data model for templates, answers, evidence, insights**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` sekcja 8
  - **V6 task mapping:** `V6-A01`, `V6-D01`, `V6-D03`
  - **Coverage:** MISSING

- **CR-V6-003 — Scope model: System / Organization / Private**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 2.5, 8.1
  - **V6 task mapping:** `V6-A03`, `V6-B01`, `V6-B05`
  - **Coverage:** MISSING

### 2.2 Templates Studio

- **CR-V6-010 — Templates Hub as a premium library**
  - **Change:** cards default, table optional, filters/scopes/actions
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.2
  - **V6 task mapping:** `V6-B01`
  - **Coverage:** MISSING

- **CR-V6-011 — Full builder workspace instead of chaotic modal**
  - **Change:** left rail + center question list + right properties panel
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.3
  - **V6 task mapping:** `V6-B03`
  - **Coverage:** MISSING

- **CR-V6-012 — AI-first brief -> draft -> refine flow**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.4
  - **V6 task mapping:** `V6-B02`
  - **Coverage:** MISSING

- **CR-V6-013 — Question quality evaluator**
  - **Change:** leading/double-barreled/too-long/unclear/evidence-light warnings
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.5
  - **V6 task mapping:** `V6-B04`
  - **Coverage:** MISSING

- **CR-V6-014 — Sections as primary UX structure**
  - **Change:** categories become metadata, sections drive flow
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4, 8.1
  - **V6 task mapping:** `V6-B03`, `V6-F02`
  - **Coverage:** MISSING

### 2.3 Runtime / respondent experience

- **CR-V6-020 — one question per screen as default runtime**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 2.2, 5.2
  - **V6 task mapping:** `V6-C01`
  - **Coverage:** MISSING

- **CR-V6-021 — Quiet left mini rail + lightweight progress**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 5.2
  - **V6 task mapping:** `V6-C01`
  - **Coverage:** MISSING

- **CR-V6-022 — Voice answer with transcript approval**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 2.3, 5.6
  - **V6 task mapping:** `V6-C02`
  - **Coverage:** MISSING

- **CR-V6-023 — Supporting evidence composer**
  - **Change:** file/link/context note under answer surface
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 5.3, 7.2
  - **V6 task mapping:** `V6-C03`, `V6-D01`
  - **Coverage:** MISSING

- **CR-V6-024 — Reviewer mode separated from respondent mode**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 5.7
  - **V6 task mapping:** `V6-C04`
  - **Coverage:** MISSING

### 2.4 Knowledge collection / evidence

- **CR-V6-030 — Canonical evidence pipeline**
  - **Change:** answer -> normalize -> ledger -> knowledge context -> insights
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7.3
  - **V6 task mapping:** `V6-D01`, `V6-D02`, `V6-D03`
  - **Coverage:** MISSING

- **CR-V6-031 — Attachments and links become linked evidence**
  - **Change:** zapis do odpowiedzi i równoległy ingest do contextual knowledge base
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7.3, 7.4
  - **V6 task mapping:** `V6-D01`, `V6-D02`
  - **Coverage:** MISSING

- **CR-V6-032 — Traceability from insight back to answer/evidence**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 6.4, 7.4
  - **V6 task mapping:** `V6-D03`, `V6-E03`
  - **Coverage:** MISSING

- **CR-V6-033 — Knowledge search / retrieval over interview evidence**
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7, `TOOLS_KNOWLEDGE_BANK_V3.md`
  - **V6 task mapping:** `V6-D04`
  - **Coverage:** MISSING

### 2.5 Insights

- **CR-V6-040 — Three-layer truth model**
  - **Change:** Source answers / AI synthesis / Consulting interpretation
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 6.2
  - **V6 task mapping:** `V6-E01`, `V6-E02`
  - **Coverage:** MISSING

- **CR-V6-041 — Structured insight report**
  - **Change:** Executive summary / Themes / Issues / Opportunities / Evidence map
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 6.3
  - **V6 task mapping:** `V6-E01`, `V6-E03`
  - **Coverage:** MISSING

- **CR-V6-042 — No automatic recommended actions**
  - **Change:** stop at issues/opportunities/follow-up areas
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 2.4, 6.5
  - **V6 task mapping:** `V6-E02`, `V6-E03`
  - **Coverage:** MISSING

- **CR-V6-043 — Multi-session consulting picture**
  - **Change:** aggregate several interviews/insights into a broader view
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 9.5
  - **V6 task mapping:** `V6-E04`
  - **Coverage:** MISSING

### 2.6 Library & content system

- **CR-V6-050 — System library of shipping templates**
  - **Change:** starter set of 18 templates for sending/interview use cases
  - **SSOT refs:** `INTERVIEW_TEMPLATES_LIBRARY_V6.md` 5
  - **V6 task mapping:** `V6-F01`
  - **Coverage:** MISSING

- **CR-V6-051 — Canonical answer modality guides**
  - **Change:** expected answer shapes, voice/file/link/context policy per question family
  - **SSOT refs:** `INTERVIEW_TEMPLATES_LIBRARY_V6.md` 4, 7
  - **V6 task mapping:** `V6-F02`
  - **Coverage:** MISSING

- **CR-V6-052 — AI generation tuned to survey quality**
  - **Change:** generate questions that are short, neutral, answerable, evidence-aware
  - **SSOT refs:** `INTERVIEW_TEMPLATES_LIBRARY_V6.md` 6, 7
  - **V6 task mapping:** `V6-B02`, `V6-B04`, `V6-F02`
  - **Coverage:** MISSING

### 2.7 Delivery / QA

- **CR-V6-060 — End-to-end smoke scripts for V6**
  - **Change:** build -> send -> answer -> review -> ingest -> insight
  - **SSOT refs:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 11
  - **V6 task mapping:** `V6-F03`
  - **Coverage:** MISSING

- **CR-V6-061 — Demo-ready story and acceptance gate**
  - **Change:** one canonical V6 demo script and release gate
  - **SSOT refs:** `V6_INTERVIEW_IMPLEMENTATION_PROGRAM.md`
  - **V6 task mapping:** `V6-F03`
  - **Coverage:** MISSING

---

## 3) Najważniejsze luki do zamknięcia

### 3.1 Product gaps

- obecny builder nie jest AI-first
- template'y nie mają dobrego modelu sections + answer modalities
- runtime respondenta jest przeładowany i zbyt operacyjny
- voice answer nie jest first-class
- attachments/links nie są pełnoprawnym knowledge ingestion pipeline
- insights nie mają jeszcze docelowej warstwy consulting interpretation

### 3.2 Architecture gaps

- brak V6 data contract dla transcript + linked evidence
- brak jawnego rozdziału respondent/reviewer
- brak retrieval layer dla knowledge context pochodzącego z interview

---

## 4) Priorytety zmian

### R0 — MUST

- foundations i scope model
- Templates Hub + Builder
- default one-question runtime
- voice + transcript approval
- supporting evidence pipeline
- basic insight report
- system library seed

### R1 — SHOULD

- reviewer mode hardening
- template quality evaluator
- knowledge search over interview context
- multi-session aggregation

### R2 — POLISH

- analytics of template quality and completion
- advanced branching
- diagnostics packs and benchmarking

---

## 5) Następny dokument operacyjny

Ten change register mapuje się 1:1 do:

- `docs/product/V6_INTERVIEW_IMPLEMENTATION_PROGRAM.md`
