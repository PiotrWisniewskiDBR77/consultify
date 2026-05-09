---
module_id: MODULE_RESULTS
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Rezultaty (Results)

## Purpose

Ustalić granice odpowiedzialności Results względem: Inicjatywy (definicje kontekstu), Realizacja (execution), Outputs/Reporting (narrative), Finanse (modeled truth).

## In scope (Must)

- MUST: KPI definitions, scorecards/OKR, dashboards, deviation cases i corrective loop.
- MUST: ROI registry + ROI analysis + evidence + realized tracking (w granicach SoT).
- MUST: Results reporting surfaces (template-first narrative w Results).
- MUST: inicjatywy jako scope surface w Results (obserwacja).

## Out of scope (Must Not)

- MUST NOT: zastępować `Inicjatywy` jako miejsce planowania/gate’ów.
- MUST NOT: zastępować `Finanse` jako miejsce modeli finansowych; Results trzyma metric truth.

## Should

- SHOULD: spójny link do Outputs gdzie powstają artefakty (reports/presentations) oraz spójny model materiałów przeglądu.

## Acceptance Criteria

- [ ] Zakres jest spójny z `RESULTS_V8_SSOT.md` (co Results owns) i nie dubluje Finance.
- [ ] Route truth: `/benefits` jest kanoniczne, `/kpi-okr` tylko alias.

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/RESULTS_V8_SSOT.md`
- `DRD/consultify/docs/product/KPI_FULL_SYSTEM_CANON_V8.md`

