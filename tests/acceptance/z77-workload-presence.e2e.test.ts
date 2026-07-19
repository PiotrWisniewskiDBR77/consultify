/**
 * #77 (workload/capacity) + presence-write (T8, notebookCollabWs) — REAL-runtime
 * verification against parity Postgres. No mocks: real getDatabase(), a real
 * HTTP server with the real gateway attached, a real `ws` client, and direct
 * SQL assertions against the `realtime_presence` table.
 *
 * Krytyk E finding: both were flagged ZAWYŻONE (no live-demo proof). This test
 * exercises:
 *   A) workloadCapacityService.getOverloadAlerts — real project_members +
 *      tasks rows, contract shape + overload math.
 *   B) notebookCollabWs presence-write — a real WS client joins, the gateway's
 *      writePresenceJoin/Heartbeat/Leave path must land rows in
 *      `realtime_presence` (channel `notebook-<noteId>`), survive a heartbeat,
 *      and flip is_connected=0 on disconnect.
 *
 * Requires: DATABASE_URL=postgres://…@localhost:5443/consultinity (parity),
 * NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true
 * JWT_SECRET=development_secret_key_change_in_production_abc123xyz.
 */
import http from 'http';
import type net from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import pg from 'pg';

import { requireLocalDbUrl } from './harness.js';

const ORG_ID = 'odbior--z77-org';
const USER_ID = 'odbior--z77-user';
const PROJECT_ID = 'odbior--z77-project';
const MEMBER_ID = 'odbior--z77-member';
const TASK_WARN_ID = 'odbior--z77-task-warn';
const TASK_CRIT_ID = 'odbior--z77-task-crit';
const NOTE_ID = 'odbior--z77-note';

const JWT_SECRET =
  process.env.JWT_SECRET || 'development_secret_key_change_in_production_abc123xyz';

function pgClient(): pg.Client {
  return new pg.Client({ connectionString: requireLocalDbUrl() });
}

async function cleanup(client: pg.Client) {
  await client.query(`DELETE FROM realtime_presence WHERE channel_id = $1`, [
    `notebook-${NOTE_ID}`,
  ]);
  await client.query(`DELETE FROM notebook_pages WHERE id = $1`, [NOTE_ID]);
  await client.query(`DELETE FROM tasks WHERE id = ANY($1)`, [[TASK_WARN_ID, TASK_CRIT_ID]]);
  await client.query(`DELETE FROM project_members WHERE id = $1`, [MEMBER_ID]);
  await client.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM users WHERE id = $1`, [USER_ID]);
  await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
}

describe('#77 workloadCapacityService.getOverloadAlerts — real Postgres contract', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = pgClient();
    await client.connect();
    await cleanup(client);

    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'Z77 Org', 'enterprise', 'active', 1, NOW())`,
      [ORG_ID]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, 'z77@acceptance.local', 'x', 'ADMIN', 'active', 'Z77', 'Worker', NOW())`,
      [USER_ID, ORG_ID]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, created_at)
       VALUES ($1, $2, 'Z77 Project', 'active', NOW())`,
      [PROJECT_ID, ORG_ID]
    );
    // allocation_percent=100 -> capacityHours = 40 (DEFAULT_WEEKLY_HOURS)
    await client.query(
      `INSERT INTO project_members (id, project_id, user_id, project_role, allocation_percent, created_at, updated_at)
       VALUES ($1, $2, $3, 'TASK_ASSIGNEE', 100, NOW(), NOW())`,
      [MEMBER_ID, PROJECT_ID, USER_ID]
    );
    // Overload: 70h due today (inside this week's Mon..Sun window) vs 40h capacity
    // -> ratio 1.75 > 1.3 => severity 'critical'; overloadHours = 30.
    await client.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id, due_date, estimated_hours, created_at, updated_at)
       VALUES ($1, $2, 'Z77 overload task', 'todo', $3, CURRENT_DATE, 70, NOW(), NOW())`,
      [TASK_CRIT_ID, ORG_ID, USER_ID]
    );
  });

  afterAll(async () => {
    await cleanup(client);
    await client.end();
  });

  it('getCapacityOverview returns real cap/alloc math for the seeded member', async () => {
    const { getCapacityOverview } = await import(
      '../../server/src/services/workloadCapacityService.js'
    );
    const overview = await getCapacityOverview(ORG_ID);
    console.log('[Z77] getCapacityOverview output:', JSON.stringify(overview, null, 2));

    expect(overview.users).toHaveLength(1);
    const u = overview.users[0];
    expect(u.userId).toBe(USER_ID);
    expect(u.capacityHours).toBe(40);
    expect(u.allocatedHours).toBe(70);
    expect(u.overloaded).toBe(true);
    expect(overview.windowStart <= overview.windowEnd).toBe(true);
  });

  it('getOverloadAlerts returns a well-shaped critical alert for the overloaded user', async () => {
    const { getOverloadAlerts } = await import(
      '../../server/src/services/workloadCapacityService.js'
    );
    const alerts = await getOverloadAlerts(ORG_ID, 'week');
    console.log('[Z77] getOverloadAlerts output:', JSON.stringify(alerts, null, 2));

    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts.length).toBeGreaterThan(0);
    const alert = alerts.find((a) => a.userId === USER_ID);
    expect(alert).toBeDefined();
    expect(alert!.capacityHours).toBe(40);
    expect(alert!.allocatedHours).toBe(70);
    expect(alert!.overloadHours).toBe(30);
    expect(alert!.severity).toBe('critical');
    expect(alert!.window).toBe('week');
    expect(typeof alert!.suggestion).toBe('string');
    expect(alert!.suggestion.length).toBeGreaterThan(0);
  });

  it('getCapacityTimeline returns 12 weeks with numeric utilization (no undefined/NaN)', async () => {
    const { getCapacityTimeline } = await import(
      '../../server/src/services/workloadCapacityService.js'
    );
    const weeks = await getCapacityTimeline(ORG_ID);
    console.log('[Z77] getCapacityTimeline[0..2]:', JSON.stringify(weeks.slice(0, 3), null, 2));

    expect(weeks).toHaveLength(12);
    for (const w of weeks) {
      expect(typeof w.weekStart).toBe('string');
      expect(Number.isFinite(w.totalCapacity)).toBe(true);
      expect(Number.isFinite(w.totalAllocated)).toBe(true);
      expect(Number.isFinite(w.utilizationPercent)).toBe(true);
    }
  });
});

describe('presence-write (T8) — notebookCollabWs real WS + real realtime_presence rows', () => {
  let client: pg.Client;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    client = pgClient();
    await client.connect();
    await cleanup(client);

    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'Z77 Org', 'enterprise', 'active', 1, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, 'z77@acceptance.local', 'x', 'ADMIN', 'active', 'Z77', 'Worker', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, ORG_ID]
    );
    await client.query(
      `INSERT INTO notebook_pages (id, owner_user_id, organization_id, title, content_json, created_at, updated_at)
       VALUES ($1, $2, $3, 'Z77 note', '{}', NOW(), NOW())`,
      [NOTE_ID, USER_ID, ORG_ID]
    );

    const { attachNotebookCollabWs } = await import(
      '../../server/src/gateways/notebookCollabWs.gateway.js'
    );
    server = http.createServer((_req, res) => res.end());
    attachNotebookCollabWs(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      server.close(() => {
        clearTimeout(t);
        resolve();
      });
      server.closeAllConnections?.();
    });
    await cleanup(client);
    await client.end();
  });

  function signToken(): string {
    return jwt.sign(
      { id: USER_ID, organizationId: ORG_ID, name: 'Z77 Worker' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  }

  /**
   * Buffers every message from the moment the socket is CREATED (not from
   * 'open'). Mirrors tests/integration/gateways/presentationCollabWs.presence.test.ts —
   * the gateway sends presence:list synchronously in the connection handler,
   * which can race a client-side listener attached only after 'open' resolves.
   */
  function openBufferedClient(url: string): {
    ws: WebSocket;
    waitFor: (predicate: (m: any) => boolean, timeoutMs?: number) => Promise<any>;
  } {
    const ws = new WebSocket(url);
    const buffer: any[] = [];
    const waiters: { predicate: (m: any) => boolean; resolve: (m: any) => void }[] = [];

    ws.on('message', (raw: WebSocket.RawData) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const idx = waiters.findIndex((w) => w.predicate(msg));
      if (idx >= 0) {
        const [w] = waiters.splice(idx, 1);
        w.resolve(msg);
      } else {
        buffer.push(msg);
      }
    });

    return {
      ws,
      waitFor(predicate, timeoutMs = 8000) {
        const existing = buffer.findIndex((m) => predicate(m));
        if (existing >= 0) return Promise.resolve(buffer.splice(existing, 1)[0]);
        return new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error('timeout waiting for WS message')), timeoutMs);
          waiters.push({
            predicate,
            resolve: (m) => {
              clearTimeout(t);
              res(m);
            },
          });
        });
      },
    };
  }

  async function fetchPresenceRow() {
    const res = await client.query(
      `SELECT * FROM realtime_presence WHERE channel_id = $1 AND user_id = $2
       ORDER BY connected_at DESC LIMIT 1`,
      [`notebook-${NOTE_ID}`, USER_ID]
    );
    return res.rows[0] || null;
  }

  it('join over the real WS gateway writes a live row to realtime_presence', async () => {
    const token = signToken();
    const { ws, waitFor } = openBufferedClient(
      `ws://127.0.0.1:${port}/ws/notebook/${NOTE_ID}?token=${encodeURIComponent(token)}`
    );
    try {
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });
      // Server sends presence:list immediately on connect; wait for it so we
      // know the connection handler (and the fire-and-forget writePresenceJoin)
      // has run at least once.
      await waitFor((m) => m.type === 'presence:list');

      // writePresenceJoin is fire-and-forget (best-effort); poll briefly for the row.
      let row: any = null;
      for (let i = 0; i < 20 && !row; i++) {
        row = await fetchPresenceRow();
        if (!row) await new Promise((r) => setTimeout(r, 150));
      }
      console.log('[Z77] realtime_presence row after join:', JSON.stringify(row));

      expect(row).toBeTruthy();
      expect(row.channel_id).toBe(`notebook-${NOTE_ID}`);
      expect(row.user_id).toBe(USER_ID);
      expect(row.is_connected).toBe(1);
      expect(row.user_name).toBe('Z77 Worker');
      const firstHeartbeat = new Date(row.last_heartbeat_at).getTime();

      // Heartbeat updates last_heartbeat_at.
      await new Promise((r) => setTimeout(r, 20));
      ws.send(JSON.stringify({ type: 'presence:heartbeat' }));
      let updated: any = null;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 150));
        updated = await fetchPresenceRow();
        if (
          updated &&
          new Date(updated.last_heartbeat_at).getTime() > firstHeartbeat
        ) {
          break;
        }
      }
      console.log('[Z77] realtime_presence row after heartbeat:', JSON.stringify(updated));
      expect(updated).toBeTruthy();
      expect(new Date(updated.last_heartbeat_at).getTime()).toBeGreaterThanOrEqual(
        firstHeartbeat
      );
      expect(updated.is_connected).toBe(1);
    } finally {
      ws.terminate();
    }

    // Disconnect must flip is_connected=0 + set disconnected_at (writePresenceLeave
    // on the WS 'close' handler, fire-and-forget).
    let disconnected: any = null;
    for (let i = 0; i < 20; i++) {
      disconnected = await fetchPresenceRow();
      if (disconnected && Number(disconnected.is_connected) === 0) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    console.log('[Z77] realtime_presence row after disconnect:', JSON.stringify(disconnected));
    expect(disconnected).toBeTruthy();
    expect(Number(disconnected.is_connected)).toBe(0);
    expect(disconnected.disconnected_at).toBeTruthy();
  });
});
