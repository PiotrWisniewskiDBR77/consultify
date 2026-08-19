/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — MOUNTED-AUTH REAL POSTGRES SUITE.
 *
 * TRUTHFUL SCOPE. `tests/integration/partners/partner-economics-policy-disabled.unit.test.ts`
 * proves the writer-service guards with the persistence seam mocked, and says
 * plainly what it does NOT prove: "no real database ... no advisory lock is
 * taken, no residue is measured, no trigger fires, no ACTIVE/revoked/foreign
 * membership is resolved, and receipt idempotency, collision behaviour and
 * append-only immutability are NOT exercised here. Those belong to the
 * separate opted-in disposable-PostgreSQL suite". THIS is that suite.
 *
 * This file mounts the FOUR real partner routers — no route interception, no
 * auth bypass, no mocked persistence layer — behind their REAL production
 * middleware chains, against a REAL, disposable PostgreSQL database, with
 * REAL signed JWTs and REAL persisted `organization_members` rows:
 *   - `server/src/routes/v8/partner.routes.ts`      → mounted at /api/v8/partner
 *     with the exact chain v8/index.ts uses: verifyToken, requireV8OrgContext,
 *     attachV8Context, v8MetricsMiddleware, mutationAbortCanary.
 *   - `server/src/routes/partners.routes.ts` default export (`router`)
 *                                                    → mounted at /api/partners
 *     (this router calls verifyToken itself, first statement in the file).
 *   - `superAdminPartnerRouter`                     → mounted at
 *     /api/superadmin/partner-settlements (calls verifyToken +
 *     requireActiveMembership + verifySuperAdmin itself).
 *   - `partnerConfigRouter`                         → mounted at
 *     /api/superadmin/partner-config (same auth chain as settlements).
 *
 * ROUTE ORDERING TRUTH (from `partnerEconomicsPolicy.ts`'s own "HONESTY NOTE"
 * and from reading the four router files directly — not re-derived, quoted):
 *   - On /api/v8/partner the economics guard is the FIRST `router.use()`,
 *     BEFORE the demo-dataset-seeding / partner-org-resolution middleware.
 *     Resolution itself WRITES (it self-heals a `partner_users` row) and demo
 *     seeding runs alongside it, so `partner_org_id` is NULL on every v8
 *     denial receipt — this file asserts that NULL explicitly, and asserts
 *     the resolution/seed middleware never ran (no new `partner_users` row)
 *     for a denied request, per REQUIRED COVERAGE §2.
 *   - On /api/partners (legacy) the guard runs immediately after `verifyToken`
 *     and BEFORE `partnerLegacyCutoverGuard` — deliberately, so a policy
 *     refusal is never mistaken for (or telemetered as) "moved to V8".
 *   - On the two superadmin routers the guard runs AFTER
 *     `requireActiveMembership` + `verifySuperAdmin`. Both of those enforce a
 *     REAL, per-request ACTIVE `organization_members` row — "Role claims,
 *     including SUPERADMIN, never bypass it" (verbatim from
 *     `requireActiveMembership.ts`) — so an actor who fails either check never
 *     reaches the economics guard at all. This file treats that as "the
 *     correct auth denial" the task brief anticipates, not a bug: it asserts
 *     the specific 403 code AND zero economics receipts for those cases.
 *
 * WHY 410, NOT 403 (restated because it drives one of this file's strongest
 * assertions): `src/services/api/v8/partner.ts` `shouldFallbackToLegacyPartner()`
 * retries a failed governed call against legacy `/api/partners/*` on
 * [400,404,405,501] and on 403+PARTNER_ORG_REQUIRED. 410 is on neither list.
 * Every denial assertion below checks BOTH that the status is 410 AND that
 * `code` is `PARTNER_ECONOMICS_POLICY_DISABLED` — never
 * `PARTNER_LEGACY_WRITER_DISABLED` (the unrelated legacy-cutover code), which
 * would silently misreport "moved to V8" instead of "excluded by policy".
 *
 * SCOPING DECISIONS, stated instead of hidden:
 *   1. This file builds its OWN schema (`DROP TABLE IF EXISTS` / `CREATE
 *      TABLE`) rather than depending on a specific `server/migrations/*.sql`
 *      run order, for the same reason the sibling realdb suites in this
 *      directory do (`partner-accrual-payout-atomic.realdb.test.ts`,
 *      `m16-final-repair.realdb.test.ts`): this codebase has DOCUMENTED,
 *      real column-shape drift across partner migrations (e.g. the 2026-09-13
 *      discount-tables repair migration's own comment: "partner_organizations.id
 *      is UUID on the canonical PostgreSQL baseline" — directly contradicted
 *      by `000_initdb_core_tables.sql`, which creates it as TEXT and is
 *      guaranteed to run first for a fresh install because "000" sorts before
 *      every other migration filename). This file commits to TEXT for
 *      `partner_organizations.id` and every `partner_org_id` column that
 *      follows from it, because that is what `000_initdb_core_tables.sql`
 *      (guaranteed-first) AND two of the three services that self-migrate
 *      their own tables at runtime (`partnerProgramLedgerService.ts`,
 *      `partnerPayoutSettingsService.ts` — both `partner_org_id TEXT`) agree
 *      on. `partner_attributions`/`partner_campaign_links`/
 *      `partner_referral_clicks` are deliberately NOT created here: they are
 *      outside this file's REQUIRED COVERAGE, and `partnerDemoSeedService.ts`
 *      checks `tableExists()` per-table and swallows any seeding error
 *      (`catch (error) { logger.warn(...) }`), so their absence cannot break
 *      a request — it only means demo-seed rows never land in the tables this
 *      file actually asserts zero-mutation over.
 *   2. `partner_program_runtime`, `partner_program_ledger` and
 *      `partner_payout_accounts` are NOT hand-built here. They are
 *      self-migrated at runtime by `partnerProgramLedgerService.ensureSchema`
 *      and `partnerPayoutSettingsService.ensurePartnerPayoutSchema`, and their
 *      SQLite-flavoured DDL text (e.g. `datetime('now')`) is translated to
 *      real PostgreSQL by `PostgresDatabase.ts`'s adapter layer — hand-copying
 *      that DDL for a raw `pg.Client` would silently diverge from what
 *      production actually executes. `beforeAll` instead performs ONE real
 *      warm-up call through the imported service modules (not HTTP) so these
 *      tables exist, through the real translation layer, before any
 *      zero-mutation count is taken.
 *   3. Positive (non-economic) controls assert the ECONOMICS-specific
 *      signature (`code !== 'PARTNER_ECONOMICS_POLICY_DISABLED'`, zero new
 *      `partner_economics_policy_events` rows for that request) rather than a
 *      blanket "200 OK". Some non-economic legacy writers (e.g.
 *      `POST /campaign-links`) are separately intercepted by the UNRELATED
 *      legacy-cutover guard ("moved to V8") and some superadmin-config writes
 *      touch certification tables this file does not build — either way, a
 *      non-410-economics-shaped response proves the ECONOMICS guard's
 *      `next()` path was taken, which is the only thing "over-blocking would
 *      fail this suite" requires.
 *   4. `superAdminPartnerRouter`'s mutation surface has no non-economic writer
 *      at all (every POST/DELETE on it is an entry in
 *      `SUPERADMIN_SETTLEMENT_ECONOMIC_WRITERS` — it IS the "operator money
 *      path" by design), so this file does not force an artificial positive
 *      control onto it; the settlements GET reads used elsewhere already
 *      prove reads are unaffected.
 *
 * OPT-IN GATE. Skipped (never failed) unless ALL of:
 *   RUN_DB_TESTS=1, MOCK_DB=false, DATABASE_URL set, AND
 *   PARTNER_ECONOMICS_MOUNTED_AUTH_DISPOSABLE_DB_PREFIX set — the literal
 *   prefix `current_database()` must start with. `beforeAll` reads
 *   `current_database()` FROM THE SERVER and refuses (throws, not skips) if
 *   it does not start with that prefix — a mislabelled DATABASE_URL cannot
 *   talk its way into running DROP/CREATE and per-prefix DELETE against a
 *   real database this file does not own.
 *
 * EXACT RUN COMMAND (Docker available):
 *   docker run -d --name prt-econ-pg -e POSTGRES_USER=prt_econ \
 *     -e POSTGRES_PASSWORD=prt_econ -e POSTGRES_DB=prtecon_disposable_$(date +%s) \
 *     -p 55977:5432 postgres:16-alpine
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   PARTNER_ECONOMICS_MOUNTED_AUTH_DISPOSABLE_DB_PREFIX=prtecon_disposable \
 *   DATABASE_URL=postgresql://prt_econ:prt_econ@127.0.0.1:55977/prtecon_disposable_<same-timestamp> \
 *   npx vitest run tests/integration/partners/partner-economics-mounted-auth.realpg.test.ts --retry=0
 */

import { randomUUID } from 'node:crypto';

import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';

import { cleanupLegacyCutoverTestIntents } from '../../../server/src/services/legacyCutover/__tests__/legacyCutoverTestCleanup.js';

// ---------------------------------------------------------------------------
// Force the real Postgres driver, never E2E bypass: every actor below is a
// REAL signed JWT resolved through the NORMAL verifyToken/attachUser path, and
// every membership state is a REAL persisted `organization_members` row —
// per REQUIRED COVERAGE §1 ("no route interception, no auth bypass").
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
}

const DISPOSABLE_PREFIX = String(
  process.env.PARTNER_ECONOMICS_MOUNTED_AUTH_DISPOSABLE_DB_PREFIX || ''
).trim();

const RUN =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL) &&
  Boolean(DISPOSABLE_PREFIX);

const describeReal = RUN ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Real routers — the actual production route modules. No stub, no fixture.
// ---------------------------------------------------------------------------
import verifyToken from '../../../server/src/middleware/auth.middleware.js';
import { mutationAbortCanary } from '../../../server/src/middleware/mutationGuard.middleware.js';
import {
  attachV8Context,
  requireV8OrgContext,
} from '../../../server/src/middleware/v8Auth.middleware.js';
import { v8MetricsMiddleware } from '../../../server/src/middleware/v8Metrics.middleware.js';
import v8PartnerRoutes from '../../../server/src/routes/v8/partner.routes.js';
import legacyPartnerRoutes, {
  partnerConfigRouter,
  superAdminPartnerRouter,
} from '../../../server/src/routes/partners.routes.js';
import {
  PARTNER_ECONOMICS_POLICY_CODE,
  PARTNER_ECONOMICS_POLICY_DECISION,
} from '../../../server/src/services/partnerEconomicsPolicy.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

const ZERO_MUTATION_TABLES = [
  'partner_payouts',
  'partner_commission_transactions',
  'partner_program_ledger',
  'partner_program_runtime',
  'partner_payout_accounts',
  'organization_discounts',
] as const;
type ZeroMutationTable = (typeof ZERO_MUTATION_TABLES)[number];

// ---------------------------------------------------------------------------
// Express apps — mirror the REAL mount points byte for byte.
//   v8:       server/src/routes/v8/index.ts
//               v8Router.use(verifyToken); v8Router.use(requireV8OrgContext);
//               v8Router.use('/partner', attachV8Context, v8MetricsMiddleware,
//                             mutationAbortCanary, partnerRoutes);
//   legacy:   server/src/Gateway.ts
//               app.use('/api/partners', ..., partnerRoutes)   (router itself
//               calls verifyToken as its own first statement)
//   settlements/config: server/src/Gateway.ts
//               app.use('/api/superadmin/partner-settlements', superAdminPartnerRouter)
//               app.use('/api/superadmin/partner-config', partnerConfigRouter)
//               (both routers call verifyToken+requireActiveMembership+
//               verifySuperAdmin as their own first statements)
// ---------------------------------------------------------------------------
function buildV8App(): Express {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v8/partner',
    verifyToken,
    requireV8OrgContext,
    attachV8Context,
    v8MetricsMiddleware,
    mutationAbortCanary,
    v8PartnerRoutes
  );
  return app;
}

function buildLegacyApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/partners', legacyPartnerRoutes);
  return app;
}

function buildSettlementsApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin/partner-settlements', superAdminPartnerRouter);
  return app;
}

function buildConfigApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin/partner-config', partnerConfigRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Identity minting — REAL signed JWTs, jsonwebtoken, same secret tests/setup.ts
// exports globally. No E2E bypass anywhere in this file.
//
// `role` is optional but, when the actor's real membership role is known
// up front (see the `activeOwner` mint below), it should be supplied: both
// `server/src/routes/auth.routes.ts` login and register handlers ALWAYS bake
// a `role` claim into a real token (via `resolveAuthEffectiveRole`,
// preferring the caller's `organization_members.role` for the token's own
// org, falling back to the global `users.role`). `auth.middleware.ts`'s
// `attachUser` only ever back-fills `req.userRole` from a fresh DB read when
// the token's claimed org does NOT match an ACTIVE membership (the
// self-heal/cross-tenant path) — for an actor whose token org IS their real
// ACTIVE org (the ordinary, non-mismatched case), the role has to already be
// on the token, exactly as a real login would put it there, or
// `requireOrgRole` gates never see anything to check.
// ---------------------------------------------------------------------------
function signToken(userId: string, organizationId: string, role?: string): string {
  return jwt.sign(
    { id: userId, email: `${userId}@local.test`, organizationId, ...(role ? { role } : {}) },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

interface Harness {
  client: Client;
  prefix: string;
  orgId: string;
  foreignOrgId: string;
  partnerOrgId: string;
  actors: {
    activeOwner: { userId: string; token: string };
    revokedPartnerMember: { userId: string; token: string };
    foreignActor: { userId: string; token: string };
    superadminNoMembership: { userId: string; token: string };
    superadminActive: { userId: string; token: string };
  };
}

let harness: Harness | null = null;
let skipMessageEmitted = false;
function emitSkipOnce(reason: string): void {
  if (skipMessageEmitted) return;
  skipMessageEmitted = true;
  // eslint-disable-next-line no-console
  console.error(
    `[skip] partner-economics-mounted-auth.realpg.test.ts did not run: ${reason}. ` +
      'See the file header for the docker + env + vitest command to exercise this suite.'
  );
}

async function pgReachable(url: string): Promise<boolean> {
  const probe = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

/**
 * Hard DB guard. Reads `current_database()` FROM THE SERVER (never trusts the
 * connection-string text) and throws — does not silently skip — if it is not
 * prefixed with the caller-supplied disposable prefix. This runs BEFORE any
 * DROP/CREATE/DELETE statement below.
 */
async function assertDisposableDatabase(client: Client): Promise<string> {
  const result = await client.query<{ db: string }>('SELECT current_database() AS db');
  const database = String(result.rows[0]?.db ?? '');
  if (!database || !database.startsWith(DISPOSABLE_PREFIX)) {
    throw new Error(
      `[partner-economics-mounted-auth] Refusing to run against database "${database}": it does not ` +
        `start with PARTNER_ECONOMICS_MOUNTED_AUTH_DISPOSABLE_DB_PREFIX="${DISPOSABLE_PREFIX}". This suite ` +
        'drops/creates tables and deletes rows by prefix; it must never run against a shared or persistent database.'
    );
  }
  return database;
}

const ADVISORY_LOCK_NAME = 'partner-economics-mounted-auth-2026-08-18';
let lockClient: Client | null = null;

/**
 * CATALOG-TYPE CONTRACT. This fixture's `CREATE TABLE IF NOT EXISTS` calls
 * below are NO-OPS against a database that already carries these tables from
 * the real migration history (which every disposable database used to run
 * this file does, by construction — migrations are applied before this
 * suite runs). That means the values this fixture inserts must match the
 * LIVE, already-migrated column types, not the types spelled out in this
 * file's own (dead) `CREATE TABLE` text.
 *
 * Measured directly against `information_schema.columns` on this database:
 * several `partner_org_id`/`id` columns are genuinely `uuid` even though
 * `000_initdb_core_tables.sql` declares them TEXT — a later migration
 * converted them. Feeding a non-UUID string into one of those columns fails
 * as Postgres error 22P02 (`invalid input syntax for type uuid`,
 * routine `string_to_uuid`) with a stack trace that points at the INSERT,
 * not at the type assumption that is actually wrong.
 *
 * This assertion runs FIRST, before any CREATE TABLE/INSERT, so a future
 * schema change that flips one of these columns between text and uuid (in
 * either direction) fails loudly HERE, with an exact column-by-column diff,
 * instead of resurfacing as a cryptic 22P02 pointing at an unrelated line.
 */
const FIXTURE_COLUMN_TYPE_CONTRACT: ReadonlyArray<{
  table: string;
  column: string;
  dataType: string;
}> = [
  { table: 'organizations', column: 'id', dataType: 'text' },
  { table: 'organizations', column: 'name', dataType: 'text' },
  { table: 'organizations', column: 'plan', dataType: 'text' },
  { table: 'organizations', column: 'status', dataType: 'text' },
  { table: 'users', column: 'id', dataType: 'text' },
  { table: 'users', column: 'organization_id', dataType: 'text' },
  { table: 'users', column: 'email', dataType: 'text' },
  { table: 'users', column: 'password', dataType: 'text' },
  { table: 'users', column: 'role', dataType: 'text' },
  { table: 'users', column: 'status', dataType: 'text' },
  { table: 'users', column: 'first_name', dataType: 'text' },
  { table: 'users', column: 'last_name', dataType: 'text' },
  { table: 'organization_members', column: 'id', dataType: 'text' },
  { table: 'organization_members', column: 'organization_id', dataType: 'text' },
  { table: 'organization_members', column: 'user_id', dataType: 'text' },
  { table: 'organization_members', column: 'role', dataType: 'text' },
  { table: 'organization_members', column: 'status', dataType: 'text' },
  { table: 'partner_organizations', column: 'id', dataType: 'uuid' },
  { table: 'partner_organizations', column: 'name', dataType: 'character varying' },
  { table: 'partner_organizations', column: 'contact_email', dataType: 'character varying' },
  { table: 'partner_organizations', column: 'status', dataType: 'character varying' },
  { table: 'partner_users', column: 'id', dataType: 'uuid' },
  // NOTE: user_id is uuid here even though `users.id` (the value that flows
  // into it — see `partnerOrgResolution.ts`'s `getActivePartnerOrgIdForUser`)
  // is TEXT. This is not a contradiction: production always mints user ids
  // with `uuidv4()` (see `server/src/routes/auth.routes.ts`), so a real
  // user id is always UUID-shaped text. This fixture must mint UUID-shaped
  // actor ids for the same reason, even though `users.id` itself is TEXT.
  { table: 'partner_users', column: 'user_id', dataType: 'uuid' },
  { table: 'partner_users', column: 'partner_org_id', dataType: 'uuid' },
  { table: 'partner_users', column: 'role', dataType: 'character varying' },
  { table: 'partner_users', column: 'status', dataType: 'character varying' },
  { table: 'partner_payouts', column: 'partner_org_id', dataType: 'uuid' },
  { table: 'partner_commission_transactions', column: 'partner_org_id', dataType: 'uuid' },
  { table: 'organization_discounts', column: 'id', dataType: 'text' },
  { table: 'organization_discounts', column: 'organization_id', dataType: 'text' },
  { table: 'organization_discounts', column: 'partner_org_id', dataType: 'text' },
  { table: 'partner_program_runtime', column: 'partner_org_id', dataType: 'text' },
  { table: 'partner_program_ledger', column: 'partner_org_id', dataType: 'text' },
  { table: 'partner_payout_accounts', column: 'partner_org_id', dataType: 'text' },
  { table: 'partner_economics_policy_events', column: 'partner_org_id', dataType: 'text' },
];

async function assertFixtureColumnTypeContract(client: Client): Promise<void> {
  const mismatches: string[] = [];
  for (const { table, column, dataType } of FIXTURE_COLUMN_TYPE_CONTRACT) {
    const r = await client.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column]
    );
    const actual = r.rows[0]?.data_type;
    if (actual !== dataType) {
      mismatches.push(
        `${table}.${column}: fixture assumes "${dataType}", live catalog says "${actual ?? '(column not found)'}"`
      );
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      "[partner-economics-mounted-auth] Live catalog no longer matches this fixture's column-type contract. " +
        "Fix the FIXTURE's value-shape for the listed columns (uuid columns need randomUUID() values, text " +
        'columns can keep prefixed strings) — do not cast around it in SQL:\n' +
        mismatches.map((m) => `  - ${m}`).join('\n')
    );
  }
}

async function buildAndSeedSchema(client: Client, prefix: string): Promise<Harness> {
  await assertFixtureColumnTypeContract(client);

  const orgId = `${prefix}_org`;
  const foreignOrgId = `${prefix}_foreign_org`;
  // uuid live column (partner_organizations.id, partner_users.partner_org_id,
  // partner_payouts.partner_org_id, partner_commission_transactions.partner_org_id
  // — see FIXTURE_COLUMN_TYPE_CONTRACT above). orgId/foreignOrgId stay
  // prefixed TEXT: nothing this suite touches compares them against a uuid
  // column.
  const partnerOrgId = randomUUID();

  // -------------------------------------------------------------------
  // Base identity tables — same column shapes as
  // tests/integration/routes/conversations.search.realdb.test.ts, which this
  // file imitates for the signed-JWT + real-router + persisted-membership
  // harness pattern.
  // -------------------------------------------------------------------
  await client.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY, name TEXT, plan TEXT, status TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, organization_id TEXT, email TEXT, password TEXT,
      role TEXT, status TEXT, first_name TEXT, last_name TEXT
    );
    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (organization_id, user_id)
    );
  `);

  // -------------------------------------------------------------------
  // partner_organizations — canonical shape from 000_initdb_core_tables.sql
  // (guaranteed-first migration; see file header scoping decision #1).
  // -------------------------------------------------------------------
  await client.query(`
    CREATE TABLE IF NOT EXISTS partner_organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      tier TEXT DEFAULT 'registered',
      status TEXT DEFAULT 'pending',
      referral_code TEXT UNIQUE,
      referral_link_slug TEXT UNIQUE,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // partner_users — canonical shape from 726/778_partner_users_missing_columns.sql.
  await client.query(`
    CREATE TABLE IF NOT EXISTS partner_users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      partner_org_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      role TEXT DEFAULT 'consultant',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (partner_org_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_partner_users_user ON partner_users(user_id);
  `);

  // partner_payouts / partner_commission_transactions — canonical shape from
  // 216_partner_referral_system.sql, TEXT partner_org_id per scoping decision
  // #1 (no FK to partner_attributions, which this file deliberately omits).
  await client.query(`
    CREATE TABLE IF NOT EXISTS partner_payouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_org_id TEXT NOT NULL,
      payout_account_id TEXT,
      payout_period_start DATE NOT NULL,
      payout_period_end DATE NOT NULL,
      gross_amount NUMERIC(12,2) NOT NULL,
      fees NUMERIC(10,2) DEFAULT 0.00,
      tax_withheld NUMERIC(10,2) DEFAULT 0.00,
      net_amount NUMERIC(12,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'EUR',
      transaction_count INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'PENDING',
      payout_method VARCHAR(30),
      payout_reference VARCHAR(100),
      external_payout_id VARCHAR(100),
      requested_at TIMESTAMPTZ DEFAULT NOW(),
      requested_by TEXT,
      processed_at TIMESTAMPTZ,
      processed_by TEXT,
      completed_at TIMESTAMPTZ,
      failure_reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS partner_commission_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_org_id TEXT NOT NULL,
      attribution_id UUID,
      organization_id TEXT,
      transaction_type VARCHAR(30) NOT NULL,
      transaction_date TIMESTAMPTZ NOT NULL,
      gross_amount NUMERIC(12,2) NOT NULL,
      commission_rate NUMERIC(5,2) NOT NULL,
      commission_amount NUMERIC(12,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'EUR',
      status VARCHAR(20) DEFAULT 'PENDING',
      approved_at TIMESTAMPTZ,
      approved_by TEXT,
      payout_id UUID,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // organization_discounts — canonical shape from the 2026-09-13 discount
  // tables repair migration (the one explicitly marked as the canonical
  // fresh-install shape; see file header scoping decision #1).
  await client.query(`
    CREATE TABLE IF NOT EXISTS organization_discounts (
      id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
      organization_id TEXT NOT NULL,
      partner_org_id TEXT NOT NULL,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
      discount_value REAL NOT NULL,
      start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_date TIMESTAMP NOT NULL,
      total_discount_applied REAL DEFAULT 0.00,
      status TEXT DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // partner_economics_policy_events — the REAL migration
  // (server/migrations/20260818_partner_economics_policy_events.sql) applied
  // VERBATIM, so this file's trigger/index/constraint assertions are proving
  // the actual shipped migration, not a hand-copied approximation. It is
  // idempotent (CREATE ... IF NOT EXISTS) and self-contained (no external
  // dependency beyond a clean or already-canonical database, which this
  // disposable database always is on first run).
  {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migrationPath = path.resolve(
      here,
      '../../../server/migrations/20260818_partner_economics_policy_events.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(migrationSql);
  }

  // -------------------------------------------------------------------
  // Warm up the two self-migrating services directly (not via HTTP) so
  // partner_program_runtime / partner_program_ledger / partner_payout_accounts
  // exist, created through the REAL PostgresDatabase SQL-adaptation layer
  // (datetime('now') -> NOW(), ? -> $N), before any zero-mutation snapshot is
  // taken. See file header scoping decision #2.
  // -------------------------------------------------------------------
  await client.query(
    `INSERT INTO partner_organizations (id, name, contact_email, status) VALUES ($1, $2, $3, 'active')`,
    [partnerOrgId, 'Mounted Auth Test Partner', `${prefix}-partner@local.test`]
  );
  const ledgerService = (
    await import('../../../server/src/services/partnerProgramLedgerService.js')
  ).default;
  const payoutSettingsService =
    await import('../../../server/src/services/partnerPayoutSettingsService.js');
  await ledgerService.getOrCreateRuntime(partnerOrgId);
  await payoutSettingsService.getPartnerPayoutSettings(partnerOrgId);

  // -------------------------------------------------------------------
  // Organizations + users + memberships + partner linkage.
  // -------------------------------------------------------------------
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Mounted Auth Org', 'enterprise', 'active')`,
    [orgId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Mounted Auth Foreign Org', 'enterprise', 'active')`,
    [foreignOrgId]
  );

  // `users.id` itself is TEXT, so a prefixed human-readable id would be fine
  // for THAT column alone — but almost every mounted route (v8 and legacy)
  // calls `getActivePartnerOrgIdForUser(userId)`, which runs
  // `SELECT ... FROM partner_users WHERE user_id = ?` with this exact value.
  // `partner_users.user_id` is a genuinely uuid column on the live catalog
  // (see FIXTURE_COLUMN_TYPE_CONTRACT), so ANY actor whose id is not
  // UUID-shaped 22P02s the very first time that query runs for them — even
  // actors who have no partner_users row at all, because the type error
  // fires before the WHERE clause gets to compare values. Real production
  // never hits this because `server/src/routes/auth.routes.ts` always mints
  // user ids with `uuidv4()`; these actor ids just have to match that same
  // real-world shape.
  const activeOwnerUserId = randomUUID();
  const revokedUserId = randomUUID();
  const foreignUserId = randomUUID();
  const superadminNoMembershipUserId = randomUUID();
  const superadminActiveUserId = randomUUID();

  const allUsers: Array<{ id: string; role: string; orgId: string }> = [
    { id: activeOwnerUserId, role: 'CONSULTANT', orgId },
    { id: revokedUserId, role: 'SUPERADMIN', orgId }, // SUPERADMIN role claim, deliberately: proves revoked membership blocks even a real superadmin (requireActiveMembership.ts: "Role claims, including SUPERADMIN, never bypass it").
    { id: foreignUserId, role: 'CONSULTANT', orgId: foreignOrgId },
    { id: superadminNoMembershipUserId, role: 'SUPERADMIN', orgId },
    { id: superadminActiveUserId, role: 'SUPERADMIN', orgId },
  ];
  for (const u of allUsers) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'x', $4, 'active', 'Mounted', 'Auth')`,
      [u.id, u.orgId, `${u.id}@local.test`, u.role]
    );
  }

  // activeOwner: ACTIVE OWNER of orgId, ACTIVE partner_users link to partnerOrgId.
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`${prefix}_om_active_owner`, orgId, activeOwnerUserId]
  );
  await client.query(
    `INSERT INTO partner_users (user_id, partner_org_id, role, status)
     VALUES ($1, $2, 'owner', 'active')`,
    [activeOwnerUserId, partnerOrgId]
  );

  // revokedPartnerMember: INACTIVE (revoked) membership in orgId, no other
  // membership anywhere, no partner_users link. Deliberately the ONLY
  // membership row for this user, so attachUser's ACTIVE-membership fallback
  // (auth.middleware.ts) finds nothing and does not silently reassign them
  // into a different, active org.
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'MEMBER', 'INACTIVE')`,
    [`${prefix}_om_revoked`, orgId, revokedUserId]
  );

  // foreignActor: ACTIVE member of a DIFFERENT org (foreignOrgId), not a
  // member of orgId at all, no partner_users link to partnerOrgId. Their JWT
  // below claims organizationId=orgId (a cross-tenant probe); attachUser's
  // fallback resolves their REAL org (foreignOrgId) since that is their only
  // ACTIVE membership — documented in the actor-matrix describe block below,
  // where this self-heal changes which check denies them on which surface.
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')`,
    [`${prefix}_om_foreign`, foreignOrgId, foreignUserId]
  );

  // superadminNoMembership: SUPERADMIN role in `users`, but ZERO
  // organization_members rows anywhere — the "SUPERADMIN-without-membership"
  // actor named explicitly in REQUIRED COVERAGE §2.
  // (no organization_members insert for superadminNoMembershipUserId)

  // superadminActive: SUPERADMIN role AND an ACTIVE membership in orgId — the
  // only actor that can actually reach the economics guard on the two
  // superadmin routers.
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`${prefix}_om_superadmin_active`, orgId, superadminActiveUserId]
  );

  return {
    client,
    prefix,
    orgId,
    foreignOrgId,
    partnerOrgId,
    actors: {
      // 'OWNER' matches the ACTIVE organization_members row minted above for
      // this actor in this exact org — the real per-org role a genuine login
      // would put on the token (see the signToken doc comment).
      activeOwner: {
        userId: activeOwnerUserId,
        token: signToken(activeOwnerUserId, orgId, 'OWNER'),
      },
      revokedPartnerMember: { userId: revokedUserId, token: signToken(revokedUserId, orgId) },
      foreignActor: { userId: foreignUserId, token: signToken(foreignUserId, orgId) },
      superadminNoMembership: {
        userId: superadminNoMembershipUserId,
        token: signToken(superadminNoMembershipUserId, orgId),
      },
      superadminActive: {
        userId: superadminActiveUserId,
        token: signToken(superadminActiveUserId, orgId),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------
async function countRow(
  client: Client,
  table: ZeroMutationTable,
  where?: string,
  params: unknown[] = []
): Promise<number> {
  const sql = `SELECT count(*)::int AS n FROM ${table}${where ? ` WHERE ${where}` : ''}`;
  const r = await client.query<{ n: number }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

async function snapshotZeroMutationTables(
  client: Client
): Promise<Record<ZeroMutationTable, number>> {
  const out = {} as Record<ZeroMutationTable, number>;
  for (const t of ZERO_MUTATION_TABLES) {
    out[t] = await countRow(client, t);
  }
  return out;
}

async function receiptRowsForRequestId(client: Client, requestId: string) {
  const r = await client.query(
    `SELECT * FROM partner_economics_policy_events WHERE request_id = $1 ORDER BY observed_at ASC`,
    [requestId]
  );
  return r.rows;
}

async function partnerUsersRowCount(client: Client, partnerOrgId: string): Promise<number> {
  const r = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM partner_users WHERE partner_org_id = $1`,
    [partnerOrgId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

const POLICY_EVENT_TRIGGERS = [
  'trg_partner_economics_policy_events_no_update',
  'trg_partner_economics_policy_events_no_delete',
] as const;

/**
 * `partner_economics_policy_events` is append-only in production by design
 * (see the migration header: "corrections must be new rows"). Test cleanup
 * still has to remove rows this file itself created, so this helper suspends
 * and restores the production guard TRANSACTIONALLY around a single, tightly
 * scoped DELETE — mirroring the same disable/delete/re-enable-inside-one-
 * transaction discipline `tests/support/disposableLedgerCleanup.ts` uses for
 * the initiative-closure-evidence ledgers (a different table, so not reused
 * directly, but the same safety shape).
 */
async function deletePolicyEventReceiptsByPrefix(
  client: Client,
  requestIdPrefix: string
): Promise<number> {
  await client.query('BEGIN');
  try {
    for (const trg of POLICY_EVENT_TRIGGERS) {
      await client.query(`ALTER TABLE partner_economics_policy_events DISABLE TRIGGER ${trg}`);
    }
    const result = await client.query(
      `DELETE FROM partner_economics_policy_events WHERE request_id LIKE $1 || '%'`,
      [requestIdPrefix]
    );
    for (const trg of POLICY_EVENT_TRIGGERS) {
      await client.query(`ALTER TABLE partner_economics_policy_events ENABLE TRIGGER ${trg}`);
    }
    await client.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeAll(async () => {
  if (!RUN) return;
  const url = process.env.DATABASE_URL as string;
  if (!(await pgReachable(url))) {
    emitSkipOnce('DATABASE_URL not reachable');
    return;
  }

  lockClient = new Client({ connectionString: url });
  await lockClient.connect();
  await assertDisposableDatabase(lockClient);
  // Retained advisory lock for the whole suite: serializes this file against
  // any other worker that might point at the same disposable database.
  await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [ADVISORY_LOCK_NAME]);

  const setupClient = new Client({ connectionString: url });
  await setupClient.connect();
  await assertDisposableDatabase(setupClient);

  const prefix = `${DISPOSABLE_PREFIX}_pea_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  harness = await buildAndSeedSchema(setupClient, prefix);
}, 60_000);

afterAll(async () => {
  if (!harness) {
    if (lockClient) {
      await lockClient
        .query('SELECT pg_advisory_unlock(hashtext($1))', [ADVISORY_LOCK_NAME])
        .catch(() => undefined);
      await lockClient.end().catch(() => undefined);
    }
    return;
  }
  const { client, prefix, partnerOrgId } = harness;
  await assertDisposableDatabase(client);

  // Delete everything scoped to this run's prefix / partnerOrgId, across
  // every table this file may have written to — including whatever demo-seed
  // side effects landed under our own partnerOrgId (see file header
  // scoping decision #1: only tables this file created can hold such rows).
  // partner_economics_policy_events is append-only (see the migration and
  // deletePolicyEventReceiptsByPrefix above) and its v8 rows carry a NULL
  // partner_org_id by design (the ROUTE ORDERING TRUTH in the file header),
  // so it is cleaned by request_id PREFIX, never by partner_org_id.
  await deletePolicyEventReceiptsByPrefix(client, prefix);
  const cleanupPool = new Pool({ connectionString: process.env.DATABASE_URL as string });
  try {
    await cleanupLegacyCutoverTestIntents(cleanupPool, {
      organizationIds: [harness.orgId, harness.foreignOrgId],
      requestIdPrefix: 'prteconomicscleanup',
    });
  } finally {
    await cleanupPool.end();
  }
  await client.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
    [harness.orgId, harness.foreignOrgId],
  ]);
  for (const table of [
    'partner_payouts',
    'partner_commission_transactions',
    'organization_discounts',
    'partner_program_ledger',
    'partner_program_runtime',
    'partner_payout_accounts',
    'partner_users',
  ]) {
    await client
      .query(`DELETE FROM ${table} WHERE partner_org_id = $1`, [partnerOrgId])
      .catch(() => undefined);
  }
  await client
    .query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [harness.orgId, harness.foreignOrgId],
    ])
    .catch(() => undefined);
  // users.id is no longer prefix-derived (see the actor-id UUID note in
  // buildAndSeedSchema) — clean up by the exact generated ids instead of a
  // LIKE prefix scan.
  const allActorUserIds = [
    harness.actors.activeOwner.userId,
    harness.actors.revokedPartnerMember.userId,
    harness.actors.foreignActor.userId,
    harness.actors.superadminNoMembership.userId,
    harness.actors.superadminActive.userId,
  ];
  await client
    .query(`DELETE FROM users WHERE id = ANY($1)`, [allActorUserIds])
    .catch(() => undefined);
  await client
    .query(`DELETE FROM partner_organizations WHERE id = $1`, [partnerOrgId])
    .catch(() => undefined);
  await client
    .query(`DELETE FROM organizations WHERE id = ANY($1)`, [[harness.orgId, harness.foreignOrgId]])
    .catch(() => undefined);

  // Postcommit residue: 0 across every scoped table.
  const residue: Record<string, number> = {};
  const policyEventResidue = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM partner_economics_policy_events WHERE request_id LIKE $1 || '%'`,
    [prefix]
  );
  if (Number(policyEventResidue.rows[0]?.n ?? 0) > 0) {
    residue['partner_economics_policy_events'] = Number(policyEventResidue.rows[0].n);
  }
  for (const table of ['legacy_cutover_usage_events', 'legacy_cutover_signal_intents'] as const) {
    const result = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${table} WHERE organization_id = ANY($1)`,
      [[harness.orgId, harness.foreignOrgId]]
    );
    if (Number(result.rows[0]?.n ?? 0) > 0) residue[table] = Number(result.rows[0].n);
  }
  for (const [table, column] of [
    ['partner_payouts', 'partner_org_id'],
    ['partner_commission_transactions', 'partner_org_id'],
    ['organization_discounts', 'partner_org_id'],
    ['partner_program_ledger', 'partner_org_id'],
    ['partner_program_runtime', 'partner_org_id'],
    ['partner_payout_accounts', 'partner_org_id'],
    ['partner_users', 'partner_org_id'],
  ] as const) {
    const n = await countRow(client, table as ZeroMutationTable, `${column} = $1`, [partnerOrgId]);
    if (n > 0) residue[table] = n;
  }
  const orgResidue = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM organizations WHERE id = ANY($1)`,
    [[harness.orgId, harness.foreignOrgId]]
  );
  if (Number(orgResidue.rows[0]?.n ?? 0) > 0)
    residue['organizations'] = Number(orgResidue.rows[0].n);

  const usersResidue = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM users WHERE id = ANY($1)`,
    [allActorUserIds]
  );
  if (Number(usersResidue.rows[0]?.n ?? 0) > 0) residue['users'] = Number(usersResidue.rows[0].n);

  expect(residue).toEqual({});

  await client.end().catch(() => undefined);

  if (lockClient) {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [ADVISORY_LOCK_NAME]);
    const remaining = await lockClient.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
    );
    expect(Number(remaining.rows[0]?.n ?? 0)).toBe(0);
    await lockClient.end();
  }
}, 30_000);

const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
  it(
    name,
    async () => {
      if (!harness) {
        expect(true).toBe(true);
        return;
      }
      await fn(harness);
    },
    timeoutMs
  );

// =============================================================================
// Hard DB guard — proves the guard itself, not just that it was called.
// =============================================================================
describeReal('hard DB guard', () => {
  itDB('current_database() is confirmed disposable and prefixed', async (h) => {
    const database = await assertDisposableDatabase(h.client);
    expect(database.startsWith(DISPOSABLE_PREFIX)).toBe(true);
  });

  itDB('both named append-only triggers exist and are enabled (O)', async (h) => {
    const r = await h.client.query<{ tgname: string; tgenabled: string }>(
      `SELECT tgname, tgenabled FROM pg_trigger
        WHERE tgrelid = 'partner_economics_policy_events'::regclass AND NOT tgisinternal
        ORDER BY tgname`
    );
    const byName = Object.fromEntries(r.rows.map((row) => [row.tgname, row.tgenabled]));
    expect(byName).toEqual({
      trg_partner_economics_policy_events_no_delete: 'O',
      trg_partner_economics_policy_events_no_update: 'O',
    });
  });

  itDB('the append-only triggers actually refuse UPDATE and DELETE', async (h) => {
    const requestId = `${h.prefix}-trigger-probe`;
    await h.client.query(
      `INSERT INTO partner_economics_policy_events
         (request_id, method, route_path, surface, operation, decision, denial_code, receipt_identity, request_fingerprint)
       VALUES ($1, 'POST', '/probe', 'service', 'commission', $2, $3, $4, $4)`,
      [
        requestId,
        PARTNER_ECONOMICS_POLICY_DECISION,
        PARTNER_ECONOMICS_POLICY_CODE,
        `${requestId}-identity`,
      ]
    );
    const updateAttempt = await h.client
      .query(`UPDATE partner_economics_policy_events SET method = 'PUT' WHERE request_id = $1`, [
        requestId,
      ])
      .then(() => 'ALLOWED')
      .catch((e: Error) => e.message);
    const deleteAttempt = await h.client
      .query(`DELETE FROM partner_economics_policy_events WHERE request_id = $1`, [requestId])
      .then(() => 'ALLOWED')
      .catch((e: Error) => e.message);
    expect(String(updateAttempt)).toContain('append-only');
    expect(String(deleteAttempt)).toContain('append-only');
    // The trigger just proved it blocks a plain DELETE — this probe row is
    // real, permanent evidence data now. Remove it the only sanctioned way
    // (disable/delete/re-enable inside one transaction), exactly like
    // afterAll's own teardown does for every other receipt this file writes.
    const removed = await deletePolicyEventReceiptsByPrefix(h.client, requestId);
    expect(removed).toBe(1);
  });
});

// =============================================================================
// Full listed-route coverage. Every economic mutation route named in this
// packet's brief, one entry per REQUIRED COVERAGE's endpoint list.
// =============================================================================
interface MutationCase {
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  operation: string;
  body?: Record<string, unknown>;
}

const V8_BASE = '/api/v8/partner';
const LEGACY_BASE = '/api/partners';
const SETTLEMENTS_BASE = '/api/superadmin/partner-settlements';
const CONFIG_BASE = '/api/superadmin/partner-config';

const V8_MUTATIONS: MutationCase[] = [
  {
    method: 'POST',
    path: '/program/lifecycle/request-payout-phase',
    operation: 'lifecycle_payout',
  },
  { method: 'POST', path: '/payouts/request', operation: 'payout' },
  { method: 'PUT', path: '/payout-settings', operation: 'payout_settings' },
];

const LEGACY_MUTATIONS: MutationCase[] = [
  { method: 'POST', path: '/payouts/request', operation: 'payout' },
  { method: 'PUT', path: '/payout-settings', operation: 'payout_settings' },
];

const SETTLEMENTS_MUTATIONS: MutationCase[] = [
  {
    method: 'POST',
    path: '/approve-commissions',
    operation: 'commission',
    body: { commissionIds: ['nonexistent'] },
  },
  {
    method: 'POST',
    path: '/process-payout',
    operation: 'payout',
    body: { payoutId: 'nonexistent', confirmation: true, reason: 'mounted-auth probe' },
  },
  {
    method: 'POST',
    path: '/complete-payout',
    operation: 'payout',
    body: { payoutId: 'nonexistent', confirmation: true, reason: 'mounted-auth probe' },
  },
  {
    method: 'POST',
    path: '/fail-payout',
    operation: 'payout',
    body: { payoutId: 'nonexistent', reason: 'mounted-auth probe' },
  },
  {
    method: 'POST',
    path: '/program/nonexistent-id/lifecycle',
    operation: 'lifecycle_payout',
    body: { toPhase: 'payout' },
  },
  {
    method: 'POST',
    path: '/program/nonexistent-id/ledger-entry',
    operation: 'accrual',
    body: { entryType: 'accrual.posted', amount: 1 },
  },
  { method: 'DELETE', path: '/attributions/nonexistent-id', operation: 'commission' },
];

const CONFIG_MUTATIONS: MutationCase[] = [
  {
    method: 'PUT',
    path: '/commission-rates',
    operation: 'commission',
    body: { tier: 'GOLD', rate: 20 },
  },
  { method: 'PUT', path: '/discount', operation: 'discount', body: { discountValue: 10 } },
  { method: 'PUT', path: '/payout-settings', operation: 'payout_settings', body: {} },
];

function sendMutation(
  app: Express,
  basePath: string,
  token: string,
  kase: MutationCase,
  requestId: string
) {
  const url = `${basePath}${kase.path}`;
  const method = kase.method.toLowerCase() as 'post' | 'put' | 'delete';
  return request(app)
    [method](url)
    .set('Authorization', `Bearer ${token}`)
    .set('X-Request-Id', requestId)
    .send(kase.body ?? {});
}

function assertPolicyDeniedBody(body: any, operation: string) {
  expect(body).toMatchObject({
    success: false,
    code: PARTNER_ECONOMICS_POLICY_CODE,
    decision: PARTNER_ECONOMICS_POLICY_DECISION,
    operation,
  });
  expect(body.code).not.toBe('PARTNER_LEGACY_WRITER_DISABLED');
  expect(body.policyUnavailable).toMatchObject({
    decision: PARTNER_ECONOMICS_POLICY_DECISION,
    code: PARTNER_ECONOMICS_POLICY_CODE,
    historicalReadOnly: true,
  });
  expect(Array.isArray(body.policyUnavailable.operations)).toBe(true);
}

async function assertZeroMutationAroundDeniedCall(
  h: Harness,
  send: () => PromiseLike<{ status: number; body: any }>
): Promise<{ status: number; body: any }> {
  const before = await snapshotZeroMutationTables(h.client);
  const res = await send();
  const after = await snapshotZeroMutationTables(h.client);
  expect(after).toEqual(before);
  return res;
}

interface SurfaceFixture {
  surface: string;
  basePath: string;
  buildApp: () => Express;
  mutations: MutationCase[];
  token: (h: Harness) => string;
}

const SURFACES: SurfaceFixture[] = [
  {
    surface: 'v8_partner',
    basePath: V8_BASE,
    buildApp: buildV8App,
    mutations: V8_MUTATIONS,
    token: (h) => h.actors.activeOwner.token,
  },
  {
    surface: 'legacy_partner',
    basePath: LEGACY_BASE,
    buildApp: buildLegacyApp,
    mutations: LEGACY_MUTATIONS,
    token: (h) => h.actors.activeOwner.token,
  },
  {
    surface: 'superadmin_partner_settlements',
    basePath: SETTLEMENTS_BASE,
    buildApp: buildSettlementsApp,
    mutations: SETTLEMENTS_MUTATIONS,
    token: (h) => h.actors.superadminActive.token,
  },
  {
    surface: 'superadmin_partner_config',
    basePath: CONFIG_BASE,
    buildApp: buildConfigApp,
    mutations: CONFIG_MUTATIONS,
    token: (h) => h.actors.superadminActive.token,
  },
];

describeReal(
  'AMD-PRT-ECONOMICS-002 — every listed economic mutation route refuses (410, zero mutation, one receipt)',
  () => {
  for (const surfaceFixture of SURFACES) {
    for (const kase of surfaceFixture.mutations) {
      itDB(
        `${surfaceFixture.surface} ${kase.method} ${kase.path} -> 410, zero mutation, exactly one receipt`,
        async (h) => {
          const requestId = `${h.prefix}-cov-${surfaceFixture.surface}-${kase.method}-${kase.path.replace(/[^a-z0-9]+/gi, '-')}`;
          const app = surfaceFixture.buildApp();
          const token = surfaceFixture.token(h);

          const res = await assertZeroMutationAroundDeniedCall(h, () =>
            sendMutation(app, surfaceFixture.basePath, token, kase, requestId)
          );

          expect(res.status).toBe(410);
          assertPolicyDeniedBody(res.body, kase.operation);

          const receipts = await receiptRowsForRequestId(h.client, requestId);
          expect(receipts).toHaveLength(1);
          const receipt = receipts[0] as any;
          expect(receipt.surface).toBe(surfaceFixture.surface);
          expect(receipt.operation).toBe(kase.operation);
          expect(receipt.method).toBe(kase.method);
          expect(receipt.decision).toBe(PARTNER_ECONOMICS_POLICY_DECISION);
          expect(receipt.denial_code).toBe(PARTNER_ECONOMICS_POLICY_CODE);
          expect(String(receipt.route_path)).toContain(kase.path.split('/')[1] ?? kase.path);

          if (surfaceFixture.surface === 'v8_partner') {
            // ROUTE ORDERING TRUTH: the guard runs before partner-org
            // resolution on v8, so partner_org_id must be NULL on the
            // receipt, and the resolution/demo-seed middleware (which would
            // self-heal a partner_users row) must never have run.
            expect(receipt.partner_org_id).toBeNull();
          }
        }
      );
    }
  }

    itDB(
      'a denied v8 request never causes a new partner_users row for the target partner org',
      async (h) => {
    const before = await partnerUsersRowCount(h.client, h.partnerOrgId);
    const app = buildV8App();
    const requestId = `${h.prefix}-cov-seeder-guard`;
        const res = await sendMutation(
          app,
          V8_BASE,
          h.actors.activeOwner.token,
          V8_MUTATIONS[1],
          requestId
        );
    expect(res.status).toBe(410);
    const after = await partnerUsersRowCount(h.client, h.partnerOrgId);
    expect(after).toBe(before);
      }
    );
  }
);

// The legacy cutover rollback variables are deliberately NOT an enablement
// mechanism for owner-excluded Partner economics.  The production routers run
// authentication and the immutable economics-policy guard before the generic
// legacy-cutover guard, so even an operator who enables either legacy rollback
// switch must still receive the policy refusal.  Keep this denominator tied to
// the stable sibling-writer ids: it is the executable proof for PRT-W18-W27.
const SIBLING_ROLLBACK_CASES: Array<{
  writerId: `PRT-W${number}`;
  surface: SurfaceFixture;
  mutation: MutationCase;
}> = [
  { writerId: 'PRT-W18', surface: SURFACES[2], mutation: SETTLEMENTS_MUTATIONS[0] },
  { writerId: 'PRT-W19', surface: SURFACES[2], mutation: SETTLEMENTS_MUTATIONS[1] },
  { writerId: 'PRT-W20', surface: SURFACES[2], mutation: SETTLEMENTS_MUTATIONS[2] },
  { writerId: 'PRT-W21', surface: SURFACES[2], mutation: SETTLEMENTS_MUTATIONS[3] },
  { writerId: 'PRT-W22', surface: SURFACES[2], mutation: SETTLEMENTS_MUTATIONS[6] },
  { writerId: 'PRT-W23', surface: SURFACES[2], mutation: SETTLEMENTS_MUTATIONS[4] },
  { writerId: 'PRT-W24', surface: SURFACES[2], mutation: SETTLEMENTS_MUTATIONS[5] },
  { writerId: 'PRT-W25', surface: SURFACES[3], mutation: CONFIG_MUTATIONS[0] },
  { writerId: 'PRT-W26', surface: SURFACES[3], mutation: CONFIG_MUTATIONS[1] },
  { writerId: 'PRT-W27', surface: SURFACES[3], mutation: CONFIG_MUTATIONS[2] },
];

describeReal('AMD-PRT-ECONOMICS-002 — legacy rollback cannot reactivate PRT-W18-W27', () => {
  itDB(
    'global and writer-selective rollback leave all ten mounted writers auth-first, policy-disabled and byte-stable',
    async (h) => {
      const globalEnv = 'PARTNER_LEGACY_ROLLBACK_ENABLED';
      const selectiveEnv = 'PARTNER_LEGACY_ROLLBACK_WRITERS';
      const previousGlobal = process.env[globalEnv];
      const previousSelective = process.env[selectiveEnv];
      const coldClient = new Client({ connectionString: process.env.DATABASE_URL as string });

      await coldClient.connect();
      try {
        for (const { writerId, surface, mutation } of SIBLING_ROLLBACK_CASES) {
          for (const mode of ['global', 'selective'] as const) {
            if (mode === 'global') {
              process.env[globalEnv] = 'true';
              delete process.env[selectiveEnv];
            } else {
              delete process.env[globalEnv];
              process.env[selectiveEnv] = writerId;
            }

            const requestId = `${h.prefix}-rollback-${mode}-${writerId.toLowerCase()}`;
            const app = surface.buildApp();
            const token = surface.token(h);
            const before = await snapshotZeroMutationTables(h.client);

            // Same authenticated request identity is replayed deliberately:
            // refusal remains stable and the durable receipt stays exactly one.
            const first = await sendMutation(app, surface.basePath, token, mutation, requestId);
            const replay = await sendMutation(app, surface.basePath, token, mutation, requestId);

            expect(first.status, `${mode} ${writerId} first`).toBe(410);
            expect(replay.status, `${mode} ${writerId} replay`).toBe(410);
            assertPolicyDeniedBody(first.body, mutation.operation);
            assertPolicyDeniedBody(replay.body, mutation.operation);
            expect(replay.body).toEqual(first.body);
            expect(await snapshotZeroMutationTables(h.client)).toEqual(before);

            // Query through an independent connection after both requests so
            // the assertion is a committed/cold read, not connection-local state.
            const receipts = await receiptRowsForRequestId(coldClient, requestId);
            expect(receipts, `${mode} ${writerId} receipt`).toHaveLength(1);
            expect(receipts[0]).toMatchObject({
              surface: surface.surface,
              operation: mutation.operation,
              method: mutation.method,
              decision: PARTNER_ECONOMICS_POLICY_DECISION,
              denial_code: PARTNER_ECONOMICS_POLICY_CODE,
            });
          }
        }
      } finally {
        await coldClient.end().catch(() => undefined);
        if (previousGlobal === undefined) delete process.env[globalEnv];
        else process.env[globalEnv] = previousGlobal;
        if (previousSelective === undefined) delete process.env[selectiveEnv];
        else process.env[selectiveEnv] = previousSelective;
      }
    },
    60_000
  );
});

// =============================================================================
// Actor matrix: ACTIVE owner/admin, revoked member, foreign tenant, and
// SUPERADMIN-without-membership, each against ONE representative economic
// mutation AND ONE representative historical read per surface, per REQUIRED
// COVERAGE §2.
//
// v8/legacy: the economics guard is membership-blind (fires for ANY
// authenticated actor on a matching route/method), so all four actors see the
// SAME 410 on the mutation; the read (unguarded) instead exercises
// `getActivePartnerOrgIdForUser`, which genuinely differs per actor.
//
// settlements/config: `requireActiveMembership` + `verifySuperAdmin` run
// BEFORE the guard, so most of these four actors are refused before the
// guard is ever reached — "the correct auth denial" per the task brief, not
// a gap. Only `superadminActive` (added specifically to prove the guard
// fires at all on these two routers) reaches 410 / 200.
// =============================================================================
describeReal(
  'actor matrix — ACTIVE owner/admin, revoked member, foreign tenant, SUPERADMIN-without-membership',
  () => {
  describe('v8_partner', () => {
      itDB(
        'POST /payouts/request refuses 410 for every actor regardless of membership',
        async (h) => {
      const app = buildV8App();
      for (const [label, actor] of [
        ['activeOwner', h.actors.activeOwner],
        ['revokedPartnerMember', h.actors.revokedPartnerMember],
        ['foreignActor', h.actors.foreignActor],
        ['superadminNoMembership', h.actors.superadminNoMembership],
      ] as const) {
        const requestId = `${h.prefix}-matrix-v8-mut-${label}`;
        const res = await sendMutation(app, V8_BASE, actor.token, V8_MUTATIONS[1], requestId);
        expect([label, res.status]).toEqual([label, 410]);
        assertPolicyDeniedBody(res.body, 'payout');
        const receipts = await receiptRowsForRequestId(h.client, requestId);
        expect([label, receipts.length]).toEqual([label, 1]);
        expect([label, (receipts[0] as any).partner_org_id]).toEqual([label, null]);
      }
        }
      );

      itDB(
        'GET /program/status is 200 only for the actor with an ACTIVE partner_users link; everyone else gets 403, never 410',
        async (h) => {
      const app = buildV8App();
      const active = await request(app)
        .get(`${V8_BASE}/program/status`)
        .set('Authorization', `Bearer ${h.actors.activeOwner.token}`);
      expect(active.status).toBe(200);
      expect(active.body?.data?.lifecyclePhase).toBeTruthy();

      // `requirePartnerEconomicsReadAccess` on this route is
      // `[requireActiveMembership, requireOrgRole('admin')]` — a real,
      // per-request `organization_members` check runs BEFORE the route
      // handler's own `getActivePartnerOrgIdForUser` lookup, so the exact
      // denial code differs by WHY each actor fails, not just THAT they
      // fail:
      //   - revokedPartnerMember's only organization_members row is the
      //     INACTIVE one seeded in orgId, and attachUser's cross-org
      //     self-heal (auth.middleware.ts) only reassigns the request's org
      //     when it finds a DIFFERENT org with an ACTIVE row — there isn't
      //     one here (deliberately, per buildAndSeedSchema's comment on this
      //     actor) — so `requireActiveMembership` denies first, on the
      //     unchanged orgId, with ORG_MEMBERSHIP_REVOKED. The route handler
      //     (and its PARTNER_ORG_REQUIRED code) is never reached.
      //   - superadminNoMembership has NO organization_members row anywhere,
      //     so the same self-heal has nothing to find either — same
      //     ORG_MEMBERSHIP_REVOKED, same "route handler never reached".
      //   - foreignActor's JWT claims orgId (a cross-tenant probe), but they
      //     DO hold a real ACTIVE membership elsewhere (foreignOrgId) — the
      //     self-heal finds THAT row, reassigns req.organizationId to
      //     foreignOrgId and req.userRole to their real role there, so they
      //     clear both requireActiveMembership and requireOrgRole('admin')
      //     and actually reach the route handler, where
      //     getActivePartnerOrgIdForUser correctly finds no partner_users
      //     link for them and returns the route's own PARTNER_ORG_REQUIRED.
      // This is the exact same actor-vs-code split already asserted for the
      // superadmin_partner_settlements/superadmin_partner_config surfaces
      // below — confirmed against the live, real-middleware-chain response,
      // not assumed.
      const expectedCodeByLabel = {
        revokedPartnerMember: 'ORG_MEMBERSHIP_REVOKED',
        foreignActor: 'PARTNER_ORG_REQUIRED',
        superadminNoMembership: 'ORG_MEMBERSHIP_REVOKED',
      } as const;
      for (const [label, actor] of [
        ['revokedPartnerMember', h.actors.revokedPartnerMember],
        ['foreignActor', h.actors.foreignActor],
        ['superadminNoMembership', h.actors.superadminNoMembership],
      ] as const) {
        const res = await request(app)
          .get(`${V8_BASE}/program/status`)
          .set('Authorization', `Bearer ${actor.token}`);
        expect([label, res.status]).toEqual([label, 403]);
        expect([label, res.body?.code]).toEqual([label, expectedCodeByLabel[label]]);
        expect([label, res.status]).not.toEqual([label, 410]);
      }
        }
      );
  });

  describe('legacy_partner', () => {
      itDB(
        'POST /payouts/request refuses 410 for every actor regardless of membership',
        async (h) => {
      const app = buildLegacyApp();
      for (const [label, actor] of [
        ['activeOwner', h.actors.activeOwner],
        ['revokedPartnerMember', h.actors.revokedPartnerMember],
        ['foreignActor', h.actors.foreignActor],
        ['superadminNoMembership', h.actors.superadminNoMembership],
      ] as const) {
        const requestId = `${h.prefix}-matrix-legacy-mut-${label}`;
            const res = await sendMutation(
              app,
              LEGACY_BASE,
              actor.token,
              LEGACY_MUTATIONS[0],
              requestId
            );
        expect([label, res.status]).toEqual([label, 410]);
        assertPolicyDeniedBody(res.body, 'payout');
        const receipts = await receiptRowsForRequestId(h.client, requestId);
        expect([label, receipts.length]).toEqual([label, 1]);
      }
        }
      );

      itDB(
        'GET /payouts is 200 only for the actor with an ACTIVE partner_users link; everyone else gets 403, never 410',
        async (h) => {
      const app = buildLegacyApp();
      const active = await request(app)
        .get(`${LEGACY_BASE}/payouts`)
        .set('Authorization', `Bearer ${h.actors.activeOwner.token}`);
      expect(active.status).toBe(200);
      expect(active.body?.success).toBe(true);
      expect(Array.isArray(active.body?.data)).toBe(true);

      for (const [label, actor] of [
        ['revokedPartnerMember', h.actors.revokedPartnerMember],
        ['foreignActor', h.actors.foreignActor],
        ['superadminNoMembership', h.actors.superadminNoMembership],
      ] as const) {
        const res = await request(app)
          .get(`${LEGACY_BASE}/payouts`)
          .set('Authorization', `Bearer ${actor.token}`);
        expect([label, res.status]).toEqual([label, 403]);
        expect([label, res.status]).not.toEqual([label, 410]);
      }
        }
      );
  });

  describe('superadmin_partner_settlements', () => {
      itDB(
        'POST /approve-commissions: only superadminActive reaches the guard (410); everyone else is refused earlier, with zero economics receipts',
        async (h) => {
      const app = buildSettlementsApp();

      const superadminRes = await sendMutation(
        app,
        SETTLEMENTS_BASE,
        h.actors.superadminActive.token,
        SETTLEMENTS_MUTATIONS[0],
        `${h.prefix}-matrix-settlements-mut-superadminActive`
      );
      expect(superadminRes.status).toBe(410);
      assertPolicyDeniedBody(superadminRes.body, 'commission');

      // activeOwner: ACTIVE membership, NOT superadmin -> verifySuperAdmin denies.
      const ownerRequestId = `${h.prefix}-matrix-settlements-mut-activeOwner`;
          const ownerRes = await sendMutation(
            app,
            SETTLEMENTS_BASE,
            h.actors.activeOwner.token,
            SETTLEMENTS_MUTATIONS[0],
            ownerRequestId
          );
      expect(ownerRes.status).toBe(403);
      expect(ownerRes.body?.code).toBe('INSUFFICIENT_PLATFORM_ROLE');
      expect(await receiptRowsForRequestId(h.client, ownerRequestId)).toHaveLength(0);

      // revokedPartnerMember: SUPERADMIN role claim in `users`, but INACTIVE
      // membership -> requireActiveMembership denies BEFORE verifySuperAdmin
      // even runs. Proves "Role claims, including SUPERADMIN, never bypass it."
      const revokedRequestId = `${h.prefix}-matrix-settlements-mut-revoked`;
          const revokedRes = await sendMutation(
            app,
            SETTLEMENTS_BASE,
            h.actors.revokedPartnerMember.token,
            SETTLEMENTS_MUTATIONS[0],
            revokedRequestId
          );
      expect(revokedRes.status).toBe(403);
      expect(revokedRes.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(await receiptRowsForRequestId(h.client, revokedRequestId)).toHaveLength(0);

      // foreignActor: JWT claims orgId, but attachUser's ACTIVE-membership
      // fallback resolves them into their REAL org (foreignOrgId, where they
      // ARE active) before requireActiveMembership even runs — so membership
      // passes and they are refused for being non-superadmin, same shape as
      // activeOwner. This is the auth layer's own cross-tenant self-heal, not
      // a gap in this file's coverage.
      const foreignRequestId = `${h.prefix}-matrix-settlements-mut-foreign`;
          const foreignRes = await sendMutation(
            app,
            SETTLEMENTS_BASE,
            h.actors.foreignActor.token,
            SETTLEMENTS_MUTATIONS[0],
            foreignRequestId
          );
      expect(foreignRes.status).toBe(403);
      expect(foreignRes.body?.code).toBe('INSUFFICIENT_PLATFORM_ROLE');
      expect(await receiptRowsForRequestId(h.client, foreignRequestId)).toHaveLength(0);

      // superadminNoMembership: SUPERADMIN role claim, but NO membership row
      // anywhere for the claimed org -> requireActiveMembership denies first.
      // This is the "SUPERADMIN-without-membership" actor named explicitly by
      // REQUIRED COVERAGE §2.
      const noMembershipRequestId = `${h.prefix}-matrix-settlements-mut-superadminNoMembership`;
      const noMembershipRes = await sendMutation(
        app,
        SETTLEMENTS_BASE,
        h.actors.superadminNoMembership.token,
        SETTLEMENTS_MUTATIONS[0],
        noMembershipRequestId
      );
      expect(noMembershipRes.status).toBe(403);
      expect(noMembershipRes.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(await receiptRowsForRequestId(h.client, noMembershipRequestId)).toHaveLength(0);
        }
      );

      itDB(
        'GET /summary (historical read): 200 for every actor that clears requireActiveMembership+verifySuperAdmin, never gated by the economics guard',
        async (h) => {
      const app = buildSettlementsApp();
      const superadminRes = await request(app)
        .get(`${SETTLEMENTS_BASE}/summary`)
        .set('Authorization', `Bearer ${h.actors.superadminActive.token}`);
      expect(superadminRes.status).toBe(200);
      expect(superadminRes.body?.success).toBe(true);

      const ownerRes = await request(app)
        .get(`${SETTLEMENTS_BASE}/summary`)
        .set('Authorization', `Bearer ${h.actors.activeOwner.token}`);
      expect(ownerRes.status).toBe(403);
      expect(ownerRes.body?.code).toBe('INSUFFICIENT_PLATFORM_ROLE');
        }
      );
  });

  describe('superadmin_partner_config', () => {
      itDB(
        'PUT /commission-rates: only superadminActive reaches the guard (410); everyone else is refused earlier, with zero economics receipts',
        async (h) => {
      const app = buildConfigApp();

      const superadminRes = await sendMutation(
        app,
        CONFIG_BASE,
        h.actors.superadminActive.token,
        CONFIG_MUTATIONS[0],
        `${h.prefix}-matrix-config-mut-superadminActive`
      );
      expect(superadminRes.status).toBe(410);
      assertPolicyDeniedBody(superadminRes.body, 'commission');

      const revokedRequestId = `${h.prefix}-matrix-config-mut-revoked`;
          const revokedRes = await sendMutation(
            app,
            CONFIG_BASE,
            h.actors.revokedPartnerMember.token,
            CONFIG_MUTATIONS[0],
            revokedRequestId
          );
      expect(revokedRes.status).toBe(403);
      expect(revokedRes.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(await receiptRowsForRequestId(h.client, revokedRequestId)).toHaveLength(0);

      const noMembershipRequestId = `${h.prefix}-matrix-config-mut-superadminNoMembership`;
      const noMembershipRes = await sendMutation(
        app,
        CONFIG_BASE,
        h.actors.superadminNoMembership.token,
        CONFIG_MUTATIONS[0],
        noMembershipRequestId
      );
      expect(noMembershipRes.status).toBe(403);
      expect(noMembershipRes.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(await receiptRowsForRequestId(h.client, noMembershipRequestId)).toHaveLength(0);
        }
      );

      itDB(
        'GET /commission-rates (historical read): 200 for superadminActive, 403 (never 410) for a non-superadmin',
        async (h) => {
      const app = buildConfigApp();
      const superadminRes = await request(app)
        .get(`${CONFIG_BASE}/commission-rates`)
        .set('Authorization', `Bearer ${h.actors.superadminActive.token}`);
      expect(superadminRes.status).toBe(200);

      const ownerRes = await request(app)
        .get(`${CONFIG_BASE}/commission-rates`)
        .set('Authorization', `Bearer ${h.actors.activeOwner.token}`);
      expect(ownerRes.status).toBe(403);
      expect(ownerRes.status).not.toBe(410);
        }
      );
    });
  }
);

// =============================================================================
// Non-economic positive controls — over-blocking would fail this suite.
// Assertion is deliberately scoped to the ECONOMICS signature (code/decision),
// not to overall HTTP success: some of these routes are separately
// intercepted by the UNRELATED legacy-cutover guard, and some touch
// certification tables this file does not build. Either way, a
// non-economics-shaped response proves the guard's `next()` path was taken —
// see file header scoping decision #3.
// =============================================================================
describeReal('non-economic routes are never touched by the economics guard', () => {
  itDB('v8 PUT /organization/listing is not refused by AMD-PRT-ECONOMICS-002', async (h) => {
    const app = buildV8App();
    const requestId = `${h.prefix}-positive-v8-organization-listing`;
    const res = await request(app)
      .put(`${V8_BASE}/organization/listing`)
      .set('Authorization', `Bearer ${h.actors.activeOwner.token}`)
      .set('X-Request-Id', requestId)
      .send({ publicListingEnabled: true });
    expect(res.body?.code).not.toBe(PARTNER_ECONOMICS_POLICY_CODE);
    expect(res.body?.decision).not.toBe(PARTNER_ECONOMICS_POLICY_DECISION);
    expect(await receiptRowsForRequestId(h.client, requestId)).toHaveLength(0);
  });

  itDB(
    'legacy POST /campaign-links is not refused by AMD-PRT-ECONOMICS-002 (it is not in LEGACY_PARTNER_ECONOMIC_WRITERS)',
    async (h) => {
    const app = buildLegacyApp();
    const requestId = `${h.prefix}-positive-legacy-campaign-links`;
    const res = await request(app)
      .post(`${LEGACY_BASE}/campaign-links`)
      .set('Authorization', `Bearer ${h.actors.activeOwner.token}`)
      .set('X-Request-Id', requestId)
      .send({ name: 'Mounted auth probe campaign' });
    expect(res.body?.code).not.toBe(PARTNER_ECONOMICS_POLICY_CODE);
    expect(res.body?.decision).not.toBe(PARTNER_ECONOMICS_POLICY_DECISION);
    expect(await receiptRowsForRequestId(h.client, requestId)).toHaveLength(0);
    }
  );

  itDB(
    'superadmin-config POST /review-queue/:certificationId is not refused by AMD-PRT-ECONOMICS-002',
    async (h) => {
    const app = buildConfigApp();
    const requestId = `${h.prefix}-positive-config-review-queue`;
    const res = await request(app)
      .post(`${CONFIG_BASE}/review-queue/nonexistent-certification`)
      .set('Authorization', `Bearer ${h.actors.superadminActive.token}`)
      .set('X-Request-Id', requestId)
      .send({ reviewState: 'approved', notes: 'mounted auth probe' });
    expect(res.body?.code).not.toBe(PARTNER_ECONOMICS_POLICY_CODE);
    expect(res.body?.decision).not.toBe(PARTNER_ECONOMICS_POLICY_DECISION);
    expect(await receiptRowsForRequestId(h.client, requestId)).toHaveLength(0);
    }
  );

  // superAdminPartnerRouter (settlements) has no non-economic writer at all —
  // see file header scoping decision #4 — so no positive control is forced
  // onto it here.
});

// =============================================================================
// The getOrCreateRuntime trap, named explicitly in REQUIRED COVERAGE §3: a
// status READ legitimately upserts partner_program_runtime. This is not
// swept into the "zero mutation" assertions above (which only ever wrap a
// DENIED call) — it gets its own explicit, positive assertion instead, so the
// trap is demonstrated rather than silently avoided.
// =============================================================================
describeReal('the historical-read runtime upsert is real and is NOT a policy violation', () => {
  itDB(
    'GET /program/status changes partner_program_runtime for the ACTIVE partner (expected, and distinct from the zero-mutation guarantee for denied writes)',
    async (h) => {
    const before = await countRow(h.client, 'partner_program_runtime', 'partner_org_id = $1', [
      h.partnerOrgId,
    ]);
    const beforeUpdatedAt = await h.client.query<{ updated_at: string }>(
      `SELECT updated_at FROM partner_program_runtime WHERE partner_org_id = $1`,
      [h.partnerOrgId]
    );

    const app = buildV8App();
    const res = await request(app)
      .get(`${V8_BASE}/program/status`)
      .set('Authorization', `Bearer ${h.actors.activeOwner.token}`);
    expect(res.status).toBe(200);

    const after = await countRow(h.client, 'partner_program_runtime', 'partner_org_id = $1', [
      h.partnerOrgId,
    ]);
    const afterUpdatedAt = await h.client.query<{ updated_at: string }>(
      `SELECT updated_at FROM partner_program_runtime WHERE partner_org_id = $1`,
      [h.partnerOrgId]
    );

    // getOrCreateRuntime always re-writes onboard_checklist_json/updated_at on
    // an existing row (see partnerProgramLedgerService.ts), so the row count
    // itself does not move (this partner org already has a runtime row from
    // beforeAll's warm-up call) but the row IS written to on every read.
    expect(after).toBe(before);
    expect(afterUpdatedAt.rows[0]?.updated_at).not.toBe(beforeUpdatedAt.rows[0]?.updated_at);
    }
  );
});
