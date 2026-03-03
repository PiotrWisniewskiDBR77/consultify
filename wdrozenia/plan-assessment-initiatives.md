# Plan wdrożenia — moduł Assessment (Licensed Tools) (V2/V3)

> **Status:** kanoniczny plan wdrożeniowy (rekonstrukcja na podstawie istniejących speców w repo).  
> **Cel:** dostarczyć brakujący artefakt wskazywany w `wdrozenia/pakiet-wdrozeniowy.md`, tak aby dokumentacja wdrożenia była kompletna i weryfikowalna.

## 1) Źródła prawdy (w repo)

- **Backend API (workflow v2)**:
  - lista endpointów: `wdrozenia/modules/assessment/backend/01-api-list.md`
  - szczegóły: `wdrozenia/modules/assessment/backend/02-api-detail.md`
  - create: `wdrozenia/modules/assessment/backend/03-api-create.md`
- **Frontend**:
  - hub: `wdrozenia/modules/assessment/frontend/02-hub-filters.md`, `05-detail-view.md`
  - new modal: `wdrozenia/modules/assessment/frontend/06-new-modal.md`
  - DRD editor: `wdrozenia/modules/assessment/frontend/07-drd-editor.md`
  - level attachments: `wdrozenia/modules/assessment/frontend/08-level-attachments.md`
- **Features**:
  - scoring: `wdrozenia/modules/assessment/features/01-scoring.md`
  - generate initiatives: `wdrozenia/modules/assessment/features/02-generate-initiative.md`
  - generation runs: `wdrozenia/modules/assessment/features/03-initiative-generation-runs.md`
  - knowledge base: `wdrozenia/modules/assessment/features/03-knowledge-base.md`
- **Testy**: `wdrozenia/modules/assessment/testing/01-unit-tests.md`
- **SSOT V3 (kryteria)**:
  - `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
  - `docs/product/TOOLS_GAP_ANALYSIS_V3.md`
  - `docs/product/DOD_INVENTORY_V2_V3.md` (V3‑E06 + outputy)

## 2) Zakres wdrożenia (co oznacza “Assessment done”)

### 2.1 Workflow (core)

- Assessment lifecycle (v2): **DRAFT → IN_REVIEW → AWAITING_APPROVAL → APPROVED**
- DoD gating:
  - `completion_percent >= 100`
  - `confidence_avg >= 3`
- Governance:
  - decyzje (request review / approve report / approve assessment)
  - audit log + notyfikacje do zespołu

### 2.2 Workbench UX (DRD/SIRI/ADMA)

- Shell workbench: nawigacja obszarów + praca w centrum + “graphic mirror”.
- Evidence-first: attachments/links albo jawny stan „needs evidence”.
- Current vs target (as‑is vs to‑be) rozdzielone.

### 2.3 Outputy

- Raport i deck generowane z **APPROVED** assessmentu, z traceability do sesji.
- Initiatives generowane dopiero po spełnieniu bramek (po APPROVED).

## 3) Minimalne kryteria akceptacji (DoD)

### 3.1 Backend (API)

- CRUD + update z autosave payloadem działają.
- Uprawnienia (RBAC/roles) egzekwowane.
- Attachments per-level działają (upload/list/download/delete).
- Report lifecycle i eksporty (PDF/PPTX) działają.

### 3.2 Frontend

- Hub działa (lista assessmentów, raporty, inicjatywy) i nie ma mocków.
- Editor działa dla DRD oraz pozostałych frameworków (SIRI/ADMA/CMMI/LEAN) w minimalnym zakresie.
- i18n: PL+EN dla copy w nowych ekranach modułu.

### 3.3 Testy

- Minimalne E2E: create → fill → review → report → approve → initiatives (zgodnie z `wdrozenia/modules/assessment/testing/01-unit-tests.md`).

## 4) Backlog (jeśli wykryto luki vs SSOT V3)

- SIRI: kanoniczny model 16D + mapowanie 16D→8D + raport/deck appendix (SSOT: `TOOLS_GAP_ANALYSIS_V3.md`).
- ADMA: agregacja T1–T7 + FoF overlay w raporcie/decku (SSOT: `TOOLS_GAP_ANALYSIS_V3.md`).

