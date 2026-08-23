# Wave 3 fresh-PostgreSQL schema audit — 2026-08-23

Status: `STRICT_CHAIN_PASS / STATIC_SCHEMA_GATE_PASS / MOUNTED_RUNTIME_PASS`

Candidate before audit: `56b31532cd044a2588d3dc846f1f21e748a47d3e`

## Safety boundary

The audit used a disposable local `pgvector/pgvector:pg16` container and an
explicit database target. It did not query or mutate Railway, staging, demo or
production. The container and database were removed after verification.

## Evidence

- strict canonical PostgreSQL chain: `830/830` migrations completed;
- information-schema comparison: `1798` expected tables, `2093` expected
  additive columns, `0` missing tables and `0` missing columns;
- schema verifier unit contract: `6/6 PASS`;
- root TypeScript check: `PASS`.

## Verifier correction

The first comparison returned four false positives. The verifier treated
schema qualifiers (`public`, `v8`) and conditional DDL inside SQL strings as
table names, and it did not apply the later lifecycle drop of the deprecated
`initiatives.estimated_roi` column. The corrected verifier now:

- uses the canonical deterministic migration order and promoted legacy set;
- distinguishes public and named schemas;
- ignores conditional DDL embedded in `EXECUTE` strings;
- applies additive-column drop lifecycle;
- queries all non-system schemas rather than only `public`.

The corrected gate passed against the same fresh database. No application
column was reintroduced to satisfy a faulty audit signal.

## Mounted-runtime convergence

The first exact-SHA mounted startup on the 830-migration database reached
health/readiness, but exposed hidden schema ownership outside the canonical
chain. `DatabaseInitializer` attempted runtime `ALTER TABLE` for 24 columns in
seven tables and reported two live-service tables as missing. This is a real
fresh-install gap and a source of startup DDL contention.

Migration `20260823_runtime_ddl_schema_convergence.sql` moves that contract into
the canonical chain with semantic types, including numeric
`usage_records.quantity` required by `SUM(quantity)`. Exact-SHA replay on
`1a26616436cdaf1ffabebe0baa495c17bb83305d` proved:

- `831` strict migrations and authoritative migration states `ok / ok`;
- health / ready / frontend `200 / 200 / 200`;
- no missing-column self-heal and no missing non-critical table warning;
- `trusted_devices.trusted_at` is timestamp, `users.is_active` integer,
  `usage_records.metric_name` text and `usage_records.quantity` numeric;
- `report_public_links` and `organization_brand_voice_profiles` exist before
  request traffic;
- focused convergence contracts `47/47 PASS`; root TypeScript check `PASS`;
- owned process groups terminated, database dropped, catalog absent and ports
  free after cleanup.

An earlier cleanup attempt on ports `4311/4312` correctly refused its final
port-free assertion because unrelated long-running PID `20613` already owned an
IPv6 listener on `4312`. The audit-owned process groups were verified dead and
its database absent before the disposable container was removed; the unrelated
process was not signalled. The qualified replay used collision-free ports
`4321/4322` and completed the full ownership cleanup contract.

## Separate cross-module finding

The broad Harvard flow contract initially failed because its hard-coded stub
list still included `B8b`, although the authoritative flow registry now marks
Ideas server export as `partial`: JSON/Markdown persistence exists behind a
fail-closed feature flag while unsupported client-canvas formats remain honest
501 responses. The test now asserts `B8b=partial` and retains `B9` as the known
stub. This is test/register reconciliation, not proof that the full Ideas export
journey is owner-accepted or release-ready.

## Remaining gates

- authenticated API query replay across the remaining Wave 3 module fixtures:
  `PENDING`;
- browser/cold-readback owner fixtures: `PENDING`;
- owner acceptance: `0/16` remains unchanged until explicit review evidence.
