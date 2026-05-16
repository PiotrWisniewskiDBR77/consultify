---
module_id: MODULE_EXECUTION
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Realizacja (Execution)

## Purpose

Metadane kontraktu modułu `Realizacja` (Execution) i jego miejsce w lifecycle.

## Identity

- **Sidebar label**: Realizacja
- **Folder**: `06_realizacja`
- **Module id**: `MODULE_EXECUTION`

## Canonicality & surface split

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`
- **Surfaces**: `Portfolio`, `Raporty`, `Manager` (jedna prawda runtime)

## Open questions (max 3)

1. Jak mapujemy `Execution -> Raporty` do globalnego modułu `Outputs` (żeby nie duplikować raportów)?
2. Jakie bounded write actions są dozwolone w `Manager` bez łamania governance/silent execution?
3. TBD

