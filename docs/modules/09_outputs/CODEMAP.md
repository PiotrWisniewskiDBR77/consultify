---
module_id: MODULE_OUTPUTS
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Outputy (Outputs Library)

## Route / AppView / Entry component

Źródło routingowe: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`.

- **Canonical route**: `/presentations`
- **Redirects**: `/reports` i `/reports/management` → `/presentations`
- **AppView**: `AppView.FULL_STEP6_REPORTS`
- **Entry component**: `ReportsAndPresentationsHub` (`src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`)
- **Tab query**: `outputsLibraryTabQuery.ts`

## Implementation notes

W tej fali: traktujemy moduł jako “Outputs Library” – stabilny registry artefaktów (doc/slides/sheet) z format-specific runtimes pod spodem.

