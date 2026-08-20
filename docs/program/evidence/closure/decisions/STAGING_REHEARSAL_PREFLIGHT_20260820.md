# Staging rehearsal preflight — 2026-08-20

## Authority and immutable candidate

- Owner decision: `D1=A, D2=A, D3=A, D4=A, D5=A, D6=A, D7=B`.
- Staging-only authority; production deploy, production traffic, production migration and production rollback remain `NOT_AUTHORIZED`.
- Immutable candidate ref: `refs/recovery/mvp-usable-100-release-candidate-20260820`.
- Candidate SHA: `71316e4125ba3f912cbcd0612639bb463b41dae7`.
- Owner-decision commit: `b8c9f5ccf4`.

## Railway target verification

- Authenticated Railway user: Piotr Wisniewski.
- Exact target: project `consultify` (`a6d59e88-263d-45f3-96bc-861f66bf467b`), environment `staging` (`487a33ba-84b0-4e2e-b18b-7f981ae5334d`), service `consultify` (`8f65b820-3d55-4dd9-8076-929d01cc4157`).
- The unrelated `Pitchdeck / production` context was detected during preflight and rejected before mutation.
- Staging application state before rehearsal: `CRASHED`; last deployment `4a011b57-5442-4f10-834a-2051f011f119` from 2026-08-12.
- Staging Postgres, pgvector and Redis services were running. No service, database or variable was created, deleted or changed during this preflight.

## Database preflight

- The application `DATABASE_URL` exactly matches the current staging Postgres internal URL by SHA-256 comparison.
- The application `DATABASE_PUBLIC_URL` does not match the staging Postgres public URL. It was not used and was not changed because a variable mutation would trigger redeployment.
- Strict candidate migration dry-run against the exact staging Postgres public URL failed closed before applying SQL.
- Blocking ledger record: `20260228_budget_initiative_links.sql` is recorded with checksum prefix `12b4cafd6a7958b2`; candidate bytes hash prefix `50e3c21219cae784`.
- The existing staging database must remain preserved under D4. Recommended rehearsal path: provision a new staging-only database, apply the full chain from empty, switch only the staging application after a green migration/replay gate, and retain the old database for rollback/evidence until explicit cleanup authority.

## Historical credential preflight and provider reconciliation

- Safe inventory: 74 unique historical records across `OPENAI_API_KEY`, `GCP_API_KEY`, `LINKEDIN_CLIENT_SECRET`, JWT/generic credential signatures and public identifiers. No secret value was read into or written to this document.
- Current Railway values were compared only by SHA-256 against the historical inventory for `dev`, `demo`, `staging` and `production`.
- Result: zero historical-hash matches in every environment.
- Authenticated provider reconciliation completed on 2026-08-20. OpenAI's only active Consultify key is current and does not match the historical inventory; all other listed keys are inactive.
- All four current keys in the authenticated GCP Gemini API project were compared by SHA-256 with the historical GCP inventory; matches: zero.
- The current LinkedIn Consultify application postdates the historical finding, and its current Railway credential does not match the historical SHA-256.
- A separately exposed production Google Speech key used by `fizzup-api / production` was rotated under explicit owner authorization. Railway deployment `ec14fa73-5d7a-4186-a4f6-ef0452de272b` reached `SUCCESS`; health, real Google STT and real Google TTS passed; only then was the previous Google key deleted.
- Safe receipt: `docs/program/evidence/closure/codex/SEC-PRIV-001/PROVIDER_ROTATION_RECEIPT_20260820.json`. It contains no credential values.
- Optional Git history rewrite remains `NOT_AUTHORIZED` and was not performed. Provider reconciliation is sufficient to close the D2 staging gate; it does not authorize a Consultify production deploy.

## Verdict and next gate

Provider verdict: `GO_FOR_STAGING_REHEARSAL_ONLY`.

Provider reconciliation is complete. The rehearsal may now provision a fresh staging-only Postgres service, run strict migrations plus replay-zero, deploy the exact candidate SHA, execute the 16 mounted flows, two 60-minute telemetry windows, alert exercise and rollback rehearsal. The old staging database must remain preserved. A green staging result does not authorize production.

## Execution update — 2026-08-20

- Fresh managed staging database `Postgres-Rehearsal-20260820-71316e` was created and kept isolated from the application.
- Candidate migration apply reached `20261038_execution_spine_authority_completion.sql` and failed closed with `execution_spine_backfill_runs has incompatible constraints`.
- Read-only reproduction proved a PostgreSQL 18 compatibility defect: PG18 exposes ten generated `*_not_null` rows in `pg_constraint`, while the frozen migration's exact-name assertion expects only the nine explicitly named constraints.
- The migration transaction rolled back. The application was not rewired or deployed; neither the historical staging database nor production was changed.
- Execution receipt: `docs/program/evidence/closure/decisions/STAGING_REHEARSAL_EXECUTION_20260820.json`.

Current rehearsal verdict: `STOP_MIGRATION_LEDGER` pending a bounded PG18-compatible migration fix and a newly frozen candidate SHA.
