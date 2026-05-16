---
module_id: MODULE_FINANCE
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Finanse

## Purpose

Metadane kontraktu modułu `Finanse` i jego miejsce w systemie.

## Identity

- **Sidebar label**: Finanse
- **Folder**: `08_finanse`
- **Module id**: `MODULE_FINANCE`

## Canonicality

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`

## Doctrine

- **Modeled truth** lives here (Finance).
- **Metric truth** lives in `Rezultaty` (Results).
- Linkage KPI↔Finance jest opcjonalne i jawne (`RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`).

## Open questions (max 3)

1. Czy “Finanse” w sidebarze zostaje na `/economics`, czy pojawi się osobna trasa dla Financial Analysis v3?
2. Jak dokładnie mapujemy 6 zakładek v3 na widoki i ich uprawnienia w roli/ACL?
3. Kiedy i gdzie jest dopuszczone “create initiative from analysis” i jaki gate to kontroluje?

