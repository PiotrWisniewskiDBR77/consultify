# M13 — Inicjatywy — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | **FAZA 4 (żywa, staging)** | S1 smoke — Portfolio | — | **PASS**: `/initiatives` renderuje Portfolio z **36 realnymi inicjatywami** ze staging (ALL 36, In Review 1, zakładki Portfolio/Analiza/Active/All/ROI); `/api/initiatives` 200 z danymi; zero crashy. FE+BE+DB live. **Pending:** preview `InitiativePreviewV3`→dokument (S1 pełne), create przez `?new=1` (S2). | ZROBIONE (D smoke) |
| 2026-06-12 | **FAZA 4-deep (API)** | S1/S3/S4/S6 — API scenario verification | `c4bfe757ca` | **S1 PARTIAL**: 121 inicjatyw org-scoped, pagination `limit=5` ignorowana (cały dataset). **S3 PASS**: PATCH 200, description trwała po reload. **S4 PARTIAL**: właściwy endpoint `/api/pmo-analysis/:projectId` (nie `/api/pmo/initiatives/:id/analysis`); graf zależności pusty stub. **S6 PARTIAL**: state machine DRAFT→PENDING→CANCELLED→ARCHIVED przez PATCH 200; POST `/archive` — naprawiony 500→400-gate (`queryHelpers.dbGet→queryOne` 19 miejsc, `dbRun→queryRun`, `datetime('now')→CURRENT_TIMESTAMP` 17 miejsc, commit `c4bfe757ca`). **Bugi naprawione:** BUG-M13-1 (JSONB actionContract/sourcePack/evidenceRefs jako string→parsowane camelCase w detail endpoint), BUG-M13-3 (archive 500 crash). BUG-M13-4 (pagination) nie naprawiony (niski priorytet). | ZROBIONE (API-deep) |
