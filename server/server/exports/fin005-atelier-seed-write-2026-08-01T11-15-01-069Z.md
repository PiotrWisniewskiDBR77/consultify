# FIN-005 — seed Atelier Finance (WRITE)

- run id: `2026-08-01T11-15-01-069Z`
- host: `127.0.0.1`
- database: `fin005_b`
- organization: `fin005-seed-demo`
- connection identity: PROVEN — PROVEN — the authorised pool, the write pool and the read pool are all cluster 7610146894575327780, database "fin005_b" (oid 533481) at 127.0.0.1:5432
  - authorised: system_identifier `7610146894575327780`, `127.0.0.1:5432/fin005_b` (oid 533481)
- pinned PostgreSQL: AVAILABLE — PostgreSQL database "fin005_b"; BEGIN/ROLLBACK proved on a pinned connection to "fin005_b" (backend pid 2272)
- fixture digest (before): `ebe78f081b03ae258a53dec5c5e76ed1de29ca1ca6719b0a19511b6b15f79421`
- plan: create=0 promote=0 relink=0 restate=0 unchanged=36

## Rows that would change

_Nothing. The canonical fixture is already materialized and READY, and the ROI model carries its canonical economics._

## Fixture verdict (before)

READY — the quarantine precondition would pass as-is.

## ROI model economics (before)

CANONICAL — the three forecast events are present with canonical values.

## Not touched by this command

- no organization is created, modified or removed;
- no destructive statement of any kind: no row removal, no DDL;
- no table outside the seven canonical Finance tables;
- no row outside the exact canonical id set;
- `financial_model_outputs` / `financial_model_validations` are NOT written: their only writer is `persistComputeResult`, which starts by deleting every existing output row. Importing it would put a destructive statement inside this command, which is the one thing it may never contain. The computed RESULT is therefore an operator step, not a seed step — runbook §8.
- `analysis_financials` / `digitization_analyses` are NOT written: the full dataset only writes them when the `line-3-digital-twin` initiative exists, which is a spine object outside this command's scope. On a tenant without it the full dataset writes nothing there either.
