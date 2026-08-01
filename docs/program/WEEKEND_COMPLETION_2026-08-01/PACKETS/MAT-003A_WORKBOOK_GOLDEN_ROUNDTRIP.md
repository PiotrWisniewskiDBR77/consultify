---
doc_id: MAT-003A
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006D
last_reviewed: 2026-07-31
---

# MAT-003A — Workbook golden round-trip

## Rezultat

Istniejący workbook runtime został sprawdzony na realnym, zamontowanym routerze,
in-memory SQLite, produkcyjnym `WorkbookBuilder` i ExcelJS. Nie była potrzebna zmiana
implementacji produkcyjnej.

Udowodniony przebieg:

`blank create → PATCH value → PATCH formula → GET reopen → XLSX download → OOXML read-back`.

Test potwierdza tenantowy zapis w `generated_workbooks`, trwałość `schema_json`,
unieważnienie cache po edycji oraz to, że pobrany plik zawiera zapisaną wartość i formułę.

## Plik dowodowy

- `tests/integration/routes/workbook.golden-roundtrip.sqlite.integration.test.ts`.

## Odbiór 2026-07-31

Decyzja: **GO**.

- golden round-trip: `1/1 PASS`;
- golden + route regression: `29/29 PASS`;
- ExcelJS read-back: `A2=21`, `B2.formula=A2*2`;
- `git diff --check`: PASS;
- brak zmian produkcyjnych, migracji i UI.

## Granice dowodu

SQLite nie dowodzi blokad Postgresa. Edge rejestru artefaktów i auth są mockowane.
ExcelJS potwierdza formułę zapisaną w OOXML, a nie wynik obliczony przez desktopowy Excel.
Concurrency, wersje/restore, operacje strukturalne i browser E2E pozostają osobnymi paczkami.
