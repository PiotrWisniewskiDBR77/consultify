---
module_id: MODULE_OUTPUTS
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Outputy (Outputs Library)

## Purpose

Zdefiniować po co istnieje moduł `Outputy`: jedna biblioteka (registry) jako trwały dom dla artefaktów generowanych przez AI i człowieka, z możliwością znalezienia, review i ponownego użycia.

## Must

- MUST: każdy wygenerowany artefakt (doc/slides/sheet) ma jeden trwały dom w Outputs Library.
- MUST: Outputs Library nie jest “export-only” – to first-class registry artefaktów.
- MUST: `My Work` pokazuje operacyjny widok na te same artefakty, ale nie przejmuje roli registry.

## Must Not

- MUST NOT: tworzyć drugiej równoległej prawdy obok Reports/Presentations runtime’ów.

## Should

- SHOULD: umożliwiać szybkie przejście: “create in chat” → “artifact appears in library” → “open in builder” → “submit for review”.

## Acceptance Criteria

- [ ] Purpose jest spójny z `V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`

