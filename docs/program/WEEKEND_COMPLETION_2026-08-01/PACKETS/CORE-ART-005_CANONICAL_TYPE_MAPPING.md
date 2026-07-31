---
doc_id: CORE-ART-005
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-004
last_reviewed: 2026-07-31
---

# CORE-ART-005 — kanoniczne mapowanie typów artefaktów

## Problem

Ten sam rezultat jest dziś opisywany przez różne słowniki: rodzina
`document/presentation/sheet/template`, output `report/presentation/sheet`, publish type
oraz origin runtime. Rozproszone warunki i casty pozwalają tworzyć sprzeczne kombinacje.

## Oczekiwany rezultat

Jeden jawny, typowany translator definiuje obsługiwane relacje oraz odrzuca kombinacje
niejednoznaczne. Serwis Artifact Run i publish używają translatora zamiast lokalnych castów.

## Dozwolone pliki

- typy i nowy mapper w `server/src/types` lub `server/src/services/v8`;
- `server/src/services/v8/artifactRegistryService.ts`;
- `server/src/services/v8/publishReviewService.ts` tylko dla usunięcia niebezpiecznego castu;
- odpowiednik typów klienta wyłącznie, jeśli jest konsumowany;
- testy kontraktów i mappera.

## Kryteria

1. Kanoniczne pary: `document→report`, `presentation→presentation`, `sheet→sheet`.
2. `template` wymaga jawnego subtype/output i nie jest zgadywany po nazwie.
3. Mapper zwraca rodzinę, output type, publish artifact type oraz dozwolone origin runtimes.
4. `finance_output` i `results_artifact` pozostają rozszerzeniami publish, nie są fałszywie mapowane na rodzinę Artifact Run.
5. Sprzeczna jawna para requestu daje stabilny błąd walidacji przed utworzeniem runu.
6. Brak `as ArtifactType` w ścieżce Artifact Run → publish dla obsługiwanych typów.
7. Test obejmuje pełną macierz poprawnych i błędnych kombinacji oraz template subtype.
8. Brak zmiany istniejących rekordów i brak destrukcyjnej migracji.

## Poza zakresem

Content envelope, publish quorum, UI, dodawanie nowych formatów oraz przebudowa legacy
artifact approvals.

## Recovery

Mapper jest addytywny. Rollback przywraca lokalne mapowanie bez zmiany danych w bazie.

## Odbiór 2026-07-31

Decyzja: **GO**.

- pełny niezależny przebieg: `51/51 PASS`;
- sprzeczne jawne pary kończą się `400 ARTIFACT_TYPE_MAPPING_INVALID` przed handoffem;
- template wymaga jawnego output subtype;
- ścieżka Artifact Run → publish używa mappera bez niebezpiecznego castu;
- `git diff --check`: PASS.
