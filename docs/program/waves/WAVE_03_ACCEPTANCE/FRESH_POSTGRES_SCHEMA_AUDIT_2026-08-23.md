# Wave 3 fresh-PostgreSQL schema audit — 2026-08-23

Status: `STRICT_CHAIN_PASS / STATIC_SCHEMA_GATE_PASS / RUNTIME_REPLAY_PENDING`

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

## Separate cross-module finding

The broad Harvard flow contract initially failed because its hard-coded stub
list still included `B8b`, although the authoritative flow registry now marks
Ideas server export as `partial`: JSON/Markdown persistence exists behind a
fail-closed feature flag while unsupported client-canvas formats remain honest
501 responses. The test now asserts `B8b=partial` and retains `B9` as the known
stub. This is test/register reconciliation, not proof that the full Ideas export
journey is owner-accepted or release-ready.

## Remaining gates

- mounted exact-SHA runtime startup and API query replay across the remaining
  Wave 3 modules: `PENDING`;
- browser/cold-readback owner fixtures: `PENDING`;
- owner acceptance: `0/16` remains unchanged until explicit review evidence.
