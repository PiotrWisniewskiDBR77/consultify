---
module_id: MODULE_PRESENTATIONS
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Prezentacje (Presentation Studio)

## Route / AppView / Entry component

Presentation Studio działa dziś w dwóch powiązanych powierzchniach:

- **Outputs Library**: `/presentations` → tab `Presentations` (`ReportsAndPresentationsHub`)
- **Generator flow (as-is)**: `/prezentacje` (KIMI pipeline; sprint plan WP-01)
- **Builder route (as-is)**: `/presentations/builder/:deckId` (manual retest evidence)

## Implementation notes

Ten moduł jest format runtime nad v8.1 substrate: decks to artefakty z trwałą tożsamością, lineage i governance.

