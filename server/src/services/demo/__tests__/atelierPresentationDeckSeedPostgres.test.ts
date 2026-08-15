/**
 * MAT-006B — the canonical Atelier deck seed against a REAL PostgreSQL.
 *
 * ★ WHY A SECOND SUITE
 * --------------------
 * The fast suite runs the seed against in-memory SQLite through the `DbPromise`
 * seam. That seam is one connection, so `BEGIN`/`COMMIT` there really is a
 * transaction — which is precisely why it could never have caught the defect
 * this packet exists to fix: on PostgreSQL `DbPromise.transaction` sends BEGIN,
 * each statement and COMMIT through `pool.query()`, i.e. on ARBITRARY pooled
 * clients, so nothing is transactional at all. A green SQLite atomicity test
 * measured the seam, not the seed.
 *
 * So this suite boots an EPHEMERAL PostgreSQL 16 in Docker, creates
 * `presentation_decks` with the production shape — including the live
 * `status IN ('draft','generating','ready','exported','failed')` CHECK — and
 * drives the real `seedAtelierPresentationDecks` through the real database
 * adapter. Assertions read the rows back with a SEPARATE `pg.Client`, so no
 * assertion is an echo of the code under test.
 *
 * If Docker is not usable the whole suite SKIPS with a visible reason. It never
 * fakes a PostgreSQL.
 *
 * NOTHING here may touch a hosted database. The connection URL is pinned to
 * 127.0.0.1 and the container port, and `beforeAll` asserts that the resolved
 * config still points there before a single query runs.
 */
import { execFileSync } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// ★ Environment is pinned BEFORE any import is evaluated (`vi.hoisted` runs
// above the import block). `DatabaseConfig` is lazy, so as long as we win this
// race the adapter can only ever resolve to the throwaway container — never to
// a hosted target that happens to sit in the ambient environment.
// ---------------------------------------------------------------------------
const ctx = vi.hoisted(() => {
  const previousEnv = { ...process.env };
  // A high, random port keeps parallel runs (and a developer's own Postgres)
  // out of each other's way.
  const port = 15200 + Math.floor(Math.random() * 9000);
  const password = 'mat006b-ephemeral';
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;

  process.env.DATABASE_URL = url;
  delete process.env.DATABASE_PUBLIC_URL;
  delete process.env.FINANCE_IMPORT_DATABASE_URL;
  delete process.env.DB_HOST;
  delete process.env.DB_READONLY;
  process.env.DB_TYPE = 'postgres';
  // Do not let the adapter run its full schema bootstrap against this container.
  process.env.DB_MANAGED_SCHEMA = 'false';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'true';
  process.env.NODE_ENV = 'test';
  // ★ WITHOUT THESE TWO the whole suite is theatre. `Database.createDatabase()`
  // hands back the global stub whenever `NODE_ENV === 'test'` unless
  // `RUN_DB_TESTS=1` / `MOCK_DB=false`, and that stub answers every `get()` with
  // null and every `run()` with success — so the seed would "pass" against a
  // database that does not exist. The first run of this suite did exactly that:
  // the table probe said "presentation_decks does not exist" while the backup
  // reported three healthy rows.
  process.env.RUN_DB_TESTS = '1';
  process.env.MOCK_DB = 'false';

  let dockerReason: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync: run } =
      require('node:child_process') as typeof import('node:child_process');
    run('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'pipe', timeout: 20_000 });
  } catch (error) {
    dockerReason = `docker is not usable from the test runner: ${(error as Error)?.message || 'unknown error'}`;
  }

  return { previousEnv, port, password, url, dockerReason, containerId: '' };
});

import { Client } from 'pg';

import { resetConnection } from '../../../database/Database.js';
import * as DbPromise from '../../../utils/DbPromise.js';
import {
  advisoryLockKey,
  closePinnedPgPool,
  withFreshPgConnection,
  withPinnedPgTransaction,
} from '../../../utils/pinnedPgTransaction.js';
import {
  ATELIER_DECK_SLUGS,
  type AtelierDeckBackup,
  atelierDeckId,
  atelierDeckLockKey,
  type AtelierDeckPostState,
  buildRollbackSql,
  readAtelierDeckBackup,
  readAtelierDeckPostState,
  reconcileAtelierDeckRollback,
  rollbackAtelierDecksOnPinnedClient,
  seedAtelierPresentationDecks,
} from '../atelierPresentationDeckSeed.js';

const ORG = 'atelier';
const BOARD = atelierDeckId(ORG, 'forward-board-readout');
const STEERING = atelierDeckId(ORG, 'line3-steering');
const GROWTH = atelierDeckId(ORG, 'connected-play-growth');
const ANCHOR = '2026-06-01T00:00:00.000Z';

/**
 * The production shape, transcribed from the migrations that built the live
 * table (568 → 20260314 → 752 → 756 → 20260719 baseline gap). The CHECK is the
 * one the seed's `isDbWritableDeckStatus` guard mirrors; without it this schema
 * would be MORE permissive than production, and a status the real database
 * rejects would pass here.
 *
 * ★ `created_at` / `updated_at` are `TIMESTAMP` — WITHOUT time zone — because
 * that is what the live Railway `demo` database has (verified read-only
 * 2026-08-01: `data_type = 'timestamp without time zone'`, as declared by
 * migrations 568 and 20260314). This test previously used `TIMESTAMPTZ`, which
 * is the SAME dialect-divergence trap that already cost this packet twice (the
 * status CHECK, and the transaction that is not a transaction): a test schema
 * that differs from production on the very column under test proves nothing.
 *
 * It matters here specifically: for `timestamp without time zone` node-pg
 * builds a `Date` by interpreting the value in the PROCESS timezone, so any
 * `toISOString()` round-trip shifts it by the local UTC offset. The backup
 * therefore reads both columns with `CAST(... AS TEXT)` and never touches a
 * `Date` at all — which is what makes "byte-identical rollback" true off UTC.
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS presentation_decks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    template_id TEXT NOT NULL DEFAULT 'default',
    deck_type TEXT,
    audience TEXT,
    goal TEXT,
    language TEXT DEFAULT 'en',
    confidentiality TEXT DEFAULT 'internal',
    theme TEXT DEFAULT 'corporate',
    presentation_mode TEXT DEFAULT 'briefing',
    source_type TEXT DEFAULT 'manual',
    source_id TEXT,
    source_artifacts TEXT,
    outline_json TEXT,
    unified_json TEXT,
    deck_json TEXT,
    source_refs_json TEXT DEFAULT '{}',
    slide_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    export_path TEXT,
    exported_at TIMESTAMP,
    generated_by TEXT,
    created_by TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT presentation_decks_status_check
      CHECK (status IN ('draft', 'generating', 'ready', 'exported', 'failed'))
  );
`;

let admin: Client | null = null;
/**
 * A SECOND observer connection, used only by the fault-injection helpers that
 * watch or kill a backend. Keeping it off `admin` means the instrument can never
 * be queued behind the thing it is measuring — and `pg` stops warning about two
 * overlapping queries on one client.
 */
let watcher: Client | null = null;

function docker(args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
}

async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await admin!.query(text, params);
  return (result.rows || []) as T[];
}

/** The same, on the observer connection. */
async function watch<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await watcher!.query(text, params);
  return (result.rows || []) as T[];
}

/** Dates normalized to ISO so two snapshots can be compared literally. */
function normalize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/** EVERY column of the three rows — the only honest definition of "unchanged". */
async function snapshotAll(): Promise<Array<Record<string, unknown>>> {
  const rows = await sql('SELECT * FROM presentation_decks ORDER BY id');
  return rows.map(normalize);
}

async function insertMetadataOnly(deckId: string, slideCount: number, version: number) {
  await sql(
    `INSERT INTO presentation_decks
       (id, organization_id, title, template_id, slide_count, status, version,
        deck_json, unified_json, created_at, updated_at)
     VALUES ($1, $2, $3, 'executive-standard', $4, 'ready', $5, NULL, NULL,
             '2026-05-01T08:00:00.000Z', '2026-05-02T09:30:00.000Z')`,
    [deckId, ORG, `Pre-existing ${deckId}`, slideCount, version]
  );
}

const HUMAN_CONTENT = JSON.stringify({
  schemaVersion: 1,
  cards: [{ card_id: 'human-1', order_index: 0, title: "A presenter's own deck", blocks: [] }],
});

async function insertHumanEdited(deckId: string) {
  await sql(
    `INSERT INTO presentation_decks
       (id, organization_id, title, template_id, slide_count, status, version,
        deck_json, unified_json, created_at, updated_at)
     VALUES ($1, $2, $3, 'executive-standard', 1, 'ready', 6, $4, '{"slides":[]}',
             '2026-04-01T08:00:00.000Z', '2026-04-02T09:30:00.000Z')`,
    [deckId, ORG, 'Human deck', HUMAN_CONTENT]
  );
}

async function dropInjectedFaults(): Promise<void> {
  await sql('DROP TRIGGER IF EXISTS mat006b_reject ON presentation_decks');
  await sql('DROP FUNCTION IF EXISTS mat006b_reject_fn() CASCADE');
  await sql('DROP TRIGGER IF EXISTS mat006b_swallow ON presentation_decks');
  await sql('DROP FUNCTION IF EXISTS mat006b_swallow_fn() CASCADE');
  await sql('DROP TRIGGER IF EXISTS mat006b_tamper ON presentation_decks');
  await sql('DROP FUNCTION IF EXISTS mat006b_tamper_fn() CASCADE');
  await sql('DROP TRIGGER IF EXISTS mat006b_kill ON presentation_decks');
  await sql('DROP FUNCTION IF EXISTS mat006b_kill_fn() CASCADE');
  await sql('DROP TRIGGER IF EXISTS mat006b_racer ON presentation_decks');
  await sql('DROP FUNCTION IF EXISTS mat006b_racer_fn() CASCADE');
  await sql('DROP TRIGGER IF EXISTS mat006b_deferred ON presentation_decks');
  await sql('DROP FUNCTION IF EXISTS mat006b_deferred_fn() CASCADE');
  // The duplicate-row case drops the primary key; put it back so the next test
  // starts from the production shape.
  await sql(`
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'presentation_decks_pkey'
      ) THEN
        DELETE FROM presentation_decks a USING presentation_decks b
          WHERE a.ctid < b.ctid AND a.id = b.id;
        ALTER TABLE presentation_decks ADD CONSTRAINT presentation_decks_pkey PRIMARY KEY (id);
      END IF;
    END
    $do$;
  `);
}

/**
 * A BEFORE trigger that SILENTLY SWALLOWS the statement for one id (`RETURN
 * NULL` skips the row without raising). This is how a real database produces the
 * shape the rollback must catch: a statement that "succeeded" and changed
 * nothing — `rowCount === 0` where the executor demanded exactly 1.
 */
async function injectSwallow(deckId: string, event: 'UPDATE' | 'DELETE'): Promise<void> {
  await sql(`
    CREATE FUNCTION mat006b_swallow_fn() RETURNS trigger AS $fn$
    BEGIN
      IF OLD.id = ${admin!.escapeLiteral(deckId)} THEN
        RETURN NULL;
      END IF;
      RETURN ${event === 'DELETE' ? 'OLD' : 'NEW'};
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await sql(`
    CREATE TRIGGER mat006b_swallow
      BEFORE ${event} ON presentation_decks
      FOR EACH ROW EXECUTE FUNCTION mat006b_swallow_fn();
  `);
}

/**
 * A BEFORE UPDATE trigger that accepts the write and quietly changes ONE column.
 * `rowCount` is 1 and the statement reports success — only reading the row back
 * and comparing every column can see it.
 */
async function injectSingleColumnTamper(deckId: string, value: string): Promise<void> {
  await sql(`
    CREATE FUNCTION mat006b_tamper_fn() RETURNS trigger AS $fn$
    BEGIN
      IF NEW.id = ${admin!.escapeLiteral(deckId)} THEN
        NEW.theme := ${admin!.escapeLiteral(value)};
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await sql(`
    CREATE TRIGGER mat006b_tamper
      BEFORE UPDATE ON presentation_decks
      FOR EACH ROW EXECUTE FUNCTION mat006b_tamper_fn();
  `);
}

/**
 * A statement-level BEFORE DELETE trigger that INSERTS the given id just before
 * the DELETE scans for it — a stranger's brand-new row appearing in the window
 * `FOR UPDATE` cannot cover, because a row that does not exist yet cannot be
 * locked. The DELETE must not treat it as the seed's own work.
 */
async function injectLateInsertRacer(deckId: string): Promise<void> {
  await sql(`
    CREATE FUNCTION mat006b_racer_fn() RETURNS trigger AS $fn$
    BEGIN
      INSERT INTO presentation_decks
        (id, organization_id, title, template_id, slide_count, status, version,
         created_at, updated_at)
      VALUES (${admin!.escapeLiteral(deckId)}, ${admin!.escapeLiteral(ORG)},
              'A stranger created this AFTER the compare-and-swap',
              'default', 1, 'draft', 1,
              TIMESTAMP '2026-07-31 23:59:59', TIMESTAMP '2026-07-31 23:59:59');
      RETURN NULL;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  // ★ DELETE **OR UPDATE**. A deck that was absent before the run and is still
  // absent after it gets no delete at all — there is nothing to undo — so a
  // DELETE-only trigger would simply never fire and the test would pass without
  // exercising anything. Firing on the UPDATE that restores the OTHER decks puts
  // the stranger row into the transaction at exactly the same moment, which is
  // the situation this test is about.
  await sql(`
    CREATE TRIGGER mat006b_racer
      BEFORE DELETE OR UPDATE ON presentation_decks
      FOR EACH STATEMENT EXECUTE FUNCTION mat006b_racer_fn();
  `);
}

/**
 * A BEFORE UPDATE trigger that kills its OWN backend mid-statement — a real
 * connection loss with the transaction open and rows already restored, at a
 * deterministic point instead of a sleep-and-hope race.
 */
async function injectBackendKill(deckId: string): Promise<void> {
  await sql(`
    CREATE FUNCTION mat006b_kill_fn() RETURNS trigger AS $fn$
    BEGIN
      IF NEW.id = ${admin!.escapeLiteral(deckId)} THEN
        PERFORM pg_terminate_backend(pg_backend_pid());
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await sql(`
    CREATE TRIGGER mat006b_kill
      BEFORE UPDATE ON presentation_decks
      FOR EACH ROW EXECUTE FUNCTION mat006b_kill_fn();
  `);
}

/**
 * A DEFERRED constraint trigger that tampers with a SECOND row at COMMIT TIME.
 *
 * ★ WHY DEFERRED. Everything the executor checks — the CAS, the `rowCount`
 * assertions, the 24-column read-back — happens before it sends `COMMIT`. A
 * normal trigger's damage is therefore visible to the read-back and refused. A
 * `DEFERRABLE INITIALLY DEFERRED` constraint trigger fires inside
 * `PreCommit_Triggers`, i.e. AFTER the read-back and BEFORE the commit record,
 * so its write is part of the committed transaction and nothing inside the
 * transaction could have seen it. That is how a MIXED post-commit state is
 * produced by the database itself rather than by a race the test hopes to win.
 *
 * Recursion terminates: the trigger only acts on `triggerId`'s row event, and
 * the update it makes to `victimId` queues an event whose `NEW.id` is not
 * `triggerId`.
 */
async function injectCommitTimeTamper(
  triggerId: string,
  victimId: string,
  value: string
): Promise<void> {
  await sql(`
    CREATE FUNCTION mat006b_deferred_fn() RETURNS trigger AS $fn$
    BEGIN
      IF NEW.id = ${admin!.escapeLiteral(triggerId)} THEN
        UPDATE presentation_decks
           SET theme = ${admin!.escapeLiteral(value)}
         WHERE id = ${admin!.escapeLiteral(victimId)}
           AND theme IS DISTINCT FROM ${admin!.escapeLiteral(value)};
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await sql(`
    CREATE CONSTRAINT TRIGGER mat006b_deferred
      AFTER UPDATE ON presentation_decks
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION mat006b_deferred_fn();
  `);
}

/**
 * ★ A COMMIT THAT DIES **INSIDE** COMMIT PROCESSING, BEFORE THE COMMIT RECORD.
 *
 * A deferred CONSTRAINT trigger runs in `CommitTransaction`, at
 * `AfterTriggerFireDeferred()` — which is BEFORE `RecordTransactionCommit()`.
 * Terminating the backend from inside it therefore produces the one shape no
 * other fault in this file produces:
 *
 *   - the COMMIT was DISPATCHED (so the client cannot claim it never sent it),
 *   - the answer is a `FATAL 57P01` or a bare socket close (so the client cannot
 *     read an abort out of it — `57P01` is exactly the code that must NOT be
 *     trusted as evidence, since a backend can also be killed at an interrupt
 *     point a commit has already passed), and
 *   - the transaction really did NOT commit, so a fresh read finds every deck
 *     still at the post-materialization state.
 *
 * That is the `indeterminate` + `not-applied` corner: the executor must NOT
 * borrow a determinate stage for it.
 */
async function injectCommitTimeBackendDeath(): Promise<void> {
  await sql(`
    CREATE FUNCTION mat006b_deferred_fn() RETURNS trigger AS $fn$
    BEGIN
      PERFORM pg_terminate_backend(pg_backend_pid());
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await sql(`
    CREATE CONSTRAINT TRIGGER mat006b_deferred
      AFTER UPDATE ON presentation_decks
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION mat006b_deferred_fn();
  `);
}

// ---------------------------------------------------------------------------
// ★ A GENUINELY LOST COMMIT ACKNOWLEDGEMENT, PRODUCED BY POSTGRESQL ITSELF
// ---------------------------------------------------------------------------
//
// Faking this at the client seam would prove nothing: the whole question is what
// the SERVER did, and a stubbed error has no server behind it. So the cluster is
// pointed at a synchronous standby that does not exist. A committing backend
// then:
//   1. writes and flushes its commit record — the transaction IS committed —
//   2. parks in `SyncRepWaitForLSN` (visible as `wait_event = 'SyncRep'`),
//   3. and on `pg_terminate_backend` takes the `ProcDiePending` branch, which
//      sets `whereToSendOutput = DestNone`: the backend deliberately sends the
//      client NOTHING and exits.
// The client is left with a dispatched COMMIT, no acknowledgement, and a
// database that committed. Measured, not assumed: the tests below assert both
// halves — the seam's verdict AND what a fresh connection finds afterwards.
//
// The wait is polled for, never slept through, so the kill lands inside the
// COMMIT every time instead of most of the time.

// A bare identifier: `synchronous_standby_names` parses a standby LIST, so a
// hyphenated name is a syntax error rather than a name.
const PHANTOM_STANDBY = 'mat006bphantom';

async function armLostCommitAck(): Promise<void> {
  // A pooled client that connected BEFORE the reload would still be usable, but
  // dropping the pool removes the question entirely.
  await closePinnedPgPool();
  await sql(`ALTER SYSTEM SET synchronous_standby_names = '${PHANTOM_STANDBY}'`);
  await sql('SELECT pg_reload_conf()');
}

async function disarmLostCommitAck(): Promise<void> {
  await sql('ALTER SYSTEM RESET synchronous_standby_names');
  await sql('SELECT pg_reload_conf()');
  await closePinnedPgPool();
}

/** The pid of the backend currently INSIDE a commit, waiting for the phantom standby. */
async function waitForCommitInFlight(): Promise<number> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const rows = await watch<{ pid: number }>(
      `SELECT pid FROM pg_stat_activity
        WHERE wait_event = 'SyncRep' AND pid <> pg_backend_pid()`
    );
    if (rows.length > 0) return Number(rows[0].pid);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    'no backend ever reached the synchronous-replication wait — the lost-ACK mechanism did not arm'
  );
}

async function terminateBackend(pid: number): Promise<void> {
  await watch('SELECT pg_terminate_backend($1)', [pid]);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const alive = await watch('SELECT 1 FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (alive.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`backend ${pid} never went away`);
}

/** The one backend holding the seed's per-tenant advisory lock right now. */
async function pinnedBackendPid(): Promise<number> {
  const rows = await watch<{ pid: number }>(
    `SELECT pid FROM pg_locks
      WHERE locktype = 'advisory' AND granted AND pid <> pg_backend_pid()`
  );
  if (rows.length !== 1) {
    throw new Error(`expected exactly one advisory-lock holder, saw ${rows.length}`);
  }
  return Number(rows[0].pid);
}

/**
 * Can a DIFFERENT session see the deck the seed inserts? 0 while the seeding
 * transaction is still open, 1 once it committed. The sharpest available probe
 * for "has the COMMIT happened yet", used to pin down WHEN the recovery anchor
 * is written.
 */
async function seededInsertVisibleElsewhere(): Promise<number> {
  const rows = await watch<{ n: number }>(
    'SELECT count(*)::int AS n FROM presentation_decks WHERE id = $1',
    [BOARD]
  );
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// A durable, signed recovery anchor — the same four syscalls the real runner uses
// ---------------------------------------------------------------------------

const ANCHOR_KEY = 'mat006b-round5-test-key';
let anchorDir = '';

interface AnchorPayload {
  organizationId: string;
  postState: AtelierDeckPostState[];
}

/** temp -> fsync(file) -> rename -> fsync(dir). Anything less is not an anchor. */
function writeSignedAnchor(filePath: string, payload: AnchorPayload): void {
  const body = JSON.stringify(payload);
  const envelope = JSON.stringify({
    algorithm: 'sha256',
    payload: body,
    signature: createHmac('sha256', ANCHOR_KEY).update(body).digest('hex'),
  });
  const directory = path.dirname(filePath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.tmp`;
  const fd = openSync(temporaryPath, 'w', 0o600);
  try {
    writeSync(fd, envelope);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporaryPath, filePath);
  const dirFd = openSync(directory, 'r');
  try {
    fsyncSync(dirFd);
  } catch {
    /* some platforms refuse fsync on a directory handle; the rename is still atomic */
  } finally {
    closeSync(dirFd);
  }
}

/** Reads it back the way a recovering operator would: verify, THEN parse. */
function readSignedAnchor(filePath: string): AnchorPayload {
  const envelope = JSON.parse(readFileSync(filePath, 'utf8')) as {
    algorithm: string;
    payload: string;
    signature: string;
  };
  if (envelope.algorithm !== 'sha256') throw new Error('unexpected anchor algorithm');
  const expected = createHmac('sha256', ANCHOR_KEY).update(envelope.payload).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(envelope.signature, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('anchor signature does not verify');
  }
  return JSON.parse(envelope.payload) as AnchorPayload;
}

/** A database-side refusal of EXACTLY ONE deck — a real constraint, not a stub. */
async function injectFaultFor(deckId: string): Promise<void> {
  await dropInjectedFaults();
  await sql(`
    CREATE FUNCTION mat006b_reject_fn() RETURNS trigger AS $fn$
    BEGIN
      IF NEW.id = ${admin!.escapeLiteral(deckId)} THEN
        RAISE EXCEPTION 'simulated refusal of %', NEW.id;
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await sql(`
    CREATE TRIGGER mat006b_reject
      BEFORE INSERT OR UPDATE ON presentation_decks
      FOR EACH ROW EXECUTE FUNCTION mat006b_reject_fn();
  `);
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 90_000;
  let lastError = 'never attempted';
  while (Date.now() < deadline) {
    const probe = new Client({ connectionString: ctx.url, connectionTimeoutMillis: 3000 });
    try {
      await probe.connect();
      await probe.query('SELECT 1');
      await probe.end();
      return;
    } catch (error) {
      lastError = (error as Error)?.message || 'unknown error';
      try {
        await probe.end();
      } catch {
        /* the probe never connected */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`PostgreSQL container never became reachable: ${lastError}`);
}

const runSuite = !ctx.dockerReason;
if (!runSuite) {
  // Visible in the run output — a skipped guarantee must never look like a met one.
  // eslint-disable-next-line no-console
  console.warn(`[MAT-006B] SKIPPING the real-PostgreSQL suite — ${ctx.dockerReason}`);
}

describe.skipIf(!runSuite)('MAT-006B — real PostgreSQL (ephemeral container)', () => {
  beforeAll(async () => {
    ctx.containerId = docker([
      'run',
      '-d',
      '--rm',
      '-e',
      `POSTGRES_PASSWORD=${ctx.password}`,
      '-p',
      `127.0.0.1:${ctx.port}:5432`,
      'postgres:16',
      '-c',
      'fsync=off',
      '-c',
      'full_page_writes=off',
    ]);
    await waitForPostgres();

    // ★ HARD SAFETY GATE. Prove the adapter resolved to the throwaway container
    // before any statement runs. A hosted host here would be a catastrophe, so it
    // is asserted, not assumed.
    const { getDatabaseConfig } = await import('../../../config/DatabaseConfig.js');
    const resolved = getDatabaseConfig().postgres;
    expect(resolved.host).toBe('127.0.0.1');
    expect(resolved.port).toBe(ctx.port);

    admin = new Client({ connectionString: ctx.url });
    await admin.connect();
    // ★ The lost-ACK tests point the cluster at a standby that does not exist,
    // which would otherwise park THIS connection's own commits too. Session-local
    // `local` keeps the instrument working while the subject hangs.
    await admin.query('SET synchronous_commit = local');
    await admin.query(SCHEMA_SQL);
    watcher = new Client({ connectionString: ctx.url });
    await watcher.connect();
    await watcher.query('SET synchronous_commit = local');
    anchorDir = mkdtempSync(path.join(tmpdir(), 'mat006b-anchor-'));
  }, 150_000);

  afterAll(async () => {
    // ★ CLOSE OUR OWN SOCKETS BEFORE THE SERVER VANISHES. A connection that is
    // still open when the postmaster exits receives a FATAL `57P01`, and `pg`
    // emits that on a client nobody is listening to any more — which vitest
    // counts as an unhandled error and fails the whole file.
    //
    // ★ EVERY step is individually guarded, so the container kill below can
    // never be skipped by a failure up here. That ordering rule was written
    // after a leaked PostgreSQL squatted on a random port for the next run.
    try {
      await closePinnedPgPool();
    } catch {
      /* a pool whose clients already died can fail to close cleanly */
    }
    try {
      await resetConnection();
    } catch {
      /* likewise for the adapter's own pool */
    }
    try {
      if (watcher) await watcher.end();
    } catch {
      /* the socket may already be broken */
    }
    try {
      if (admin) await admin.end();
    } catch {
      /* the socket may already be broken */
    }
    if (ctx.containerId) {
      try {
        docker(['kill', ctx.containerId]);
      } catch {
        /* --rm means an already-dead container needs no cleanup */
      }
    }
    for (const key of Object.keys(process.env)) {
      if (!(key in ctx.previousEnv)) delete process.env[key];
    }
    Object.assign(process.env, ctx.previousEnv);
  }, 60_000);

  beforeEach(async () => {
    await dropInjectedFaults();
    await sql('TRUNCATE presentation_decks');
  });

  afterEach(async () => {
    await dropInjectedFaults();
    // A leaked phantom standby would hang the NEXT test's first commit, which
    // would read as a mysterious timeout somewhere unrelated.
    await sql('ALTER SYSTEM RESET synchronous_standby_names');
    await sql('SELECT pg_reload_conf()');
  });

  // -------------------------------------------------------------------------

  describe('the pinned transaction is real', () => {
    it('reports atomicity: pinned-pg on a run that went through a pinned client', async () => {
      const result = await seedAtelierPresentationDecks({
        organizationId: ORG,
        anchorDate: ANCHOR,
      });

      expect(result.failures).toEqual([]);
      expect(result.applied).toBe(true);
      expect(result.decks).toBe(3);
      // ★ The claim under test. On this path it is backed by a real
      // BEGIN/COMMIT; the fault-injection cases below are what PROVE it.
      expect(result.atomicity).toBe('pinned-pg');

      const rows = await sql<{ id: string; slide_count: number; deck_json: string }>(
        'SELECT id, slide_count, deck_json FROM presentation_decks ORDER BY id'
      );
      expect(rows.length).toBe(3);
      for (const row of rows) {
        expect(JSON.parse(row.deck_json).cards.length).toBe(row.slide_count);
      }
    });

    it('GUARD THE PREMISE: a BEGIN sent through DbPromise binds NOTHING — it orphans a transaction in the shared pool', async () => {
      // ★ THE EVIDENCE FOR THE WHOLE PACKET, and it is subtler than "the old way
      // loses rows".
      //
      // Measured here: sending BEGIN through `DbPromise` leaves an OPEN
      // transaction on a client that is then handed straight back to the pool.
      // The caller holds nothing; any later query — from any unrelated request
      // — may be given that same client and silently execute inside a
      // transaction it never opened, to be committed or rolled back by whoever
      // sends the next COMMIT/ROLLBACK.
      //
      // NOT asserted here: that `DbPromise.transaction` loses rows. On an idle
      // pool node-pg keeps handing back the most recently released client, so
      // the statements usually do land together and the batch LOOKS atomic —
      // which is exactly why this defect survived so long. It is luck, not a
      // guarantee, and it evaporates under concurrent traffic. Asserting a
      // specific interleaving here would be a flaky test; asserting the orphaned
      // transaction is deterministic and proves the same thing: the adapter has
      // no transaction context to give.
      const idleInTransaction = async (): Promise<number> => {
        // Measured from a SEPARATE connection on purpose: asking the app pool
        // would hand back the very client under test, which would then report
        // itself as 'active' and hide the finding.
        const rows = await sql<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE state = 'idle in transaction' AND datname = current_database()`
        );
        return Number(rows[0]?.n || 0);
      };

      expect(await idleInTransaction()).toBe(0);
      await DbPromise.run('BEGIN');
      // ★ Nobody is holding this transaction. It is sitting in the pool.
      expect(await idleInTransaction()).toBe(1);
      await DbPromise.run('ROLLBACK');
      expect(await idleInTransaction()).toBe(0);
    });
  });

  describe('fault injection — one refused deck takes the whole batch with it', () => {
    for (const slug of ATELIER_DECK_SLUGS) {
      const deckId = atelierDeckId(ORG, slug);
      it(`rolls back all three when PostgreSQL refuses ${slug}, leaving the pre-state byte-identical`, async () => {
        // Three metadata-only rows: every deck is a planned write, so a refusal
        // of any one of them has two accepted siblings to leave behind.
        await insertMetadataOnly(BOARD, 14, 2);
        await insertMetadataOnly(STEERING, 11, 3);
        await insertMetadataOnly(GROWTH, 9, 4);
        const before = await snapshotAll();

        await injectFaultFor(deckId);
        const result = await seedAtelierPresentationDecks({
          organizationId: ORG,
          anchorDate: ANCHOR,
        });

        expect(result.applied).toBe(false);
        expect(result.decks).toBe(0);
        expect(result.deckIds).toEqual([]);
        expect(result.atomicity).toBe('pinned-pg');
        expect(result.failures.length).toBe(3);
        // The deck that actually caused it is named, not just "something failed".
        const culprit = result.plan.find((p) => p.deckId === deckId);
        expect(culprit?.outcome).toBe('failed');
        expect(culprit?.reason).toMatch(/simulated refusal/i);

        // ★ THE GUARANTEE, measured with a different instrument: every column of
        // every row is exactly what it was.
        expect(await snapshotAll()).toEqual(before);
      });
    }
  });

  describe('TOCTOU — an editor writes between plan and write', () => {
    it('detects the concurrent edit under the lock and rolls the whole transaction back', async () => {
      await insertMetadataOnly(BOARD, 14, 2);
      await insertMetadataOnly(STEERING, 11, 3);
      await insertMetadataOnly(GROWTH, 9, 4);
      const before = await snapshotAll();

      // A second connection plays the presenter. It holds the SAME advisory lock
      // the seed takes, so the seed will block AFTER building its plan and
      // BEFORE writing — the exact window the CAS exists to close.
      const editor = new Client({ connectionString: ctx.url });
      await editor.connect();
      let result: Awaited<ReturnType<typeof seedAtelierPresentationDecks>>;
      try {
        await editor.query('BEGIN');
        await editor.query('SELECT pg_advisory_xact_lock($1::bigint)', [
          advisoryLockKey(`atelier-presentation-decks:${ORG}`),
        ]);

        const pending = seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

        // Wait until the seed is genuinely parked on the lock. Sleeping a fixed
        // interval here would make the race a coin flip and the test a liar.
        const deadline = Date.now() + 30_000;
        let blocked = false;
        while (Date.now() < deadline) {
          const waiting = await sql<{ waiting: string }>(
            `SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`
          );
          if (Number(waiting[0]?.waiting || 0) > 0) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        expect(blocked, 'the seed never waited on the advisory lock').toBe(true);

        // The presenter saves their work INSIDE the window.
        await editor.query(
          `UPDATE presentation_decks
              SET deck_json = $1, unified_json = '{"slides":[]}', version = version + 1,
                  updated_at = '2026-07-15T12:00:00.000Z'
            WHERE id = $2`,
          [HUMAN_CONTENT, STEERING]
        );
        await editor.query('COMMIT');

        result = await pending;
      } finally {
        await editor.end();
      }

      // ★ The plan said "update all three". Under the lock the re-read disagreed,
      // so NOTHING was written — including the two decks whose rows never moved.
      expect(result.applied).toBe(false);
      expect(result.decks).toBe(0);
      expect(result.atomicity).toBe('pinned-pg');
      expect(result.failures.length).toBe(3);
      expect(result.failures.some((f) => /concurrent modification/i.test(f.reason))).toBe(true);
      const drifted = result.plan.find((p) => p.deckId === STEERING);
      expect(drifted?.outcome).toBe('failed');
      expect(drifted?.reason).toMatch(/concurrent modification/i);

      // The presenter's work is intact...
      const steering = await sql<{ deck_json: string; version: number }>(
        'SELECT deck_json, version FROM presentation_decks WHERE id = $1',
        [STEERING]
      );
      expect(steering[0].deck_json).toBe(HUMAN_CONTENT);
      expect(steering[0].version).toBe(4);
      // ...and the two decks the seed WOULD have written are untouched.
      const others = (await snapshotAll()).filter((row) => row.id !== STEERING);
      expect(others).toEqual(before.filter((row) => row.id !== STEERING));
    }, 90_000);
  });

  describe('backup states — verified_absent is proven, unknown is not', () => {
    it('an empty table yields verified_absent, and the rollback may DELETE those ids', async () => {
      const backup = await readAtelierDeckBackup(ORG);
      expect(backup.entries.map((e) => e.state)).toEqual([
        'verified_absent',
        'verified_absent',
        'verified_absent',
      ]);
      expect(backup.complete).toBe(true);

      const rollback = buildRollbackSql(backup);
      expect((rollback.match(/^DELETE FROM/gm) || []).length).toBe(3);
      // And the manifest is executable against the real database.
      await sql(rollback);
    });

    it('a FAILING select yields unknown — and no DELETE can be produced from it', async () => {
      await insertMetadataOnly(STEERING, 11, 3);
      await sql('ALTER TABLE presentation_decks RENAME TO presentation_decks_hidden');
      try {
        const backup = await readAtelierDeckBackup(ORG);
        expect(backup.entries.map((e) => e.state)).toEqual(['unknown', 'unknown', 'unknown']);
        expect(backup.entries.every((e) => (e.error || '').length > 0)).toBe(true);
        expect(backup.complete).toBe(false);

        // ★ THE POINT. "I could not read it" must never become "it was not
        // there" — a DELETE here would destroy a row the seed never touched.
        expect(() => buildRollbackSql(backup)).toThrow(/incomplete backup/i);
      } finally {
        await sql('ALTER TABLE presentation_decks_hidden RENAME TO presentation_decks');
      }

      // The row the failed backup described is of course still there.
      const rows = await sql('SELECT id FROM presentation_decks');
      expect(rows.length).toBe(1);
    });
  });

  describe('snapshot -> materialize -> rollback', () => {
    it('restores all three rows BYTE-IDENTICALLY, every column compared', async () => {
      // A realistic mixed pre-state: one absent (the seed will INSERT), one
      // metadata-only (UPDATE), one carrying a human deck (only `force` writes it).
      await insertMetadataOnly(STEERING, 11, 3);
      await insertHumanEdited(GROWTH);
      const before = await snapshotAll();
      expect(before.map((r) => r.id)).toEqual([GROWTH, STEERING].sort());

      const backup = await readAtelierDeckBackup(ORG);
      expect(backup.complete).toBe(true);
      expect(backup.entries.find((e) => e.deckId === BOARD)?.state).toBe('verified_absent');
      expect(backup.entries.find((e) => e.deckId === STEERING)?.state).toBe('exists');
      expect(backup.entries.find((e) => e.deckId === GROWTH)?.state).toBe('exists');
      const rollback = buildRollbackSql(backup);

      const result = await seedAtelierPresentationDecks({
        organizationId: ORG,
        anchorDate: ANCHOR,
        force: true,
      });
      expect(result.failures).toEqual([]);
      expect(result.applied).toBe(true);
      expect(result.atomicity).toBe('pinned-pg');
      expect(result.decks).toBe(3);

      // Guard the premise: the rollback has to have something to undo.
      const afterSeed = await snapshotAll();
      expect(afterSeed.length).toBe(3);
      expect(afterSeed).not.toEqual(before);

      await sql(rollback);

      // ★ EVERY column of EVERY row, including the ones the earlier ten-column
      // backup would have left as the seed rewrote them (audience, theme,
      // template_id, created_at, description, ...).
      const restored = await snapshotAll();
      expect(restored).toEqual(before);
      // The deck that did not exist before is gone again, not left behind as an
      // orphan the next reader would treat as canonical.
      expect(restored.map((r) => r.id)).not.toContain(BOARD);
    });
  });

  // =========================================================================
  // THE TRANSACTIONAL ROLLBACK EXECUTOR
  //
  // The signed SQL manifest above is an AUDIT artifact. Executing it through a
  // plain write seam is the P1 defect: no lock, so a presenter's save lands
  // between the preflight and the restore; no compare-and-swap, so the restore
  // cannot tell the seed's own row from the edit that replaced it; no rowCount
  // check, so an UPDATE that matched ZERO rows reads exactly like success; and
  // no read-back, so "RESTORED" describes the statement rather than the
  // database. Everything below drives the real executor against the real
  // PostgreSQL and refuses to accept its own return value as evidence — every
  // assertion re-reads the rows with the separate admin client.
  // =========================================================================
  describe('rollback executor — pinned, locked, compare-and-swapped, read back', () => {
    interface Materialized {
      backup: AtelierDeckBackup;
      postState: AtelierDeckPostState[];
      /** The pre-state a rollback must reproduce, every column. */
      before: Array<Record<string, unknown>>;
      /** What the seed left behind — what a REFUSED rollback must leave untouched. */
      afterSeed: Array<Record<string, unknown>>;
    }

    /**
     * A realistic mixed pre-state, then a real materialization:
     *   BOARD    absent before  -> the seed INSERTs   -> rollback must DELETE
     *   STEERING metadata-only  -> the seed UPDATEs   -> rollback must UPDATE
     *   GROWTH   human deck     -> `force` overwrites -> rollback must UPDATE
     * So one run exercises both restore statements.
     */
    async function materialize(): Promise<Materialized> {
      await insertMetadataOnly(STEERING, 11, 3);
      await insertHumanEdited(GROWTH);
      const before = await snapshotAll();

      const backup = await readAtelierDeckBackup(ORG);
      expect(backup.complete).toBe(true);
      expect(backup.entries.find((e) => e.deckId === BOARD)?.state).toBe('verified_absent');

      const result = await seedAtelierPresentationDecks({
        organizationId: ORG,
        anchorDate: ANCHOR,
        force: true,
      });
      expect(result.failures).toEqual([]);
      expect(result.applied).toBe(true);
      expect(result.atomicity).toBe('pinned-pg');
      expect(result.postState.length).toBe(3);

      const afterSeed = await snapshotAll();
      expect(afterSeed).not.toEqual(before);
      return { backup, postState: result.postState, before, afterSeed };
    }

    // -----------------------------------------------------------------------

    it('takes the SAME advisory lock key the seed write takes — one definition, not two spellings', () => {
      // The two blocking tests in this file hold the lock by VALUE: the TOCTOU
      // test above parks the SEED on `advisoryLockKey('atelier-presentation-decks:'
      // + ORG)`, and the CAS test below parks the ROLLBACK on
      // `atelierDeckLockKey(ORG)`. This closes the chain between them: the same
      // number, so the same lock, so the two paths really do serialise.
      expect(atelierDeckLockKey(ORG)).toBe(advisoryLockKey(`atelier-presentation-decks:${ORG}`));
    });

    it('records a post-state whose timestamps are the DATABASE rendering, never a JS Date', async () => {
      const { postState } = await materialize();

      expect(postState.map((s) => s.deckId).sort()).toEqual([BOARD, GROWTH, STEERING].sort());
      expect(postState.every((s) => s.state === 'exists')).toBe(true);
      expect(postState.every((s) => s.organizationId === ORG)).toBe(true);
      expect(postState.every((s) => (s.contentFingerprint || '').length === 64)).toBe(true);
      expect(postState.every((s) => s.status === 'ready')).toBe(true);

      // ★ `CAST(updated_at AS TEXT)` on a `timestamp WITHOUT time zone` renders
      // '2026-06-01 00:00:00'. An ISO 'T'/'Z' here would mean a JS `Date` round
      // trip happened — which shifts the value by the process timezone offset and
      // silently breaks the CAS on every host that is not UTC.
      for (const state of postState) {
        expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
        expect(state.updatedAt).not.toMatch(/[TZ]/);
      }

      // And the read-only reader agrees with what the seed captured under the lock.
      const reread = await readAtelierDeckPostState(ORG);
      expect(reread).toEqual(postState);
    });

    it('SCENARIO 8 — a correct rollback restores all 24 columns BYTE-IDENTICALLY and only then says restored', async () => {
      const { backup, postState, before } = await materialize();

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.restored).toBe(true);
      // The read-back it returns is the two rows it restored, all 24 columns.
      const returned = outcome.ok ? outcome.rows : [];
      expect(returned.map((r) => r.id).sort()).toEqual([GROWTH, STEERING].sort());
      for (const row of returned) {
        const backedUp = backup.entries.find((e) => e.deckId === row.id)?.row;
        expect(row).toEqual(backedUp);
      }

      // ★ Measured with a different instrument: every column of every row is
      // exactly what it was before the materialization, and the inserted deck is
      // gone rather than left as an orphan.
      expect(await snapshotAll()).toEqual(before);
      expect((await snapshotAll()).map((r) => r.id)).not.toContain(BOARD);
    });

    it('SCENARIO 1 + GUARD — a write landing after the preflight but before the lock is caught by the CAS', async () => {
      const { backup, postState, afterSeed } = await materialize();

      // The operator's preflight runs HERE: no editors, no drift, green light.
      // Everything it saw is a rumour the moment it returns — which is the whole
      // point of this test.
      const preflight = await readAtelierDeckPostState(ORG);
      expect(preflight).toEqual(postState);

      const presenter = new Client({ connectionString: ctx.url });
      await presenter.connect();
      let outcome: Awaited<ReturnType<typeof rollbackAtelierDecksOnPinnedClient>>;
      try {
        // The presenter takes the SAME advisory lock the rollback will ask for,
        // so the rollback parks after its preflight and before its re-read.
        await presenter.query('BEGIN');
        await presenter.query('SELECT pg_advisory_xact_lock($1::bigint)', [
          atelierDeckLockKey(ORG),
        ]);

        const pending = rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });

        // ★ PROOF THE ROLLBACK TAKES THAT EXACT KEY: it is waiting on it. A
        // fixed sleep here would make this a coin flip.
        const deadline = Date.now() + 30_000;
        let blocked = false;
        while (Date.now() < deadline) {
          const waiting = await sql<{ waiting: number }>(
            `SELECT count(*)::int AS waiting FROM pg_locks
              WHERE locktype = 'advisory' AND NOT granted`
          );
          if (Number(waiting[0]?.waiting || 0) > 0) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        expect(blocked, 'the rollback never waited on the advisory lock').toBe(true);

        // The presenter saves their work INSIDE the window the old code left open.
        await presenter.query(
          `UPDATE presentation_decks
              SET deck_json = $1, unified_json = '{"slides":[]}', version = version + 1,
                  updated_at = '2026-07-20T10:00:00.000Z'
            WHERE id = $2`,
          [HUMAN_CONTENT, STEERING]
        );
        await presenter.query('COMMIT');

        outcome = await pending;
      } finally {
        await presenter.end();
      }

      // ★ WITHOUT THE LOCK the rollback would have re-read BEFORE this save and
      // the CAS would have agreed; without the CAS the re-read would have been
      // pointless. Either omission turns this assertion red and destroys the
      // presenter's deck instead.
      expect(outcome.ok).toBe(false);
      expect(outcome.restored).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('cas');
        expect(outcome.reason).toMatch(/version|content fingerprint|updated_at/i);
        expect(outcome.reason).toContain(STEERING);
      }

      // The presenter's work survived, and NOTHING was restored — not even the
      // two decks whose rows never moved.
      const steering = await sql<{ deck_json: string }>(
        'SELECT deck_json FROM presentation_decks WHERE id = $1',
        [STEERING]
      );
      expect(steering[0].deck_json).toBe(HUMAN_CONTENT);
      const others = (await snapshotAll()).filter((row) => row.id !== STEERING);
      expect(others).toEqual(afterSeed.filter((row) => row.id !== STEERING));
    }, 90_000);

    it('GUARD — a deliberately STALE expectedPostState is refused, and the fresh one is accepted', async () => {
      // The stale fingerprint is the pre-materialization state: exactly what a
      // manifest would carry if the post-state were captured at the wrong moment,
      // and exactly what an executor with no CAS would happily accept.
      await insertMetadataOnly(STEERING, 11, 3);
      await insertHumanEdited(GROWTH);
      const before = await snapshotAll();
      const backup = await readAtelierDeckBackup(ORG);
      const stale = await readAtelierDeckPostState(ORG);

      const seeded = await seedAtelierPresentationDecks({
        organizationId: ORG,
        anchorDate: ANCHOR,
        force: true,
      });
      expect(seeded.applied).toBe(true);
      const afterSeed = await snapshotAll();

      const refused = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: stale,
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.stage).toBe('cas');
      // Nothing moved: a refusal is a refusal, not a partial restore.
      expect(await snapshotAll()).toEqual(afterSeed);

      // ★ CONTROL. The same call with the CORRECT post-state succeeds — so the
      // refusal above is the CAS doing its job, not the executor being broken.
      const accepted = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: seeded.postState,
      });
      expect(accepted.ok).toBe(true);
      expect(await snapshotAll()).toEqual(before);
    });

    it('SCENARIO 2 — version, updated_at and content drift after the materialization each refuse the rollback', async () => {
      const cases: Array<{ name: string; mutate: string; reason: RegExp }> = [
        {
          name: 'version',
          mutate: `UPDATE presentation_decks SET version = version + 1 WHERE id = '${STEERING}'`,
          reason: /version is 3, manifest recorded 2|version is \d+, manifest recorded \d+/i,
        },
        {
          name: 'updated_at',
          mutate: `UPDATE presentation_decks SET updated_at = '2026-07-21T11:00:00' WHERE id = '${STEERING}'`,
          reason: /updated_at is /i,
        },
        {
          name: 'content fingerprint',
          mutate: `UPDATE presentation_decks SET deck_json = '{"cards":[]}' WHERE id = '${STEERING}'`,
          reason: /content fingerprint changed/i,
        },
      ];

      for (const testCase of cases) {
        await sql('TRUNCATE presentation_decks');
        const { backup, postState } = await materialize();
        await sql(testCase.mutate);
        const afterEdit = await snapshotAll();

        const outcome = await rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });

        expect(outcome.ok, `drift in ${testCase.name} was NOT refused`).toBe(false);
        expect(outcome.restored).toBe(false);
        if (!outcome.ok) {
          expect(outcome.stage).toBe('cas');
          expect(outcome.reason).toMatch(testCase.reason);
        }
        // The edit is intact and no sibling row was touched either.
        expect(await snapshotAll()).toEqual(afterEdit);
      }
    }, 90_000);

    it('SCENARIO 3 — an UPDATE that matches ZERO rows never reports RESTORED', async () => {
      const { backup, postState, afterSeed } = await materialize();

      // A real database-side swallow: the statement succeeds, the row does not
      // change, `rowCount` is 0. The old executor could not tell this from a
      // restore. Note the DELETE of the inserted deck runs FIRST and lands — so
      // this also proves the abort takes an already-applied statement with it.
      await injectSwallow(STEERING, 'UPDATE');

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.restored).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('write');
        expect(outcome.reason).toMatch(/matched 0 rows, expected exactly 1/i);
        expect(outcome.reason).toContain(STEERING);
      }
      // Including the deck whose DELETE had already succeeded inside the tx.
      expect(await snapshotAll()).toEqual(afterSeed);
    });

    it('SCENARIO 4a — a DELETE that matches ZERO rows never reports RESTORED', async () => {
      const { backup, postState, afterSeed } = await materialize();
      await injectSwallow(BOARD, 'DELETE');

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('write');
        expect(outcome.reason).toMatch(/DELETE of .* matched 0 rows/i);
      }
      expect(await snapshotAll()).toEqual(afterSeed);
    });

    it('SCENARIO 4b — a DELETE that matches MORE THAN ONE row never reports RESTORED', async () => {
      const { backup, postState } = await materialize();

      // A duplicate id can only exist without the primary key — which is exactly
      // the state a botched migration leaves behind, and the reason the executor
      // demands `rowCount === 1` rather than `>= 1`. The copy is byte-identical,
      // so the CAS legitimately agrees and the DELETE is what has to catch it.
      await sql('ALTER TABLE presentation_decks DROP CONSTRAINT presentation_decks_pkey');
      await sql('INSERT INTO presentation_decks SELECT * FROM presentation_decks WHERE id = $1', [
        BOARD,
      ]);
      const afterDuplicate = await snapshotAll();
      expect(afterDuplicate.filter((r) => r.id === BOARD).length).toBe(2);

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('write');
        expect(outcome.reason).toMatch(/DELETE of .* matched 2 rows/i);
      }
      // Both copies are still there: a rollback that deleted "one of them" would
      // have left a row nobody can account for.
      expect(await snapshotAll()).toEqual(afterDuplicate);
    });

    it('SCENARIO 5 — a failure AFTER the first row is restored takes the whole rollback with it', async () => {
      const { backup, postState, afterSeed } = await materialize();

      // The restore order is the canonical slug order: DELETE board, UPDATE
      // steering, UPDATE growth. Refusing the LAST one means two statements have
      // already changed rows inside the transaction when it aborts.
      await injectFaultFor(GROWTH);

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.restored).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('write');
        expect(outcome.reason).toMatch(/simulated refusal/i);
      }

      // ★ EVERY column of EVERY row is exactly what it was the moment before the
      // rollback ran — including the deck that WAS deleted and the deck that WAS
      // updated earlier in the same transaction.
      expect(await snapshotAll()).toEqual(afterSeed);
    });

    it('SCENARIO 6 — a read-back differing in exactly ONE of the 24 columns rolls back instead of reporting RESTORED', async () => {
      const { backup, postState, afterSeed } = await materialize();

      // The UPDATE reports `rowCount === 1` and everything the executor asked for
      // lands — except `theme`, which the database quietly rewrites. Only a
      // column-by-column read-back can see it.
      await injectSingleColumnTamper(STEERING, 'tampered-by-a-trigger');

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.restored).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('readback');
        expect(outcome.reason).toMatch(/column 'theme' read back as/i);
      }
      expect(await snapshotAll()).toEqual(afterSeed);
    });

    // ★ WHAT THIS DOES AND DOES NOT PROVE. It proves the composition: a row that
    // materialises around the DELETE is neither destroyed nor counted, and the
    // rollback refuses instead of reporting RESTORED. It does NOT prove the
    // executor's identity guard (`version` / `updated_at` in the DELETE's WHERE):
    // removing that guard leaves this test green, because PostgreSQL's own
    // snapshot already hides an insert made by the statement's BEFORE trigger.
    // The race the identity guard actually addresses — ANOTHER SESSION inserting
    // this id and committing between our `SELECT ... FOR UPDATE` and our DELETE —
    // has no scheduling point an in-process test can hold, so the guard is
    // reasoned and positively exercised by the happy path, not negatively tested.
    it('a row conjured into existence during the DELETE is neither removed nor counted as a restore', async () => {
      const { backup } = await materialize();

      // Make the id genuinely absent again and re-fingerprint, so the CAS
      // legitimately agrees that there is nothing there. `FOR UPDATE` cannot lock
      // a row that does not exist, which is why the DELETE additionally targets
      // the exact version and updated_at the CAS approved — here, none at all.
      await sql('DELETE FROM presentation_decks WHERE id = $1', [BOARD]);
      const fresh = await readAtelierDeckPostState(ORG);
      expect(fresh.find((s) => s.deckId === BOARD)?.state).toBe('absent');

      // ★ GUARD THE PREMISE. A refusal proves nothing if the racer never fired —
      // "matched 0 rows" is also what an empty table says. Fire it once from the
      // admin connection and check the stranger's row really does appear.
      await injectLateInsertRacer(BOARD);
      await sql(`DELETE FROM presentation_decks WHERE id = '__probe_no_such_id__'`);
      const conjured = await sql<{ id: string }>(
        'SELECT id FROM presentation_decks WHERE id = $1',
        [BOARD]
      );
      expect(conjured.length, 'the late-insert racer never fired').toBe(1);
      await dropInjectedFaults();
      await sql('DELETE FROM presentation_decks WHERE id = $1', [BOARD]);
      const afterDelete = await snapshotAll();
      expect(afterDelete.map((r) => r.id)).not.toContain(BOARD);

      await injectLateInsertRacer(BOARD);

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: fresh,
      });

      // No stranger row was destroyed and nothing was called RESTORED.
      //
      // ★ WHAT THIS PROVES, STATED HONESTLY. This deck was absent before the run
      // AND absent after it, so there is nothing to undo and the executor issues
      // no delete for it — forcing a `rowCount === 1` delete would fail a
      // rollback in which every deck is already in its target state. The stranger
      // row therefore arrives while the OTHER decks are being restored.
      //
      // The refusal comes from the write stage rather than the read-back: the
      // racer fires once per statement, so its second insert of the same id
      // collides on the primary key and aborts the transaction. That is a weaker
      // mechanism than a deliberate check — it happens to be the first thing that
      // trips — so this test is evidence for the OUTCOME (nothing destroyed,
      // nothing called RESTORED, table untouched), not for a specific guard.
      // The read-back's absence assertion is exercised directly by the
      // one-column-drift test instead.
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('write');
      }
      // The trigger's INSERT happened inside OUR transaction, so ROLLBACK took it
      // with it: the table is exactly as it was before the attempt.
      expect(await snapshotAll()).toEqual(afterDelete);
    });

    it('refuses an INCOMPLETE backup before it opens a transaction at all', async () => {
      const { backup, postState, afterSeed } = await materialize();

      const crippled: AtelierDeckBackup = {
        ...backup,
        complete: false,
        entries: backup.entries.map((entry, index) =>
          index === 1 ? { ...entry, state: 'unknown', row: null, error: 'read timed out' } : entry
        ),
      };

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup: crippled,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toMatch(/INCOMPLETE backup/i);
      expect(await snapshotAll()).toEqual(afterSeed);
    });

    it('refuses when the manifest carries no post-state for a deck — there is nothing to swap against', async () => {
      const { backup, postState, afterSeed } = await materialize();

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState.filter((state) => state.deckId !== GROWTH),
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('cas');
        expect(outcome.reason).toContain(GROWTH);
      }
      expect(await snapshotAll()).toEqual(afterSeed);
    });

    // ★ LAST ON PURPOSE: it kills a pooled backend, so it runs after everything
    // that wants a healthy pool.
    it('SCENARIO 7 — the connection dropped before COMMIT is never reported as a success', async () => {
      const { backup, postState, afterSeed } = await materialize();

      // The trigger terminates the rollback's OWN backend in the middle of the
      // last restore statement: the transaction is open, two statements have
      // already changed rows, and the COMMIT will never be sent.
      //
      // ★ THIS TEST ALSO GUARDS THE PROCESS. The first version of it reported a
      // perfectly correct rollback outcome AND an unhandled `Connection
      // terminated unexpectedly` — `pg` removes its own error listener from a
      // CHECKED-OUT client, so a mid-transaction connection death was an uncaught
      // exception. `withPinnedPgTransaction` now listens for the duration of the
      // checkout and destroys the client on release; vitest fails the run on any
      // unhandled error, so a regression there turns this file red again.
      await injectBackendKill(GROWTH);

      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.restored).toBe(false);
      if (!outcome.ok) {
        // ★ Pinned to the ACTUAL cause. Without this the test would pass just as
        // happily on a rollback that failed for some unrelated reason and never
        // exercised a dropped connection at all.
        expect(outcome.reason).toMatch(
          /terminat|connection|socket|server closed|shutdown|administrator command/i
        );
      }

      // The server rolled the abandoned transaction back, and the executor did
      // not claim otherwise. Both halves matter: a `restored: true` here would be
      // a lie about a database that never committed anything.
      expect(await snapshotAll()).toEqual(afterSeed);

      // The pool now holds a dead client; drop it so nothing after this inherits it.
      await closePinnedPgPool();
    }, 60_000);

    // =======================================================================
    // ★ ROUND 5 — THE COMMIT RESULT IS NOT A GUESS
    //
    // Everything above this line assumed a failed COMMIT meant a rolled-back
    // transaction. That assumption is wrong in exactly one case, and it is the
    // expensive one: the server commits and the acknowledgement never arrives.
    // Reporting "rolled back, nothing changed" there tells an operator a
    // falsehood about a database that changed under them.
    //
    // These tests produce that case for real (see `armLostCommitAck`) and pin
    // down all three states plus the reconciliation that resolves them.
    // =======================================================================
    describe('an ambiguous COMMIT', () => {
      it('LOST ACK — a COMMIT the server executed but never acknowledged is INDETERMINATE, and a fresh read finds the write COMMITTED', async () => {
        await insertMetadataOnly(STEERING, 11, 3);
        const title = 'committed, but the acknowledgement never arrived';

        await armLostCommitAck();
        // The killer waits for the SERVER to be provably inside the commit —
        // no sleep, no coin flip.
        const killer = waitForCommitInFlight().then(async (pid) => {
          await terminateBackend(pid);
          return pid;
        });

        const outcome = await withPinnedPgTransaction(async (client) => {
          await client.query('UPDATE presentation_decks SET title = $1 WHERE id = $2', [
            title,
            STEERING,
          ]);
          return 'work done';
        });
        const killedPid = await killer;
        await disarmLostCommitAck();

        expect(killedPid).toBeGreaterThan(0);
        expect(outcome.available).toBe(true);
        if (outcome.available) {
          // ★ THE WHOLE POINT. Not `rolled_back`.
          expect(outcome.state).toBe('indeterminate');
          if (outcome.state === 'indeterminate') {
            expect(outcome.error).toMatch(/UNKNOWN/);
            expect(outcome.error).not.toMatch(/nothing was (changed|written)/i);
          }
        }

        // ★ MEASURED WITH A DIFFERENT INSTRUMENT: the separate admin connection
        // shows the row IS updated. The transaction the seam refused to call
        // "rolled back" is in fact committed — which is precisely why calling it
        // rolled back would have been a lie.
        const rows = await sql<{ title: string }>(
          'SELECT title FROM presentation_decks WHERE id = $1',
          [STEERING]
        );
        expect(rows[0].title).toBe(title);
      }, 90_000);

      it('DROPPED BEFORE THE COMMIT — a connection known dead before dispatch is rolled_back, and the row never moved', async () => {
        await insertMetadataOnly(STEERING, 11, 3);
        const before = await snapshotAll();

        const outcome = await withPinnedPgTransaction(async (client) => {
          await client.query('UPDATE presentation_decks SET title = $1 WHERE id = $2', [
            'this must never be visible',
            STEERING,
          ]);
          const pid = Number(
            (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
          );
          await terminateBackend(pid);
          // ★ Force the client to OBSERVE the death BEFORE the COMMIT is
          // dispatched. Without this the failure would surface at the COMMIT
          // itself, which is the (correctly) ambiguous case instead of this one.
          try {
            await client.query('SELECT 1');
          } catch {
            /* expected: the backend is gone */
          }
          return 'work done';
        });

        expect(outcome.available).toBe(true);
        if (outcome.available) {
          expect(outcome.state).toBe('rolled_back');
          if (outcome.state === 'rolled_back') {
            expect(outcome.error).toMatch(/never sent/i);
          }
        }
        // The server discarded the open transaction; a fresh read proves it.
        expect(await snapshotAll()).toEqual(before);
        await closePinnedPgPool();
      }, 60_000);

      it('DROPPED BEFORE THE COMMIT — the rollback refuses, and a FRESH re-read identifies every deck as post-state', async () => {
        const { backup, postState, afterSeed } = await materialize();

        await injectBackendKill(GROWTH);
        const outcome = await rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });
        expect(outcome.ok).toBe(false);
        expect(outcome.restored).toBe(false);
        await dropInjectedFaults();

        // ★ THE RECONCILIATION ITSELF, ON THE STATE IT HAS TO READ CORRECTLY.
        // Every deck still carries what the materialization left, so the verdict
        // is "the restore did not take effect" — a fact read from the database,
        // not inferred from an error message.
        const reconciliation = await reconcileAtelierDeckRollback({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });
        expect(reconciliation.verdict).toBe('post-state');
        expect(reconciliation.observed.map((o) => o.matches)).toEqual([
          'post-state',
          'post-state',
          'post-state',
        ]);
        expect(await snapshotAll()).toEqual(afterSeed);
        await closePinnedPgPool();
      }, 90_000);

      it('LOST ACK on the ROLLBACK — a fresh re-read showing the pre-state proves the restore DID commit', async () => {
        const { backup, postState, before } = await materialize();

        await armLostCommitAck();
        const killer = waitForCommitInFlight().then(async (pid) => {
          await terminateBackend(pid);
          return pid;
        });
        const outcome = await rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });
        await killer;
        await disarmLostCommitAck();

        // The executor could not know from the COMMIT; it found out by reading.
        expect(outcome.ok).toBe(true);
        expect(outcome.restored).toBe(true);
        // ★ And the claim is true: every column of every row is the pre-state.
        expect(await snapshotAll()).toEqual(before);
      }, 90_000);

      it('MIXED — an ambiguous COMMIT whose fresh re-read matches NEITHER state is never a RESTORED, and asks for an operator', async () => {
        const { backup, postState } = await materialize();

        // A commit-time tamper the executor's pre-COMMIT read-back cannot see:
        // two decks come back at the pre-state, one comes back at neither.
        await injectCommitTimeTamper(STEERING, GROWTH, 'tampered-at-commit-time');

        await armLostCommitAck();
        const killer = waitForCommitInFlight().then(async (pid) => {
          await terminateBackend(pid);
          return pid;
        });
        const outcome = await rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });
        await killer;
        await disarmLostCommitAck();

        expect(outcome.ok).toBe(false);
        expect(outcome.restored).toBe(false);
        expect(outcome.ok === false && outcome.stage).toBe('indeterminate');
        if (outcome.ok === false && outcome.stage === 'indeterminate') {
          expect(outcome.needsOperator).toBe(true);
          expect(outcome.verdict).toBe('mixed');
          const seen = new Map(outcome.observed.map((o) => [o.deckId, o.matches]));
          expect(seen.get(GROWTH)).toBe('neither');
          expect(seen.get(STEERING)).toBe('pre-state');
          expect(seen.get(BOARD)).toBe('pre-state');
          expect(outcome.reason).toContain(GROWTH);
          // ★ THE WORDING BAN, ENFORCED.
          expect(outcome.reason).not.toMatch(
            /nothing was (changed|restored)|transaction rolled back/i
          );
        }

        // The ambiguous transaction really did commit — the tamper is on disk.
        const growth = await sql<{ theme: string }>(
          'SELECT theme FROM presentation_decks WHERE id = $1',
          [GROWTH]
        );
        expect(growth[0].theme).toBe('tampered-at-commit-time');
      }, 90_000);

      // =====================================================================
      // ★ ROUND 5b — AN AMBIGUOUS COMMIT NEVER BORROWS A DETERMINATE STAGE,
      //   AND A READ THAT DID NOT HAPPEN IS NOT A VERDICT
      // =====================================================================

      it('★ NOT-APPLIED — a COMMIT that died inside commit processing stays INDETERMINATE and is never called a self-rollback', async () => {
        const { backup, postState, afterSeed } = await materialize();

        // Dies at `AfterTriggerFireDeferred()`, i.e. inside COMMIT and BEFORE
        // the commit record: dispatched, unanswered, and genuinely not applied.
        await injectCommitTimeBackendDeath();

        const outcome = await rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });
        await dropInjectedFaults();

        expect(outcome.ok).toBe(false);
        expect(outcome.restored).toBe(false);
        // ★ THE FIX. The previous cut returned `stage: 'write'` here — a
        // DETERMINATE stage, which routes the runner into "the executor rolled
        // its own transaction back, so nothing was changed". The executor rolled
        // nothing back: it sent a COMMIT and never learned the answer. The
        // difference is carried by `verdict`, not by borrowing a stage.
        expect(outcome.ok === false && outcome.stage).toBe('indeterminate');
        if (outcome.ok === false && outcome.stage === 'indeterminate') {
          expect(outcome.verdict).toBe('not-applied');
          expect(outcome.needsOperator).toBe(true);
          expect(outcome.observed.map((o) => o.matches)).toEqual([
            'post-state',
            'post-state',
            'post-state',
          ]);
          // ★ THE BANNED SENTENCE, ENFORCED AT THE SOURCE.
          expect(outcome.reason).not.toMatch(
            /rolled (its own )?transaction back|nothing was changed/i
          );
          // What IS said: the rows are not restored, and a re-run starts from
          // the top rather than from the write.
          expect(outcome.reason).toMatch(/preflight/i);
        }

        // Measured with the separate admin connection: the restore really is not
        // in the database, so `not-applied` is a fact and not a consolation.
        expect(await snapshotAll()).toEqual(afterSeed);
        await closePinnedPgPool();
      }, 90_000);

      it('★ F3 — while the in-doubt transaction still holds the tenant lock there is NO verdict at all', async () => {
        const { backup, postState } = await materialize();

        // ★ THE CASE THE OLD RECONCILIATION COULD NOT SEE. Every ambiguity this
        // file produces elsewhere is made by KILLING a backend, and a dead
        // backend has always already settled. A network partition or a proxy
        // timeout does not kill anything: the backend is alive, inside
        // `CommitTransaction`, and the rows are about to change. A plain MVCC
        // SELECT taken now reads "not applied" and would be wrong milliseconds
        // later. Holding the tenant lock from another session is exactly what an
        // undecided transaction looks like to the reconciliation.
        await watch('BEGIN');
        try {
          await watch('SELECT pg_advisory_xact_lock($1::bigint)', [atelierDeckLockKey(ORG)]);

          const undecided = await reconcileAtelierDeckRollback({
            organizationId: ORG,
            backup,
            expectedPostState: postState,
          });

          expect(undecided.verdict).toBe('unreadable');
          expect(undecided.observed.map((o) => o.matches)).toEqual([
            'unreadable',
            'unreadable',
            'unreadable',
          ]);
          expect(undecided.rows).toEqual([]);
          expect(undecided.detail).toMatch(/advisory lock/i);
          expect(undecided.detail).toMatch(/not decided|has NOT decided/i);
          // It must NOT be either real verdict — those are claims about rows it
          // never read.
          expect(undecided.verdict).not.toBe('post-state');
          expect(undecided.verdict).not.toBe('pre-state');
        } finally {
          await watch('COMMIT');
        }

        // ★ AND THE LOCK IS THE ONLY REASON. The SAME call, against the SAME
        // rows, one statement later — now that the holder has ended — produces
        // the real verdict. Without this half the test would also pass on a
        // reconciliation that had simply broken.
        const settled = await reconcileAtelierDeckRollback({
          organizationId: ORG,
          backup,
          expectedPostState: postState,
        });
        expect(settled.verdict).toBe('post-state');
        expect(settled.observed.map((o) => o.matches)).toEqual([
          'post-state',
          'post-state',
          'post-state',
        ]);
      }, 90_000);

      it('★ F3 — the reconciliation connection cannot wait forever: a black-holed statement is bounded', async () => {
        // `connectionTimeoutMillis` alone only covers the handshake. A socket
        // that connects and then goes silent — the expected input on a recovery
        // path reached BECAUSE a connection stopped answering — would otherwise
        // make `client.query` (and the `client.end()` in the `finally`) wait
        // forever, and the "never throws" contract would be honoured by never
        // returning at all. `pg_sleep` stands in for that silence; the bound is
        // what is being measured, not the sleep.
        const started = Date.now();
        const outcome = await withFreshPgConnection(async (client) => {
          await client.query('SELECT pg_sleep(120)');
          return 'never reached';
        });
        const elapsed = Date.now() - started;

        expect(outcome.available).toBe(true);
        expect(outcome.available && outcome.ok).toBe(false);
        if (outcome.available && outcome.ok === false) {
          expect(outcome.error).toMatch(/timeout|statement timeout|canceling statement/i);
        }
        // Comfortably under the 120s sleep, and under this test's own timeout.
        expect(elapsed).toBeLessThan(45_000);
      }, 90_000);
    });

    // =======================================================================
    // ★ ROUND 5 — THE RECOVERY ANCHOR IS DURABLE **BEFORE** THE COMMIT
    //
    // The old order was: commit, then re-sign the manifest with the post-state.
    // A death in that window left a CHANGED database, a manifest with no
    // post-state, and an automatic rollback that correctly refuses to run — a
    // change nobody could safely undo. These tests pin the new order down from
    // both sides: what happens if the anchor cannot be written, and what an
    // operator finds on disk after a death on either side of the COMMIT.
    // =======================================================================
    describe('the recovery anchor precedes the commit', () => {
      async function mixedPreState(): Promise<Array<Record<string, unknown>>> {
        await insertMetadataOnly(STEERING, 11, 3);
        await insertHumanEdited(GROWTH);
        return snapshotAll();
      }

      it('a recovery anchor that cannot be persisted ABORTS the transaction — the rows never change', async () => {
        const before = await mixedPreState();

        const result = await seedAtelierPresentationDecks({
          organizationId: ORG,
          anchorDate: ANCHOR,
          force: true,
          persistRecoveryAnchor: async () => {
            throw new Error('no space left on device');
          },
        });

        expect(result.applied).toBe(false);
        expect(result.atomicity).toBe('pinned-pg');
        expect(result.commitState).toBe('rolled_back');
        expect(result.failures.length).toBeGreaterThan(0);
        expect(result.failures.map((f) => f.reason).join(' | ')).toMatch(
          /recovery anchor.*durable before COMMIT|no space left on device/i
        );
        // ★ Byte-identical, and the deck the seed would have INSERTED is absent.
        expect(await snapshotAll()).toEqual(before);
        expect((await snapshotAll()).map((r) => r.id)).not.toContain(BOARD);
      }, 60_000);

      it('DEATH AFTER THE ANCHOR, BEFORE THE COMMIT — the database stays in its pre-state and the anchor still refuses to corrupt it', async () => {
        const before = await mixedPreState();
        const backup = await readAtelierDeckBackup(ORG);
        const file = path.join(anchorDir, 'death-before-commit.json');
        let visibleWhileAnchoring: number | null = null;

        const result = await seedAtelierPresentationDecks({
          organizationId: ORG,
          anchorDate: ANCHOR,
          force: true,
          persistRecoveryAnchor: async (postState) => {
            writeSignedAnchor(file, { organizationId: ORG, postState });
            // ★ ORDERING, MEASURED. At this instant the anchor is on disk and
            // the transaction has NOT committed: another session cannot see the
            // inserted deck. Move this callback after the COMMIT and this reads 1.
            visibleWhileAnchoring = await seededInsertVisibleElsewhere();
            // Now the process "dies": its backend is terminated with the anchor
            // durable and the transaction still open.
            await terminateBackend(await pinnedBackendPid());
          },
        });

        expect(visibleWhileAnchoring).toBe(0);
        expect(result.applied).toBe(false);
        // Either verdict is honest here — what must NOT happen is a claim that
        // the rows landed.
        expect(['rolled_back', 'indeterminate']).toContain(result.commitState);
        expect(await snapshotAll()).toEqual(before);

        // The anchor survived the death, signed, carrying a full post-state...
        const recovered = readSignedAnchor(file);
        expect(recovered.postState.length).toBe(3);

        // ...and describes a transaction that never landed, so the rollback's
        // compare-and-swap refuses it instead of writing anything.
        const outcome = await rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: recovered.postState,
        });
        expect(outcome.ok).toBe(false);
        expect(outcome.ok === false && outcome.stage).toBe('cas');
        expect(await snapshotAll()).toEqual(before);
        await closePinnedPgPool();
      }, 90_000);

      it('DEATH IMMEDIATELY AFTER THE COMMIT — the signed anchor already carries the post-state, and it ALONE can undo the run', async () => {
        const before = await mixedPreState();
        const backup = await readAtelierDeckBackup(ORG);
        const file = path.join(anchorDir, 'death-after-commit.json');
        let visibleWhileAnchoring: number | null = null;

        const result = await seedAtelierPresentationDecks({
          organizationId: ORG,
          anchorDate: ANCHOR,
          force: true,
          persistRecoveryAnchor: async (postState) => {
            writeSignedAnchor(file, { organizationId: ORG, postState });
            visibleWhileAnchoring = await seededInsertVisibleElsewhere();
          },
        });

        expect(visibleWhileAnchoring).toBe(0);
        expect(result.applied).toBe(true);
        expect(result.commitState).toBe('committed');
        expect(await seededInsertVisibleElsewhere()).toBe(1);

        // ★ THE SIMULATED DEATH: nothing that runs after the COMMIT contributes
        // to the anchor, so the recovery path is driven from the FILE alone —
        // `result` is used only to prove the two agree.
        const recovered = readSignedAnchor(file);
        expect(recovered.postState).toEqual(result.postState);

        const outcome = await rollbackAtelierDecksOnPinnedClient({
          organizationId: ORG,
          backup,
          expectedPostState: recovered.postState,
        });
        expect(outcome.ok).toBe(true);
        expect(outcome.restored).toBe(true);
        expect(await snapshotAll()).toEqual(before);
      }, 90_000);
    });
  });
});
