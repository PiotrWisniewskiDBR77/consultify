/**
 * Zadanie #101 (Grupa 0 / P0) — WS-leak: demo session must never write to the
 * user's REAL organization.
 *
 * The HTTP layer switches org context in demo mode (demoContextMiddleware →
 * demo_sessions / demo:enabled preference), but the WS gateway used to take
 * `organizationId` straight from the JWT (ideaCollabWs.gateway.ts:226). Result:
 * a user inside a demo session kept a realtime channel bound to their REAL org
 * — graph_patch / lock_node / collab_sessions writes landed on real data.
 *
 * This suite is the regression proof:
 *   1. active demo session  → handshake must bind to the SESSION org, so a
 *      join against a real-org idea is rejected 403 (OLD code: 101 upgrade).
 *   2. demo preference (shared demo org) → connection is read-only: write ops
 *      answered with DEMO_READ_ONLY error frame, not relayed, not persisted.
 *   3. org switch mid-connection (real → demo) → after the org-context TTL a
 *      write is rejected and the stale socket is closed with 4403.
 *   4. legit same-org multiplayer flow (graph_patch relay) keeps working.
 *
 * DB is mocked at the getDatabase() seam (same pattern as
 * ideaCollabWs.orgscope.test.ts) with SQL-dispatching handlers so the demo
 * state can be flipped mid-test.
 */
import http from 'http';
import net from 'net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';

// ── Hoisted DB mock ───────────────────────────────────────────────────────────

const mockDbGet = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockDbRun = vi.hoisted(() => vi.fn().mockResolvedValue({ changes: 0 }));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    get: (...args: [string, unknown[]]) => mockDbGet(...args),
    run: (...args: unknown[]) => mockDbRun(...args),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    all: vi.fn().mockResolvedValue([]),
    prepare: vi.fn(),
  }),
}));

const loggerWarn = vi.hoisted(() => vi.fn());
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: loggerWarn, error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/config/Config.js', () => ({
  config: { JWT_SECRET: 'test-secret' },
}));

// This suite owns the demo-tenant switching contract, not the separate shared
// maps membership contract. Keep that lane off and explicitly admit the
// synthetic principals through the newer fail-closed realtime guard.
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_SHARED_IDEA_MAPS: false },
  default: { ENABLE_SHARED_IDEA_MAPS: false },
}));
vi.mock('../../../server/src/realtime/demoRealtimeGuard.js', () => ({
  evaluateRealtimeAccess: vi.fn().mockResolvedValue({ allowed: true }),
  trackRealtimeConnection: vi.fn(() => () => undefined),
}));

// Short org-context TTL so the mid-connection switch test is fast.
process.env.WS_ORG_CONTEXT_TTL_MS = '80';

// ── Import after mocks ────────────────────────────────────────────────────────

import { attachIdeaCollabWs } from '../../../server/src/gateways/ideaCollabWs.gateway.js';

// ── Fixtures / helpers ────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret';
const REAL_ORG = 'org-real';
const SESSION_ORG = 'demo-org-session-u1';
const DEMO_ORG = process.env.DEMO_ORG_ID || 'demo-org';

interface DemoState {
  /** session_org_id of the active demo session, or null. */
  activeSessionOrg: string | null;
  /** demo:enabled user preference. */
  demoPrefEnabled: boolean;
  /** map ideaId -> organization_id (idea existence per org). */
  ideas: Record<string, string>;
}

const state: DemoState = { activeSessionOrg: null, demoPrefEnabled: false, ideas: {} };

/** SQL-dispatching db.get mock reflecting `state`. */
function installDbGet(): void {
  mockDbGet.mockImplementation(async (sql: string, params: unknown[]) => {
    if (/FROM\s+demo_sessions/i.test(sql)) {
      return state.activeSessionOrg ? { session_org_id: state.activeSessionOrg } : null;
    }
    if (/FROM\s+user_preferences/i.test(sql)) {
      return state.demoPrefEnabled ? { value: 'true' } : null;
    }
    if (/FROM\s+my_ideas/i.test(sql)) {
      const [ideaId, orgId] = params as [string, string];
      return state.ideas[ideaId] === orgId ? { id: ideaId } : null;
    }
    if (/INSERT\s+INTO\s+collab_sessions/i.test(sql)) {
      return { id: 'collab-session-1' };
    }
    return null;
  });
}

function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET);
}

/** Raw HTTP upgrade request → status code (401/403/101) or -1 on timeout. */
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
      const statusMatch = data.match(/^HTTP\/1\.1 (\d{3})/);
      if (statusMatch) {
        clearTimeout(timeout);
        socket.destroy();
        resolve(parseInt(statusMatch[1], 10));
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

/** Open a real WS client and wait for the initial session_state frame. */
function connectClient(port: number, ideaId: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws/collab/${ideaId}?token=${encodeURIComponent(token)}`
    );
    const t = setTimeout(() => reject(new Error('WS connect timeout')), 3000);
    ws.on('message', (raw: Buffer) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'session_state') {
        clearTimeout(t);
        resolve(ws);
      }
    });
    ws.on('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
    ws.on('close', (code) => {
      clearTimeout(t);
      reject(new Error(`WS closed during connect (code=${code})`));
    });
  });
}

/** Collect frames of a given type into an array (mutating sink). */
function collectFrames(ws: WebSocket, sink: Array<Record<string, unknown>>): void {
  ws.on('message', (raw: Buffer) => {
    try {
      sink.push(JSON.parse(raw.toString()));
    } catch {
      /* ignore */
    }
  });
}

function waitFor(cond: () => boolean, timeoutMs = 2500, everyMs = 20): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const iv = setInterval(() => {
      if (cond()) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(iv);
        reject(new Error('waitFor timeout'));
      }
    }, everyMs);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('#101 Grupa 0 — ideaCollabWs demo org-context isolation', () => {
  let server: http.Server;
  let port: number;
  const openSockets: WebSocket[] = [];

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

  beforeEach(() => {
    vi.clearAllMocks();
    state.activeSessionOrg = null;
    state.demoPrefEnabled = false;
    state.ideas = {};
    installDbGet();
    mockDbRun.mockResolvedValue({ changes: 0 });
  });

  afterEach(async () => {
    for (const ws of openSockets.splice(0)) {
      try {
        ws.terminate();
      } catch {
        /* already closed */
      }
    }
  });

  // ── 1. THE LEAK (regression proof — fails on pre-fix gateway) ──────────────

  it('P0 leak: active demo session must NOT allow joining a REAL-org idea (403)', async () => {
    // User u1: JWT bound to org-real, but an ACTIVE demo session exists.
    // idea-real lives in the real org. Old code binds the WS to the JWT org and
    // returns 101 — the demo session keeps a realtime write channel to real data.
    state.activeSessionOrg = SESSION_ORG;
    state.ideas['idea-real'] = REAL_ORG;

    const token = signToken({ id: 'u1', organizationId: REAL_ORG, name: 'U1' });
    const status = await sendUpgrade(port, '/ws/collab/idea-real', token);
    expect(status).toBe(403);
  });

  it('active demo session binds to the SESSION org: joining a session-org idea works', async () => {
    state.activeSessionOrg = SESSION_ORG;
    state.ideas['idea-demo'] = SESSION_ORG;

    const token = signToken({ id: 'u1', organizationId: REAL_ORG, name: 'U1' });
    const status = await sendUpgrade(port, '/ws/collab/idea-demo', token);
    expect([101, -1]).toContain(status);
    expect(status).not.toBe(403);
    // persistJoin must record the SESSION org, never the real org.
    await waitFor(() =>
      mockDbGet.mock.calls.some(([sql]) => /INSERT\s+INTO\s+collab_sessions/i.test(String(sql)))
    );
    const joinCall = mockDbGet.mock.calls.find(([sql]) =>
      /INSERT\s+INTO\s+collab_sessions/i.test(String(sql))
    );
    expect(joinCall?.[1]).toEqual(['idea-demo', SESSION_ORG, 'u1']);
  });

  // ── 2. Shared demo org (demo:enabled preference) is READ-ONLY ──────────────

  it('demo preference: writes are rejected with DEMO_READ_ONLY and not relayed', async () => {
    state.demoPrefEnabled = true;
    state.ideas['idea-shared'] = DEMO_ORG;

    const tokenA = signToken({ id: 'uA', organizationId: REAL_ORG, name: 'A' });
    const tokenB = signToken({ id: 'uB', organizationId: REAL_ORG, name: 'B' });

    const wsA = await connectClient(port, 'idea-shared', tokenA);
    const wsB = await connectClient(port, 'idea-shared', tokenB);
    openSockets.push(wsA, wsB);

    const framesA: Array<Record<string, unknown>> = [];
    const framesB: Array<Record<string, unknown>> = [];
    collectFrames(wsA, framesA);
    collectFrames(wsB, framesB);

    wsA.send(JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add' }] }));

    await waitFor(() => framesA.some((f) => f.type === 'error'));
    const err = framesA.find((f) => f.type === 'error');
    expect(err?.code).toBe('DEMO_READ_ONLY');
    // peer never receives the patch
    await sleep(150);
    expect(framesB.some((f) => f.type === 'graph_patch')).toBe(false);
    // no collab event persisted
    expect(
      mockDbRun.mock.calls.some(([sql]) =>
        /INSERT\s+INTO\s+collab_session_events/i.test(String(sql))
      )
    ).toBe(false);
    // rejection is logged, not silent
    expect(loggerWarn).toHaveBeenCalled();
  });

  // ── 3. Org switch mid-connection (stale socket must stop writing) ──────────

  it('demo session started while WS open: stale real-org socket is closed on next write (4403)', async () => {
    state.ideas['idea-real'] = REAL_ORG;

    const tokenA = signToken({ id: 'u1', organizationId: REAL_ORG, name: 'U1' });
    const tokenB = signToken({ id: 'u2', organizationId: REAL_ORG, name: 'U2' });
    const wsA = await connectClient(port, 'idea-real', tokenA);
    const wsB = await connectClient(port, 'idea-real', tokenB);
    openSockets.push(wsA, wsB);

    const framesB: Array<Record<string, unknown>> = [];
    collectFrames(wsB, framesB);

    // u1 enters demo mid-connection (active demo session appears in DB).
    state.activeSessionOrg = SESSION_ORG;

    // Wait past the org-context TTL so the next write triggers revalidation.
    await sleep(150);

    const closed = new Promise<number>((resolve) => wsA.on('close', (code) => resolve(code)));
    wsA.send(JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add' }] }));

    const closeCode = await closed;
    expect(closeCode).toBe(4403);
    // the patch never reached the peer on the old (real) org room
    await sleep(100);
    expect(framesB.some((f) => f.type === 'graph_patch')).toBe(false);
    expect(loggerWarn).toHaveBeenCalled();
  });

  // ── 4. Legit same-org multiplayer flow keeps working ────────────────────────

  it('no regression: same-org peers relay graph_patch and lock_node normally', async () => {
    state.ideas['idea-team'] = REAL_ORG;

    const tokenA = signToken({ id: 'uA', organizationId: REAL_ORG, name: 'A' });
    const tokenB = signToken({ id: 'uB', organizationId: REAL_ORG, name: 'B' });
    const wsA = await connectClient(port, 'idea-team', tokenA);
    const wsB = await connectClient(port, 'idea-team', tokenB);
    openSockets.push(wsA, wsB);

    const framesB: Array<Record<string, unknown>> = [];
    collectFrames(wsB, framesB);

    wsA.send(JSON.stringify({ type: 'graph_patch', operations: [{ op: 'add', id: 'n1' }] }));
    await waitFor(() => framesB.some((f) => f.type === 'graph_patch'));
    const patch = framesB.find((f) => f.type === 'graph_patch') as Record<string, unknown>;
    expect(patch.userId).toBe('uA');

    wsA.send(JSON.stringify({ type: 'lock_node', nodeId: 'n1' }));
    await waitFor(() =>
      framesB.some(
        (f) =>
          f.type === 'session_state' &&
          (f.lockedNodes as Record<string, string> | undefined)?.n1 === 'uA'
      )
    );
  });
});
