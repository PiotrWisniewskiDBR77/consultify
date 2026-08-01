---
doc_id: FIN-003A
truth_type: operations
status: SUPERSEDED_AS_ACCEPTANCE_GATE
owner: codex
product_owner: piotr
priority: P0
depends_on: FIN-001
last_reviewed: 2026-08-01
---

# FIN-003A — real XLSX statement import E2E

## Werdykt po decyzji środowiskowej 2026-08-01

**Ten lokalny runner nie jest już bramką odbiorową.** Product Owner ustalił, że
jedynym targetem odbioru jest Railway environment `demo`, `demo.consultify.ai` i jego
PostgreSQL. Plik testowy może pozostać jako development harness, lecz jego PASS nie
może nadać funkcji statusu `GO`.

Następcą jest `FIN-003B`: kontrolowany staging E2E z namespaced fixture, cleanupem,
tenant isolation, backup/recovery oraz read-backiem z PostgreSQL `demo`.

## Historyczny werdykt

**Test zaimplementowany; wykonanie BLOCKED przed migracjami.** Repozytorium zawiera oddzielną konfigurację
`server/.env.test`, która wskazuje na osiągalny lokalny PostgreSQL
`localhost:5432/consultinity_test`. Zdalne konfiguracje z `.env` i `.env.local` są poza
zakresem tej paczki i nie wolno ich użyć. Nie tworzymy emulatora SQLite udającego
Postgresa, ponieważ ten flow korzysta z wielu tabel, wersji, JSON semantics, `FILTER`,
`ON CONFLICT` i pełnych migracji.

## Historyczny lokalny dowód

Test acceptance używa `tests/acceptance/harness.ts`, realnego routera Finance Statements,
JWT, migracji i fixture XLSX z P&L FY2025 PLN. Przechodzi:

`upload → detect → extract → map → manual correction → validate → confirm → GET/read-back`.

Wymagane asercje obejmują wykryty typ/okres/walutę, co najmniej trzy wiersze, canonical
mapping, ręczną korektę z reason/provenance, status confirmed, wersje, quality/ingest
evidence oraz bezpośredni tenant-scoped PostgreSQL read-back.

## Bramka wykonania

Przed testem runner ładuje wyłącznie `server/.env.test`, sprawdza nazwę hosta i bazy
oraz odmawia pracy, jeżeli host nie jest lokalny albo baza nie ma nazwy
`consultinity_test`. Następnie uruchamia pełne migracje. Komenda odbioru nie może
zawierać skipów.

## Recovery

Fixture otrzymuje unikalny prefiks `odbior--fin003a--`; test usuwa rekordy w kolejności
bezpiecznej dla FK oraz pliki tymczasowe. Nie modyfikuje współdzielonych rekordów poza
idempotentnym odczytem kanonicznego registry.

## Próba wykonania 2026-08-01

Zaimplementowano zabezpieczony runner i real-route acceptance test. Runner:

- czyta wyłącznie `server/.env.test`;
- odmawia wykonania, jeśli host nie jest `localhost`, `127.0.0.1` lub `::1` albo nazwa
  bazy nie jest dokładnie `consultinity_test`;
- uruchamia pełne migracje, a dopiero po nich test bez skipów.

Wykonanie zatrzymało się przed pierwszą migracją i przed testem:

```text
[FIN-003A] guarded local target: localhost/consultinity_test
Postgres migrate failed: role "consultinity" does not exist
```

Port `5432` jest osiągalny, ale lokalny PostgreSQL nie ma roli zapisanej w
`server/.env.test`. W środowisku nie ma klienta `psql`, więc nie wykonano dodatkowych
zmian administracyjnych. Nie utworzono roli, nie zmieniono URL i nie użyto `.env` ani
`.env.local`. Status pozostaje blokujący do czasu skorygowania lokalnej roli/credentials;
test nie jest raportowany jako PASS.
