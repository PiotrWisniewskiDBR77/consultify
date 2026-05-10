/**
 * Alert worker integration test harness — Postgres edition.
 *
 * Sprint 10 ships a worker that, when CI/dev has a real Postgres reachable,
 * deserves an end-to-end test that exercises the full diff cycle: read deck
 * rows + subscriptions + worker_state, run the cycle, write back snapshot +
 * dispatch audit rows, and react to consecutive failures. This harness is
 * the bridge between vitest and that real DB without coupling to the app's
 * pool / mock layer.
 *
 * Key contracts:
 *   - `pgReachable()` is a fast precondition (≤2s connection budget). It
 *     returns `false` whenever the `pg` client cannot establish a session
 *     using the same env vars the app honors (`DATABASE_URL` / `PG*` / `DB_*`).
 *     Tests treat that as a clean skip — they NEVER fail on a developer
 *     machine that has no Postgres.
 *   - `setupAlertWorkerHarness()` probes for the migration-762/763 tables.
 *     If any are missing, returns `null` so the suite skips just like a
 *     missing connection.
 *   - Each harness instance owns a unique `organization_id` so concurrent
 *     test files cannot collide. `cleanup()` removes only rows scoped to
 *     that org.
 *
 * The harness intentionally uses its OWN `pg.Client` to seed and assert
 * state. The worker under test still queries through the application's
 * pool (`Database.ts` → `PostgresDatabase`), so the test exercises the
 * exact same code path that production uses.
 */

import { Client, type ClientConfig } from 'pg';
import { randomBytes } from 'node:crypto';

import { __testHooks } from '../../../../server/scripts/run-presentation-alert-worker.ts';
import type { WatchlistEntryInput } from '../../../../server/src/services/presentationGovernanceWatchlistService.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PgHarness {
  client: Client;
  testOrgId: string;
  cleanup: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Connection probe
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // The repo's config rejects unexpanded Railway templates. Mirror that
  // guard so we don't silently use a bogus value.
  if (trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }

  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;

  const port = Number(process.env.PGPORT || process.env.DB_PORT || 5432);
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'postgres';
  const user = process.env.PGUSER || process.env.DB_USER || 'postgres';
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD || '';

  return {
    host,
    port: Number.isFinite(port) ? port : 5432,
    database,
    user,
    password,
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

export async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;

  const probe = new Client(config);
  let connected = false;
  try {
    await probe.connect();
    connected = true;
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    if (connected) {
      try {
        await probe.end();
      } catch {
        // Closing a probe is best-effort; do not leak a failure.
      }
    } else {
      try {
        // Some pg versions throw on `end()` for a never-connected client.
        await probe.end();
      } catch {
        // ignore
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Required tables
// ---------------------------------------------------------------------------

const REQUIRED_TABLES = [
  'presentation_governance_alert_subscriptions',
  'presentation_governance_alert_dispatches',
  'presentation_governance_alert_worker_state',
  'presentation_decks',
  'presentation_runtime_events',
  'presentation_export_records',
  'presentation_ai_operations',
] as const;

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((row) => row.table_name));
  return names.every((name) => found.has(name));
}

// ---------------------------------------------------------------------------
// Harness lifecycle
// ---------------------------------------------------------------------------

function generateTestOrgId(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(6).toString('hex');
  return `org_test_${ts}_${rand}`;
}

export interface SetupOpts {
  ttlSeconds?: number;
}

export async function setupAlertWorkerHarness(
  _opts?: SetupOpts
): Promise<PgHarness | null> {
  if (!(await pgReachable())) return null;

  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    const ok = await tablesExist(client, REQUIRED_TABLES);
    if (!ok) {
      try {
        await client.end();
      } catch {
        // ignore
      }
      return null;
    }
  } catch {
    try {
      await client.end();
    } catch {
      // ignore
    }
    return null;
  }

  const testOrgId = generateTestOrgId();

  const cleanup = async () => {
    try {
      await clearOrgRowsInternal(client, testOrgId);
    } catch {
      // Best-effort: leaking a few rows is acceptable; a hung test is not.
    }
    // Drop any lingering watchlist override registered for this org so a
    // subsequent test file does not see stale entries.
    try {
      __testHooks.watchlistOverrides.delete(testOrgId);
    } catch {
      // ignore
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, testOrgId, cleanup };
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

export interface InsertSubscriptionInput {
  channel: 'webhook' | 'email' | 'slack';
  target: string;
  minSeverity: 'BLOCKED_P0' | 'BLOCKED_P1';
  active?: boolean;
  signingSecret?: string | null;
}

export async function insertSubscription(
  harness: PgHarness,
  input: InsertSubscriptionInput
): Promise<string> {
  const id = `sub_test_${randomBytes(8).toString('hex')}`;
  await harness.client.query(
    `INSERT INTO presentation_governance_alert_subscriptions (
       id, organization_id, channel, target, min_severity, active, signing_secret
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      harness.testOrgId,
      input.channel,
      input.target,
      input.minSeverity,
      input.active !== false,
      input.signingSecret ?? null,
    ]
  );
  return id;
}

export interface InsertWatchlistDeckRowInput {
  deckId: string;
  title: string;
  verdict: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'BLOCKED_P0' | 'INCONCLUSIVE';
  p0?: number;
  p1?: number;
  p2?: number;
}

/**
 * Insert a `presentation_decks` row for the harness's org and ALSO push the
 * deck onto the per-org watchlist override consumed by `runSingleCycleForTest`.
 *
 * The DB row makes the test feel realistic (the worker's `loadDeckRows` will
 * see it), but the verdict for diffing comes from the override map so we do
 * not need to drive the full quality-gate / governance-card pipeline. This
 * is the dependency-injection path the harness contract recommends.
 */
export async function insertWatchlistDeckRow(
  harness: PgHarness,
  input: InsertWatchlistDeckRowInput
): Promise<void> {
  const deckJson = JSON.stringify({
    id: input.deckId,
    title: input.title,
    slides: [],
    test_seed: { verdict: input.verdict },
  });

  await harness.client.query(
    `INSERT INTO presentation_decks (
       id, organization_id, title, deck_type, language, confidentiality,
       theme, deck_json, slide_count, status, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       deck_json = EXCLUDED.deck_json,
       updated_at = NOW()`,
    [
      input.deckId,
      harness.testOrgId,
      input.title,
      'test',
      'en',
      'internal',
      'corporate',
      deckJson,
      0,
      'draft',
    ]
  );

  const existing = __testHooks.watchlistOverrides.get(harness.testOrgId) ?? [];
  const next = existing.filter((entry) => entry.deckId !== input.deckId);
  next.push({
    deckId: input.deckId,
    title: input.title,
    confidentialityLevel: 'internal',
    updatedAt: new Date().toISOString(),
    card: {
      overallVerdict: input.verdict,
      quality: {
        p0: typeof input.p0 === 'number' ? input.p0 : 0,
        p1: typeof input.p1 === 'number' ? input.p1 : 0,
        p2: typeof input.p2 === 'number' ? input.p2 : 0,
        gateCount:
          (typeof input.p0 === 'number' ? input.p0 : 0) +
          (typeof input.p1 === 'number' ? input.p1 : 0) +
          (typeof input.p2 === 'number' ? input.p2 : 0),
      },
      telemetry: { exportsBlocked: 0, lastActivityAt: null },
    },
  } satisfies WatchlistEntryInput);
  __testHooks.watchlistOverrides.set(harness.testOrgId, next);
}

export interface WorkerStateRow {
  organization_id: string;
  last_snapshot_json: string | null;
  last_run_at: string | null;
  last_run_summary: string | null;
  failures_in_a_row: number;
  paused: boolean;
  paused_reason: string | null;
}

export async function readWorkerStateRow(
  harness: PgHarness
): Promise<WorkerStateRow | null> {
  const res = await harness.client.query<{
    organization_id: string;
    last_snapshot_json: string | null;
    last_run_at: string | null;
    last_run_summary: string | null;
    failures_in_a_row: string | number | null;
    paused: boolean | null;
    paused_reason: string | null;
  }>(
    `SELECT organization_id, last_snapshot_json, last_run_at, last_run_summary,
            failures_in_a_row, paused, paused_reason
       FROM presentation_governance_alert_worker_state
      WHERE organization_id = $1`,
    [harness.testOrgId]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    organization_id: row.organization_id,
    last_snapshot_json: row.last_snapshot_json,
    last_run_at: row.last_run_at != null ? String(row.last_run_at) : null,
    last_run_summary: row.last_run_summary,
    failures_in_a_row: Number(row.failures_in_a_row ?? 0),
    paused: row.paused === true,
    paused_reason: row.paused_reason,
  };
}

export interface DispatchAuditRow {
  id: string;
  status: string;
  to_verdict: string;
  signature_present: boolean;
  signature_algorithm: string | null;
  http_status: number | null;
}

export async function readDispatchRows(
  harness: PgHarness
): Promise<DispatchAuditRow[]> {
  // Schema-tolerance: the signing columns only exist after migration 763.
  // If they are missing the harness still returns rows with `signature_*`
  // back-filled to defaults so tests can assert against the stable shape.
  try {
    const res = await harness.client.query<{
      id: string;
      status: string;
      to_verdict: string;
      signature_present: boolean | null;
      signature_algorithm: string | null;
      http_status: number | null;
    }>(
      `SELECT id, status, to_verdict, signature_present, signature_algorithm, http_status
         FROM presentation_governance_alert_dispatches
        WHERE organization_id = $1
        ORDER BY created_at ASC`,
      [harness.testOrgId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      status: row.status,
      to_verdict: row.to_verdict,
      signature_present: row.signature_present === true,
      signature_algorithm: row.signature_algorithm,
      http_status: row.http_status,
    }));
  } catch (err) {
    const msg = String((err as { message?: unknown })?.message ?? '').toLowerCase();
    if (msg.includes('signature_') || msg.includes('does not exist')) {
      const res = await harness.client.query<{
        id: string;
        status: string;
        to_verdict: string;
        http_status: number | null;
      }>(
        `SELECT id, status, to_verdict, http_status
           FROM presentation_governance_alert_dispatches
          WHERE organization_id = $1
          ORDER BY created_at ASC`,
        [harness.testOrgId]
      );
      return res.rows.map((row) => ({
        id: row.id,
        status: row.status,
        to_verdict: row.to_verdict,
        signature_present: false,
        signature_algorithm: null,
        http_status: row.http_status,
      }));
    }
    throw err;
  }
}

async function clearOrgRowsInternal(client: Client, orgId: string): Promise<void> {
  // Order matters: dispatch rows reference subscription rows (via id) so we
  // delete the dependents first. Each statement is wrapped individually so a
  // missing optional table (e.g. `presentation_runtime_events`) does not
  // abort the cleanup.
  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: `DELETE FROM presentation_governance_alert_dispatches WHERE organization_id = $1`,
      params: [orgId],
    },
    {
      sql: `DELETE FROM presentation_governance_alert_subscriptions WHERE organization_id = $1`,
      params: [orgId],
    },
    {
      sql: `DELETE FROM presentation_governance_alert_worker_state WHERE organization_id = $1`,
      params: [orgId],
    },
    {
      sql: `DELETE FROM presentation_runtime_events WHERE organization_id = $1`,
      params: [orgId],
    },
    {
      sql: `DELETE FROM presentation_export_records WHERE organization_id = $1`,
      params: [orgId],
    },
    {
      sql: `DELETE FROM presentation_ai_operations WHERE organization_id = $1`,
      params: [orgId],
    },
    {
      sql: `DELETE FROM presentation_decks WHERE organization_id = $1`,
      params: [orgId],
    },
  ];

  for (const stmt of statements) {
    try {
      await client.query(stmt.sql, stmt.params);
    } catch {
      // Tolerate missing optional tables — cleanup must NEVER fail loudly.
    }
  }
}

/**
 * Wipe every row owned by the harness's `testOrgId` plus the in-memory
 * watchlist override. Useful in `beforeEach` for full per-test isolation.
 */
export async function clearOrgRows(harness: PgHarness): Promise<void> {
  await clearOrgRowsInternal(harness.client, harness.testOrgId);
  __testHooks.watchlistOverrides.delete(harness.testOrgId);
}
