---
doc_id: CORE-ART-003A
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-002
last_reviewed: 2026-07-31
---

# CORE-ART-003A — bezpieczny retry Artifact Run

## Problem

`retryArtifactRun` przyjmuje dziś dowolny status, mutuje rodzica do `retry_requested`, a następnie tworzy potomka. Pozwala to retry zakończonego albo aktywnego runu i niszczy prawdę o terminalnym stanie rodzica.

## Oczekiwany rezultat

Retry tworzy nowy run wyłącznie dla `failed`, `rejected` lub `cancelled`, zachowuje status rodzica bez zmian i zwraca stabilny konflikt `409` dla pozostałych stanów.

## Dozwolone pliki

- `server/src/services/v8/artifactRegistryService.ts`;
- `server/src/routes/artifact-runs.routes.ts` tylko jeśli potrzebne do stabilnego HTTP 409;
- testy Artifact Run route/service.

## Kryteria

1. `failed`, `rejected`, `cancelled` tworzą nowy child z `retryOfRunId`.
2. `planned`, `proposal_created`, `awaiting_review`, `approved_for_apply`, `applying`, `retry_requested`, `completed` zwracają `409 ARTIFACT_RUN_RETRY_NOT_ALLOWED`.
3. Status rodzica nigdy nie jest zmieniany przez retry.
4. Cleanup ghost output działa tylko dla failed z origin i pozostaje best-effort.
5. Audit rodzica zapisuje próbę/utworzenie childa bez fałszywej zmiany statusu; `fromStatus` i `toStatus` nie sugerują mutacji rodzica.
6. Dwa równoległe retry tego samego rodzica nie mogą cicho stworzyć nieograniczonych duplikatów; minimalnie drugi request ma dostać istniejący child albo konflikt.
7. Test obejmuje macierz statusów, parent immutability, lineage, tenant scope i concurrency/idempotency.

## Poza zakresem

Effective lifecycle DTO, preflight, publish, DB schema, UI oraz usuwanie istniejących enumów.

## Recovery

Brak migracji. Rollback przez odwrócenie zmian service/route/test. Istniejące historyczne rekordy `retry_requested` pozostają czytelne.

## Odbiór 2026-07-31

Decyzja: **GO**.

- test kontraktu service: `13/13 PASS`;
- testy integracyjne retry: `3/3 PASS` (completed → 409, failed → child, cancelled → child);
- rodzic pozostaje w pierwotnym statusie, a child zapisuje `retryOfRunId`;
- stabilny błąd: `409 ARTIFACT_RUN_RETRY_NOT_ALLOWED`;
- `git diff --check`: PASS.

Ograniczenie zaakceptowane dla stagingu: serializacja równoległych prób działa w obrębie
jednego procesu Node. Gwarancja między wieloma instancjami wymaga osobnego constraintu
lub klucza idempotencji w bazie i pozostaje zadaniem przed skalowaniem produkcyjnym.

Dwa istniejące czerwone scenariusze materializacji arkusza nie należą do retry i zostały
przeniesione do `CORE-ART-003B`: kontrolowany failure zwraca dziś 409 zamiast starego 500,
a materializacja z `tableId` kończy się `ARTIFACT_MATERIALIZE_FAILED`.
