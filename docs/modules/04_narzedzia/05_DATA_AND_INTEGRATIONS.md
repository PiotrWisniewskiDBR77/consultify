---
module_id: MODULE_TOOLS
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Narzędzia

## Purpose

Opisać: obiekty danych narzędzi (ToolSession, step defs), wizualizacje oraz handoff do inicjatyw i assessmentów.

## Must

- MUST: sesje narzędziowe są trwałe (ToolSession) i mają read-back po zapisie.
- MUST: dane wejściowe narzędzia i wyniki (np. macierze, radary) mają jednoznaczne źródła i mogą zostać użyte do inicjatyw.

## Must Not

- MUST NOT: tracić wyników po refreshu (jeśli UI pokazało sukces zapisu).

## Should

- SHOULD: inicjatywy mają powiązanie `derived_from` do narzędzia/sesji (traceability).

## Acceptance Criteria

- [ ] Handoff do Initiatives zachowuje źródła i rationale.

## Related Sources

- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md` (useToolStore, ToolWorkspace)
- `DRD/consultify/docs/product/SOURCE_TRACEABILITY_SPEC.md`

