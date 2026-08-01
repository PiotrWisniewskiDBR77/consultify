---
doc_id: OPS-DEMO-003
truth_type: operations
status: READY
owner: codex
product_owner: piotr
priority: P0
last_reviewed: 2026-08-01
---

# OPS-DEMO-003 — recovery i bezpieczne fixtures stagingowe

## Werdykt

**NO-GO dla in-place restore i destrukcyjnego `db:seed:atelier`.** Obecny restore
używa `gunzip | psql` bez `ON_ERROR_STOP`, clean/drop, transakcji, checksumu i manifestu,
więc może zgłosić sukces po częściowej porażce.

## Zakres utwardzenia

1. custom-format `pg_dump` z `--no-owner --no-privileges`;
2. SHA-256, `pg_restore --list` i manifest bez sekretów;
3. restore wyłącznie do świeżej recovery DB z `--exit-on-error --single-transaction`;
4. schema/migration parity, counts i orphan checks przed decyzją GO;
5. additive-only runner dla namespace `demo-<slug>`, bez kasowania `atelier`;
6. jawne `--write`, confirmation token, environment guard i advisory lock;
7. transakcyjny exact-namespace cleanup z count report i audytem;
8. RPO/RTO, retencja, szyfrowanie i approval matrix.

## Reuse

- `server/scripts/lib/scriptDatabaseTarget.ts`;
- `server/src/config/demoPolicy.ts`;
- `server/src/services/demo/demoSeedService.ts`;
- `db-truth-audit.ts`, `database-readiness-audit.ts`,
  `verify-schema-vs-migrations.ts`;
- testy `atelierSpineCoherence` i `atelierSeedIdempotency`.

## Zakazy

- bez `npm run db:seed:atelier` na współdzielonym demo;
- bez restore do aktywnej DB;
- bez URL bazy w argv/logach;
- bez deklarowania dry-run dla operacji, która faktycznie tworzy i usuwa tenant.

## Bramka dla mutujących golden flows

Mutujący test stagingowy może ruszyć dopiero po restore drill do izolowanej DB oraz po
przyjęciu additive namespaced fixture + exact cleanup.
