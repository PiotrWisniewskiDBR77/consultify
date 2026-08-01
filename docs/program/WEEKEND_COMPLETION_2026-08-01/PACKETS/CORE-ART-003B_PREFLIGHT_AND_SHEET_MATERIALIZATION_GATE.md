---
doc_id: CORE-ART-003B
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-003A
last_reviewed: 2026-07-31
---

# CORE-ART-003B — obowiązkowy preflight i materializacja arkusza

## Problem

Preflight Artifact Run jest dziś informacyjny: materializacja może ruszyć bez przejścia
bramki, a preflight arkusza nie zna parametrów przekazywanych dopiero przy materializacji.
Istniejący test potwierdza też, że arkusz z podanym `config.tableId` kończy się kontrolowanym
`409 ARTIFACT_MATERIALIZE_FAILED` zamiast utworzeniem artefaktu.

## Oczekiwany rezultat

Każda materializacja raportu, prezentacji i arkusza ma aktualny, zapisany preflight oparty
na rzeczywistych parametrach żądania. Materializacja rusza tylko dla wyniku `passed`.
Arkusz z prawidłowym zarządzanym `tableId` materializuje się i daje się ponownie odczytać.

## Dozwolone pliki

- `server/src/services/v8/artifactRegistryService.ts`;
- `server/src/routes/artifact-runs.routes.ts`, jeśli potrzebne do stabilnego kontraktu HTTP;
- istniejące typy Artifact Run wyłącznie, jeśli preflight wymaga jawnego pola;
- testy Artifact Run route/service.

## Kryteria

1. `materializeArtifactRun` oblicza preflight z faktycznymi parametrami materializacji i zapisuje jego wynik.
2. Stan inny niż `passed` blokuje materializację stabilnym `409 ARTIFACT_RUN_PREFLIGHT_BLOCKED` z listą niespełnionych checks.
3. Zgodność wsteczna: klient nie musi osobno wywołać endpointu preflight; materializacja wykonuje aktualny preflight atomowo przed skutkami ubocznymi.
4. Nie powstaje output, artifact ani wersja, jeśli bramka nie przeszła.
5. Sheet z istniejącym i należącym do tenant `tableId` kończy się `completed`, zapisuje origin/artifact i przechodzi read-back.
6. Brak lub obcy `tableId` daje kontrolowane 409, zapisuje failure package i nie pozostawia ghost output.
7. Testy rozróżniają świadomie `409` błędu kontrolowanego od `500` błędu serwera.
8. Report i presentation nie tracą dotychczasowych zielonych ścieżek.

## Testy obowiązkowe

- `tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts`;
- `tests/integration/routes/artifact-runs.routes.preflight-and-failure.sqlite.integration.test.ts`;
- odpowiednie testy service dla macierzy preflight;
- typecheck zmienionego zakresu i `git diff --check`.

## Poza zakresem

Effective lifecycle DTO, publish quorum, retry, nowy edytor arkusza, migracja modelu
materiałów oraz zmiany UI.

## Recovery

Brak destrukcyjnej migracji. Zmiana ma być odwracalna przez rollback service/route/test.
Nie usuwać istniejących artefaktów ani tabel podczas naprawy.

## Odbiór 2026-07-31

Decyzja: **GO**.

- route SQLite: `5/5 PASS`;
- preflight/failure SQLite: `2/2 PASS`;
- service retry + preflight matrix: `18/18 PASS`;
- łącznie w niezależnym przebiegu: `25/25 PASS`;
- `git diff --check`: PASS.

Preflight korzysta z rzeczywistych parametrów materializacji, weryfikuje tenant scope
i użyteczny schemat tabeli przed skutkami ubocznymi. Odrzucenie zapisuje failure package
ze stage `preflight` i zwraca `409 ARTIFACT_RUN_PREFLIGHT_BLOCKED` bez ghost output.
