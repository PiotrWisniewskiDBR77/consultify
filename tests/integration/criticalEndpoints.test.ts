/**
 * Critical endpoint smoke: `GET /api/system/health`.
 *
 * Contract (SEC-PUB-002 — see the header of
 * `server/src/routes/system-health.routes.ts`): this is a readiness probe and
 * nothing else.
 *
 *   database reachable   -> 200, body EXACTLY `{ status: 'ready',     timestamp }`
 *   database unreachable -> 503, body EXACTLY `{ status: 'not-ready', timestamp }`
 *
 * Never `checks`, never `overall`, no diagnostics of any kind. The endpoint used
 * to answer a twelve-check report that disclosed administrator credentials; the
 * point of these cases is that a body of that shape can never come back unnoticed.
 *
 * These cases mock the database module, so BOTH branches are exercised
 * deterministically — unlike `publicSystemSurface.contract.test.ts`, which rides
 * a real database and can therefore only accept "200 or 503". This file is the
 * strict gate: the exact status/body pairing per branch, and the exact key set.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'supertest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

/**
 * Flipped per case to drive the two branches. Hoisted because `vi.mock` factories
 * run before the module body.
 */
const dbState = vi.hoisted(() => ({ reachable: false }));

vi.mock('../../server/src/database/index.js', () => ({
  getDatabaseAsync: async () => {
    if (!dbState.reachable) {
      throw new Error('db down');
    }
    // The route issues one `SELECT 1` round trip and races it against a timeout.
    return { query: async () => [{ ok: 1 }] };
  },
  getConnectionPool: () => null,
}));

async function loadSystemHealthRouter() {
  return (await import('../../server/src/routes/system-health.routes.ts')).default;
}

async function getHealth(reachable: boolean): Promise<Response> {
  dbState.reachable = reachable;
  const router = await loadSystemHealthRouter();
  const app = makeTestApp({ mountPath: '/api/system', router });
  return request(app).get('/api/system/health');
}

/** The documented body, and the whole of it. A new key is how disclosure creeps back. */
const READINESS_KEYS = ['status', 'timestamp'];

/** Shapes the OLD, withdrawn body carried. None may reappear at any depth. */
const WITHDRAWN_MARKERS = ['checks', 'overall', 'userCount', 'adminCount', 'NODE_ENV'];

function assertReadinessBody(res: Response, expectedStatus: 'ready' | 'not-ready'): void {
  // Exact key set, so an added field fails here rather than being tolerated by a
  // loose `objectContaining`.
  expect(Object.keys(res.body).sort()).toEqual(READINESS_KEYS);
  // Exact value equality, second gate on the same property.
  expect(res.body).toEqual({ status: expectedStatus, timestamp: res.body.timestamp });

  expect(res.body.status).toBe(expectedStatus);
  expect(typeof res.body.timestamp).toBe('string');
  expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);

  const serialized = JSON.stringify(res.body);
  for (const marker of WITHDRAWN_MARKERS) {
    expect(serialized, `readiness body must not contain \`${marker}\``).not.toContain(marker);
  }
  expect(res.body).not.toHaveProperty('checks');
  expect(res.body).not.toHaveProperty('overall');
}

describe('Critical endpoint: /system/health - REAL integration', () => {
  it('GET /health answers 503 + exactly {status:"not-ready", timestamp} when the DB is down', async () => {
    const res = await getHealth(false);

    expect(res.status).toBe(503);
    assertReadinessBody(res, 'not-ready');
  });

  it('GET /health answers 200 + exactly {status:"ready", timestamp} when the DB is reachable', async () => {
    const res = await getHealth(true);

    expect(res.status).toBe(200);
    assertReadinessBody(res, 'ready');
  });

  it('GET /health never reports per-check diagnostics — the DB failure is not described', async () => {
    // The withdrawn body named a `Database Connection` check and set its status to
    // `error`. Readiness signals the same fact with a status code and one word; the
    // reason stays in the server log, because driver messages name hosts,
    // databases and sometimes credentials.
    const res = await getHealth(false);
    const serialized = JSON.stringify(res.body);

    expect(res.status).toBe(503);
    expect(serialized).not.toMatch(/Database Connection/i);
    expect(serialized).not.toContain('db down');
    expect(serialized).not.toMatch(/\berror\b/i);
    expect(Array.isArray((res.body as Record<string, unknown>).checks)).toBe(false);
  });

  it('GET /health keeps the status code and the status word paired in both branches', async () => {
    // A 200 carrying `not-ready` (or a 503 carrying `ready`) would defeat every
    // orchestrator that reads only one of the two.
    const down = await getHealth(false);
    const up = await getHealth(true);

    expect([down.status, down.body.status]).toEqual([503, 'not-ready']);
    expect([up.status, up.body.status]).toEqual([200, 'ready']);
  });
});
