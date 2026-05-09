---
module_id: MODULE_OUTPUTS
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Outputy (Outputs Library)

## Purpose

Kontrakt zachowania biblioteki artefaktów: jak artefakty powstają, jak trafiają do registry, jak działa open/reopen/builder handoff, review i traceability.

## Must

- MUST: każdy artefakt utworzony przez AI/człowieka jest rejestrowany w jednym registry i widoczny w Outputs Library (w granicach visibility scope).
- MUST: artefakty nie są “tymczasowe exporty”; mają trwałą tożsamość i metadane.
- MUST: gdy generation pipeline pada, UI musi pokazać błąd (toast + detale), bez infinite spinner.
- MUST: reopen/open-in-builder używa poprawnych, kanonicznych endpointów (np. origin path dla presentations).

## Must Not

- MUST NOT: ukrywać failure w pipeline przez ciche `catch {}`.
- MUST NOT: łamać visibility scopes (private/project/org/review_shared/demo).

## Should

- SHOULD: wspierać review workflow (needs review) jako first-class, a nie “folder w nazwie”.

## Acceptance Criteria

- [ ] Artefakt po generacji zawsze ląduje w Outputs Library, a nie znika po eksporcie.
- [ ] UI nie wchodzi w “Postęp zadania 0/8” bez sygnału błędu.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/testy_antygravity/ANYGRAVITY_PRESENTATIONS_FIX_RETEST_2026-05-08_PROMPT.md` (evidence: honest errors)

