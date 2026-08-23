# Railway and public-demo incident audit — 2026-08-23

Status: `READ_ONLY_RAILWAY_DIAGNOSIS / LOCAL_REALPG_REMEDIATION_PASS / RELEASE_NOT_AUTHORIZED`

## Safety boundary

- Railway inspection was read-only. No deployment, restart, variable change,
  database command, domain change or service mutation was performed.
- Production, staging and demo data were not queried directly.
- All remediation tests used a disposable local PostgreSQL 16 + pgvector
  container and a fail-closed exact-SHA runtime harness.
- The disposable runtime database and container were removed after verification.

## Railway context reconciliation

CLI identity and context were re-read from the repository checkout.

- Project: `consultify` (`a6d59e88-263d-45f3-96bc-861f66bf467b`)
- Workspace: `Piotr Wisniewski's Projects`
- The checkout was **not** linked to a pitchdeck project.
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
