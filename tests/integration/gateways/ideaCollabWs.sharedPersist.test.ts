/**
 * DP-3 T5 — ideaCollabWs shared canonical persist.
 *
 * Verifies the ENABLE_SHARED_IDEA_MAPS gateway behavior (plan §2-§3):
 *   - membership at upgrade: ACTIVE member joins; non-member → 403.
 *   - graph_patch from A → canonical my_idea_maps row updated (version+1) AND a
 *     `graph_version` broadcast reaches B (and the author).
 *   - two patches → strictly sequential versions (n+1, n+2), both persisted.
 *   - flag OFF → NO persist (DB untouched) but relay still delivers the patch.
 *
 * Uses two real `ws` clients against a live HTTP server (like the existing
 * ideaCollabWs.orgscope.test.ts setup, extended to full WS sessions), with an
 * in-memory DB stub standing in for the canonical row so we can assert the
 * read-modify-write without a live Postgres.
 */
import http from 'http';
import net from 'net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

// ── Mutable feature flag (toggled per test) ───────────────────────────────────

const flagState = vi.hoisted(() => ({ ENABLE_SHARED_IDEA_MAPS: true }));

vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: flagState,
  default: flagState,
  loadFeatureFlags: () => flagState,
}));

// ── In-memory canonical map store + membership ────────────────────────────────

interface StoreState {
  ideaOrg: Map<string, string>; // ideaId -> organizationId (my_ideas)
  members: Set<string>; // `${org}:${user}` ACTIVE membership
  canonical: Map<
    string,
    { id: string; version: number; nodes_json: string; edges_json: string; last_editor?: string }
  >; // ideaId -> canonical row
  locks: Map<string, { holder: string; owner: string; token: number; expiresAt: number }>;
  collabEvents: Array<{ eventType: string; payload: unknown }>;
}

const store = vi.hoisted(
  () =>
    ({
      ideaOrg: new Map<string, string>(),
      members: new Set<string>(),
      canonical: new Map(),
      locks: new Map(),
      collabEvents: [],
    }) as StoreState
);

// getTableColumns → always report is_canonical present so the canonical path is
// active (real schema fallback also lists it after T1).
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () =>
    new Set([
      'id',
      'idea_id',
      'user_id',
      'organization_id',
      'nodes_json',
      'edges_json',
      'version',
      'is_canonical',
      'last_editor_user_id',
      'archived_from_user_id',
    ])
  ),
  hasColumn: vi.fn(async () => true),
  clearSchemaCache: vi.fn(),
}));

// db.get dispatcher: matches the queries the gateway + ideaMapAccess issue.
async function dbGet(sql: string, params: unknown[] = []): Promise<unknown> {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (/INSERT INTO idea_workspace_node_locks/.test(s)) {
    const org = String(params[3]); const idea = String(params[4]); const node = String(params[5]);
    const holder = String(params[6]); const owner = String(params[7]); const ttl = Number(params[8]);
    const key = `${org}:${idea}:${node}`; const prior = store.locks.get(key);
    if (prior && prior.expiresAt > Date.now() && (prior.holder !== holder || prior.owner !== owner)) return null;
    const next = { holder, owner, token: (prior?.token || 0) + 1, expiresAt: Date.now() + ttl * 1000 };
    store.locks.set(key, next);
    return { nodeId: node, holderUserId: holder, leaseOwner: owner, fencingToken: next.token, expiresAt: new Date(next.expiresAt).toISOString() };
  }
  if (/DELETE FROM idea_workspace_node_locks/.test(s)) {
    const key = `${params[0]}:${params[1]}:${params[2]}`; const lock = store.locks.get(key);
    const released = !!lock && lock.holder === params[3] && lock.owner === params[4] && lock.token === Number(params[5]);
    if (released) store.locks.delete(key);
    return { released };
  }

  // my_ideas org check (flag-OFF upgrade path + membership idea existence)
  if (/SELECT id FROM my_ideas WHERE id = \? AND organization_id = \?/.test(s)) {
    const [ideaId, org] = params as [string, string];
    return store.ideaOrg.get(ideaId) === org ? { id: ideaId } : null;
  }
  // organization_members ACTIVE check
  if (/organization_members WHERE organization_id = \? AND user_id = \?.*ACTIVE/.test(s)) {
    const [org, user] = params as [string, string];
    return store.members.has(`${org}:${user}`) ? { id: `${org}:${user}` } : null;
  }
  // canonical row read (selectCanonicalMapRowFull)
  if (/FROM my_idea_maps WHERE idea_id = \? AND organization_id = \? AND is_canonical = TRUE/.test(s)) {
    const [ideaId] = params as [string, string];
    const row = store.canonical.get(ideaId);
    if (!row) return null;
    return {
      id: row.id,
      version: row.version,
      nodes_json: row.nodes_json,
      edges_json: row.edges_json,
    };
  }
  // collab_sessions INSERT ... RETURNING id (persistJoin)
  if (/INSERT INTO collab_sessions/.test(s)) {
    return { id: `sess-${Math.random().toString(36).slice(2)}` };
  }
  return null;
}

async function dbAll(sql: string, params: unknown[] = []): Promise<unknown[]> {
  if (/FROM idea_workspace_node_locks/.test(sql)) {
    const prefix = `${params[0]}:${params[1]}:`;
    return [...store.locks.entries()].filter(([key, lock]) => key.startsWith(prefix) && lock.expiresAt > Date.now())
      .map(([key, lock]) => ({ nodeId: key.slice(prefix.length), holderUserId: lock.holder, leaseOwner: lock.owner, fencingToken: lock.token, expiresAt: new Date(lock.expiresAt).toISOString() }));
  }
  return [];
}

// db.run dispatcher: the canonical UPDATE (find the row by its id and mutate it).
async function dbRun(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (/INSERT INTO collab_session_events \(session_id, event_type, payload_json\)/.test(s)) {
    store.collabEvents.push({
      eventType: String(params[1]),
      payload: params[2] == null ? null : JSON.parse(String(params[2])),
    });
    return { changes: 1 };
  }
  if (/UPDATE my_idea_maps SET nodes_json = \?, edges_json = \?, version = \?, last_editor_user_id = \?/.test(s)) {
    const [nodesJson, edgesJson, version, lastEditor, , rowId] = params as [
      string,
      string,
      number,
      string,
      string,
      string,
    ];
    for (const [, row] of store.canonical) {
      if (row.id === rowId) {
        row.nodes_json = nodesJson;
        row.edges_json = edgesJson;
        row.version = version;
        row.last_editor = lastEditor;
        return { changes: 1 };
      }
    }
    return { changes: 0 };
  }
  return { changes: 0 };
}

const execCalls = vi.hoisted(() => [] as string[]);
const pinnedState = vi.hoisted(() => ({ tail: Promise.resolve(), releaseLock: null as null | (() => void) }));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    get: (sql: string, params?: unknown[]) => dbGet(sql, params),
    run: (sql: string, params?: unknown[]) => dbRun(sql, params),
    exec: async (sql: string) => {
      execCalls.push(sql);
    },
    query: vi.fn().mockResolvedValue({ rows: [] }),
    all: (sql: string, params?: unknown[]) => dbAll(sql, params),
    prepare: vi.fn(),
  }),
}));

vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  getPoolClientForPinnedTransaction: async () => {
    let unlock: () => void = () => undefined;
    const mine = new Promise<void>((resolve) => { unlock = resolve; });
    const previous = pinnedState.tail;
    pinnedState.tail = previous.then(() => mine);
    let owns = false;
    return {
      query: async (sql: string, params: unknown[] = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        if (normalized === 'BEGIN') {
          await previous;
          owns = true;
          execCalls.push('BEGIN');
          return { rows: [], rowCount: null };
        }
        if (normalized === 'COMMIT' || normalized === 'ROLLBACK') {
          execCalls.push(normalized);
          if (owns) unlock();
          owns = false;
          return { rows: [], rowCount: null };
        }
        if (/SELECT id, version, nodes_json, edges_json FROM my_idea_maps/.test(normalized)) {
          const [ideaId] = params as [string, string];
          const row = store.canonical.get(ideaId);
          return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
        }
        if (/FROM idea_workspace_node_locks/.test(normalized)) {
          const [org, idea, nodes] = params as [string, string, string[]];
          const rows = nodes.flatMap((node) => {
            const lock = store.locks.get(`${org}:${idea}:${node}`);
            return lock ? [{ node_id: node, lease_owner: lock.owner, fencing_token: String(lock.token), unexpired: lock.expiresAt > Date.now() }] : [];
          });
          return { rows, rowCount: rows.length };
        }
        if (/UPDATE my_idea_maps SET nodes_json = \$1/.test(normalized)) {
          const [nodesJson, edgesJson, version, lastEditor, rowId, org, expectedVersion] = params as [
            string, string, number, string, string, string, number,
          ];
          for (const [ideaId, row] of store.canonical) {
            if (row.id === rowId && store.ideaOrg.get(ideaId) === org && row.version === expectedVersion) {
              row.nodes_json = nodesJson;
              row.edges_json = edgesJson;
              row.version = version;
              row.last_editor = lastEditor;
              return { rows: [], rowCount: 1 };
            }
          }
          return { rows: [], rowCount: 0 };
        }
        throw new Error(`unexpected pinned SQL: ${normalized}`);
      },
      release: () => { if (owns) unlock(); owns = false; },
    };
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/config/Config.js', () => ({
  config: { JWT_SECRET: 'test-secret' },
}));

vi.mock('../../../server/src/realtime/demoRealtimeGuard.js', () => ({
  evaluateRealtimeAccess: vi.fn(async () => ({ allowed: true })),
  trackRealtimeConnection: vi.fn(() => () => undefined),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { attachIdeaCollabWs } from '../../../server/src/gateways/ideaCollabWs.gateway.js';

const JWT_SECRET = 'test-secret';
function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET);
}

/** Raw HTTP upgrade (used for the 403 non-member assertion). */
function sendUpgrade(port: number, path: string, token?: string): Promise<number> {
  return new Promise((resolve) => {
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
      socket.write(
        [
          `GET ${url} HTTP/1.1`,
          `Host: 127.0.0.1:${port}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n')
      );
    });
    let data = '';
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(-1);
    }, 2000);
    socket.on('data', (chunk) => {
      data += chunk.toString();
      const m = data.match(/^HTTP\/1\.1 (\d{3})/);
      if (m) {
        clearTimeout(timeout);
        socket.destroy();
        resolve(parseInt(m[1], 10));
      }
    });
    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(-1);
    });
    socket.on('close', () => {
      clearTimeout(timeout);
      if (data === '') resolve(-1);
    });
  });
}

/** Open a WS client and wait for the OPEN event. */
const liveSockets = new Set<WebSocket>();

function connect(port: number, ideaId: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/collab/${ideaId}?token=${encodeURIComponent(token)}`);
    const t = setTimeout(() => reject(new Error('connect timeout')), 3000);
    ws.on('open', () => {
      clearTimeout(t);
      liveSockets.add(ws);
      ws.once('close', () => liveSockets.delete(ws));
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

/** Collect messages of a given type on a socket. */
function onceMessageOfType(ws: WebSocket, type: string, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${type} message within ${timeoutMs}ms`)), timeoutMs);
    const handler = (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === type) {
          clearTimeout(t);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch {
        /* ignore */
      }
    };
    ws.on('message', handler);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DP-3 T5 — ideaCollabWs shared canonical persist', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end());
    attachIdeaCollabWs(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  afterEach(async () => {
    const closing = [...liveSockets].map((socket) => new Promise<void>((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) return resolve();
      socket.once('close', () => resolve());
      socket.close();
      setTimeout(() => { if (socket.readyState !== WebSocket.CLOSED) socket.terminate(); resolve(); }, 250);
    }));
    await Promise.all(closing);
    liveSockets.clear();
  });

  beforeEach(() => {
    flagState.ENABLE_SHARED_IDEA_MAPS = true;
    execCalls.length = 0;
    store.ideaOrg.clear();
    store.members.clear();
    store.canonical.clear();
    store.locks.clear();
    store.collabEvents.length = 0;
    pinnedState.tail = Promise.resolve();
  });

  it('non-member is rejected at upgrade (403) when flag ON', async () => {
    store.ideaOrg.set('idea-x', 'org-a');
    // no membership row for u-outsider
    const token = signToken({ id: 'u-outsider', organizationId: 'org-a' });
    const status = await sendUpgrade(port, '/ws/collab/idea-x', token);
    expect(status).toBe(403);
  });

  it('ACTIVE member patch → canonical row updated (version+1) + graph_version reaches peer', async () => {
    store.ideaOrg.set('idea-1', 'org-a');
    store.members.add('org-a:userA');
    store.members.add('org-a:userB');
    store.canonical.set('idea-1', {
      id: 'map-1',
      version: 3,
      nodes_json: JSON.stringify([{ id: 'n1', position: { x: 0, y: 0 } }]),
      edges_json: JSON.stringify([]),
    });

    const tokenA = signToken({ id: 'userA', organizationId: 'org-a', name: 'A' });
    const tokenB = signToken({ id: 'userB', organizationId: 'org-a', name: 'B' });
    const wsA = await connect(port, 'idea-1', tokenA);
    const wsB = await connect(port, 'idea-1', tokenB);

    const graphVersionOnB = onceMessageOfType(wsB, 'graph_version');
    const graphPatchOnB = onceMessageOfType(wsB, 'graph_patch');

    wsA.send(
      JSON.stringify({
        type: 'graph_patch',
        operations: [
          { op: 'add_node', data: { id: 'n2', position: { x: 10, y: 10 } } },
          { op: 'update_node', data: { id: 'n1', position: { x: 5, y: 5 } } },
        ],
      })
    );

    // Relay: B receives the raw patch.
    const relayed = await graphPatchOnB;
    expect(relayed.userId).toBe('userA');
    expect(Array.isArray(relayed.operations)).toBe(true);

    // Broadcast: B receives the new canonical version.
    const versionMsg = await graphVersionOnB;
    expect(versionMsg.version).toBe(4);

    // Canonical row persisted: version bumped, ops applied, editor stamped.
    const row = store.canonical.get('idea-1')!;
    expect(row.version).toBe(4);
    expect(row.last_editor).toBe('userA');
    expect(store.collabEvents.filter((event) =>
      event.eventType === 'graph_patch' &&
      typeof event.payload === 'object' && event.payload !== null &&
      (event.payload as any).opCount === 2 && (event.payload as any).version === 4
    )).toHaveLength(1);
    const nodes = JSON.parse(row.nodes_json);
    expect(nodes.find((n: any) => n.id === 'n2')).toBeTruthy();
    expect(nodes.find((n: any) => n.id === 'n1').position).toEqual({ x: 5, y: 5 });

    wsA.close();
    wsB.close();
  });

  it('two patches → strictly sequential versions (n+1, n+2), both persisted', async () => {
    store.ideaOrg.set('idea-2', 'org-a');
    store.members.add('org-a:userA');
    store.canonical.set('idea-2', {
      id: 'map-2',
      version: 10,
      nodes_json: JSON.stringify([]),
      edges_json: JSON.stringify([]),
    });

    const tokenA = signToken({ id: 'userA', organizationId: 'org-a', name: 'A' });
    const wsA = await connect(port, 'idea-2', tokenA);

    const versions: number[] = [];
    wsA.on('message', (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === 'graph_version') versions.push(m.version);
      } catch {
        /* ignore */
      }
    });

    // Acknowledge the first durable DB-serialized write before issuing the
    // second. Cross-replica overlap is covered by the real-PG subpacket suite;
    // this gateway test owns wire broadcast ordering.
    const firstVersion = onceMessageOfType(wsA, 'graph_version');
    wsA.send(
      JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add_node', data: { id: 'a' } }] })
    );
    expect((await firstVersion).version).toBe(11);
    const secondVersion = onceMessageOfType(wsA, 'graph_version');
    wsA.send(
      JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add_node', data: { id: 'b' } }] })
    );
    expect((await secondVersion).version).toBe(12);

    expect(versions).toEqual([11, 12]);
    const row = store.canonical.get('idea-2')!;
    expect(row.version).toBe(12);
    const nodes = JSON.parse(row.nodes_json);
    expect(nodes.map((n: any) => n.id).sort()).toEqual(['a', 'b']);

    wsA.close();
  });

  it('shared-map persist failure is fail-closed and does not relay the rejected patch', async () => {
    store.ideaOrg.set('idea-fail', 'org-a');
    store.members.add('org-a:userA');
    store.members.add('org-a:userB');
    const wsA = await connect(port, 'idea-fail', signToken({ id: 'userA', organizationId: 'org-a' }));
    const wsB = await connect(port, 'idea-fail', signToken({ id: 'userB', organizationId: 'org-a' }));
    let relayed = false;
    wsB.on('message', (raw) => {
      try {
        if (JSON.parse(raw.toString()).type === 'graph_patch') relayed = true;
      } catch { /* ignore */ }
    });
    const failure = onceMessageOfType(wsA, 'error');
    wsA.send(JSON.stringify({
      type: 'graph_patch',
      operations: [{ op: 'add_node', data: { id: 'stale' } }],
    }));
    expect((await failure).code).toBe('GRAPH_PERSIST_FAILED');
    await delay(100);
    expect(relayed).toBe(false);
    expect(store.collabEvents.some((event) => event.eventType === 'graph_patch')).toBe(false);
    wsA.close();
    wsB.close();
  });

  it('uses the server-held lock fence automatically and denies a non-holder', async () => {
    store.ideaOrg.set('idea-lock', 'org-a');
    store.members.add('org-a:userA');
    store.members.add('org-a:userB');
    store.canonical.set('idea-lock', {
      id: 'map-lock', version: 1,
      nodes_json: JSON.stringify([{ id: 'locked-node', label: 'before' }]), edges_json: '[]',
    });
    const wsA = await connect(port, 'idea-lock', signToken({ id: 'userA', organizationId: 'org-a' }));
    const wsB = await connect(port, 'idea-lock', signToken({ id: 'userB', organizationId: 'org-a' }));
    const acquired = onceMessageOfType(wsA, 'lock_acquired');
    wsA.send(JSON.stringify({ type: 'lock_node', nodeId: 'locked-node', ttlSeconds: 30 }));
    expect((await acquired).fencingToken).toBe(1);
    const succeeded = onceMessageOfType(wsA, 'graph_version');
    wsA.send(JSON.stringify({ type: 'graph_patch', operations: [
      { op: 'update_node', data: { id: 'locked-node', label: 'holder' } },
    ] }));
    expect((await succeeded).version).toBe(2);
    const denied = onceMessageOfType(wsB, 'error');
    wsB.send(JSON.stringify({ type: 'graph_patch', operations: [
      { op: 'update_node', data: { id: 'locked-node', label: 'nonholder' } },
    ] }));
    expect((await denied).code).toBe('GRAPH_PERSIST_FAILED');
    expect(store.canonical.get('idea-lock')?.version).toBe(2);
    wsA.close(); wsB.close();
  });

  it('rejects malformed graph ops and a membership revoked after socket upgrade without version bump', async () => {
    store.ideaOrg.set('idea-validate', 'org-a');
    store.members.add('org-a:userA');
    store.canonical.set('idea-validate', { id: 'map-validate', version: 4, nodes_json: '[]', edges_json: '[]' });
    const ws = await connect(port, 'idea-validate', signToken({ id: 'userA', organizationId: 'org-a' }));
    const malformed = onceMessageOfType(ws, 'error');
    ws.send(JSON.stringify({ type: 'graph_patch', operations: [{ op: 'unknown', data: { id: 'x' } }] }));
    expect((await malformed).code).toBe('INVALID_MESSAGE');
    expect(store.canonical.get('idea-validate')?.version).toBe(4);
    const malformedSelection = onceMessageOfType(ws, 'error');
    ws.send(JSON.stringify({ type: 'select_nodes', nodeIds: Array.from({ length: 201 }, (_, i) => `n-${i}`) }));
    expect((await malformedSelection).code).toBe('INVALID_MESSAGE');
    const malformedCursor = onceMessageOfType(ws, 'error');
    ws.send(JSON.stringify({ type: 'cursor', x: 'NaN', y: 0 }));
    expect((await malformedCursor).code).toBe('INVALID_MESSAGE');
    store.members.delete('org-a:userA');
    const revoked = onceMessageOfType(ws, 'error');
    ws.send(JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add_node', data: { id: 'x' } }] }));
    expect((await revoked).code).toBe('NOT_A_WRITER');
    expect(store.canonical.get('idea-validate')?.version).toBe(4);
    ws.close();
  });

  it('flag OFF still rechecks ACTIVE membership and revoked mutation has no relay or audit', async () => {
    flagState.ENABLE_SHARED_IDEA_MAPS = false;
    store.ideaOrg.set('idea-off-revoke', 'org-a');
    store.members.add('org-a:userA'); store.members.add('org-a:userB');
    store.canonical.set('idea-off-revoke', { id: 'map-off-r', version: 2, nodes_json: '[]', edges_json: '[]' });
    const wsA = await connect(port, 'idea-off-revoke', signToken({ id: 'userA', organizationId: 'org-a' }));
    const wsB = await connect(port, 'idea-off-revoke', signToken({ id: 'userB', organizationId: 'org-a' }));
    store.members.delete('org-a:userA');
    let relayed = false;
    wsB.on('message', (raw) => { try { if (JSON.parse(raw.toString()).type === 'graph_patch') relayed = true; } catch {} });
    const denied = onceMessageOfType(wsA, 'error');
    wsA.send(JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add_node', data: { id: 'denied' } }] }));
    expect((await denied).code).toBe('NOT_A_WRITER');
    await delay(100);
    expect(relayed).toBe(false);
    expect(store.collabEvents.some((event) => event.eventType === 'graph_patch')).toBe(false);
    expect(store.canonical.get('idea-off-revoke')?.version).toBe(2);
    wsA.close(); wsB.close();
  });

  it('flag OFF → no persist (DB untouched) but relay still delivers the patch', async () => {
    flagState.ENABLE_SHARED_IDEA_MAPS = false;
    store.ideaOrg.set('idea-3', 'org-a');
    store.members.add('org-a:userA');
    store.members.add('org-a:userB');
    store.canonical.set('idea-3', {
      id: 'map-3',
      version: 7,
      nodes_json: JSON.stringify([]),
      edges_json: JSON.stringify([]),
    });

    const tokenA = signToken({ id: 'userA', organizationId: 'org-a', name: 'A' });
    const tokenB = signToken({ id: 'userB', organizationId: 'org-a', name: 'B' });
    const wsA = await connect(port, 'idea-3', tokenA);
    const wsB = await connect(port, 'idea-3', tokenB);

    const graphPatchOnB = onceMessageOfType(wsB, 'graph_patch');
    let gotVersion = false;
    wsB.on('message', (raw) => {
      try {
        if (JSON.parse(raw.toString()).type === 'graph_version') gotVersion = true;
      } catch {
        /* ignore */
      }
    });

    wsA.send(
      JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add_node', data: { id: 'z' } }] })
    );

    const relayed = await graphPatchOnB;
    expect(relayed.userId).toBe('userA');

    await delay(300);
    // DB untouched: version still 7, no ops applied.
    const row = store.canonical.get('idea-3')!;
    expect(row.version).toBe(7);
    expect(JSON.parse(row.nodes_json)).toEqual([]);
    // No canonical UPDATE ran → no BEGIN/COMMIT.
    expect(execCalls).toEqual([]);
    // No graph_version broadcast when flag OFF.
    expect(gotVersion).toBe(false);

    wsA.close();
    wsB.close();
  });
});
