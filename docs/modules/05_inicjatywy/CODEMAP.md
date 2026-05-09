---
module_id: MODULE_INITIATIVES
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Inicjatywy

## Route / AppView / Entry component

Źródło routingowe: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`.

- **Route**: `/initiatives`
- **AppView**: `AppView.FULL_STEP2_INITIATIVES`
- **Entry component**: `InitiativesHub` (`src/components/Initiatives/InitiativesHub.tsx`)

## Implementation notes

W Inicjatywach FE nie może zgadywać uprawnień z lokalnych macierzy: CTA/editability są sterowane backendem przez `GET /api/initiatives/:id/gate-readiness-check` (`INITIATIVE_CAPABILITIES_SYSTEM.md`).

