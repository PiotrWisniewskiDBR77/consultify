---
doc_id: CORE-ART-006D
truth_type: operations
status: READY
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006C
last_reviewed: 2026-07-31
---

# CORE-ART-006D — tenant-safe adapter treści arkusza

## Oczekiwany rezultat

Origin `sheet` zwraca rzeczywisty, deterministyczny snapshot Table Platform bez użycia
nie-tenantowego MetadataService i bez ładowania nieograniczonego datasetu do pamięci.

## Kontrakt

- ownership: pierwszy query `tp_tables → tp_bases.organization_id`;
- fields: `field_order, name, id`;
- views: `is_default DESC, ordinal NULLS LAST, name, id`;
- records: keyset `(created_at, id)`, bez offset pagination;
- JSON przechowuje record data po UUID pola, nie po nazwie;
- preview: domyślnie 50, max 100;
- full page: domyślnie 200, max 500;
- hard payload cap około 1 MiB, bez obcinania JSON pojedynczego rekordu;
- `projection.completeness` jawnie `full` lub `truncated`.

## Rewizja

`schema_version`, table `updated_at` ani `COUNT + MAX(updated_at)` nie są mocną rewizją
całej treści. Mocna rewizja to wyłącznie SHA-256 kanonicznego pełnego snapshotu liczony
strumieniowo w spójnej transakcji. Jeśli nie jest liczony, adapter musi jawnie zwrócić
słabą/snapshotową semantykę i nie przedstawiać pageHash jako dataset revision.

## Kryteria

1. Foreign tenant i missing table są nierozróżnialnym 404; dalsze query nie ruszają.
2. Deterministyczne sortowanie ma tie-breaker `id`.
3. Cursor jest walidowany; strony nie mają skip/duplicate przy równych timestampach.
4. Zmiana key order JSONB nie zmienia hash; zmiana wartości/schema/view/insert/delete zmienia mocny hash.
5. Preview 50/51 i full 500/501 poprawnie oznaczają truncation/nextCursor.
6. Limit bajtów kończy stronę na granicy rekordu; pojedynczy zbyt duży rekord daje stabilny 413.
7. Markdown poprawnie escapuje pipe, newline, null i nested JSON.
8. Registry E2E zwraca realny sheet origin i tenant-safe read-back.
9. Brak migracji DB i brak zmian istniejącego Table Platform API.

## Recovery

Usunięcie rejestracji adaptera przywraca fail-closed unsupported runtime bez zmiany danych.
