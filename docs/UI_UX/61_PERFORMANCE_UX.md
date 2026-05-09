---
uiux_doc_id: UIUX_PERFORMANCE
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Performance UX (latency, long jobs)

## Purpose

Ujednolicić UX dla latency i długich zadań (pipelines), żeby UI nie “wisi” i nie udaje sukcesu.

## Applies To

Upload/processing, generowanie artefaktów, integracje/sync, AI workflows.

## Must

- **MUST**: Brak infinite spinner — długie prace pokazują job/progress state i recovery.
- **MUST**: Heavy processing jest async; UI pokazuje status (processing/partial/ready) i timestamp “last updated”.
- **MUST**: Writes fail closed, gdy system nie jest gotowy (np. ledger/context engine niedostępne).

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Honest degraded UI)
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md` (async processing + statusy)

