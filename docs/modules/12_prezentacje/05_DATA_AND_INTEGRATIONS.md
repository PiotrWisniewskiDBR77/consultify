---
module_id: MODULE_PRESENTATIONS
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Prezentacje (Presentation Studio)

## Purpose

Obiekty danych i integracje: deck artifact model, outline JSON, source pack, brand kit, builder autosave, export ledger.

## Must

- MUST: decki są artefaktami z trwałą tożsamością i lineage (v8.1 substrate).
- MUST: reopen kompatybilności korzysta z kanonicznego `origin` path dla decków.
- MUST: builder autosave zapisuje stan i nie miesza go z lifecycle approval state.

## Must Not

- MUST NOT: logować wrażliwych payloadów w UI/logach (PII/tenant data).

## Should

- SHOULD: source pack metadata jest zapisane i widoczne (coverage, missing inputs, policy blocks).

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_SPRINT_PLAN_2026-05-08.md`

