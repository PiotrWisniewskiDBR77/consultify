/**
 * M02-C — Ideas collaboration SCHEMA contract, against a REAL Postgres.
 *
 * Guards `server/migrations/942_ideas_collaboration_tool_sessions.sql`:
 *   1. the documented shape of `tool_sessions` / `tool_session_presence`
 *      (columns, types, nullability, indexes) is actually present;
 *   2. re-applying the migration is a no-op — no error, no shape change.
 *
 * The expected shape below is transcribed from the live demo catalog
 * (read-only `information_schema` / `pg_indexes` dump taken 2026-08-04), so
 * "fresh database" and "already-migrated database" are asserted against the
 * same contract rather than against each other.
 *
 * Fresh-from-zero and upgrade-an-existing-database are process-level runs
 * (`npm run db:migrate` against an empty vs. an already-populated database);
 * their evidence is in the M02-C packet report. What can be automated — the
 * resulting contract and idempotency — is automated here.
 *
 * HOW TO RUN LOCALLY: see the header of
 * `tests/integration/m02c-ideas-collaboration-presence.realdb.test.ts`.
 *
 * SKIP POLICY: if a database is configured but unreachable, this suite FAILS
 * rather than skipping green.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type ClientConfig } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const PROBE_TIMEOUT_MS = 2_000;
const testDir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.resolve(
  testDir,
  '../../server/migrations/942_ideas_collaboration_tool_sessions.sql'
);

/** column -> [data_type, is_nullable] */
const EXPECTED_COLUMNS: Record<string, Record<string, [string, 'YES' | 'NO']>> = {
  tool_sessions: {
    id: ['text', 'NO'],
    organization_id: ['text', 'NO'],
    project_id: ['text', 'YES'],
    tool_type: ['text', 'NO'],
    name: ['text', 'NO'],
    status: ['text', 'YES'],
    completion_percent: ['integer', 'YES'],
    confidence_avg: ['real', 'YES'],
    answers_json: ['text', 'YES'],
    context_snapshot: ['text', 'YES'],
    review_requested_at: ['timestamp without time zone', 'YES'],
    approved_at: ['timestamp without time zone', 'YES'],
    created_by: ['text', 'NO'],
    updated_by: ['text', 'YES'],
    created_at: ['timestamp without time zone', 'YES'],
    updated_at: ['timestamp without time zone', 'YES'],
    runtime_contract_json: ['text', 'YES'],
    dod_status: ['text', 'YES'],
    wizard_state_json: ['text', 'YES'],
    missing_items_json: ['text', 'YES'],
    failure_reason: ['text', 'YES'],
    last_generation_batch_id: ['text', 'YES'],
    output_json: ['text', 'YES'],
    version: ['integer', 'NO'],
  },
  tool_session_presence: {
    id: ['text', 'NO'],
    organization_id: ['text', 'NO'],
    tool_session_id: ['text', 'NO'],
    user_id: ['text', 'NO'],
    user_name: ['text', 'YES'],
    user_color: ['text', 'YES'],
    cursor_state: ['text', 'YES'],
    active_block_id: ['text', 'YES'],
    editing_field: ['text', 'YES'],
    // INTEGER flag (0/1), not boolean — realtimePlatformService compares `= 1`.
    is_connected: ['integer', 'YES'],
    connected_at: ['timestamp without time zone', 'YES'],
    last_heartbeat_at: ['timestamp without time zone', 'YES'],
    disconnected_at: ['timestamp without time zone', 'YES'],
  },
};

const EXPECTED_INDEXES = [
  'idx_tool_sessions_dod',
  'idx_tool_sessions_org',
  'idx_tool_sessions_status',
  'idx_tool_sessions_tool',
  'idx_tsp_session',
  'tool_session_presence_pkey',
  'tool_sessions_pkey',
];

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 60_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 60_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client(buildClientConfig() as ClientConfig);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function readShape(): Promise<{ columns: string[]; indexes: string[] }> {
  return withClient(async (c) => {
    const cols = await c.query(
      `SELECT table_name || '|' || column_name || '|' || data_type || '|' || is_nullable AS sig
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('tool_sessions','tool_session_presence')
        ORDER BY 1`
    );
    const idx = await c.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('tool_sessions','tool_session_presence')
        ORDER BY 1`
    );
    return {
      columns: cols.rows.map((r: { sig: string }) => r.sig),
      indexes: idx.rows.map((r: { indexname: string }) => r.indexname),
    };
  });
}

describe('M02-C — Ideas collaboration schema contract (real Postgres)', () => {
  let reachable = false;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — M02-C collaboration schema tests did NOT run. ' +
          'This run is not evidence.'
      );
      return;
    }
    try {
      await withClient(async (c) => {
        await c.query('SELECT 1');
      });
      reachable = true;
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable; refusing to report a green run. ' +
          String(error)
      );
    }
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 120_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('both collaboration tables exist with the documented columns and nullability', async () => {
    const rows = await withClient((c) =>
      c
        .query(
          `SELECT table_name, column_name, data_type, is_nullable
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('tool_sessions','tool_session_presence')`
        )
        .then((r) => r.rows as Array<{
          table_name: string;
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>)
    );

    const actual: Record<string, Record<string, [string, string]>> = {};
    for (const row of rows) {
      actual[row.table_name] = actual[row.table_name] || {};
      actual[row.table_name][row.column_name] = [row.data_type, row.is_nullable];
    }

    for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
      expect(actual[table], `table ${table} is missing entirely`).toBeTruthy();
      for (const [column, [type, nullable]] of Object.entries(columns)) {
        expect(actual[table][column], `${table}.${column} is missing`).toBeTruthy();
        expect(actual[table][column][0], `${table}.${column} type`).toBe(type);
        expect(actual[table][column][1], `${table}.${column} nullability`).toBe(nullable);
      }
    }
  });

  itDB('every documented index and primary key exists', async () => {
    const shape = await readShape();
    for (const index of EXPECTED_INDEXES) {
      expect(shape.indexes, `index ${index} is missing`).toContain(index);
    }
  });

  itDB('re-applying the migration twice changes nothing and raises nothing', async () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const before = await readShape();

    await withClient(async (c) => {
      await c.query(sql);
      await c.query(sql);
    });

    const after = await readShape();
    expect(after.columns).toEqual(before.columns);
    expect(after.indexes).toEqual(before.indexes);
  });
});
