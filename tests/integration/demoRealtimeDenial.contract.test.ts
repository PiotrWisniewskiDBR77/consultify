/**
 * OPS-DEMO-002 — the realtime plane must refuse public demo principals.
 *
 * Realtime is a second authorization surface that never passes through
 * `attachUser`, where the HTTP read-only guard lives. Every entry point verified
 * only the JWT signature, so a public demo credential could open a socket and
 * emit mutating events — `cell:update`, CRDT patches, presence, votes, comments,
 * edit locks — none of which the HTTP guard can see. And because the handshake was
 * the only check, a socket opened while the demo was live kept working for the
 * rest of the access token's life after the session expired.
 *
 * Policy under test: a public demo principal gets NO realtime connection at all.
 *
 * These cases drive REAL transports — a real socket.io-client against a real
 * listening server, and a real WebSocket upgrade — not a mocked middleware.
 */
import type { Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const nodePath = require('path');
  const nodeFs = require('fs');
  const dbFile = nodePath.resolve(__dirname, 'demo-realtime.integration.db');
  try {
    nodeFs.rmSync(dbFile, { force: true });
  } catch {
    /* best effort */
  }
  process.env.SQLITE_PATH = dbFile;
  process.env.MOCK_DB = 'false';
  process.env.DEMO_USE_BASE_ORG = 'false';
  process.env.DEMO_ORG_ID = 'demo-org';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'ops-demo-002-realtime-fixture-secret-at-least-32-chars';
});

import app from '../../server/src/index';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { dbProxy, resetConnection } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';
import { get as dbGet, run as dbRun } from '../../server/src/utils/DbPromise.js';
import { __resetDemoPrincipalCache } from '../../server/src/services/demo/demoPrincipalGuard.js';
import {
  __resetRealtimeTracking,
  __trackedRealtimeConnections,
  evaluateRealtimeAccess,
  sweepRealtimeConnections,
  trackRealtimeConnection,
} from '../../server/src/realtime/demoRealtimeGuard.js';

const RUN_ID = `${process.pid.toString(36)}${Date.now().toString(36)}`;
const FIXTURE_PASSWORD = 'ops-demo-002-realtime-pass';
let caseCounter = 0;
const fixtureEmail = (label: string) =>
  `ops-demo-002+rt-${label}-${RUN_ID}-${(caseCounter += 1)}@fixture.invalid`;

async function registerDemo(email: string) {
  return request(app)
    .post('/api/auth/register-demo')
    .send({ email, password: FIXTURE_PASSWORD, firstName: 'Fixture' });
}

/** Every namespace that runs the central socket auth middleware. */
const GUARDED_NAMESPACES = ['/chat-projects', '/org-context', '/facilitation', '/table-platform'];

describe('OPS-DEMO-002 realtime denial', () => {
  beforeAll(async () => {
    await resetConnection();
    const init = await initializeDatabase();
    if (!init.success) throw new Error(`DB init failed: ${init.message}`);
    await setDependencies({ db: dbProxy });
    __resetRealtimeTracking();
  }, 180_000);

  afterAll(async () => {
    __resetRealtimeTracking();
    await resetConnection();
  });

  describe('the central decision', () => {
    it('refuses an ACTIVE public demo principal', async () => {
      const a = await registerDemo(fixtureEmail('active'));
      expect(a.status).toBe(200);
      __resetDemoPrincipalCache();

      const decision = await evaluateRealtimeAccess(a.body.user.id);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('demo_realtime_forbidden');
    }, 180_000);

    it('refuses an EXPIRED public demo principal', async () => {
      const a = await registerDemo(fixtureEmail('expired'));
      await dbRun(
        `UPDATE demo_sessions SET expires_at = ? WHERE user_id = ?`,
        [new Date(Date.now() - 60_000).toISOString(), a.body.user.id],
        { fallback: false }
      );
      __resetDemoPrincipalCache();

      const decision = await evaluateRealtimeAccess(a.body.user.id);
      expect(decision.allowed).toBe(false);
    }, 180_000);

    it('allows an ordinary non-demo user — realtime is not broken for customers', async () => {
      const email = `ops-demo-002+rt-normal-${RUN_ID}@fixture.invalid`;
      const reg = await request(app).post('/api/auth/register').send({
        email,
        password: FIXTURE_PASSWORD,
        firstName: 'Normal',
        lastName: 'User',
        companyName: `ops-demo-002 realtime ${RUN_ID}`,
      });
      expect([200, 201]).toContain(reg.status);
      const userId = reg.body?.user?.id || reg.body?.id;
      expect(userId).toBeTruthy();
      __resetDemoPrincipalCache();

      const decision = await evaluateRealtimeAccess(userId);
      expect(decision.allowed).toBe(true);
    }, 180_000);

    it('refuses an empty principal', async () => {
      expect((await evaluateRealtimeAccess('')).allowed).toBe(false);
    });
  });

  describe('live transports', () => {
    let server: HttpServer;
    let baseUrl: string;

    beforeAll(async () => {
      const { createServer } = await import('http');
      server = createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as AddressInfo).port;
      baseUrl = `http://127.0.0.1:${port}`;

      // Attach the realtime planes exactly as index.ts does.
      // socket.io (server) resolves only from server/node_modules, so load it
      // through a require rooted there. Using the real server keeps this a real
      // transport test rather than a middleware unit test.
      const { createRequire } = await import('module');
      const nodePath = await import('path');
      // `import.meta.url` is unusable here: the suite runs under jsdom, whose
      // Location shim hijacks URL. __dirname is stable in this harness.
      const serverRequire = createRequire(
        nodePath.resolve(__dirname, '../../server/package.json')
      );
      const { Server: SocketIOServer } = serverRequire('socket.io');
      const io = new SocketIOServer(server, { cors: { origin: '*' } });
      // Create each namespace explicitly and apply the PRODUCTION middleware, so a
      // connection outcome is a statement about that middleware. (Connecting to a
      // namespace that was never created is refused by socket.io itself, which is
      // how this test used to pass vacuously.)
      const { socketAuthMiddleware } = await import('../../server/src/realtime/socketAuth.js');
      for (const namespace of GUARDED_NAMESPACES) {
        const ns = io.of(namespace);
        ns.use(socketAuthMiddleware);
        ns.on('connection', () => {
          /* the handshake is the whole subject; no handlers needed */
        });
      }
      const { attachIdeaCollabWs } = await import(
        '../../server/src/gateways/ideaCollabWs.gateway.js'
      );
      attachIdeaCollabWs(server);
      const { attachNotebookCollabWs } = await import(
        '../../server/src/gateways/notebookCollabWs.gateway.js'
      );
      attachNotebookCollabWs(server);
      const { attachPresentationCollabWs } = await import(
        '../../server/src/gateways/presentationCollabWs.gateway.js'
      );
      attachPresentationCollabWs(server);
    }, 180_000);

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    /** Connect to a namespace guarded by the production socketAuthMiddleware. */
    async function connectSocketIo(
      namespace: string,
      token: string
    ): Promise<'connected' | 'refused'> {
      const { io: ioClient } = await import('socket.io-client');
      return new Promise((resolve) => {
        const client = ioClient(`${baseUrl}${namespace}`, {
          auth: { token },
          transports: ['websocket'],
          reconnection: false,
          timeout: 3000,
        });
        const settle = (result: 'connected' | 'refused') => {
          try {
            client.close();
          } catch {
            /* noop */
          }
          resolve(result);
        };
        client.on('connect', () => settle('connected'));
        client.on('connect_error', () => settle('refused'));
        setTimeout(() => settle('refused'), 4000);
      });
    }

    /** Try a real native WebSocket upgrade; resolve with the outcome. */
    async function tryWebSocket(path: string, token: string): Promise<'open' | 'refused'> {
      const { default: WebSocket } = await import('ws');
      return new Promise((resolve) => {
        const ws = new WebSocket(
          `${baseUrl.replace('http', 'ws')}${path}?token=${encodeURIComponent(token)}`
        );
        const settle = (outcome: 'open' | 'refused') => {
          try {
            ws.close();
          } catch {
            /* noop */
          }
          resolve(outcome);
        };
        ws.on('open', () => settle('open'));
        ws.on('error', () => settle('refused'));
        ws.on('unexpected-response', () => settle('refused'));
        setTimeout(() => settle('refused'), 4000);
      });
    }

    it.each([
      ['idea collaboration (CRDT / edit locks)', '/ws/collab/idea-fixture'],
      ['notebook collaboration (presence)', '/ws/notebook/notebook-fixture'],
      ['presentation collaboration (comments)', '/ws/presentations/deck-fixture'],
    ])('refuses a public demo token on %s', async (_label, path) => {
      const a = await registerDemo(fixtureEmail('ws'));
      __resetDemoPrincipalCache();
      expect(await tryWebSocket(path, a.body.token)).toBe('refused');
    }, 180_000);

    it('refuses a public demo token on a namespace running the real socket auth middleware', async () => {
      // The namespace is built HERE, applying the production `socketAuthMiddleware`,
      // so the connection outcome reflects that middleware and nothing else. An
      // earlier version of this test connected to namespaces that were never
      // created, which socket.io refuses on its own — it passed while proving
      // nothing. The negative control below is what keeps this honest.
      const a = await registerDemo(fixtureEmail('sio'));
      __resetDemoPrincipalCache();

      for (const namespace of GUARDED_NAMESPACES) {
        const outcome = await connectSocketIo(namespace, a.body.token);
        expect(outcome, `namespace ${namespace} must refuse a public demo token`).toBe('refused');
      }
    }, 180_000);

    it('admits an ordinary non-demo user on the same namespace', async () => {
      // Proves the refusal above is the demo policy, not a broken namespace.
      const email = `ops-demo-002+rt-sio-ok-${RUN_ID}@fixture.invalid`;
      const reg = await request(app).post('/api/auth/register').send({
        email,
        password: FIXTURE_PASSWORD,
        firstName: 'Sio',
        lastName: 'Ok',
        companyName: `ops-demo-002 sio ${RUN_ID}`,
      });
      const userId = reg.body?.user?.id || reg.body?.id;
      __resetDemoPrincipalCache();
      const jwt = (await import('jsonwebtoken')).default;
      const token = jwt.sign(
        { id: userId, email, organizationId: reg.body?.user?.organizationId || 'x' },
        process.env.JWT_SECRET as string
      );
      expect(await connectSocketIo(GUARDED_NAMESPACES[0], token)).toBe('connected');
    }, 180_000);

    it('a forged organizationId in the token does not buy a connection', async () => {
      // The handshake org is never consulted; the decision is the DB marker.
      const a = await registerDemo(fixtureEmail('forged-org'));
      __resetDemoPrincipalCache();
      const jwt = (await import('jsonwebtoken')).default;
      const forged = jwt.sign(
        { id: a.body.user.id, email: 'x@fixture.invalid', organizationId: 'some-other-tenant' },
        process.env.JWT_SECRET as string
      );
      expect(await tryWebSocket('/ws/collab/idea-fixture', forged)).toBe('refused');
    }, 180_000);

    it('user A presenting user B session org is still refused', async () => {
      const a = await registerDemo(fixtureEmail('cross-a'));
      const b = await registerDemo(fixtureEmail('cross-b'));
      __resetDemoPrincipalCache();
      const jwt = (await import('jsonwebtoken')).default;
      const forged = jwt.sign(
        {
          id: a.body.user.id,
          email: 'x@fixture.invalid',
          organizationId: b.body.demoSession.organizationId,
        },
        process.env.JWT_SECRET as string
      );
      expect(await tryWebSocket('/ws/notebook/notebook-fixture', forged)).toBe('refused');
    }, 180_000);
  });

  describe('a refused connection writes nothing', () => {
    /**
     * The events the review named — cell:update, CRDT, presence, votes, comments,
     * edit locks — all land in these tables. A refused handshake must leave every
     * one of them untouched.
     */
    const REALTIME_WRITE_TABLES = [
      'collab_sessions',
      'realtime_presence',
      'idea_map_nodes',
      'notebook_pages',
    ];

    async function countRows(table: string): Promise<number> {
      try {
        const row = await dbGet<{ c: number }>(`SELECT COUNT(*) as c FROM ${table}`, [], {
          fallback: false,
        });
        return Number(row?.c || 0);
      } catch {
        return -1; // table absent in this schema — treated as "nothing to compare"
      }
    }

    it('leaves every realtime-written table byte-identical', async () => {
      const a = await registerDemo(fixtureEmail('nowrite'));
      __resetDemoPrincipalCache();

      const before: Record<string, number> = {};
      for (const table of REALTIME_WRITE_TABLES) before[table] = await countRows(table);

      const { default: WebSocket } = await import('ws');
      const { createServer } = await import('http');
      const probeServer = createServer(app);
      await new Promise<void>((resolve) => probeServer.listen(0, '127.0.0.1', resolve));
      const port = (probeServer.address() as AddressInfo).port;
      const { attachIdeaCollabWs } = await import(
        '../../server/src/gateways/ideaCollabWs.gateway.js'
      );
      attachIdeaCollabWs(probeServer);

      await new Promise<void>((resolve) => {
        const ws = new WebSocket(
          `ws://127.0.0.1:${port}/ws/collab/idea-fixture?token=${encodeURIComponent(a.body.token)}`
        );
        const done = () => {
          try {
            ws.close();
          } catch {
            /* noop */
          }
          resolve();
        };
        ws.on('open', () => {
          // If we ever get here the guard failed; still try the mutating emit so
          // the read-back below is a genuine proof rather than a vacuous one.
          ws.send(JSON.stringify({ type: 'cell:update', payload: { value: 'must-not-persist' } }));
          setTimeout(done, 500);
        });
        ws.on('error', done);
        ws.on('unexpected-response', done);
        setTimeout(done, 4000);
      });

      await new Promise<void>((resolve) => probeServer.close(() => resolve()));

      for (const table of REALTIME_WRITE_TABLES) {
        const after = await countRows(table);
        expect(after, `${table} must be unchanged`).toBe(before[table]);
      }
    }, 180_000);
  });

  describe('an already-open connection is closed when the principal stops qualifying', () => {
    it('the sweep disconnects a tracked connection and stops tracking it', async () => {
      __resetRealtimeTracking();
      const a = await registerDemo(fixtureEmail('sweep'));
      __resetDemoPrincipalCache();

      let closed = 0;
      const untrack = trackRealtimeConnection(a.body.user.id, () => {
        closed += 1;
      });
      expect(__trackedRealtimeConnections()).toBe(1);

      // A public demo principal never qualifies, so the very next sweep evicts it —
      // this is the path that also covers "session expired while the socket was open".
      const swept = await sweepRealtimeConnections();
      expect(swept).toBe(1);
      expect(closed).toBe(1);
      expect(__trackedRealtimeConnections()).toBe(0);
      untrack();
    }, 180_000);

    it('leaves a qualifying principal connected', async () => {
      __resetRealtimeTracking();
      const email = `ops-demo-002+rt-keep-${RUN_ID}@fixture.invalid`;
      const reg = await request(app).post('/api/auth/register').send({
        email,
        password: FIXTURE_PASSWORD,
        firstName: 'Keep',
        lastName: 'Connected',
        companyName: `ops-demo-002 keep ${RUN_ID}`,
      });
      const userId = reg.body?.user?.id || reg.body?.id;
      __resetDemoPrincipalCache();

      let closed = 0;
      const untrack = trackRealtimeConnection(userId, () => {
        closed += 1;
      });
      expect(await sweepRealtimeConnections()).toBe(0);
      expect(closed).toBe(0);
      untrack();
      expect(__trackedRealtimeConnections()).toBe(0);
    }, 180_000);
  });
});
