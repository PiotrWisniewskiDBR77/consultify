# Rejestr schematu od zera — 2026-09-02

## A. Pełny przebieg migracji od zera

- Marker: `eeb253c3ec13195a04b3848ef2566c5c07786e58`.
- Lokalna baza: kontener `cx-day281-pg`, PostgreSQL `pgvector/pgvector:pg16`, port hosta `127.0.0.1:6268`, baza `cx281`.
- Runner zgłosił `Applying migrations: 882`, wykonał pełny przebieg i zakończył `Postgres migrations complete`.
- W pełnym logu nie znaleziono błędu ani ostrzeżenia. Trafienie słowa `exception` pochodzi wyłącznie z nazwy migracji `20260809_finance_v3_b05_exception_ledger.sql`.
- `schema_migrations` po przebiegu: `882` wiersze.
- `to_regclass('public.email_verification_tokens')` po migracjach: `NULL` — tabela nie powstała.
- Log: `/private/tmp/cx-day281-schemat-od-zera-artefakty/r1-migrate-full.log`.
- SHA-256 logu: `c5fd75a05660423fff9f6a10345691417d9d5a661129f3d9d7abf1e25898334a`.

## B. Tabele tworzone poza migracjami

Do uzupełnienia w R2 na podstawie własnego pomiaru wszystkich trafień.

## C. Naprawy i dowody

Do uzupełnienia w R4–R5.

## D. Otwarte pozycje

- `email_verification_tokens` nie jest tworzona przez żadną migrację.
- Pełny inwentarz runtime DDL pozostaje do wykonania w R2.

