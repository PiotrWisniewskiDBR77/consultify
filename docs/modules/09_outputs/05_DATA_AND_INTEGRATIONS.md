---
module_id: MODULE_OUTPUTS
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Outputy (Outputs Library)

## Purpose

Opisać obiekty danych i integracje: artifact registry, format runtimes (doc/slides/sheet), integracje z Chat (creation) i My Work (personal filter).

## Must

- MUST: istnieje jeden “artifact identity” w registry, a format runtime’y są pod spodem.
- MUST: artefakty mają: typ (doc/slides/sheet), status (draft/review/approved), owner, visibility scope i linki do kontekstu (initiative / workspace).

## Must Not

- MUST NOT: rozproszyć artefaktów w modułach bez wpisu do registry.

## Should

- SHOULD: zachować traceability: co wygenerowało artefakt (runId / prompt context / approvals) bez ekspozycji raw internals.

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`

