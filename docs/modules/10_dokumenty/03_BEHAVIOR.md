---
module_id: MODULE_DOCUMENTS
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Dokumenty (Document Studio)

## Purpose

Opisać kontrakt zachowania Document Studio: tryby tworzenia, lifecycle artefaktu, planowanie narracji, generacja treści, edycja i QA, zawsze na v8.1 substrate.

## Must

- MUST: wspierać 3 mode’y tworzenia (Mode 1/2/3) z jednym lifecycle v8.1: `requested → planning → generating → validating → draft → in_review → approved → exported → archived`.
- MUST: Mode 1:
  - intake → outline proposal → accept → generate section-by-section → QA → draft artifact.
- MUST: Mode 2:
  - plan template → governance approval → template registry.
- MUST: Mode 3:
  - pick approved template → assemble source pack → generate → QA → draft/in_review.
- MUST: unsourced analytical blocks są oznaczane `is_assumption: true` i nie są “ukryte”.

## Must Not

- MUST NOT: tworzyć równoległych tabel/state poza v8.1 substrate.
- MUST NOT: “silent publish/export” bez governance, jeśli flow wymaga review.

## Should

- SHOULD: reuse report-builder export pipeline dla DOCX/PDF (MVP-1), a nie wprowadzać nowego eksportu.

## Acceptance Criteria

- [ ] Dokument ma trwałą tożsamość artefaktu v8.1 i ląduje w Outputs Library.
- [ ] Brak “fake success” i brak infinite spinner w generacji/QA/eksportach.

## Related Sources

- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`
- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`
- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`

