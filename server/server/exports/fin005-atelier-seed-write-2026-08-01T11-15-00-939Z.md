# FIN-005 — seed Atelier Finance (WRITE)

- run id: `2026-08-01T11-15-00-939Z`
- host: `127.0.0.1`
- database: `fin005_b`
- organization: `fin005-seed-demo`
- connection identity: PROVEN — PROVEN — the authorised pool, the write pool and the read pool are all cluster 7610146894575327780, database "fin005_b" (oid 533481) at 127.0.0.1:5432
  - authorised: system_identifier `7610146894575327780`, `127.0.0.1:5432/fin005_b` (oid 533481)
- pinned PostgreSQL: AVAILABLE — PostgreSQL database "fin005_b"; BEGIN/ROLLBACK proved on a pinned connection to "fin005_b" (backend pid 2263)
- fixture digest (before): `b625c134948fa5d759e853821a95708d8ae35a8e836afe1f792b06c4b537164d`
- plan: create=36 promote=0 relink=0 restate=0 unchanged=0

## Rows that would change

| table | id | action | observed |
| --- | --- | --- | --- |
| `financial_statement_packs` | `fin005-seed-demo--statement-pack--atelier-fy2014` | create | absent |
| `financial_statements` | `fin005-seed-demo--statement--atelier-fy2014-pl` | create | absent |
| `financial_statements` | `fin005-seed-demo--statement--atelier-fy2014-bs` | create | absent |
| `financial_statements` | `fin005-seed-demo--statement--atelier-fy2014-cf` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--revenue` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--cogs` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--gross_profit` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--opex` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--ebitda` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--depreciation` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--ebit` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--interest_expense` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--ebt` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--tax_expense` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-pl--net_income` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--cash` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--ar` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--inventory` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--current_assets` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--fixed_assets` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--total_assets` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--ap` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--current_liabilities` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--long_term_debt` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--total_liabilities` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-bs--total_equity` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-cf--operating_cf` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-cf--capex` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-cf--investing_cf` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-cf--financing_cf` | create | absent |
| `financial_statement_values` | `fin005-seed-demo--statement-value--atelier-fy2014-cf--net_change_cash` | create | absent |
| `financial_analyses` | `fin005-seed-demo--analysis--atelier-fy2014-baseline` | create | absent |
| `financial_models` | `fin005-seed-demo--financial-model--transformation-2015-roi` | create | absent |
| `financial_model_events` | `fin005-seed-demo--financial-model-event--revenue-uplift` | create | absent |
| `financial_model_events` | `fin005-seed-demo--financial-model-event--digital-capex` | create | absent |
| `financial_model_events` | `fin005-seed-demo--financial-model-event--opex-reduction` | create | absent |

## Fixture verdict (before)

- the canonical statement pack (fin005-seed-demo--statement-pack--atelier-fy2014) is missing from the read-back — read back [nothing]
- 3 of the 3 canonical statements [fin005-seed-demo--statement--atelier-fy2014-bs, fin005-seed-demo--statement--atelier-fy2014-cf, fin005-seed-demo--statement--atelier-fy2014-pl] are missing from the read-back — read back [nothing]
- 27 canonical statement values expected, 0 read back (missing 27, e.g. fin005-seed-demo--statement-value--atelier-fy2014-bs--ap)
- the canonical analysis (fin005-seed-demo--analysis--atelier-fy2014-baseline) is missing from the read-back — read back [nothing]
- the canonical model (fin005-seed-demo--financial-model--transformation-2015-roi) is missing from the read-back — read back [nothing]

## ROI model economics (before)

NOT CANONICAL — see the `financial_model_events` rows above.

## Not touched by this command

- no organization is created, modified or removed;
- no destructive statement of any kind: no row removal, no DDL;
- no table outside the seven canonical Finance tables;
- no row outside the exact canonical id set;
- `financial_model_outputs` / `financial_model_validations` are NOT written: their only writer is `persistComputeResult`, which starts by deleting every existing output row. Importing it would put a destructive statement inside this command, which is the one thing it may never contain. The computed RESULT is therefore an operator step, not a seed step — runbook §8.
- `analysis_financials` / `digitization_analyses` are NOT written: the full dataset only writes them when the `line-3-digital-twin` initiative exists, which is a spine object outside this command's scope. On a tenant without it the full dataset writes nothing there either.
