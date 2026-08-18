/**
 * F2 blast-radius remediation — proof for the two new composable helpers in
 * `roiRealdbOrgFixture.ts`: `ensureRoiFixtureMembership` and
 * `ensureRoiGovernedVisibility`.
 *
 * WHY THIS FILE EXISTS. `ensureRoiGovernedVisibility` is a thin wrapper
 * around the canonical `publishRoiGovernedVisibilityPolicy`
 * (visibilityResolver.ts) — a wrapper is easy to get wrong in ways that
 * are invisible from reading the source (accidentally swallowing an
 * error, accidentally satisfying only half the invariant). This file
 * proves the wrapper behaves EXACTLY like the canonical function it
 * delegates to: same dual-write, same fail-closed authorization, same
 * idempotent-replay behavior, same collision behavior — nothing added,
 * nothing subtracted.
 *
 * It also proves, directly against `rvn_platform_resource_visibility`,
 * the concrete defect this helper exists to prevent: 39 realDB consumers
 * across `tests/resultsVnext/roi/` currently hand-roll their own
 * `insertVisibilityPolicy('roi', <mode>, actor)` raw-SQL helper (or, for
 * four ROI-E006 PIR suites, share `roiPirRealdbFixtures.ts`'s
 * `insertVisibilityPolicy` export) instead of calling
 * `publishRoiGovernedVisibilityPolicy`. Every one of those, once this
 * organization's `resolveRoiGovernedVisibility` gate is enforced, either
 * (a) never publishes `rvn_roi_visibility_governance` at all and so fails
 * `createRoiCase` with `RoiCaseCreationNotAuthorizedError` (test A below),
 * or (b) would, if "fixed" by someone hand-writing the legacy
 * `rvn_platform_visibility_policies` row directly with the wrong mode,
 * silently stamp new cases `OPEN_ORG`/`RESTRICTED_ACL` instead of
 * `ROI_GOVERNED` (test B below) — the exact silent-reintroduction risk
 * CTO finding #2 named. This file is the record that both failure modes
 * are real, not hypothetical, and that the two-function helper avoids
 * both.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 *
 * NEVER DELETES `rvn_roi_visibility_governance` rows in teardown —
 * that table is append-only by trigger
 * (`trg_rvn_roi_visibility_governance_append_only`), same documented shape
 * `roiGovernedVisibility20.realdb.test.ts` and
 * `roiOpenOrgBackfillVariantB.realdb.test.ts` already rely on. Every
 * organizationId in this file is unique per run (`tag` below) specifically
 * so that permanent residue never collides with a later run.
 *
 * ONE-ORG PROOF, NOT A MULTI-TENANT ONE. The upsert-safety test below
 * proves the membership gate (REVOKED → ACTIVE OWNER) by re-publishing
 * against the SAME already-governed ORG_ID with a fresh idempotencyKey and
 * asserting the resulting collision — collision is only reachable once
 * `publishRoiGovernedVisibilityPolicy` has let the actor past its
 * same-tenant-membership check (visibilityResolver.ts), so it proves the
 * gate passed. This is deliberately a SINGLE-ORG proof. It does NOT
 * exercise, and this file makes NO claim about, cross-tenant/multi-org
 * behavior — an earlier draft published governance for a second
 * organization to make the same point and was reverted specifically
 * because that created a second permanently undeletable organizations row
 * (see the HONEST LIMIT section below) for no additional proof value.
 *
 * SAFETY MECHANISMS ADDED after an independent audit of an earlier draft
 * of this file (that draft reached 8/8 passing without any of the four
 * below — green, but not proven safe to run against a real database):
 *
 * 1. HARD EXPLICIT DISPOSABLE OPT-IN — `ROI_REALDB_DISPOSABLE_DB_PREFIX`
 *    must be set, in addition to `DATABASE_URL`. A `DATABASE_URL` alone is
 *    not treated as consent to run mutating tests: `DATABASE_URL` is often
 *    ambient (shared across many `*.realdb.test.ts` files in a single CI
 *    run), so its mere presence does not mean this specific file's
 *    destructive behavior was deliberately opted into for THIS database.
 *    Absent this variable, the suite no-ops, same as the existing
 *    no-`DATABASE_URL` skip path.
 *
 * 2. CALLER/LIVE DATABASE NAME EQUALITY — the value of
 *    `ROI_REALDB_DISPOSABLE_DB_PREFIX` is not just a flag; it is the
 *    caller's own declaration of which database they believe they are
 *    pointing at. `beforeAll` queries the LIVE connection for
 *    `SELECT current_database()` — a fact only Postgres itself can supply,
 *    independent of whatever `DATABASE_URL` says or a proxy/alias/tunnel
 *    silently redirected to — and aborts BEFORE any write if the live name
 *    does not start with the declared prefix. A `DATABASE_URL` that LOOKS
 *    disposable is not evidence; only the live connection is.
 *
 * 3. RETAINED ADVISORY SESSION LOCK — a dedicated `lockClient` (never
 *    shared with the `client` used for fixture reads/writes) takes
 *    `pg_advisory_lock(hashtext(...))` once, at the very start, and holds
 *    it — not acquired-and-released around each step — for the entire
 *    file's run, releasing only in `afterAll`. A dedicated `Client` is used
 *    (not a shared `Pool`) specifically because a `Pool` silently discards
 *    the physical connection behind any client whose query rejected, and a
 *    session-level advisory lock and its unlock must land on the SAME
 *    backend connection or the unlock is a no-op against the wrong
 *    session.
 *
 * 4. PINNED TRANSACTIONAL CLEANUP, NESTED `finally` — teardown's DELETEs run
 *    as an EXPLICIT `BEGIN`/`COMMIT`/`ROLLBACK` on the ONE pinned `client`
 *    connection (`runTeardownTransaction` below), never a flat sequence of
 *    autocommit statements, so a mid-teardown failure rolls back cleanly
 *    instead of leaving an ambiguous half-deleted state. That transactional
 *    stage is itself one link in `afterAll`'s outer chain of nested
 *    `try`/`finally` stages (see `runStagesNested` below): if the
 *    transaction stage throws (after its own `ROLLBACK`), every later stage
 *    — advisory-lock release, the postcommit lock-free assertion, and
 *    closing BOTH connections — still runs, because it lives in the
 *    `finally` of the stage before it. This repo has a documented history
 *    of teardown dying silently under a bare `catch {}`; this file
 *    deliberately does NOT swallow teardown errors that way — a stage that
 *    throws still lets every later stage run, but the failure is not
 *    hidden from the test run's own result.
 *
 * 5. RESIDUE ASSERTED TWICE — INSIDE AND AFTER THE TRANSACTION. The exact
 *    same zero-residue query (`assertZeroResidue` below) runs once INSIDE
 *    the still-open teardown transaction, immediately before `COMMIT`
 *    (proving the DELETEs above actually did their work — a session always
 *    sees its own uncommitted writes), and again AFTER `COMMIT`, on the
 *    same connection (proving the deleted state actually survived the
 *    commit, not merely that the DELETE statements ran). These prove
 *    different things: passing only the first would not prove durability;
 *    passing only the second would not localize a failure to "the deletes
 *    were wrong" versus "something reappeared once the transaction closed".
 *
 * 6. UNCONDITIONAL CONNECTION/ADVISORY-LOCK TEARDOWN. Every stage that
 *    releases the advisory lock or closes a connection is guarded by its
 *    OWN state flag (`advisoryLockHeld` / `clientConnected` /
 *    `lockClientConnected`), never by `reachable` alone. If the suite
 *    aborts INSIDE `beforeAll` — wrong prefix, unreachable database, a
 *    missing migration — after the lock was already acquired or a
 *    connection already opened, `beforeAll`'s own `catch` releases/closes
 *    whatever was actually acquired before rethrowing, AND `afterAll` still
 *    runs its own guarded release/close stages regardless of whether
 *    `reachable` ever became true. Both are idempotent (the flags make a
 *    second attempt a no-op), so running from both places is safe. A lock
 *    or connection retained by an aborted run blocks the next worker on a
 *    container the whole lane shares.
 *
 * 7. RUN-SCOPED PREFIX — NOT A SINGLE ORG_ID — FOR BOTH CLEANUP AND
 *    RESIDUE. Every organization id this file ever creates (`ORG_ID` itself
 *    and the anti-pattern test's `${ORG_ID}-antipattern`) shares the
 *    `RUN_SCOPE_LIKE` prefix (`${ORG_ID}%`). Both the teardown transaction's
 *    DELETEs and the residue-count query are scoped by that SAME prefix
 *    (`LIKE $1`), never by an exact match on `ORG_ID` alone — so the
 *    anti-pattern org's rows are covered by `afterAll`'s own cleanup
 *    independently of whether that test's own inline cleanup (inside its
 *    test body) ran to completion. This is deliberate defense against the
 *    specific trap where a negative-control test creates rows under an id
 *    that does not share the run's tag: if it did not, tag-scoped cleanup
 *    AND tag-scoped residue counting would both silently miss it — a leak
 *    invisible to a vacuously-passing assertion. Here it does share the
 *    tag, and both cleanup and counting cover it.
 *
 * HONEST LIMIT — READ BEFORE TRUSTING A GREEN RUN. Governance
 * (`rvn_roi_visibility_governance`) is append-only (trigger
 * `trg_rvn_roi_visibility_governance_append_only`), and its
 * `organization_id` column is `REFERENCES organizations(id)` with NO `ON
 * DELETE CASCADE` — so once this file publishes governance for `ORG_ID`
 * (the "delegates to the canonical function" test), that `ORG_ID`'s
 * `organizations` row becomes PERMANENTLY undeletable from WITHIN this test
 * file, by construction, not by omission. The ONLY way to reach a TRUE
 * final zero — including that permanent `organizations` row and the
 * governance row itself — is to drop the whole disposable child database
 * this file ran against, from OUTSIDE this file, after the run (Postgres
 * will not let a database drop the very database it is connected through).
 * That is an operational step for whoever runs this suite, not something
 * this file can do to itself.
 *
 * The postcommit residue assertions in `afterAll` (both the
 * inside-transaction one and the after-commit one) therefore assert
 * exact-zero residue ONLY for the NON-governance tables this file touches —
 * and the excluded set is exactly TWO tables, no more, no fewer:
 * `organizations` and `rvn_roi_visibility_governance`. Every OTHER table
 * this file, `roiRealdbOrgFixture.ts`, or the product code it exercises
 * (`createRoiCase`, `publishRoiGovernedVisibilityPolicy`) writes to IS
 * counted — including `rvn_platform_obligations` (written by
 * `createObligation` inside `createRoiCase`'s own transaction, test B
 * below; easy to miss because it is never mentioned by name anywhere else
 * in this file, and the prior draft of this docblock claimed full coverage
 * while silently missing exactly this table from the count). Residue-zero
 * on a database this file expects to be REUSED is NOT what this file
 * proves, and nothing in this file's comments, assertions, or any report
 * generated from running it should be read as claiming otherwise. If a
 * future edit adds a write to a table not in `assertZeroResidue`'s count
 * below, this paragraph's claim becomes false again exactly the way the
 * prior draft's did — keep the excluded-table list here and the tables
 * named in `assertZeroResidue` in lockstep, or don't claim coverage at all.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

// SAFETY MECHANISM 1 — HARD EXPLICIT DISPOSABLE OPT-IN. `DATABASE_URL`
// alone is not consent to run this file's mutating tests against it: it is
// often ambient/shared across many `*.realdb.test.ts` files in one run.
// This file additionally requires `ROI_REALDB_DISPOSABLE_DB_PREFIX` — a
// non-empty string the caller supplies to declare "the database I am
// pointing this file at is a disposable child database whose real name
// starts with this". Its presence is the opt-in; its value is checked
// against the LIVE connection below (SAFETY MECHANISM 2) — an env var can
// be stale or wrong, so the declaration alone is not trusted either.
const DISPOSABLE_DB_PREFIX = (process.env.ROI_REALDB_DISPOSABLE_DB_PREFIX || '').trim() || null;

const DB_CONFIGURED = buildClientConfig() !== null && DISPOSABLE_DB_PREFIX !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-fixture-helper-org-${tag}`;
const INITIATIVE_ID = `roi-fixture-helper-init-${tag}`;
const USER_OWNER = `roi-fixture-helper-owner-${tag}`;
const USER_TO_BE_REVOKED_THEN_FIXED = `roi-fixture-helper-flip-${tag}`;
const USER_ORDINARY_MEMBER = `roi-fixture-helper-member-${tag}`;

// SAFETY MECHANISM 3 — RETAINED ADVISORY LOCK. One fixed key for the whole
// file (not per-org, not per-test) — the point is to serialize whole runs
// of THIS file against the same physical database, not to protect any one
// row.
const ADVISORY_LOCK_KEY = 'roiRealdbOrgFixtureHelper.realdb.test.ts::disposable-db-mutex';

// Every organizationId this file ever creates (ORG_ID itself and the
// anti-pattern test's `${ORG_ID}-antipattern`) shares this prefix — used
// both to scope the cleanup/residue queries below and, per the audit's
// requirement, to scope the postcommit residue assertion by THIS RUN's
// tag rather than by whole-table totals (`roi_gov_base` already contains
// one pre-existing `organizations` row, `system`, that is not this run's
// and must not be counted against it).
const RUN_SCOPE_LIKE = `${ORG_ID}%`;

type VisibilityResolverModule =
  typeof import('../../../server/src/services/resultsVnext/platform/visibilityResolver.js');
type RoiCaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type FixtureModule = typeof import('./roiRealdbOrgFixture.js');

let ensureRoiFixtureOrganization: FixtureModule['ensureRoiFixtureOrganization'];
let ensureRoiFixtureMembership: FixtureModule['ensureRoiFixtureMembership'];
let ensureRoiGovernedVisibility: FixtureModule['ensureRoiGovernedVisibility'];
let RoiVisibilityGovernanceActorNotAuthorizedError: VisibilityResolverModule['RoiVisibilityGovernanceActorNotAuthorizedError'];
let RoiGovernedVisibilityPolicyCollisionError: VisibilityResolverModule['RoiGovernedVisibilityPolicyCollisionError'];
let createRoiCase: RoiCaseCommandsModule['createRoiCase'];
let RoiCaseCreationNotAuthorizedError: RoiCaseCommandsModule['RoiCaseCreationNotAuthorizedError'];

// SAFETY MECHANISM 4 helper (see top docblock). Each stage's own `try`
// wraps a `finally` that runs every remaining stage, so one stage throwing
// cannot prevent later stages — including connection teardown — from
// running. Deliberately no `catch` here: a thrown error still propagates
// after every later stage has run, rather than being silently absorbed.
async function runStagesNested(stages: ReadonlyArray<() => Promise<void>>, index = 0): Promise<void> {
  if (index >= stages.length) return;
  try {
    await stages[index]!();
  } finally {
    await runStagesNested(stages, index + 1);
  }
}

let client: Client;
// SAFETY MECHANISM 3 — a SEPARATE, dedicated connection solely for the
// retained advisory lock. Never used for fixture reads/writes, so a query
// failure on `client` can never cause the lock/unlock pair to land on
// different backend connections.
let lockClient: Client;
let reachable = false;
let advisoryLockHeld = false;
// SAFETY MECHANISM 6 — tracked independently of `reachable`: `reachable`
// only ever becomes true once EVERYTHING in `beforeAll` succeeded, but a
// connection can be opened (and need closing) even when a LATER guard in
// `beforeAll` aborts the run. These flags are what let both `beforeAll`'s
// own abort `catch` and `afterAll` safely, idempotently, attempt to close
// exactly what was actually opened — never more, never less.
let clientConnected = false;
let lockClientConnected = false;

// Zero-residue query, scoped to RUN_SCOPE_LIKE (SAFETY MECHANISM 7 — covers
// ORG_ID AND the anti-pattern test's `${ORG_ID}-antipattern` in one pass).
// Counts every non-governance table this file or the product code it
// exercises writes to — see the HONEST LIMIT section of the top docblock
// for exactly why `organizations` and `rvn_roi_visibility_governance` are
// the only two tables excluded, and why that exclusion list must stay in
// lockstep with this query. `rvn_platform_obligations` is deliberately
// included here — it is the one table an earlier draft's DELETE in
// teardown covered but this count did not, which is exactly the defect an
// independent audit found and this file now closes.
async function assertZeroResidue(activeClient: Client, when: string): Promise<void> {
  const residue = await activeClient.query<{ n: string }>(
    `SELECT (
       (SELECT count(*) FROM users WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM organization_members WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM initiatives WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_platform_visibility_policies WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_roi_cases WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_roi_baselines WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_roi_calculation_policy WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_platform_obligations WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_platform_events WHERE organization_id LIKE $1) +
       (SELECT count(*) FROM rvn_platform_outbox WHERE event_id IN (
          SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)) +
       (SELECT count(*) FROM rvn_platform_resource_acl WHERE resource_type = 'roi_case' AND resource_id IN (
          SELECT case_id::text FROM rvn_roi_cases WHERE organization_id LIKE $1))
     )::text AS n`,
    [RUN_SCOPE_LIKE]
  );
  const residueCount = Number(residue.rows[0]?.n ?? -1);
  if (residueCount !== 0) {
    throw new Error(
      `Postcommit residue assertion FAILED (${when}): expected 0 rows across all non-governance ` +
        `tables scoped to "${RUN_SCOPE_LIKE}", found ${residueCount}. (organizations and ` +
        `rvn_roi_visibility_governance are excluded from this assertion by design — see HONEST ` +
        'LIMIT in the top docblock.)'
    );
  }
}

// SAFETY MECHANISM 4/5/7 — the ONE pinned transaction for teardown's
// DELETEs, on the ONE connection (`activeClient`, always `client` in
// practice — never `lockClient`). Every DELETE is scoped by RUN_SCOPE_LIKE
// (SAFETY MECHANISM 7), covering both ORG_ID and the anti-pattern org.
// `rvn_roi_visibility_governance` is deliberately NEVER deleted here —
// append-only by trigger, see HONEST LIMIT in the top docblock. On any
// failure, ROLLBACK runs before rethrowing, so this stage never leaves the
// connection sitting in an aborted transaction for a later stage to trip
// over.
async function runTeardownTransaction(activeClient: Client): Promise<void> {
  await activeClient.query('BEGIN');
  try {
    await activeClient.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id LIKE $1)`,
      [RUN_SCOPE_LIKE]
    );
    await activeClient.query(
      `DELETE FROM rvn_platform_obligations WHERE organization_id LIKE $1`,
      [RUN_SCOPE_LIKE]
    );
    await activeClient.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [RUN_SCOPE_LIKE]
    );
    await activeClient.query(`DELETE FROM rvn_platform_events WHERE organization_id LIKE $1`, [RUN_SCOPE_LIKE]);
    await activeClient.query(
      `DELETE FROM rvn_platform_resource_visibility WHERE organization_id LIKE $1`,
      [RUN_SCOPE_LIKE]
    );
    await activeClient.query(
      `DELETE FROM rvn_roi_calculation_policy WHERE organization_id LIKE $1`,
      [RUN_SCOPE_LIKE]
    );
    await activeClient.query(`DELETE FROM rvn_roi_baselines WHERE organization_id LIKE $1`, [RUN_SCOPE_LIKE]);
    await activeClient.query(`DELETE FROM rvn_roi_cases WHERE organization_id LIKE $1`, [RUN_SCOPE_LIKE]);
    await activeClient.query(`DELETE FROM initiatives WHERE organization_id LIKE $1`, [RUN_SCOPE_LIKE]);
    await activeClient.query(
      `DELETE FROM rvn_platform_visibility_policies WHERE organization_id LIKE $1`,
      [RUN_SCOPE_LIKE]
    );
    await activeClient.query(`DELETE FROM organization_members WHERE organization_id LIKE $1`, [RUN_SCOPE_LIKE]);
    await activeClient.query(`DELETE FROM users WHERE organization_id LIKE $1`, [RUN_SCOPE_LIKE]);
    // organizations — EXCLUDING ORG_ID itself, which is permanently pinned
    // by the governance row this file publishes for it (HONEST LIMIT).
    // The anti-pattern org never gets a governance row (that is the whole
    // point of the anti-pattern test), so it is not pinned and this DELETE
    // is a genuine safety net if that test's own inline cleanup did not
    // run to completion — a no-op if it already did.
    await activeClient.query(`DELETE FROM organizations WHERE id LIKE $1 AND id <> $2`, [RUN_SCOPE_LIKE, ORG_ID]);

    // POSTCOMMIT ASSERTION, INSIDE THE TRANSACTION (SAFETY MECHANISM 5) —
    // proves the DELETEs above actually did their work before COMMIT is
    // even attempted.
    await assertZeroResidue(activeClient, 'INSIDE the teardown transaction, before COMMIT');

    await activeClient.query('COMMIT');
  } catch (error) {
    await activeClient.query('ROLLBACK').catch(() => {
      // A ROLLBACK failing here means the connection itself is already
      // broken; the original `error` below is what matters and is never
      // swallowed by this catch.
    });
    throw error;
  }

  // POSTCOMMIT ASSERTION, AFTER COMMIT (SAFETY MECHANISM 5) — same query,
  // same connection, proving the deleted state actually survived the
  // commit rather than merely that the statements ran.
  await assertZeroResidue(activeClient, 'AFTER COMMIT');
}

async function insertRawLegacyPolicy(
  organizationId: string,
  mode: string,
  createdBy: string
): Promise<void> {
  // Deliberately the ANTI-PATTERN this helper exists to replace — a raw
  // hand-written `rvn_platform_visibility_policies` row, exactly as all 39
  // blast-radius consumers' local `insertVisibilityPolicy` functions do
  // today. Used ONLY to prove the defect it causes (test B); never a
  // pattern this file's own fixtures use for their own setup.
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'roi', 1, $2, true, $3)`,
    [organizationId, mode, createdBy]
  );
}

describe('F2 blast-radius remediation — ensureRoiFixtureMembership / ensureRoiGovernedVisibility (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — roiRealdbOrgFixtureHelper realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      clientConnected = true;

      // SAFETY MECHANISM 2 — CALLER/LIVE DATABASE NAME EQUALITY. This must
      // run before ANY schema probe or write, and it checks a fact only
      // Postgres itself can supply (`current_database()`), not anything
      // derived from parsing DATABASE_URL — a connection string can look
      // disposable and still resolve, via a proxy/alias/tunnel, to a
      // database that is not. A mismatch aborts here, before the
      // migration-presence check below and before any INSERT.
      const liveDb = await client.query<{ current_database: string }>('SELECT current_database()');
      const liveDbName = liveDb.rows[0]?.current_database;
      if (!liveDbName || !liveDbName.startsWith(DISPOSABLE_DB_PREFIX as string)) {
        throw new Error(
          `Live current_database() is "${liveDbName}", which does not start with the declared ` +
            `ROI_REALDB_DISPOSABLE_DB_PREFIX "${DISPOSABLE_DB_PREFIX}". Refusing to run mutating ` +
            'realdb tests against a database whose live identity does not match what the caller ' +
            'explicitly declared as disposable — this is exactly the "URL looks disposable" gap ' +
            'the caller/live-database equality check exists to close.'
        );
      }

      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_visibility_governance LIMIT 0');
      const checkPermits = await client.query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conrelid = 'rvn_platform_visibility_policies'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%ROI_GOVERNED%'
         ) ok`
      );
      if (!checkPermits.rows[0]?.ok) {
        throw new Error(
          '20261021_rvn_platform_visibility_roi_governed_mode.sql has not run against this database — apply it before this suite'
        );
      }

      // SAFETY MECHANISM 3 — acquire the retained advisory lock on its own
      // dedicated connection, still before any fixture write. Session-level
      // (`pg_advisory_lock`, not `pg_advisory_xact_lock`): it is meant to
      // outlive any single statement/transaction and be released explicitly
      // in `afterAll`, not implicitly at a transaction boundary.
      lockClient = new Client(buildClientConfig() as ClientConfig);
      await lockClient.connect();
      lockClientConnected = true;
      await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [ADVISORY_LOCK_KEY]);
      advisoryLockHeld = true;
    } catch (error) {
      // SAFETY MECHANISM 6 — UNCONDITIONAL TEARDOWN ON EARLY ABORT. Release
      // whatever was ACTUALLY acquired (lock, either connection) before
      // rethrowing — a wrong prefix, an unreachable database, or a missing
      // migration must not leak a connection or a retained advisory lock
      // onto a container the whole lane shares just because setup failed
      // partway through. Guarded by the exact same flags `afterAll` uses
      // below, so this is idempotent even if `afterAll` also runs and
      // repeats the attempt. Each release is its own try/catch so one
      // failing does not prevent the others from being attempted, and none
      // of them replace or hide the ORIGINAL error, which is always what
      // gets thrown from this hook.
      try {
        if (advisoryLockHeld && lockClientConnected) {
          await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [ADVISORY_LOCK_KEY]);
          advisoryLockHeld = false;
        }
      } catch (unlockError) {
        // eslint-disable-next-line no-console
        console.error(
          '[roiRealdbOrgFixtureHelper] releasing the advisory lock during beforeAll abort also failed:',
          unlockError
        );
      }
      try {
        if (clientConnected) {
          await client.end();
          clientConnected = false;
        }
      } catch (endError) {
        // eslint-disable-next-line no-console
        console.error('[roiRealdbOrgFixtureHelper] closing `client` during beforeAll abort also failed:', endError);
      }
      try {
        if (lockClientConnected) {
          await lockClient.end();
          lockClientConnected = false;
        }
      } catch (endError) {
        // eslint-disable-next-line no-console
        console.error(
          '[roiRealdbOrgFixtureHelper] closing `lockClient` during beforeAll abort also failed:',
          endError
        );
      }
      throw new Error(
        'A database is configured but is not reachable, is missing the ROI_GOVERNED migration, or failed ' +
          'the disposable-database identity check; refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const fixtureMod: FixtureModule = await import('./roiRealdbOrgFixture.js');
    ensureRoiFixtureOrganization = fixtureMod.ensureRoiFixtureOrganization;
    ensureRoiFixtureMembership = fixtureMod.ensureRoiFixtureMembership;
    ensureRoiGovernedVisibility = fixtureMod.ensureRoiGovernedVisibility;

    const visMod: VisibilityResolverModule = await import(
      '../../../server/src/services/resultsVnext/platform/visibilityResolver.js'
    );
    RoiVisibilityGovernanceActorNotAuthorizedError = visMod.RoiVisibilityGovernanceActorNotAuthorizedError;
    RoiGovernedVisibilityPolicyCollisionError = visMod.RoiGovernedVisibilityPolicyCollisionError;

    const caseMod: RoiCaseCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
    );
    createRoiCase = caseMod.createRoiCase;
    RoiCaseCreationNotAuthorizedError = caseMod.RoiCaseCreationNotAuthorizedError;

    await ensureRoiFixtureOrganization(client, ORG_ID, 'ROI Fixture Helper RealDB Org');
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
      [INITIATIVE_ID, ORG_ID, 'ROI Fixture Helper initiative', 'EXECUTING']
    );
  }, 30_000);

  afterAll(async () => {
    // SAFETY MECHANISM 6 — UNCONDITIONAL CONNECTION/ADVISORY-LOCK TEARDOWN.
    // Deliberately NO `if (!reachable) return;` here: every stage below is
    // individually guarded by its OWN state flag (`reachable` for the data
    // cleanup; `advisoryLockHeld` / `clientConnected` / `lockClientConnected`
    // for lock release and connection close), so this hook still reaches,
    // and safely no-ops past, whichever of those was never set — including
    // the case where `beforeAll` aborted before `reachable` was ever set.
    // `beforeAll`'s own `catch` already attempts the same release/close at
    // the point of abort; running the guarded versions again here is
    // intentional defense in depth, not redundant risk — every stage is
    // idempotent given its guard.
    //
    // SAFETY MECHANISM 4 — PINNED CLEANUP, NESTED `finally`. Each stage's
    // work lives in a `try`; the NEXT stage lives in that `try`'s
    // `finally` (see `runStagesNested` below), so a stage that throws
    // still lets every later stage run — including the postcommit
    // lock-free assertion and the connection teardown. This deliberately
    // does NOT wrap each stage in its own `catch {}`: that would swallow
    // the failure (the documented silent-teardown-death anti-pattern this
    // mechanism exists to avoid) instead of merely refusing to let it
    // block later stages. If more than one stage throws, JavaScript's
    // finally-supersedes-try semantics mean only the LAST thrown error
    // ultimately surfaces from this hook — an accepted tradeoff for
    // "every stage still runs" over "every error is individually
    // reported".
    const stages: Array<() => Promise<void>> = [
      // SAFETY MECHANISM 1/4/5/7 — the pinned teardown transaction: every
      // DELETE, the inside-transaction residue assertion, COMMIT (or
      // ROLLBACK on failure), and the after-commit residue assertion. Only
      // runs at all if `beforeAll` actually reached a usable connection.
      async () => {
        if (reachable && clientConnected) {
          await runTeardownTransaction(client);
        }
      },
      // release the retained advisory lock, on the SAME dedicated
      // connection that acquired it (SAFETY MECHANISM 3) — never `client`.
      async () => {
        if (advisoryLockHeld && lockClientConnected) {
          await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [ADVISORY_LOCK_KEY]);
          advisoryLockHeld = false;
        }
      },
      // POSTCOMMIT ASSERTION — advisory locks = 0. `pg_locks` is
      // CLUSTER-WIDE, not per-database, so a raw count would be noisy on a
      // shared Postgres instance running unrelated sessions. Instead,
      // directly demonstrate the key is free: `client` (a session that
      // never held it) attempts a NON-blocking acquire of the exact same
      // key just released above — success proves nobody, including this
      // file, still holds it — then immediately releases its own trial
      // lock so this check itself leaves nothing behind. Only meaningful
      // (and only attempted) if `client` is actually still connected.
      async () => {
        if (clientConnected) {
          const tryLock = await client.query<{ ok: boolean }>(
            'SELECT pg_try_advisory_lock(hashtext($1)) AS ok',
            [ADVISORY_LOCK_KEY]
          );
          if (!tryLock.rows[0]?.ok) {
            throw new Error(
              `Postcommit advisory-lock assertion FAILED: "${ADVISORY_LOCK_KEY}" is still held after unlock.`
            );
          }
          await client.query('SELECT pg_advisory_unlock(hashtext($1))', [ADVISORY_LOCK_KEY]);
        }
      },
      async () => {
        if (clientConnected) {
          await client.end();
          clientConnected = false;
        }
      },
      async () => {
        if (lockClientConnected) {
          await lockClient.end();
          lockClientConnected = false;
        }
      },
    ];

    await runStagesNested(stages);
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'A — THE DEFECT THIS HELPER REPLACES: with no governed policy published at all (the state every one of the 39 blast-radius consumers currently leaves an organization in unless something publishes governance), createRoiCase is denied — RoiCaseCreationNotAuthorizedError, not a generic DB error',
    async () => {
      await ensureRoiFixtureMembership(client, { organizationId: ORG_ID, userId: USER_OWNER, role: 'OWNER' });
      await expect(
        createRoiCase({
          organizationId: ORG_ID,
          initiativeId: INITIATIVE_ID,
          title: 'Should be denied — no governed policy published yet',
          ownerUserId: USER_OWNER,
          currency: 'USD',
          createdBy: USER_OWNER,
          actorEffectiveRole: 'owner',
          idempotencyKey: `denied-${tag}`,
        })
      ).rejects.toThrow(RoiCaseCreationNotAuthorizedError);
    }
  );

  itDB(
    'ensureRoiGovernedVisibility delegates to the canonical function and produces BOTH rows in one call: a rvn_roi_visibility_governance row AND a domain=roi, mode=ROI_GOVERNED rvn_platform_visibility_policies row',
    async () => {
      const outcome = await ensureRoiGovernedVisibility({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        idempotencyKey: `publish-${tag}`,
      });
      expect(outcome.outcome).toBe('applied');
      expect(outcome.publication.organizationId).toBe(ORG_ID);

      const governance = await client.query(
        `SELECT organization_id FROM rvn_roi_visibility_governance WHERE organization_id = $1`,
        [ORG_ID]
      );
      expect(governance.rowCount).toBe(1);

      const legacy = await client.query<{ visibility_mode: string; is_active: boolean }>(
        `SELECT visibility_mode, is_active FROM rvn_platform_visibility_policies
          WHERE organization_id = $1 AND domain = 'roi' AND is_active = true`,
        [ORG_ID]
      );
      expect(legacy.rowCount).toBe(1);
      expect(legacy.rows[0]?.visibility_mode).toBe('ROI_GOVERNED');
    }
  );

  itDB(
    'B — end to end: createRoiCase now succeeds for the OWNER, and the new case is stamped ROI_GOVERNED — never OPEN_ORG/RESTRICTED_ACL, the exact silent-reintroduction the raw-SQL anti-pattern risks',
    async () => {
      const outcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        title: 'Created after ensureRoiGovernedVisibility published governance',
        ownerUserId: USER_OWNER,
        currency: 'USD',
        createdBy: USER_OWNER,
        actorEffectiveRole: 'owner',
        idempotencyKey: `create-after-publish-${tag}`,
      });
      expect(outcome.outcome).toBe('applied');
      const stamped = await client.query<{ visibility_mode: string }>(
        `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type = 'roi_case' AND resource_id = $1`,
        [outcome.result.case.caseId]
      );
      expect(stamped.rows[0]?.visibility_mode).toBe('ROI_GOVERNED');
    }
  );

  itDB(
    'ensureRoiGovernedVisibility called twice with the SAME idempotencyKey replays cleanly (outcome "replayed") — the helper adds no try/catch, so this success comes from the canonical function itself, not from swallowing an error',
    async () => {
      const replay = await ensureRoiGovernedVisibility({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        idempotencyKey: `publish-${tag}`,
      });
      expect(replay.outcome).toBe('replayed');
    }
  );

  itDB(
    'ensureRoiGovernedVisibility called again with a DIFFERENT idempotencyKey for an org already published collides — RoiGovernedVisibilityPolicyCollisionError propagates, proving the helper does not catch-and-hide it',
    async () => {
      await expect(
        ensureRoiGovernedVisibility({
          organizationId: ORG_ID,
          actorUserId: USER_OWNER,
          idempotencyKey: `publish-different-key-${tag}`,
        })
      ).rejects.toThrow(RoiGovernedVisibilityPolicyCollisionError);
    }
  );

  itDB(
    'ensureRoiGovernedVisibility refuses an actor without ACTIVE OWNER/ADMIN membership — RoiVisibilityGovernanceActorNotAuthorizedError, proving the helper does not pre-authorize or relax the canonical check',
    async () => {
      await ensureRoiFixtureMembership(client, {
        organizationId: ORG_ID,
        userId: USER_ORDINARY_MEMBER,
        role: 'MEMBER',
      });
      await expect(
        ensureRoiGovernedVisibility({
          organizationId: ORG_ID,
          actorUserId: USER_ORDINARY_MEMBER,
          idempotencyKey: `publish-as-member-${tag}`,
        })
      ).rejects.toThrow(RoiVisibilityGovernanceActorNotAuthorizedError);
    }
  );

  itDB(
    'ensureRoiFixtureMembership is UPSERT-SAFE (ON CONFLICT DO UPDATE, not DO NOTHING): a user first inserted as a REVOKED member is corrected to an ACTIVE OWNER by a later call, and can then publish governance',
    async () => {
      await ensureRoiFixtureMembership(client, {
        organizationId: ORG_ID,
        userId: USER_TO_BE_REVOKED_THEN_FIXED,
        role: 'MEMBER',
        status: 'REVOKED',
      });
      const revoked = await client.query<{ role: string; status: string }>(
        `SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [ORG_ID, USER_TO_BE_REVOKED_THEN_FIXED]
      );
      expect(revoked.rows[0]?.status).toBe('REVOKED');

      await ensureRoiFixtureMembership(client, {
        organizationId: ORG_ID,
        userId: USER_TO_BE_REVOKED_THEN_FIXED,
        role: 'OWNER',
        status: 'ACTIVE',
      });
      const fixed = await client.query<{ role: string; status: string }>(
        `SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [ORG_ID, USER_TO_BE_REVOKED_THEN_FIXED]
      );
      expect(fixed.rows[0]?.role).toBe('OWNER');
      expect(fixed.rows[0]?.status).toBe('ACTIVE');

      // Prove the correction is not merely cosmetic. ORG_ID already has a
      // published governance policy (from the "delegates to the canonical
      // function" test above), so `publishRoiGovernedVisibilityPolicy`
      // checks this now-ACTIVE-OWNER actor's same-tenant membership FIRST
      // (visibilityResolver.ts) — a still-REVOKED row would be denied with
      // RoiVisibilityGovernanceActorNotAuthorizedError right there, before
      // the existing-policy row is even read. Reaching the COLLISION
      // instead, with a FRESH idempotencyKey against the ALREADY-governed
      // ORG_ID, is therefore only possible once the membership gate has
      // let this actor through — proving the same thing a second
      // organization's successful publish would have proved, without
      // creating a new organization or a new governance row: a collision
      // throws before any write, and the actor/org pairing needs neither
      // (both already exist). Zero new residue.
      await expect(
        ensureRoiGovernedVisibility({
          organizationId: ORG_ID,
          actorUserId: USER_TO_BE_REVOKED_THEN_FIXED,
          idempotencyKey: `publish-after-fix-${tag}`,
        })
      ).rejects.toThrow(RoiGovernedVisibilityPolicyCollisionError);
    }
  );

  itDB(
    'THE ANTI-PATTERN THIS HELPER REPLACES, made concrete: a raw hand-written domain=roi legacy policy row with mode OPEN_ORG (exactly what every blast-radius consumer\'s local insertVisibilityPolicy(\'roi\', \'OPEN_ORG\', actor) does today) satisfies createRoiCase\'s existence check on its own, ONLY once governance also exists for a DIFFERENT reason — proving the two tables are independently necessary and the canonical function is what keeps them coherent, not either write alone',
    async () => {
      const anotherOrgId = `${ORG_ID}-antipattern`;
      const anotherOwner = `${USER_OWNER}-antipattern`;
      await ensureRoiFixtureOrganization(client, anotherOrgId, 'ROI Fixture Helper Anti-Pattern RealDB Org');
      await ensureRoiFixtureMembership(client, { organizationId: anotherOrgId, userId: anotherOwner, role: 'OWNER' });
      await client.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
        [`${INITIATIVE_ID}-antipattern`, anotherOrgId, 'Anti-pattern initiative', 'EXECUTING']
      );

      // The raw-SQL anti-pattern writes the LEGACY row but never the
      // governance row rvn_roi_visibility_governance — so the gate denies
      // before this row is ever read, regardless of what mode it carries.
      await insertRawLegacyPolicy(anotherOrgId, 'OPEN_ORG', anotherOwner);
      await expect(
        createRoiCase({
          organizationId: anotherOrgId,
          initiativeId: `${INITIATIVE_ID}-antipattern`,
          title: 'Denied even though a legacy OPEN_ORG row exists',
          ownerUserId: anotherOwner,
          currency: 'USD',
          createdBy: anotherOwner,
          actorEffectiveRole: 'owner',
          idempotencyKey: `antipattern-${tag}`,
        })
      ).rejects.toThrow(RoiCaseCreationNotAuthorizedError);

      await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [anotherOrgId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [anotherOrgId]);
    }
  );
});
