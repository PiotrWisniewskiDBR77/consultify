---
module_id: MODULE_PRESENTATIONS
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Prezentacje (Presentation Studio)

## Purpose

Ustalić granice odpowiedzialności Presentation Studio względem Outputs (registry), Chat (creation), Document Studio (doc runtime) i v8.1 substrate.

## In scope (Must)

- MUST: generator flow (as-is `/prezentacje`) jest uczciwy i restartowalny (bez infinite spinner).
- MUST: Outputs `/presentations` jest kanonicznym domem decków jako artefaktów.
- MUST: builder jest dostępny (open in builder) i działa deterministycznie dla fresh i reopen decków.
- MUST: source pack + narrative planning + template architect + QA engine (wg sprint plan i 100% contract; etapami).

## Out of scope (Must Not)

- MUST NOT: tworzyć równoległego artifact registry / run history / visibility scopes.
- MUST NOT: wprowadzać Gamma jako runtime dependency.

## Should

- SHOULD: integracje cross-module (Interview/Research/Initiatives/Finance) jako źródła do decków, ale zawsze z traceability.

## Acceptance Criteria

- [ ] Zakres jest spójny z sprint planem i 100% contract (bez “scope creep” poza kontrakt).

## Related Sources

- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_SPRINT_PLAN_2026-05-08.md`
- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md`

