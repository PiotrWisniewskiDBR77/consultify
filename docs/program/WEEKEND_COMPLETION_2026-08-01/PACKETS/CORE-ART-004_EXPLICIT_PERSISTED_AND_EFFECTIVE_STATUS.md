---
doc_id: CORE-ART-004
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-003B
last_reviewed: 2026-07-31
---

# CORE-ART-004 — jawny status zapisany i efektywny Artifact Run

## Problem

Backend zapisuje `run_status`, ale przy odczycie nadpisuje pole `runStatus` stanem
wyprowadzonym z Execution Spine. Konsument nie wie, czy ogląda stan zapisany, czy
efektywny. To utrudnia retry, audyt, diagnostykę i bezpieczne wznowienie procesu.

## Oczekiwany rezultat

DTO jawnie udostępnia `persistedRunStatus` oraz `effectiveRunStatus`. Dotychczasowe
`runStatus` pozostaje kompatybilnym aliasem statusu efektywnego w tej migracji.
Operacje mutujące i reguły retry korzystają ze statusu zapisanego; prezentacja postępu
może korzystać z efektywnego.

## Dozwolone pliki

- `server/src/services/v8/artifactRegistryService.ts`;
- `server/src/types/artifactRegistry.ts`;
- `src/services/api/artifactRuns.ts`;
- testy kontraktów i Artifact Run service/routes.

## Kryteria

1. Każdy odczyt runu zwraca trzy jawne pola: `persistedRunStatus`, `effectiveRunStatus`, `runStatus`.
2. `runStatus === effectiveRunStatus` dla zgodności wstecznej.
3. `persistedRunStatus` zawsze odpowiada `v8_artifact_runs.run_status`.
4. Rozbieżność Execution Spine nie usuwa informacji o statusie zapisanym.
5. Retry, materialize i inne decyzje domenowe nie polegają przypadkowo na statusie efektywnym.
6. Klient nie wyprowadza ponownie statusu inaczej niż backend; istnieje jeden kanoniczny mapper.
7. Test obejmuje zgodność statusów, ich rozbieżność, terminalny status rodzica i starszy payload.
8. Brak migracji destrukcyjnej i brak usunięcia `runStatus`.

## Poza zakresem

Nowy lifecycle, zmiana listy statusów, publish quorum, typy content envelope i UI redesign.

## Recovery

Zmiana jest addytywna. Rollback usuwa nowe pola z DTO i mappera bez zmiany danych.

## Odbiór 2026-07-31

Decyzja: **GO**.

- kontrakty, service i integracje: `33/33 PASS`;
- frontend typecheck: PASS;
- `git diff --check`: PASS;
- `runStatus` pozostaje kompatybilnym aliasem `effectiveRunStatus`;
- decyzje domenowe korzystają z `persistedRunStatus`.
