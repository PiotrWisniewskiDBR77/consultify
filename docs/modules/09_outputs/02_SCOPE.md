---
module_id: MODULE_OUTPUTS
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Outputy (Outputs Library)

## Purpose

Ustalić granice odpowiedzialności Outputs Library względem: Chat (creation), My Work (personal filter), moduły domenowe (context), format runtimes (doc/slides/sheet).

## In scope (Must)

- MUST: stabilna biblioteka (registry) dla artefaktów: listowanie, filtrowanie, statusy, metadata, owner.
- MUST: spójne entry-points do format-specific builderów (doc/slides/sheet).
- MUST: “Needs review / Mine / All / Templates” jako główne tryby pracy (tabs).
- MUST: obsługa redirectów routingowych `/reports*` → `/presentations`.

## Out of scope (Must Not)

- MUST NOT: generować artefaktów “w próżni” (generation odbywa się przez Chat / flows), poza przypadkami template authoring.
- MUST NOT: łamać tenant/ACL boundaries przy “global discoverability”.

## Should

- SHOULD: integrować się z `My Work` jako “operacyjny filtr” nad tym samym registry.

## Acceptance Criteria

- [ ] Zakres nie tworzy drugiej biblioteki artefaktów poza Outputs.
- [ ] Jest spójność z `MODULE_ROUTING_ARCHITECTURE.md` (route `/presentations`).

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`

