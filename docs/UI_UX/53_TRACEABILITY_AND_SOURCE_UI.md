---
uiux_doc_id: UIUX_TRACEABILITY_SOURCE_UI
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Traceability & source UI

## Purpose

Zamknąć zasady “traceability”: jak UI pokazuje źródła, lineage i ślad wykonania, oraz kiedy to jest obowiązkowe.

## Applies To

AI outputs, KPI/ROI/finance, governance actions, integracje/sync, generowane artefakty.

## Must

- **MUST**: Dla decyzji biznesowych i outputów AI UI pokazuje źródła albo jawnie wskazuje brak danych.
- **MUST**: Dla istotnych mutacji UI zapewnia audit trace (kto/co/kiedy/dlaczego; before/after summary gdzie sensowne).
- **MUST**: UI nigdy nie pokazuje raw internals jako komunikatu biznesowego.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Traceability, No Raw Internals)
- `DRD/consultify/docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`

