---
module_id: MODULE_DOCUMENTS
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Dokumenty (Document Studio)

## Purpose

Obiekty danych i integracje Document Studio: DocumentSchema, Template Registry, QA results oraz zapis przez v8.1 artifact substrate.

## Must

- MUST: trwały stan przechodzi przez v8.1 substrate: `Artifact`, `ArtifactRun`, `ArtifactVersion`, `ArtifactSourceRef`.
- MUST: Document Studio nie tworzy równoległych tabel registry/run/version/source-ref.
- MUST: endpointy i serwisy w planie są spójne z “untouched files” listą.

## Must Not

- MUST NOT: logować raw payloadów dokumentu / wrażliwych danych źródłowych w sposób umożliwiający wyciek.

## Should

- SHOULD: reuse report-builder export pipeline (DOCX/PDF) w MVP-1.

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`
- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`

