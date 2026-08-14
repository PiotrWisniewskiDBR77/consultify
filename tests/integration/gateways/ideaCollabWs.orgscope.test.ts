/**
 * M07 L-02 — WS org-scope regression test for ideaCollabWs.gateway.ts
 *
 * Verifies that the upgrade handler enforces:
 *   - 401 when token is missing or invalid
 *   - 403 when idea belongs to a different org (cross-org IDOR attempt)
 *   - upgrade proceeds when idea belongs to the requesting org
 *
 * Uses a real HTTP server + raw tcp to check HTTP/1.1 status returned
 * before the WebSocket handshake, without requiring a live DB.
 *
 * Pattern: mock getDatabase() to control `db.get()` return value.
 */
import http from 'http';
import net from 'net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

// ── Hoisted DB mock ───────────────────────────────────────────────────────────

const mockDbGet = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    get: (...args: [string, unknown[]]) => mockDbGet(...args),
    run: vi.fn().mockResolvedValue({ changes: 0 }),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    all: vi.fn().mockResolvedValue([]),
    prepare: vi.fn(),
  }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/config/Config.js', () => ({
  config: { JWT_SECRET: 'test-secret' },
}));

// Public-demo realtime eligibility is a separate boundary with its own tests.
// This suite exercises the organization and idea-membership boundary after an
// authenticated principal has already passed that eligibility gate.
vi.mock('../../../server/src/realtime/demoRealtimeGuard.js', () => ({
  evaluateRealtimeAccess: async () => ({ allowed: true, reason: 'eligible_test_principal' }),
  trackRealtimeConnection: () => () => undefined,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { attachIdeaCollabWs } from '../../../server/src/gateways/ideaCollabWs.gateway.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret';

function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Send a raw HTTP/1.1 Upgrade request and collect the response status line.
 * Returns the HTTP status code (e.g. 401, 403) or -1 on TCP error.
 */
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
      resolve(-1); // timed out — no HTTP response
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

    socket.on('error', () => { clearTimeout(timeout); resolve(-1); });
    socket.on('close', () => { clearTimeout(timeout); if (data === '') resolve(-1); });
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('M07 L-02 — ideaCollabWs org-scope gate', () => {
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

  beforeEach(() => {
    vi.resetAllMocks();
    mockDbGet.mockResolvedValue(null); // default: idea not found → 403
  });

  it('returns 401 when no token is provided', async () => {
    const status = await sendUpgrade(port, '/ws/collab/idea-1');
    expect(status).toBe(401);
  });

  it('returns 401 when token is malformed', async () => {
    const status = await sendUpgrade(port, '/ws/collab/idea-1', 'not.a.jwt');
    expect(status).toBe(401);
  });

  it('returns 401 when token is signed with wrong secret', async () => {
    const token = jwt.sign({ id: 'u1', organizationId: 'org-a' }, 'wrong-secret');
    const status = await sendUpgrade(port, '/ws/collab/idea-1', token);
    expect(status).toBe(401);
  });

  it('returns 403 when idea belongs to a different org (cross-org IDOR attempt)', async () => {
    // idea-1 is in org-b, but the token claims org-a
    mockDbGet.mockResolvedValue(null); // DB returns nothing → idea not in org-a
    const token = signToken({ id: 'u-attacker', organizationId: 'org-a' });
    const status = await sendUpgrade(port, '/ws/collab/idea-1', token);
    expect(status).toBe(403);
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM my_ideas'),
      ['idea-1', 'org-a']
    );
  });

  it('proceeds past the gate (not 401/403) when idea belongs to same org', async () => {
    // DB confirms idea-1 is in org-a → gate passes → WS upgrade proceeds (101)
    mockDbGet.mockResolvedValue({ id: 'idea-1' });
    const token = signToken({ id: 'u1', organizationId: 'org-a' });
    const status = await sendUpgrade(port, '/ws/collab/idea-1', token);
    // 101 = Switching Protocols (successful upgrade) or -1 if WS handshake times out
    // — either way it must NOT be 403 or 401
    expect([101, -1]).toContain(status);
    expect(status).not.toBe(403);
    expect(status).not.toBe(401);
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM my_ideas'),
      ['idea-1', 'org-a']
    );
  });

  // ── M07 F3 — graph_patch relay for the new PF-only ops ──────────────────
  // The gateway forwards `operations` 1:1 with no validation (line ~379:
  // `operations: msg.operations`), so update_lanes / graph_snapshot pass
  // through untouched. Prove it with two real WS clients in the same room.
  describe('graph_patch relay (update_lanes / graph_snapshot)', () => {
    function openClient(token: string): Promise<WebSocket> {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:${port}/ws/collab/idea-1?token=${encodeURIComponent(token)}`
        );
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
      });
    }

    function nextPatch(ws: WebSocket, timeoutMs = 2000): Promise<any> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no graph_patch received')), timeoutMs);
        ws.on('message', (raw: WebSocket.RawData) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'graph_patch') {
              clearTimeout(timer);
              resolve(msg);
            }
          } catch {
            /* ignore non-JSON */
          }
        });
      });
    }

    beforeEach(() => {
      // Same-org idea so the upgrade gate passes for both clients.
      mockDbGet.mockResolvedValue({ id: 'idea-1' });
    });

    it('relays update_lanes and graph_snapshot 1:1 from A to B', async () => {
      const tokenA = signToken({ id: 'u-a', organizationId: 'org-a', name: 'A' });
      const tokenB = signToken({ id: 'u-b', organizationId: 'org-a', name: 'B' });
      const a = await openClient(tokenA);
      const b = await openClient(tokenB);
      try {
        a.send(JSON.stringify({ type: 'join', userId: 'u-a', userName: 'A' }));
        b.send(JSON.stringify({ type: 'join', userId: 'u-b', userName: 'B' }));

        const lanes = [{ id: 'l1', label: 'Sales', color: '#111' }];
        const received = nextPatch(b);
        a.send(
          JSON.stringify({
            type: 'graph_patch',
            operations: [
              { op: 'update_lanes', data: { lanes } },
              { op: 'update_node', data: { id: 'n1', data: { laneId: 'l1' } } },
            ],
          })
        );
        const patch = await received;
        expect(patch.userId).toBe('u-a');
        expect(patch.operations).toEqual([
          { op: 'update_lanes', data: { lanes } },
          { op: 'update_node', data: { id: 'n1', data: { laneId: 'l1' } } },
        ]);

        const snap = {
          nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
          lanes,
        };
        const received2 = nextPatch(b);
        a.send(
          JSON.stringify({ type: 'graph_patch', operations: [{ op: 'graph_snapshot', data: snap }] })
        );
        const patch2 = await received2;
        expect(patch2.operations[0].op).toBe('graph_snapshot');
        expect(patch2.operations[0].data).toEqual(snap);
      } finally {
        a.close();
        b.close();
      }
    });

    it('does NOT echo a graph_patch back to its own sender', async () => {
      const tokenA = signToken({ id: 'u-a', organizationId: 'org-a', name: 'A' });
      const a = await openClient(tokenA);
      try {
        a.send(JSON.stringify({ type: 'join', userId: 'u-a', userName: 'A' }));
        let echoed = false;
        a.on('message', (raw: WebSocket.RawData) => {
          try {
            if (JSON.parse(raw.toString()).type === 'graph_patch') echoed = true;
          } catch {
            /* ignore */
          }
        });
        a.send(
          JSON.stringify({
            type: 'graph_patch',
            operations: [{ op: 'update_lanes', data: { lanes: [] } }],
          })
        );
        await new Promise((r) => setTimeout(r, 300));
        expect(echoed).toBe(false);
      } finally {
        a.close();
      }
    });
  });

  it('non-collab paths are ignored (gateway does not intercept)', async () => {
    // /ws/other/... should not match, so the raw HTTP server responds 200
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const response = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => { socket.destroy(); resolve('timeout'); }, 1000);
      socket.on('connect', () =>
        socket.write('GET /api/health HTTP/1.1\r\nHost: test\r\nConnection: close\r\n\r\n')
      );
      let buf = '';
      socket.on('data', (d) => { buf += d.toString(); });
      socket.on('close', () => { clearTimeout(t); resolve(buf); });
      socket.on('error', reject);
    });
    // Response from the raw http.createServer handler — not gateway
    expect(response).toMatch(/HTTP\/1\.1 200/);
  });
});
