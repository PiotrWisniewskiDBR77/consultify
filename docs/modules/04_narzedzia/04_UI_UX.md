---
module_id: MODULE_TOOLS
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Narzędzia

## Purpose

Zdefiniować UX obszaru Tools: biblioteka/kategorie, widok narzędzia, sesja narzędziowa (workspace), oraz spójność z globalnymi standardami.

## Must

- MUST: biblioteka narzędzi jest “hubem modułowym” zgodnym z `module-hub-standard.md`.
- MUST: narzędzia deklarują “surface type” (Hub / Artifact detail / Workspace / Wizard) zgodnie z `TOOLS_CATALOG_V3.md`.
- MUST: sesja narzędziowa ma czytelny układ (np. chat panel + wizualizacja + akcje tworzenia inicjatyw).

## Must Not

- MUST NOT: tworzyć lokalnych, niekanonicznych toolbarów dla AI poza przewidzianymi slotami (Menu 3 / command row / prawy slot).

## Should

- SHOULD: utrzymywać spójne CTA i etykiety akcji między narzędziami (Run, Generate Initiative, Export).

## Acceptance Criteria

- [ ] Library ma czytelne kategorie, a wejścia do narzędzi nie zaskakują routingiem.
- [ ] W sesji narzędzia user zawsze widzi gdzie jest wynik i jak z niego powstaje inicjatywa.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/product/TOOLS_CATALOG_V3.md`

