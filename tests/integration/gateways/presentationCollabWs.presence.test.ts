// @vitest-environment node
/**
 * P3.3 — /ws/presentations/:deckId presence gateway.
 *
 * Mirrors tests/integration/gateways/ideaCollabWs.orgscope.test.ts:
 *   - 401 on missing / malformed / wrong-secret token
 *   - 403 when the deck is not in the caller's org and no collaborator row
 *   - upgrade proceeds (101) when the deck is in the caller's org
 * Plus a live-socket presence test:
 *   - two clients connect → each sees the other in the presence roster
 *   - one disconnects → the remaining client gets `presence:left`
 *
 * Uses a real HTTP server + `ws` client. DB is mocked via getDatabase().
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

// resolveWsOrgContext: deterministic non-demo context bound to the JWT org.
vi.mock('../../../server/src/realtime/wsOrgContext.js', () => ({
  resolveWsOrgContext: vi.fn(async (_db: unknown, _userId: string, jwtOrg: string) => ({
    organizationId: jwtOrg,
    jwtOrganizationId: jwtOrg,
    demoMode: false,
    writeAllowed: true,
    resolvedAt: Date.now(),
  })),
  isWsOrgContextFresh: () => true,
  getDemoOrgId: () => 'demo-org',
  getWsOrgContextTtlMs: () => 60_000,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { attachPresentationCollabWs } from '../../../server/src/gateways/presentationCollabWs.gateway.js';

const JWT_SECRET = 'test-secret';

function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET);
}

/** Raw HTTP/1.1 Upgrade; resolves the HTTP status code or -1 on TCP error. */
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

function openClient(port: number, deckId: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws/presentations/${deckId}?token=${encodeURIComponent(token)}`
    );
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Wait for the first message whose parsed JSON satisfies `predicate`. */
function waitForMessage(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs = 2000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
    const handler = (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (predicate(msg)) {
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

describe('P3.3 — presentationCollabWs presence gateway', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end());
    attachPresentationCollabWs(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  beforeEach(() => {
    mockDbGet.mockReset();
    // Default: deck belongs to org-a; no collaborator rows.
    mockDbGet.mockImplementation(async (sql: string) => {
      if (/FROM presentation_decks/i.test(sql)) return { id: 'deck-1' };
      return null;
    });
  });

  it('returns 401 when no token is provided', async () => {
    expect(await sendUpgrade(port, '/ws/presentations/deck-1')).toBe(401);
  });

  it('returns 401 when token is malformed', async () => {
    expect(await sendUpgrade(port, '/ws/presentations/deck-1', 'not.a.jwt')).toBe(401);
  });

  it('returns 401 when token is signed with the wrong secret', async () => {
    const token = jwt.sign({ id: 'u1', organizationId: 'org-a' }, 'wrong-secret');
    expect(await sendUpgrade(port, '/ws/presentations/deck-1', token)).toBe(401);
  });

  it('returns 403 when the deck is not in the org and there is no collaborator row', async () => {
    mockDbGet.mockResolvedValue(null); // deck not in org, no membership
    const token = signToken({ id: 'u-attacker', organizationId: 'org-a' });
    const status = await sendUpgrade(port, '/ws/presentations/deck-1', token);
    expect(status).toBe(403);
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('FROM presentation_decks'),
      ['deck-1', 'org-a']
    );
  });

  it('proceeds past the gate (101) when the deck belongs to the org', async () => {
    const token = signToken({ id: 'u1', organizationId: 'org-a' });
    const status = await sendUpgrade(port, '/ws/presentations/deck-1', token);
    expect([101, -1]).toContain(status);
    expect(status).not.toBe(403);
    expect(status).not.toBe(401);
  });

  it('non-presentation paths are ignored by the gateway', async () => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const response = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => {
        socket.destroy();
        resolve('timeout');
      }, 1000);
      socket.on('connect', () =>
        socket.write('GET /api/health HTTP/1.1\r\nHost: test\r\nConnection: close\r\n\r\n')
      );
      let buf = '';
      socket.on('data', (d) => {
        buf += d.toString();
      });
      socket.on('close', () => {
        clearTimeout(t);
        resolve(buf);
      });
      socket.on('error', reject);
    });
    expect(response).toMatch(/HTTP\/1\.1 200/);
  });

  it('broadcasts presence: two clients see each other, and left on disconnect', async () => {
    const tokenA = signToken({ id: 'user-a', organizationId: 'org-a', name: 'Alice' });
    const tokenB = signToken({ id: 'user-b', organizationId: 'org-a', name: 'Bob' });

    const wsA = await openClient(port, 'deck-live', tokenA);

    // When B joins, A must receive a presence:joined for user-b.
    const aSeesB = waitForMessage(
      wsA,
      (m) => m.type === 'presence:joined' && m.user?.userId === 'user-b'
    );
    const wsB = await openClient(port, 'deck-live', tokenB);

    // B should receive the roster (presence:list) including A.
    const bRoster = await waitForMessage(
      wsB,
      (m) => m.type === 'presence:list' && Array.isArray(m.users)
    );
    expect(bRoster.users.some((u: any) => u.userId === 'user-a')).toBe(true);

    const joinedMsg = await aSeesB;
    expect(joinedMsg.user.name).toBe('Bob');

    // A must be notified when B disconnects.
    const aSeesLeft = waitForMessage(
      wsA,
      (m) => m.type === 'presence:left' && m.userId === 'user-b'
    );
    wsB.close();
    const leftMsg = await aSeesLeft;
    expect(leftMsg.userId).toBe('user-b');

    wsA.close();
  });
});
