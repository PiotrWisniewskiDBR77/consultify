# Wave 01 — Finance Statement `25P02` root cause

Status: `ROOT_CAUSE_CONFIRMED / FIX_PACKET_REQUIRED`  
Observed product SHA: `f5c6a7f16f95a6b800afb19b08832d2c6930514c`  
Database: `consultify_fin_statement_f5c6_acceptance` in container `consultify-fin-statement-78b5-acceptance-pg`

## Reproduction

Mounted request:

`POST /api/v8/finance/statements/a7eb81ba-b244-48bd-9c8e-c8597f313a10/extract`

Body selected `P&L`, `BS` and `CF` for period 2025. Upload succeeded with HTTP 201. Extract returned HTTP 422 and PostgreSQL `25P02`.

## First error, previously swallowed

The PostgreSQL container log proves the preceding error on the same transaction connection:

- `duplicate key value violates unique constraint "idx_fs_pack_active_type"`;
- conflicting key: pack `2674ede8-4caf-426f-8432-badac54a4526`, type `P&L`;
- failing statement: assignment of `statement_pack_id` while staging a sibling;
- the immediately following status update emitted the secondary `25P02` shown to the user.

The database contains both indexes:

- obsolete `idx_fs_pack_active_type`, unique by `(statement_pack_id, statement_type)`;
- current `idx_fs_pack_active_type_period`, unique by pack, type and period dates.

The exact-six contract requires two active periods for each of P&L, BS and CF. Therefore the type-only index makes the new product contract impossible.

## Why the existing migration was insufficient

`20261057_finance_statement_pack_comparative_period_identity.sql` correctly drops the obsolete index and creates the period-aware index. Its ledger row is `success`, yet the obsolete index exists again in the mounted database. The same obsolete definition also exists in:

- `server/migrations/20260316_financial_statement_packs.sql`;
- `server/migrations-v2/001_baseline_20260413.sql`;
- the archived migration copy.

This establishes schema resurrection/drift after the corrective migration. A successful ledger row alone is not proof of the effective final schema.

## Required Wave 02 fix packet

1. Add a late, idempotent migration that drops `idx_fs_pack_active_type` and asserts the exact definition of `idx_fs_pack_active_type_period`.
2. Remove or supersede the obsolete index from every bootstrap/baseline path capable of recreating it on a current installation.
3. Extend `assertAtomicStatementImportSchema()` to fail before `BEGIN` when the obsolete index exists or the current period-aware index is absent/wrong.
4. Preserve the original database error in structured logs with request/correlation ID; never replace it only with a later `25P02`.
5. Add a red-before/green-after real-PostgreSQL test that intentionally restores the obsolete index and expects preflight `503 STATEMENT_IMPORT_SCHEMA_INCOMPLETE`, zero sibling writes and no `25P02`.
6. Qualify fresh migration, restored/late-shape migration, repeat=0, dry-run=0 and exact-six mounted flow.

## Acceptance

Required result: six distinct statement IDs and six source receipts in one pack (`P&L:2025`, `P&L:2024`, `BS:2025`, `BS:2024`, `CF:2025`, `CF:2024`), followed by mapping, confirmation, receipt, downstream deep link and independent cold readback.

No production migration is authorized by this packet.

