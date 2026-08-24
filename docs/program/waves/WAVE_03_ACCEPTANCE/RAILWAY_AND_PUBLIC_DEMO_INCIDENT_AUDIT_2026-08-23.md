# Railway and public-demo incident audit — 2026-08-23

Status: `READ_ONLY_RAILWAY_DIAGNOSIS / UNSAFE_INHERITED_PARENT_LINK / RELEASE_NOT_AUTHORIZED`

## 2026-08-24 control correction — final candidate inherits Pitchdeck production

This correction supersedes the checkout-link statement in the historical
2026-08-23 checkpoint below. It does not erase that earlier observation.

Read-only inspection from the canonical integration checkout
`/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823`
showed that the checkout has no exact entry in the global Railway CLI project
map. Railway CLI therefore falls back to the mapped parent path
`/Users/piotrwisniewski` and resolves to:

- workspace: `DBR77`;
- project: `Pitchdeck` (`7632d2da-3f45-4ed1-b123-625ea8dbb2e4`);
- environment: `production` (`63cdf6d2-f1c1-4073-9c74-12f4954f1d07`);
- selected service: `Pitchdeck` (`bf3f7b24-79e8-4f62-8016-efbc2e6dfd3b`).

That project also exposes two distinct running PostgreSQL services with ready
volumes. They remain separate unidentified assets and MUST NOT be deleted,
merged, deduplicated, queried or treated as Consultify data without a separate
identity and reconstructibility proof:

- `Postgres` (`7bba7edd-5e54-4aae-b1f1-02b7ffb2a332`), volume approximately
  `1135.58 MB` at inspection time;
- `Postgres-S_aE` (`dece45d4-a648-457e-8b5f-cf1ecc365dd2`), volume
  approximately `1106.39 MB` at inspection time.

No Railway link, variable, service, database, deployment or global CLI config
was changed. No database content was read. This is a context-resolution defect,
not evidence that Pitchdeck data is corrupt or that Consultify data is absent.

### Actual Consultify Railway identity discovered read-only

- workspace: `Piotr Wisniewski's Projects`;
- project: `consultify` (`a6d59e88-263d-45f3-96bc-861f66bf467b`);
- environments: `dev` (`379582b3-63f2-4645-803e-35725104920d`),
  `production` (`39f2f768-2449-48b6-b05e-031cad063cdc`), `staging`
  (`487a33ba-84b0-4e2e-b18b-7f981ae5334d`) and `demo`
  (`a257fce9-33f0-4e10-8e7c-a9cec472f377`);
- services: `Postgres` (`842e4cf0-21af-44e1-9d91-4198b0c18735`), app
  `consultify` (`8f65b820-3d55-4dd9-8076-929d01cc4157`), `Redis`
  (`afcae226-f39e-4280-b624-ba7f720b8d65`), `pgvector`
  (`de81443b-4678-4780-b4d1-742ab36ecd83`) and
  `Postgres-Rehearsal-20260820-71316e`
  (`fc377fcb-2f98-4fb7-b772-932012fd7dd3`).

These identifiers prove discovery only. They do not prove which database is
canonical for any environment, current schema compatibility, tenant identity,
backup completeness or application readback. Every database remains
`IDENTITY_DISCOVERED / CONTENT_NOT_INSPECTED / READBACK_NOT_PROVEN` until its
own controlled gate is passed. The rehearsal database is not presumed to be
the current canonical database.

### Mandatory stop gate

Before ANY future Railway operation from the canonical checkout:

1. prove an exact checkout-path binding rather than a parent-path fallback;
2. prove workspace, project, environment and service IDs with a fresh
   read-only status command;
3. use explicit project/environment/service selectors where the CLI supports
   them;
4. separately prove the intended database, tenant and reconstruction/backup
   boundary before any database access;
5. retain `production = NOT_AUTHORIZED` until Piotr gives a separate explicit
   release authorization.

`railway link` is itself a state change and was not performed during this
audit. Correcting the global CLI map requires a separate authorized control
action.

### Production release-history alert discovered with explicit selectors

An explicit read-only query against the Consultify project and production
environment bypassed the unsafe inherited Pitchdeck context. It showed:

- the active app deployment remains
  `9844648c-4ea9-44c4-80a2-f5a0b15954a0`, `SUCCESS`, created
  `2026-08-14T10:07:32.377Z`;
- the latest app deployment is
  `7e610c66-b9a3-459e-b0f0-404a2fd2ef59`, `FAILED`, created
  `2026-08-24T04:48:42.731Z`, with CLI message
  `trim registry payload and restore landing assets; candidate 19e6b0e3b08a`.

This audit did not initiate that attempt and did not retry, stop, restart or
redeploy anything. The event requires reconciliation with the release ledger
and explicit authorization record. The older active `SUCCESS` deployment is
still returned by Railway, so this failed attempt alone does not prove a
production cutover.

## Safety boundary

- Railway inspection was read-only. No deployment, restart, variable change,
  database command, domain change or service mutation was performed.
- Production, staging and demo data were not queried directly.
- All remediation tests used a disposable local PostgreSQL 16 + pgvector
  container and a fail-closed exact-SHA runtime harness.
- The disposable runtime database and container were removed after verification.

## Historical 2026-08-23 Railway context reconciliation

CLI identity and context were re-read from the repository checkout.

- Project: `consultify` (`a6d59e88-263d-45f3-96bc-861f66bf467b`)
- Workspace: `Piotr Wisniewski's Projects`
- At that historical inspection point, the inspected checkout resolved to
  Consultify rather than Pitchdeck. This observation MUST NOT be generalized to
  another checkout path; the 2026-08-24 canonical integration checkout instead
  inherited the unsafe parent-path Pitchdeck production link documented above.
- `production`, `staging` and `demo` reported the `consultify` service as
  `SUCCESS` at inspection time.
- `dev` reported `CRASHED`; latest deployment
  `d114a04f-02f5-4bd9-90a5-6e0e6b9d1169`, commit
  `bbe5e8d2eca0eb5e25cda052670a270cc482ed0b`, created
  `2026-08-12T07:20:17.643Z`.

### Dev failure classification

Bounded logs show a fail-closed migration identity refusal, not a missing
database:

- 22 already-applied migration files had checksums different from the files in
  that old deployed image;
- readiness refused the schema and the process exited;
- the log explicitly reported `CRITICAL: incomplete schema in production`.

Disposition: `HISTORICAL_DEPLOYMENT_CRASHED / DO_NOT_REDEPLOY_OR_REWRITE_LEDGER`.
Recovery requires a separately frozen candidate plus a non-mutating checksum
reconciliation report before any Railway action.

### Demo runtime finding

The current Railway demo service remained `SUCCESS`, but bounded logs from
`2026-08-22T19:45Z` showed concurrent startup pressure:

- information-schema and outbox reads waited up to about 98 seconds;
- runtime `CREATE TABLE` / `ALTER TABLE` operations overlapped background work;
- one `slack_router_dedupe` insert failed while the database was under that
  pressure;
- migration verification later completed and the service remained running.

Disposition: `SERVICE_RUNNING / STARTUP_DDL_CONTENTION_EVIDENCE / ROOT_ERROR_DETAIL_INCOMPLETE`.
The available Railway log envelope did not retain the database driver's exact
error text for the failed insert, so no narrower causal claim is made.

## Public-demo defects and remediation

### Defect 1 — client auth hydration broke the isolated tenant

Observed before remediation:

- signup provisioned a valid isolated session;
- `/auth/me` returned the base account role/org;
- client hydration replaced the public-demo persona and org;
- navigation reached `/interview` or emitted `DEMO_SESSION_INVALID`.

Remediation commits:

- `83be2ff8e9` — bind the client user to the isolated tenant and preserve the
  demo persona during `/auth/me` hydration;
- `306bff2e0f` — prevent `OrgProvider` from persisting the base demo org as an
  ordinary `x-org-context` tenant-steering header.

### Defect 2 — membership middleware rejected valid demo reads

Exact-SHA reproduction on `c9036b0a957883c8aa4cb5266c93fb12ba08c40c`:

| Endpoint | Before | Code |
|---|---:|---|
| `/api/organization-context` | 403 | `ORG_MEMBERSHIP_REVOKED` |
| `/api/my-work/personal-tasks` | 403 | `ORG_MEMBERSHIP_REVOKED` |
| `/api/conversations` | 403 | `ORG_MEMBERSHIP_REVOKED` |
| `/api/chat-projects` | 403 | `ORG_MEMBERSHIP_REVOKED` |

Root cause: the token middleware correctly resolved the server-owned active
`demo_sessions.session_org_id`, but `validateOrgMembership` then demanded an
`organization_members` row. Session tenants deliberately have no such row.

Remediation commit `3a40a255f3` records the active session authority in a
module-private `WeakMap<Request, ActiveDemoSession>` and bypasses the ordinary
membership lookup only when the exact request and exact resolved session org
match. No header or request body can create this proof.

### Exact-SHA RealPG acceptance

Candidate: `3a40a255f31399ed620d37ec8566d7b42228c9c0`

- clean dirty fingerprint: SHA-256 of empty input;
- health / ready / frontend: `200 / 200 / 200`;
- migrations: `829`, SQL and runtime migration state `ok`;
- test auth/support/gateway bypasses: all `false`;
- public registration: 200, role `CONSULTANT`, isolated session org issued;
- nine authenticated read probes: 9/9 HTTP 200;
- forbidden initiative write: HTTP 403 `DEMO_READ_ONLY`;
- browser: landing -> signup -> `/chat`, Demo Mode, Atelier Toys, 7 projects,
  22 initiatives, full consultant navigation and Teresa welcome visible;
- no `DEMO_SESSION_INVALID` surfaced in the final replay.

Unit evidence: `tests/unit/backend/middleware/auth.middleware.test.ts` —
178/178 PASS. Root TypeScript check: PASS.

The broad SQLite public-entry suite was **not** counted as evidence: its process
inherited an unrelated local `DATABASE_URL` and connected to `iris_test`, making
registration return 503. The exact named RealPG replay above is the qualified
acceptance evidence.

## Fresh-PostgreSQL schema convergence

The strict PostgreSQL baseline and runtime bootstrap define different shapes
for `subscription_plans` and `webhooks`. In a baseline-first startup, the
runtime `CREATE TABLE IF NOT EXISTS` statements cannot add the columns used by
Billing, Revenue, and `WebhookService`. This explained the startup diagnostics
for missing `subscription_plans.is_active` and `webhooks.created_by`; the latter
is a live write field, not a stale index-only artifact.

Migration `20260823_billing_webhooks_schema_convergence.sql` additively repairs
both creation orders. Local disposable RealPG evidence:

- canonical strict chain: 830/830 migrations completed;
- `subscription_plans`: all live billing metadata columns present and a full
  plan insert/readback passed;
- `webhooks`: all `WebhookService` write columns present, a tenant-bound
  insert/readback passed, and `idx_webhooks_creator` exists;
- a webhook insert against a nonexistent organization was rejected by the
  foreign key as expected;
- 27/27 focused schema-contract tests passed and root TypeScript check passed;
- disposable container and test database removed after verification.

## Remaining gates

- Railway `dev` recovery: `NOT_AUTHORIZED`; requires candidate/ledger decision.
- Railway demo restart or deployment: `NOT_AUTHORIZED`.
- Direct Railway database reconciliation/backup proof: `NOT_PERFORMED`.
- Full Wave 3 owner acceptance: `PENDING`.
- Remaining 82-task denominator: unchanged until each task's own closure
  contract is proven and the canonical plan is updated.
