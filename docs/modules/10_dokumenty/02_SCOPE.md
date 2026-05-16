---
module_id: MODULE_DOCUMENTS
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Dokumenty (Document Studio)

## Purpose

Ustalić granice odpowiedzialności Document Studio względem Outputs (registry), Chat (creation surface), Results/Finance (źródła), oraz export/runtime.

## In scope (Must)

- MUST: intake → outline plan → generate → preview → export DOCX/PDF (Mode 1; MVP-1).
- MUST: Document Schema jako wewnętrzna reprezentacja treści + renderer do preview/export.
- MUST: template registry + template planning/approval (Mode 2/3; późniejsze MVP).
- MUST: QA engine (co najmniej structural + source) i jawne oznaczanie `is_assumption` gdy brakuje źródeł.

## Out of scope (Must Not)

- MUST NOT: równoległy artifact registry / run record / version table / source-ref table (stan trwały idzie przez v8.1).
- MUST NOT: nowy auth surface ani nowy model-routing surface.
- MUST NOT: osobny moduł “storage” konkurujący z Outputs Library jako kanonicznym domem.

## Should

- SHOULD: reuse existing report-builder export helpers (DOCX/PDF) zamiast pisać nowe eksporty od zera (MVP-1).

## Acceptance Criteria

- [ ] Zakres jest spójny z `CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md` (boundaries, untouched files).
- [ ] Nie powstaje “druga biblioteka” dokumentów poza Outputs.

## Related Sources

- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`
- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`
- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`

