/**
 * H5.4 — V8 MUTATION CANARY (regression guard for the req.destroyed hang).
 *
 * HISTORY (why this test exists):
 *   The v8 auth middleware (server/src/middleware/v8Auth.middleware.ts) gates
 *   requests on connection state. Twice it regressed by checking `req.destroyed`
 *   (re-added in 46a1674000 "to make a unit test pass"). That single check
 *   silently broke EVERY v8 POST/PATCH/DELETE on demo: express.json() consumes
 *   the request stream, and once the readable side ends it is auto-destroyed
 *   (`req.destroyed === true`) while the underlying socket stays open. The bad
 *   gate then short-circuited without calling next() and without sending a
 *   response, so every mutation hung until the Cloudflare 524 timeout.
 *   The canonical fix gates on `socket.destroyed` (real network state) +
 *   `res.writableEnded` / `res.headersSent`, and DELIBERATELY excludes
 *   `req.destroyed`. See MEMORY finding: v8_req_destroyed_hangs_mutations.
 *
 * WHAT THIS ASSERTS (through the REAL router + REAL verifyToken + REAL v8
 * middleware chain + REAL Postgres, exactly the production path):
 *   1. A normal completed v8 mutation (POST .../ledger/baselines) succeeds with
 *      201 and the row is actually written — this is the direct regression path,
 *      because by the time the v8 middleware runs, express.json() has already
 *      set req.destroyed === true. If the bad gate returns, this test HANGS.
 *   2. The server is not wedged: after the mutation, a follow-up request on the
 *      same app still completes.
 *   3. A client that abruptly closes its socket does NOT hang the server: a
 *      subsequent request still completes, and the DB is left in a clean state
 *      (row either fully present or absent — never a half-written baseline).
 *   4. Gate-level (unit) semantics are locked: destroyed READABLE but open
 *      SOCKET must call next(); a genuinely destroyed SOCKET must short-circuit
 *      WITHOUT throwing and WITHOUT emitting a response.
 *   5. Static guard: the live gate source still uses socket.destroyed and does
 *      NOT reference req.destroyed inside isConnectionClosed().
 *
 * Runtime: PARITY pg18 (:5443, schema = demo/production). Standard acceptance
 * env. All fixtures use the reversible `odbior--h54--` prefix and are cleaned up.
 */
import http from 'node:http';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { seed, SEED } from './seed.mjs';

const PREFIX = 'odbior--h54--';
const INITIATIVE_ID = `${PREFIX}ini-0001`;
const KPI_ID = `${PREFIX}kpi-0001`;

let token: string;
let app: Express;

/**
 * Build the REAL production path for the Value Tracking cluster:
 *   express.json()  →  verifyToken  →  requireV8OrgContext  →  attachV8Context
 *   →  financeValueTrackingRoutes
 * Middleware order is load-bearing: json() runs first and (auto-)destroys the
 * readable request stream BEFORE the v8 gate sees it — reproducing exactly the
 * condition that the req.destroyed regression short-circuited on.
 */
async function buildV8App(): Promise<Express> {
  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const { default: router } = await import('../../server/src/routes/v8/finance-value.routes.js');

  const a = express();
  a.use(express.json({ limit: '5mb' }));
  a.use(
    '/api/v8/finance/value-tracking',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    router
  );
  return a;
}

async function cleanupFixtures(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `DELETE FROM value_baselines
        WHERE organization_id = $1 AND (initiative_id LIKE $2 OR kpi_id LIKE $2)`,
      [SEED.ORG_ID, `${PREFIX}%`]
    );
  } finally {
    await c.end();
  }
}

async function countActiveBaselines(): Promise<number> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query(
      `SELECT COUNT(*)::int AS n FROM value_baselines
        WHERE organization_id = $1 AND initiative_id = $2 AND kpi_id = $3 AND is_active = 1`,
      [SEED.ORG_ID, INITIATIVE_ID, KPI_ID]
    );
    return r.rows[0]?.n ?? 0;
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();
  token = mintToken();
  app = await buildV8App();
  await cleanupFixtures();
}, 60_000);

afterAll(async () => {
  await cleanupFixtures();
});

describe('H5.4 — v8 mutation canary (req.destroyed hang guard)', () => {
  it('1) completed v8 mutation succeeds (201) and the row is written — the regression path', async () => {
    // If the bad req.destroyed gate is present, express.json() has already set
    // req.destroyed=true here, so the middleware short-circuits and this request
    // never resolves → the 20s test timeout fires. Passing = gate is correct.
    const res = await request(app)
      .post('/api/v8/finance/value-tracking/ledger/baselines')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID, value: 1000 });

    expect(res.status).toBe(201);
    expect(res.body?.data?.initiative_id).toBe(INITIATIVE_ID);
    expect(res.body?.data?.kpi_id).toBe(KPI_ID);
    expect(Number(res.body?.data?.frozen_value)).toBe(1000);

    // Row genuinely persisted (real Postgres, not an echo).
    expect(await countActiveBaselines()).toBe(1);
  }, 20_000);

  it('2) server is not wedged: a follow-up mutation still completes', async () => {
    // Re-freeze deactivates the prior active baseline and inserts a new one:
    // still exactly one active row. Proves the connection/gate path is reusable.
    const res = await request(app)
      .post('/api/v8/finance/value-tracking/ledger/baselines')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID, value: 1500 });

    expect(res.status).toBe(201);
    expect(await countActiveBaselines()).toBe(1);
  }, 20_000);

  it('3) abrupt socket close does not hang the server; DB left clean', async () => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    // Client that writes a full request then DESTROYS the socket immediately,
    // before the response can be read (a genuinely aborted connection).
    await new Promise<void>((resolve) => {
      const body = JSON.stringify({
        initiativeId: `${PREFIX}abort`,
        kpiId: `${PREFIX}abort`,
        value: 42,
      });
      const sock = net.connect(port, '127.0.0.1', () => {
        sock.write(
          `POST /api/v8/finance/value-tracking/ledger/baselines HTTP/1.1\r\n` +
            `Host: 127.0.0.1:${port}\r\n` +
            `Authorization: Bearer ${token}\r\n` +
            `Content-Type: application/json\r\n` +
            `Content-Length: ${Buffer.byteLength(body)}\r\n` +
            `Connection: close\r\n\r\n` +
            body
        );
        // Abort right away — the server must handle the disconnect gracefully.
        sock.destroy();
        resolve();
      });
      sock.on('error', () => resolve()); // ECONNRESET etc. are expected here
    });

    // Give the server a tick to process the aborted socket.
    await new Promise((r) => setTimeout(r, 250));

    // The server must still be alive and responsive to a fresh request.
    const res = await request(server)
      .post('/api/v8/finance/value-tracking/ledger/baselines')
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INITIATIVE_ID, kpiId: KPI_ID, value: 2000 });

    expect(res.status).toBe(201);

    await new Promise<void>((resolve) => server.close(() => resolve()));

    // DB integrity: still exactly one active baseline for our KPI (aborted
    // request either wrote nothing for the `abort` key or a clean row — never a
    // corrupt half-state for the tracked KPI).
    expect(await countActiveBaselines()).toBe(1);

    // The aborted request must not have left a dangling active row either.
    const c = pgClient();
    await c.connect();
    try {
      const r = await c.query(
        `SELECT COUNT(*)::int AS n FROM value_baselines
          WHERE organization_id = $1 AND initiative_id = $2`,
        [SEED.ORG_ID, `${PREFIX}abort`]
      );
      // 0 (socket died before handler wrote) or 1 (handler completed) — both are
      // consistent; what matters is the server never hung.
      expect([0, 1]).toContain(r.rows[0]?.n ?? 0);
    } finally {
      await c.end();
    }
  }, 30_000);

  it('4) gate semantics locked: destroyed readable + open socket → next(); dead socket → short-circuit', async () => {
    const { requireV8OrgContext } = await import(
      '../../server/src/middleware/v8Auth.middleware.js'
    );

    // (a) The regression condition: request readable destroyed, socket OPEN.
    //     Must call next() (proceed to the handler), NOT short-circuit.
    {
      let nexted = false;
      let responded = false;
      const req: any = {
        destroyed: true, // readable consumed by body-parser
        socket: { destroyed: false }, // network still open
        organizationId: SEED.ORG_ID,
        user: { organizationId: SEED.ORG_ID, id: SEED.USER_ID },
      };
      const res: any = {
        headersSent: false,
        writableEnded: false,
        setHeader() {},
        status() {
          responded = true;
          return this;
        },
        json() {
          responded = true;
          return this;
        },
      };
      requireV8OrgContext(req, res, () => {
        nexted = true;
      });
      expect(nexted).toBe(true);
      expect(responded).toBe(false);
    }

    // (b) Genuinely dead socket: must short-circuit WITHOUT throwing and WITHOUT
    //     emitting a response (client is gone — nothing to send).
    {
      let nexted = false;
      let responded = false;
      const req: any = {
        destroyed: true,
        socket: { destroyed: true }, // real disconnect
        organizationId: SEED.ORG_ID,
        user: { organizationId: SEED.ORG_ID, id: SEED.USER_ID },
      };
      const res: any = {
        headersSent: false,
        writableEnded: false,
        setHeader() {},
        status() {
          responded = true;
          return this;
        },
        json() {
          responded = true;
          return this;
        },
      };
      expect(() => requireV8OrgContext(req, res, () => {
        nexted = true;
      })).not.toThrow();
      expect(nexted).toBe(false);
      expect(responded).toBe(false);
    }
  });

  it('5) static guard: live gate uses socket.destroyed and excludes req.destroyed in isConnectionClosed', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../server/src/middleware/v8Auth.middleware.ts'),
      'utf8'
    );

    // Isolate the isConnectionClosed() body — the connection gate itself.
    const start = src.indexOf('const isConnectionClosed');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('const hasForbiddenControlChars', start);
    const gate = src.slice(start, end === -1 ? undefined : end);

    // Canonical fix present …
    expect(gate).toMatch(/socket\?\.destroyed/);
    expect(gate).toMatch(/writableEnded/);
    expect(gate).toMatch(/headersSent/);

    // … and the poison check absent: no active `req.destroyed` read. (The
    // explanatory comment mentions the words "req.destroyed" but never reads it,
    // so assert there is no executable `req.destroyed` / `(req as any).destroyed`
    // that is not the socket form.)
    const executableReqDestroyed = /\breq(?:\s+as\s+any)?\)?\.destroyed\b/;
    // Strip line comments before checking, so the warning comment doesn't trip us.
    const gateNoComments = gate
      .split('\n')
      .map((l) => (l.trim().startsWith('//') ? '' : l))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(gateNoComments).not.toMatch(executableReqDestroyed);
    expect(gateNoComments).toMatch(/socket\?\.destroyed/);
  });
});
