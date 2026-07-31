---
doc_id: FIN-003A
truth_type: operations
status: BLOCKED
owner: codex
product_owner: piotr
priority: P0
depends_on: FIN-001
last_reviewed: 2026-07-31
---

# FIN-003A — real XLSX statement import E2E

## Werdykt

**NO-GO w bieżącym środowisku.** `DATABASE_URL` nie jest ustawione. Nie tworzymy
nieuruchomionego testu ani emulatora SQLite udającego Postgresa, ponieważ ten flow
korzysta z wielu tabel, wersji, JSON semantics, `FILTER`, `ON CONFLICT` i pełnych migracji.

## Wymagany dowód po udostępnieniu lokalnej bazy

Test acceptance używa `tests/acceptance/harness.ts`, realnego routera Finance Statements,
JWT, migracji i fixture XLSX z P&L FY2025 PLN. Przechodzi:

`upload → detect → extract → map → manual correction → validate → confirm → GET/read-back`.

Wymagane asercje obejmują wykryty typ/okres/walutę, co najmniej trzy wiersze, canonical
mapping, ręczną korektę z reason/provenance, status confirmed, wersje, quality/ingest
evidence oraz bezpośredni tenant-scoped PostgreSQL read-back.

## Warunek odblokowania

Lokalny `DATABASE_URL` do bazy testowej z pełnymi migracjami. Test nie może używać bazy
staging ani produkcyjnej. Po odblokowaniu komenda odbioru nie może zawierać skipów.

## Recovery

Fixture otrzymuje unikalny prefiks `odbior--fin003a--`; test usuwa rekordy w kolejności
bezpiecznej dla FK oraz pliki tymczasowe. Nie modyfikuje współdzielonych rekordów poza
idempotentnym odczytem kanonicznego registry.
