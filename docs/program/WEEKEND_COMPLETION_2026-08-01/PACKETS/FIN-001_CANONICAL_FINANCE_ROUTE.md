---
doc_id: FIN-001
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: UI-UX-GATE-0
last_reviewed: 2026-07-31
---

# FIN-001 — kanoniczna trasa Finance

## Problem

`/finance` i historyczne `/economics` montowały równolegle ten sam hub. Powstawały dwa
równoważne URL-e, mimo zatwierdzonej nazwy produktu Finance i kanonicznego mapowania
`AppView.ECONOMICS → /finance`.

## Rezultat

- `/finance` pozostaje jedyną trasą montującą Finance Hub;
- `/economics` jest kompatybilnym redirect-only aliasem;
- query i hash są zachowane, więc zakładki oraz deep-link state nie giną;
- redirect emituje istniejącą telemetrię `route_redirected`;
- backendowe nazwy `/api/economics`, identyfikator uprawnienia `MODULE_ECONOMICS`
  i szczegółowe trasy `/finance/*` pozostają bez zmian.

## Odbiór 2026-07-31

Decyzja: **GO**.

- canonical route identity i query/hash preservation: `2/2 PASS`;
- Document route non-regression: `5/5 PASS`;
- frontend `npm run type-check`: PASS;
- brak migracji i zmian API.

## Następna bramka

`FIN-002` ma przekształcić nietrwały kalkulator NPV/IRR/payback w wersjonowany,
odtwarzalny Investment Case z ROI, scenario, baseline decision i actuals.
