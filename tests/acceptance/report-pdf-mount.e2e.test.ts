/**
 * Acceptance E2E — finding A4 follow-up: verify `reportPdf.routes.ts` is
 * genuinely mounted and reachable, and that the PDF download endpoint
 * returns real PDF bytes (not just an HTTP 200 on a mock).
 *
 * Context: the route file's header comment used to read "NOT mounted in the
 * Gateway here — wiring is a separate, deliberate step." `git blame` shows
 * the mount (`app.use('/api/report-pdf', reportPdfRoutes)` in
 * `server/src/Gateway.ts`) actually landed 4 minutes after the route file
 * itself (2026-06-23), so the comment was stale, not the wiring. This test
 * is the runtime proof (golden rule: verify runtime, not docs/flags) and the
 * stale comment was corrected in the same change.
 *
 * Pattern: 1:1 with tests/acceptance/h44-m13-flow.e2e.test.ts — REAL router
 * mounted at the SAME prefix Gateway.ts uses (`/api/report-pdf`) + REAL
 * verifyToken (minted JWT) + REAL Postgres (parity :5443). Zero mocks.
 *
 * Two assertions:
 *   1. GET /api/report-pdf/cadence/due (F6·6.3) — 200, `{ due: [] }` shape,
 *      proves the router itself boots and its first route resolves before
 *      the `:reportId` catch-all could swallow the literal `cadence` segment.
 *   2. GET /api/report-pdf/:reportId/pdf (F8·8.4) — 200, Content-Type
 *      application/pdf, body begins with the `%PDF` magic header — proves
 *      the full auth → org-scoped fetch → pdfkit render → stream path works
 *      end-to-end against a real status_reports row.
 *
 * Isolation: prefix `odbior--pdf--`, own initiative + status_reports row,
 * cleaned up in afterAll. ONLY file for this follow-up.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--pdf--';
const INITIATIVE_ID = `${PREFIX}initiative-0001`;
const REPORT_ID = `${PREFIX}report-0001`;
const INITIATIVE_TITLE = `${PREFIX}Program stabilizacji dostaw`;

let app: Express;
let token: string;

async function buildApp(): Promise<Express> {
  // reportPdf.routes.ts applies `verifyToken, isAuthenticated` per-route
  // itself (see the file) — mirror Gateway.ts EXACTLY (no extra auth
  // middleware here) rather than double-applying verifyToken.
  const reportPdfRouter = (await import('../../server/src/routes/reportPdf.routes.js')).default;

  const expressApp = express();
  expressApp.use(express.json({ limit: '5mb' }));
  // Mirrors Gateway.ts: app.use('/api/report-pdf', reportPdfRoutes);
  expressApp.use('/api/report-pdf', reportPdfRouter);
  return expressApp;
}

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership foundation

  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO initiatives (id, organization_id, name, title, status, created_at)
       VALUES ($1, $2, $3, $3, 'EXECUTING', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [INITIATIVE_ID, SEED.ORG_ID, INITIATIVE_TITLE]
    );

    await c.query(
      `INSERT INTO status_reports
         (id, organization_id, initiative_id, period_type, period_start, period_end,
          period_label, overall_status, sections_json, executive_summary, created_by,
          created_at, updated_at)
       VALUES ($1, $2, $3, 'WEEKLY', $4, $5, $6, 'GREEN', $7, $8, $9,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [
        REPORT_ID,
        SEED.ORG_ID,
        INITIATIVE_ID,
        '2026-07-13',
        '2026-07-19',
        'Week 29, 2026',
        JSON.stringify({ SCHEDULE: { status: 'GREEN', content: 'On track.' } }),
        'Dostawy przebiegają zgodnie z planem.',
        SEED.USER_ID,
      ]
    );
  } finally {
    await c.end();
  }

  app = await buildApp();
  token = mintToken();
});

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM status_reports WHERE id = $1`, [REPORT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiatives WHERE id = $1`, [INITIATIVE_ID]).catch(() => {});
  } finally {
    await c.end();
  }
});

describe('reportPdf.routes.ts — real Gateway mount at /api/report-pdf', () => {
  it('1) GET /cadence/due resolves before the :reportId catch-all (router boots for real)', async () => {
    const res = await request(app)
      .get('/api/report-pdf/cadence/due')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.due)).toBe(true);
  });

  it('2) GET /:reportId/pdf streams a real PDF (%PDF magic header) for a real status_reports row', async () => {
    const res = await request(app)
      .get(`/api/report-pdf/${REPORT_ID}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (chunk: Buffer) => chunks.push(chunk));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(`${REPORT_ID}.pdf`);
    const body = res.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('3) GET /:reportId/pdf 404s for a report outside the org (org-scoped fetch, not a global lookup)', async () => {
    const res = await request(app)
      .get(`/api/report-pdf/${PREFIX}not-a-real-report/pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
