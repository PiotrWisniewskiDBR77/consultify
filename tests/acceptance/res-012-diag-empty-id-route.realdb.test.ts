/**
 * RN-G6-A1 diagnostic (read-only audit, not a permanent regression test).
 *
 * Explains the res-012-reporting-snapshot.realdb.test.ts "foreignSnapshotRead
 * expected 200 to be 404" observation reported by another lane. Confirms the
 * mechanism: when the FIRST test in that file fails for an UNRELATED reason
 * (schema gap: report_builder_reports.source_refs_json missing on a
 * migrations-only fresh DB), `snapshotV1` stays '' for the rest of the file.
 * The third test then requests `GET /api/results/kpi-reports/` (trailing
 * empty segment), which Express's non-strict routing resolves to the LIST
 * route (`GET /kpi-reports`) instead of the detail route
 * (`GET /kpi-reports/:snapshotId`). The list route legitimately returns 200
 * (scoped to the caller's own org, and empty for a foreign org with no
 * reports) — it is not the snapshot-detail endpoint the test believes it is
 * probing, so the 200 is not a cross-tenant data leak.
 */
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: Express;
let token: string;

beforeAll(async () => {
  await seed();
  token = mintToken();
  const router = (await import('../../server/src/routes/results-kpi-reports.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/results', router);
});

describe('RN-G6-A1 diagnostic — empty snapshotId falls through to the list route', () => {
  it('GET /api/results/kpi-reports/ (empty id) returns the LIST payload shape, not a 404 and not snapshot detail', async () => {
    const res = await request(app)
      .get(`/api/results/kpi-reports/`)
      .set('Authorization', `Bearer ${token}`);

    // eslint-disable-next-line no-console
    console.log('[diag] status', res.status, 'body', JSON.stringify(res.body));

    expect(res.status).toBe(200);
    // This is the LIST endpoint's response shape (`{ success, data: [...] }`),
    // never the detail endpoint's shape (`{ success, data: { snapshot, ... } }`).
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/results/kpi-reports/some-nonexistent-id (non-empty id) correctly 404s via the detail route', async () => {
    const res = await request(app)
      .get(`/api/results/kpi-reports/does-not-exist-12345`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(Array.isArray((res.body as any).data)).toBe(false);
  });
});

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    // no rows written by this diagnostic — nothing to clean up beyond the shared seed.
    void client;
  } finally {
    await client.end();
  }
});

void SEED;
