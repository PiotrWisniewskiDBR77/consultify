---
module_id: MODULE_ORGANIZATION
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Organizacja (Organization Context)

## Route / AppView / Entry component

Źródło routingowe: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`.

- **Route**: TBD (brak jawnego modułu w routing SSOT na dziś)
- **AppView**: TBD
- **Entry component**: TBD

## Implementation notes

Organization Context Engine występuje dziś jako **cross-cutting subsystem**: ingestion + processing + retrieval + lineage, używany przez Chat/Interview/Outputs. UI entrypointy mogą żyć w “Settings/Admin operations” zamiast w sidebarze.

