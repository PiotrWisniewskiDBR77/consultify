---
module_id: MODULE_TOOLS
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Narzędzia

## Purpose

Zdefiniować po co istnieje moduł `Narzędzia` i jak przekłada AI-guided analizę na inicjatywy gotowe do planowania i realizacji.

## Must

- MUST: udostępniać bibliotekę narzędzi z jasnymi kategoriami i wejściem do sesji narzędziowej.
- MUST: prowadzić użytkownika przez strukturę (inputs → kroki → wynik) zamiast “pustego czatu bez metody”.
- MUST: generować wyniki w sposób, który może zasilić `Inicjatywy` (inicjatywy gotowe do potwierdzenia).

## Must Not

- MUST NOT: mieszać “wynik narzędzia” z “zatwierdzoną inicjatywą” (inicjatywa wymaga osobnego lifecycle/gates).

## Should

- SHOULD: utrzymywać mentalny model v3: **Library → Sessions → Reports/Presentations → Initiatives**.

## Acceptance Criteria

- [ ] Purpose jest spójny z `DISCOVERY_TOOLS_MODULE.md` oraz `TOOLS_CATALOG_V3.md`.

## Related Sources

- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`
- `DRD/consultify/docs/product/TOOLS_CATALOG_V3.md`

