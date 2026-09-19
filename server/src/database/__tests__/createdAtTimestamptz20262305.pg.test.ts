/**
 * D-03 / QD16 ETAP 1 (DEC-660) — migration 20262305 converts `created_at` from
 * text to timestamptz on 24 tables, proved against a REAL PostgreSQL.
 *
 * WHY A REAL-DB TEST: the whole content of this migration is WHICH tables it
 * touches, WHAT it does to the stored bytes, and WHAT it refuses to do. A string
 * assertion on the .sql sees none of that: it cannot show that the instant of
 * every row survives the cast, that a second pass is a no-op (the file is picked
 * up twice — migrationIdentity.ts:56 also matches eight-digit names), that a
 * non-castable value stops the migration instead of being guessed at, or that the
 * rollback returns the TEXT byte-for-byte in the shape the table stored
 * (KANON `...+00` vs ISO-Z `...Z` — one shared form would corrupt one of them).
 * So this suite creates its OWN throwaway database, builds the 24 tables with the
 * measured defaults and stored shapes, applies the REAL migration files and
 * re-reads over the same connection after each step.
 *
 * MUTATIONS (negative controls, each measured RED and reverted):
 *   M1 remove the pg_input_is_valid fail-closed block from 20262305 -> the
 *      poisoned-value test no longer sees the table name + offending value.
 *   M2 force every shape in the .down.sql to `created_at::text` -> the ISO-Z
 *      byte-fidelity assertion goes RED.
 *   M3 delete `SET LOCAL TIME ZONE 'UTC'` from the .down.sql -> the KANON
 *      byte-fidelity assertion goes RED when the session TimeZone is not UTC
 *      (this suite runs the rollback under America/Chicago on purpose).
 *   M4 drop one table from the etap-1 list in 20262305 -> "all 24 converted"
 *      goes RED (wiring: the list, not the mechanism).
 *
 * HOW TO RUN (from the repo root):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/postgres \
 *   npx vitest run src/database/__tests__/createdAtTimestamptz20262305.pg.test.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const UP_PATH = path.resolve(__dirname, '../../../migrations/20262305_created_at_timestamptz_etap1.sql');
const DOWN_PATH = path.resolve(
  __dirname,
  '../../../migrations/rollback/20262305_created_at_timestamptz_etap1.down.sql'
);

// The etap-1 list, written down independently of the migration file so that
// removing a table from the migration is a RED test (M4), not a silent shrink.
const ETAP1: ReadonlyArray<readonly [string, 'KANON' | 'ISOZ' | 'PUSTA']> = [
  ['wave6_context_ledger', 'KANON'],
  ['wave6_context_snapshots', 'KANON'],
  ['wave5_artifact_versions', 'KANON'],
  ['research_session_events', 'KANON'],
  ['research_sessions', 'KANON'],
  ['research_evidence_graph', 'KANON'],
  ['research_report_artifacts', 'KANON'],
  ['wave7_connectors', 'KANON'],
  ['wave6_memory_candidates', 'KANON'],
  ['wave6_memory_stewardship_decisions', 'KANON'],
  ['wave8_agent_notifications', 'KANON'],
  ['wave8_agent_runs', 'KANON'],
  ['wave9_evidence_registry', 'KANON'],
  ['ai_deep_thinking_confirms', 'KANON'],
  ['usage_pricing_tiers', 'KANON'],
  ['v8_promotion_gates', 'KANON'],
  ['notification_dedup', 'ISOZ'],
  ['meeting_participants', 'ISOZ'],
  ['work_canvas_proposals', 'ISOZ'],
  ['document_share_links', 'ISOZ'],
  ['deck_comments', 'ISOZ'],
  ['decision_escalation_templates', 'PUSTA'],
  ['meeting_decisions', 'PUSTA'],
  ['tax_rates', 'PUSTA'],
];

// A table that is NOT in etap 1: it must stay text through the whole cycle.
const CONTROL_TABLE = 'd03_etap1_control';

// Stored shapes measured in KROK 0 over all 5875 rows of the copy.
const KANON_VALUES = ['2026-04-25 17:59:50.953169+00', '2026-09-19 04:00:00+00'];
const ISOZ_VALUES = ['2026-07-05T12:14:57.993Z', '2026-09-08T00:00:00.000Z'];
const POISON = 'to-nie-data';

const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const SCRATCH_DB = `d03_etap1_${tag}`;

// --- fail-closed gate (RUN_DB_TESTS read ONCE at module load) ---
const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const RUN_DB = process.env.RUN_DB_TESTS;
const DB_REQUIRED = RUN_DB !== undefined && !OPT_OUT.has(String(RUN_DB).trim().toLowerCase());
const FAIL_BANNER =
  '[D-03] FAIL-CLOSED: RUN_DB_TESTS demanded a real PostgreSQL, so this suite refuses a vacuous pass.';

class SoftSkip extends Error {}
let skipReason = 'no PostgreSQL connection string (DATABASE_URL / PGHOST unset)';
let ready = false;

let admin: Client | null = null;
let db: Client | null = null;

function adminUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (raw) {
    const u = new URL(raw);
    u.pathname = '/postgres'; // maintenance DB, to CREATE/DROP the scratch DB
    return u.toString();
  }
  if (process.env.PGHOST) {
    const port = process.env.PGPORT || '5432';
    const user = process.env.PGUSER || 'postgres';
    return `postgresql://${user}@${process.env.PGHOST}:${port}/postgres`;
  }
  throw new SoftSkip(skipReason);
}

function scratchUrl(adminConnectionString: string): string {
  const u = new URL(adminConnectionString);
  u.pathname = `/${SCRATCH_DB}`;
  return u.toString();
}

async function dataTypeOf(table: string): Promise<string | null> {
  const r = await db!.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'created_at'`,
    [table]
  );
  return r.rows[0]?.data_type ?? null;
}

async function columnDefaultOf(table: string): Promise<string | null> {
  const r = await db!.query(
    `SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'created_at'`,
    [table]
  );
  return r.rows[0]?.column_default ?? null;
}

/** TimeZone-independent fingerprint of the instants stored in a table. */
async function epochFingerprint(table: string): Promise<string> {
  const r = await db!.query(
    `SELECT coalesce(md5(string_agg(extract(epoch FROM created_at::timestamptz)::text, ','
                                    ORDER BY created_at::timestamptz)), '-') AS h
       FROM public.${table}`
  );
  return r.rows[0].h as string;
}

/** Raw stored text of the column, ordered by itself (only legal while it is text). */
async function rawTexts(table: string): Promise<string[]> {
  const r = await db!.query(
    `SELECT created_at AS v FROM public.${table} WHERE created_at IS NOT NULL ORDER BY created_at`
  );
  return r.rows.map((row) => String(row.v));
}

async function createEtap1Fixtures(): Promise<void> {
  for (const [table, shape] of ETAP1) {
    // The measured default of the KANON group; the other variants are covered by
    // their own assertions below (to_char / (now())::text / literal / now()).
    await db!.query(`CREATE TABLE public.${table} (id text PRIMARY KEY, created_at TEXT)`);
    if (shape === 'KANON') {
      await db!.query(`ALTER TABLE public.${table} ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP`);
      await db!.query(
        `INSERT INTO public.${table} (id, created_at) VALUES ($1, $2), ($3, $4)`,
        [`${table}-1`, KANON_VALUES[0], `${table}-2`, KANON_VALUES[1]]
      );
    } else if (shape === 'ISOZ') {
      await db!.query(
        `INSERT INTO public.${table} (id, created_at) VALUES ($1, $2), ($3, $4)`,
        [`${table}-1`, ISOZ_VALUES[0], `${table}-2`, ISOZ_VALUES[1]]
      );
    }
    // PUSTA: created empty on purpose, that is the measured state of the copy.
  }
  // The three measured text-producing defaults, verbatim from the copy.
  await db!.query(
    `ALTER TABLE public.decision_escalation_templates ALTER COLUMN created_at
       SET DEFAULT to_char((now() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text)`
  );
  await db!.query(
    `ALTER TABLE public.tax_rates ALTER COLUMN created_at
       SET DEFAULT to_char((now() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text)`
  );
  await db!.query(
    `ALTER TABLE public.meeting_decisions ALTER COLUMN created_at SET DEFAULT (now())::text`
  );
  await db!.query(
    `ALTER TABLE public.v8_promotion_gates ALTER COLUMN created_at SET DEFAULT now()`
  );
  await db!.query(
    `ALTER TABLE public.usage_pricing_tiers ALTER COLUMN created_at
       SET DEFAULT '2026-03-03 18:30:11.358808+00'::timestamp with time zone`
  );
  await db!.query(
    `CREATE TABLE public.${CONTROL_TABLE} (id text PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  );
  await db!.query(
    `INSERT INTO public.${CONTROL_TABLE} (id, created_at) VALUES ('c1', $1)`,
    [KANON_VALUES[0]]
  );
}

beforeAll(async () => {
  let adminConnectionString: string;
  try {
    adminConnectionString = adminUrl();
  } catch (err) {
    if (err instanceof SoftSkip) {
      skipReason = err.message;
      if (DB_REQUIRED) throw new Error(`${FAIL_BANNER} ${skipReason}`);
      return;
    }
    throw err;
  }

  admin = new Client({ connectionString: adminConnectionString });
  try {
    await admin.connect();
  } catch (err) {
    skipReason = `cannot reach PostgreSQL: ${err instanceof Error ? err.message : String(err)}`;
    if (DB_REQUIRED) throw new Error(`${FAIL_BANNER} ${skipReason}`);
    admin = null;
    return;
  }

  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
  await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);

  db = new Client({ connectionString: scratchUrl(adminConnectionString) });
  await db.connect();
  await createEtap1Fixtures();
  ready = true;
});

afterAll(async () => {
  if (db) {
    await db.end().catch(() => undefined);
    db = null;
  }
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`).catch(() => undefined);
    await admin.end().catch(() => undefined);
    admin = null;
  }
});

/**
 * Decided at RUN time, not at collection time: `ready` is only known after beforeAll.
 * Under DB_REQUIRED a missing database throws instead of skipping.
 */
function requireReady(ctx: { skip: (note?: string) => void }): void {
  if (ready) return;
  if (DB_REQUIRED) throw new Error(`${FAIL_BANNER}\n  reason: ${skipReason}`);
  ctx.skip(`[D-03] not verified — ${skipReason} (RUN_DB_TESTS unset)`);
}

const itDb = (name: string, fn: () => Promise<void>, timeout?: number): void => {
  it(
    name,
    async (ctx) => {
      requireReady(ctx);
      await fn();
    },
    timeout
  );
};

describe('20262305 created_at text -> timestamptz, etap 1 (real PostgreSQL)', () => {
  itDb('converts all 24 etap-1 tables and leaves a table outside the list alone', async () => {
    const before = new Map<string, string>();
    for (const [table] of ETAP1) before.set(table, (await epochFingerprint(table)) as string);

    await db!.query(readFileSync(UP_PATH, 'utf8'));

    for (const [table] of ETAP1) {
      expect(await dataTypeOf(table), `${table}.created_at type`).toBe('timestamp with time zone');
    }
    expect(await dataTypeOf(CONTROL_TABLE)).toBe('text');

    // the instant of every row survives the cast
    for (const [table] of ETAP1) {
      expect(await epochFingerprint(table), `${table} instants`).toBe(before.get(table));
    }
  }, 120_000);

  itDb('replaces the text-producing defaults and keeps the timestamptz ones', async () => {
    expect(await columnDefaultOf('decision_escalation_templates')).toBe('now()');
    expect(await columnDefaultOf('tax_rates')).toBe('now()');
    expect(await columnDefaultOf('meeting_decisions')).toBe('now()');
    expect(await columnDefaultOf('v8_promotion_gates')).toBe('now()');
    expect(await columnDefaultOf('usage_pricing_tiers')).toContain('2026-03-03 18:30:11.358808+00');
    expect(await columnDefaultOf('wave6_context_ledger')).toBe('CURRENT_TIMESTAMP');
    expect(await columnDefaultOf('notification_dedup')).toBeNull();
  });

  itDb('is idempotent: a second pass changes nothing (the file is applied twice in production)', async () => {
    const before = new Map<string, string>();
    for (const [table] of ETAP1) before.set(table, await epochFingerprint(table));

    await expect(db!.query(readFileSync(UP_PATH, 'utf8'))).resolves.toBeDefined();

    for (const [table] of ETAP1) {
      expect(await dataTypeOf(table)).toBe('timestamp with time zone');
      expect(await epochFingerprint(table), `${table} instants after the second pass`).toBe(
        before.get(table)
      );
    }
  }, 120_000);

  itDb('rollback returns the stored TEXT byte-for-byte in the shape of the table', async () => {
    // Deliberately NOT UTC: the .down.sql carries its own SET LOCAL TIME ZONE,
    // and this is what makes deleting it a RED test (M3).
    await db!.query(`SET TIME ZONE 'America/Chicago'`);

    // A timestamptz default is rendered in the session TimeZone, so the byte check
    // has to be against this session's own rendering; the instant is pinned below.
    const defaultBeforeRollback = await columnDefaultOf('usage_pricing_tiers');

    await db!.query(readFileSync(DOWN_PATH, 'utf8'));

    for (const [table] of ETAP1) {
      expect(await dataTypeOf(table), `${table}.created_at type`).toBe('text');
    }

    for (const [table, shape] of ETAP1) {
      const rows = await rawTexts(table);
      if (shape === 'KANON') {
        expect(rows, `${table} KANON bytes`).toEqual([...KANON_VALUES].sort());
      } else if (shape === 'ISOZ') {
        expect(rows, `${table} ISO-Z bytes`).toEqual([...ISOZ_VALUES].sort());
      } else {
        expect(rows, `${table} empty`).toEqual([]);
      }
    }

    // the defaults go back to the measured originals
    expect(await columnDefaultOf('wave6_context_ledger')).toBe('CURRENT_TIMESTAMP');
    expect(await columnDefaultOf('decision_escalation_templates')).toBe(
      `to_char((now() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text)`
    );
    expect(await columnDefaultOf('meeting_decisions')).toBe('(now())::text');
    expect(await columnDefaultOf('usage_pricing_tiers')).toBe(defaultBeforeRollback);
    expect(await columnDefaultOf('v8_promotion_gates')).toBe('now()');
    expect(await columnDefaultOf('notification_dedup')).toBeNull();

    // a table outside etap 1 was never touched
    expect(await dataTypeOf(CONTROL_TABLE)).toBe('text');
    expect(await rawTexts(CONTROL_TABLE)).toEqual(KANON_VALUES.slice(0, 1));

    await db!.query(`SET TIME ZONE 'UTC'`);
    expect(await columnDefaultOf('usage_pricing_tiers')).toContain('2026-03-03 18:30:11.358808+00');
  }, 120_000);

  itDb('fails closed on a value that is not a timestamp, naming the table and the value', async () => {
    await db!.query(`INSERT INTO public.deck_comments (id, created_at) VALUES ('poison', $1)`, [POISON]);

    let message = '';
    try {
      await db!.query(readFileSync(UP_PATH, 'utf8'));
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    expect(message, 'the migration must refuse, not guess').toContain('D03-20262305');
    expect(message).toContain('deck_comments');
    expect(message).toContain(POISON);

    // the refused transaction left nothing half-converted
    expect(await dataTypeOf('deck_comments')).toBe('text');

    await db!.query(`DELETE FROM public.deck_comments WHERE id = 'poison'`);
  }, 120_000);

  itDb('UP after the rollback reproduces the same state (U-D-U)', async () => {
    await db!.query(readFileSync(UP_PATH, 'utf8'));
    for (const [table] of ETAP1) {
      expect(await dataTypeOf(table)).toBe('timestamp with time zone');
    }
    expect(await rawTextsAsInstants('deck_comments')).toEqual([
      '2026-07-05T12:14:57.993Z',
      '2026-09-08T00:00:00.000Z',
    ]);
  }, 120_000);
});

/** The stored instants rendered back as ISO-Z, to compare across the type change. */
async function rawTextsAsInstants(table: string): Promise<string[]> {
  const r = await db!.query(
    `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS v
       FROM public.${table} WHERE created_at IS NOT NULL ORDER BY created_at`
  );
  return r.rows.map((row) => String(row.v));
}
