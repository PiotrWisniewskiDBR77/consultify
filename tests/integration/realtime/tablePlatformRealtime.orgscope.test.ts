/**
 * Zadanie #101 (Grupa 0 / P0) — /table-platform realtime org-context gate.
 *
 * Before the fix the namespace accepted ANONYMOUS connections with a
 * client-claimed userId, `join:table` joined any room unchecked and
 * `cell:update` relayed edits into any table room — a cross-org (and
 * demo→real) write-relay channel.
 *
 * After the fix:
 *   - connection requires a verified JWT (socketAuthMiddleware),
 *   - join:table validates the table's org (tp_tables → tp_bases) against the
 *     user's ACTIVE org (demo-aware, same resolver as ideaCollabWs),
 *   - cell:update requires room membership + fresh writable org context;
 *     demo shared org is read-only; a demo↔real switch mid-connection
 *     disconnects the stale socket,
 *   - rejections are logged and surfaced via `realtime:error`.
 *
 * Socket.IO is not installed in this worktree, so the suite drives the service
 * through a minimal fake io/namespace/socket implementation that mirrors the
 * (tiny) API surface the service uses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// ── Env before imports ────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-test-secret-test-secret-1234'; // ≥32 chars for socketAuth
process.env.JWT_SECRET = JWT_SECRET;
process.env.WS_ORG_CONTEXT_TTL_MS = '80';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockDbGet = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());

vi.mock('../../../server/src/database/Database.js', () => ({
  // DbPromise (pulled in by socketAuth) imports the default proxy — provide a
  // stub so module load succeeds; it is never exercised in this suite.
  default: {},
  dbProxy: {},
  getDatabase: () => ({
    get: (...args: [string, unknown[]]) => mockDbGet(...args),
    run: vi.fn().mockResolvedValue({ changes: 0 }),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    all: vi.fn().mockResolvedValue([]),
    prepare: vi.fn(),
  }),
}));

const loggerWarn = vi.hoisted(() => vi.fn());
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: loggerWarn, error: vi.fn(), debug: vi.fn() },
}));

// This suite characterizes table tenant resolution after a verified socket
// principal exists. Public-demo admission is covered by the dedicated realtime
// guard tests, so explicitly admit these synthetic users and keep the table/org
// authorization path below real.
vi.mock('../../../server/src/realtime/demoRealtimeGuard.js', () => ({
  evaluateRealtimeAccess: vi.fn().mockResolvedValue({ allowed: true }),
  trackRealtimeConnection: vi.fn(() => () => undefined),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { TablePlatformRealtimeService } from '../../../server/src/services/tablePlatform/RealtimeService.js';

// ── Demo/org state driving the db mock ────────────────────────────────────────

const REAL_ORG = 'org-real';
const OTHER_ORG = 'org-other';
const SESSION_ORG = 'demo-org-session-u1';
const DEMO_ORG = process.env.DEMO_ORG_ID || 'demo-org';

const state = {
  activeSessionOrg: null as string | null,
  demoPrefEnabled: false,
  /** tableId -> organization_id */
  tables: {} as Record<string, string>,
};

function installDbGet(): void {
  mockDbGet.mockImplementation(async (sql: string, params: unknown[]) => {
    if (/FROM\s+demo_sessions/i.test(sql)) {
      return state.activeSessionOrg ? { session_org_id: state.activeSessionOrg } : null;
    }
    if (/FROM\s+user_preferences/i.test(sql)) {
      return state.demoPrefEnabled ? { value: 'true' } : null;
    }
    if (/FROM\s+tp_tables/i.test(sql)) {
      const [tableId] = params as [string];
      const org = state.tables[tableId];
      return org ? { org_id: org } : null;
    }
    return null;
  });
}

// ── Minimal fake Socket.IO ────────────────────────────────────────────────────

type Handler = (...args: unknown[]) => void | Promise<void>;

class FakeSocket {
  id = `s-${Math.random().toString(36).slice(2, 8)}`;
  handshake: {
    auth: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  };
  data: Record<string, unknown> = {};
  rooms = new Set<string>();
  received: Array<{ event: string; payload: unknown }> = [];
  disconnected = false;
  private handlers = new Map<string, Handler>();

  constructor(
    private ns: FakeNamespace,
    auth: Record<string, unknown>
  ) {
    this.handshake = { auth, headers: {} };
  }

  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  }

  /** Simulate a client-emitted event (awaits async handlers). */
  async trigger(event: string, ...args: unknown[]): Promise<void> {
    const handler = this.handlers.get(event);
    if (handler) await handler(...args);
  }

  emit(event: string, payload?: unknown): void {
    this.received.push({ event, payload });
  }

  join(room: string): void {
    this.rooms.add(room);
  }

  leave(room: string): void {
    this.rooms.delete(room);
  }

  to(room: string): { emit: (event: string, payload?: unknown) => void } {
    return {
      emit: (event: string, payload?: unknown) => {
        for (const other of this.ns.sockets) {
          if (other !== this && other.rooms.has(room) && !other.disconnected) {
            other.received.push({ event, payload });
          }
        }
      },
    };
  }

  disconnect(_close?: boolean): void {
    this.disconnected = true;
  }
}

class FakeNamespace {
  sockets: FakeSocket[] = [];
  private middlewares: Array<(socket: unknown, next: (err?: Error) => void) => void> = [];
  private connectionHandler: ((socket: unknown) => void) | null = null;

  use(mw: (socket: unknown, next: (err?: Error) => void) => void): void {
    this.middlewares.push(mw);
  }

  on(event: string, handler: (socket: unknown) => void): void {
    if (event === 'connection') this.connectionHandler = handler;
  }

  to(_room: string): { emit: (event: string, payload?: unknown) => void } {
    return {
      emit: (event: string, payload?: unknown) => {
        for (const s of this.sockets) {
          if (s.rooms.has(_room) && !s.disconnected) s.received.push({ event, payload });
        }
      },
    };
  }

  /** Run middleware chain then the connection handler — like a real handshake. */
  async connect(
    auth: Record<string, unknown>
  ): Promise<{ socket: FakeSocket; error: Error | null }> {
    const socket = new FakeSocket(this, auth);
    for (const mw of this.middlewares) {
      const err = await new Promise<Error | undefined>((resolve) => mw(socket, resolve));
      if (err) return { socket, error: err };
    }
    this.sockets.push(socket);
    this.connectionHandler?.(socket);
    return { socket, error: null };
  }
}

class FakeIo {
  namespaces = new Map<string, FakeNamespace>();
  of(name: string): FakeNamespace {
    let ns = this.namespaces.get(name);
    if (!ns) {
      ns = new FakeNamespace();
      this.namespaces.set(name, ns);
    }
    return ns;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function token(payload: object): string {
  return jwt.sign(payload, JWT_SECRET);
}

function frames(socket: FakeSocket, event: string): unknown[] {
  return socket.received.filter((f) => f.event === event).map((f) => f.payload);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('#101 Grupa 0 — /table-platform realtime org-context gate', () => {
  let ns: FakeNamespace;

  beforeEach(() => {
    vi.clearAllMocks();
    state.activeSessionOrg = null;
    state.demoPrefEnabled = false;
    state.tables = {};
    installDbGet();

    const io = new FakeIo();
    const service = new TablePlatformRealtimeService();
    service.init(io as never);
    ns = io.of('/table-platform');
  });

  it('rejects anonymous connections (no token)', async () => {
    const { error } = await ns.connect({ userId: 'u-claimed', userName: 'X' });
    expect(error).toBeTruthy();
  });

  it('rejects a client-claimed userId without valid JWT', async () => {
    const { error } = await ns.connect({ token: 'not.a.jwt', userId: 'u-claimed' });
    expect(error).toBeTruthy();
  });

  it('join:table is refused when the table belongs to another org', async () => {
    state.tables['t-other'] = OTHER_ORG;
    const { socket, error } = await ns.connect({
      token: token({ id: 'u1', organizationId: REAL_ORG }),
    });
    expect(error).toBeNull();

    await socket.trigger('join:table', 't-other');
    expect(socket.rooms.has('table:t-other')).toBe(false);
    expect(frames(socket, 'realtime:error')).toEqual([
      expect.objectContaining({ code: 'TABLE_ORG_FORBIDDEN', tableId: 't-other' }),
    ]);
    expect(loggerWarn).toHaveBeenCalled();
  });

  it('P0 leak: active demo session must NOT join/relay into a REAL-org table', async () => {
    state.activeSessionOrg = SESSION_ORG;
    state.tables['t-real'] = REAL_ORG;

    const { socket, error } = await ns.connect({
      token: token({ id: 'u1', organizationId: REAL_ORG }),
    });
    expect(error).toBeNull();

    await socket.trigger('join:table', 't-real');
    expect(socket.rooms.has('table:t-real')).toBe(false);
    expect(frames(socket, 'realtime:error')).toEqual([
      expect.objectContaining({ code: 'TABLE_ORG_FORBIDDEN' }),
    ]);

    // even a forced relay attempt is refused (no room membership)
    await socket.trigger('cell:update', {
      tableId: 't-real',
      recordId: 'r1',
      fieldId: 'f1',
      value: 'x',
    });
    expect(frames(socket, 'realtime:error')).toEqual([
      expect.objectContaining({ code: 'TABLE_ORG_FORBIDDEN' }),
      expect.objectContaining({ code: 'TABLE_NOT_JOINED' }),
    ]);
  });

  it('demo preference (shared demo org): join is allowed but cell:update is read-only', async () => {
    state.demoPrefEnabled = true;
    state.tables['t-demo'] = DEMO_ORG;

    const { socket } = await ns.connect({ token: token({ id: 'u1', organizationId: REAL_ORG }) });
    await socket.trigger('join:table', 't-demo');
    expect(socket.rooms.has('table:t-demo')).toBe(true);

    await socket.trigger('cell:update', {
      tableId: 't-demo',
      recordId: 'r1',
      fieldId: 'f1',
      value: 'x',
    });
    expect(frames(socket, 'realtime:error')).toEqual([
      expect.objectContaining({ code: 'DEMO_READ_ONLY' }),
    ]);
    expect(loggerWarn).toHaveBeenCalled();
  });

  it('org switch mid-connection: stale real-org socket is disconnected on next write', async () => {
    state.tables['t-real'] = REAL_ORG;

    const { socket: writer } = await ns.connect({
      token: token({ id: 'u1', organizationId: REAL_ORG }),
    });
    const { socket: peer } = await ns.connect({
      token: token({ id: 'u2', organizationId: REAL_ORG }),
    });
    await writer.trigger('join:table', 't-real');
    await peer.trigger('join:table', 't-real');
    expect(writer.rooms.has('table:t-real')).toBe(true);

    // u1 enters demo mid-connection; wait past the org-context TTL.
    state.activeSessionOrg = SESSION_ORG;
    await sleep(150);

    await writer.trigger('cell:update', {
      tableId: 't-real',
      recordId: 'r1',
      fieldId: 'f1',
      value: 'leak',
    });
    expect(writer.disconnected).toBe(true);
    expect(frames(writer, 'realtime:error')).toEqual([
      expect.objectContaining({ code: 'ORG_CONTEXT_CHANGED' }),
    ]);
    expect(frames(peer, 'cell:updated')).toEqual([]);
    expect(loggerWarn).toHaveBeenCalled();
  });

  it('no regression: same-org peers relay cell:update with the VERIFIED user id', async () => {
    state.tables['t-team'] = REAL_ORG;

    const { socket: a } = await ns.connect({
      // client claims a different userId — the verified token id must win
      token: token({ id: 'u-real', organizationId: REAL_ORG }),
      userId: 'u-spoofed',
      userName: 'A',
    });
    const { socket: b } = await ns.connect({
      token: token({ id: 'u-b', organizationId: REAL_ORG }),
      userName: 'B',
    });

    await a.trigger('join:table', 't-team');
    await b.trigger('join:table', 't-team');

    await a.trigger('cell:update', {
      tableId: 't-team',
      recordId: 'r1',
      fieldId: 'f1',
      value: 42,
      userId: 'u-spoofed',
    });

    const updates = frames(b, 'cell:updated') as Array<Record<string, unknown>>;
    expect(updates).toHaveLength(1);
    expect(updates[0].userId).toBe('u-real');
    expect(updates[0].value).toBe(42);

    // presence flows too
    expect(frames(b, 'presence:update').length).toBeGreaterThan(0);
  });
});
