/**
 * O1 W7 — axis_data write-time guard, REAL runtime (real Express router, real
 * `verifyToken`, real Postgres parity :5443, zero business-logic mocks).
 *
 * CONTEXT / FINDING
 * ------------------
 * `assessment_reports.axis_data` must hold DRD maturity LEVELS (0..axis.levelCount
 * — 5 or 7 depending on the axis), never 0-100 percentages. The report renderer
 * (`drdReportModel.ts`) computes `pct(level, maxLevel) = level/maxLevel*100`, so
 * a stray percentage written into `axis_data` (bad assessment answer, seed,
 * fixture, or future import) would blow past 100% once rendered — e.g.
 * "Cyberbezpieczeństwo 600%" — a client-facing report Piotr will not sign off.
 *
 * This suite proves the WRITE-TIME half of the defense-in-depth fix: the real
 * `POST /api/assessment-reports` route (which calls
 * `computeAxisDataFromAssessment` → `clampAxisDataEntries` before persisting)
 * never lets an out-of-range assessment answer land in the DB as-is. It seeds
 * a DRD assessment whose answers contain an out-of-range `achievedLevel: 100`
 * (axis 1 "Digital Processes" has levelCount=7) and a valid area on a
 * different axis (axis 6 "Cybersecurity", levelCount=5) as a control, calls
 * the real route, then reads `assessment_reports.axis_data` straight from
 * Postgres to assert the corrupt value was clamped, not stored raw.
 *
 * (The render-time half — `pct()` clamping so even a pre-existing bad DB row
 * can never render >100% — is covered by the hermetic, DB-free unit suite
 * `tests/unit/services/drdAxisDataGuard.test.ts`, which also exercises the
 * full HTML output and the SIRI/ADMA adapter; a real-LLM full-report HTTP call
 * here would just re-prove that at ~90-240s of live Anthropic cost for zero
 * new coverage — see `o1-drd-report-benchmark.e2e.test.ts` for that pattern.)
 *
 * Every row carries the reversible `odbior--axis--` prefix. The probe cleans
 * up after itself (report, assessment, project).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

const PROJECT_ID = 'odbior--axis--project-0001';
const ASSESSMENT_ID = 'odbior--axis--assessment-0001';

let token: string;
let app: Express;
let createdReportId: string | null = null;

/**
 * DRD assessment answers with ONE deliberately corrupt area:
 *   "1A" (axis 1, "Digital Processes", levelCount=7) achievedLevel=100,
 *   targetLevel=100 — a mistaken 0-100 "percentage" instead of a level.
 * "6A" (axis 6, "Cybersecurity", levelCount=5) is a valid control at level 3/4.
 */
const CORRUPT_ANSWERS = {
  drd: {
    areas: {
      '1A': { achievedLevel: 100, targetLevel: 100 },
      '6A': { achievedLevel: 3, targetLevel: 4 },
    },
  },
};

async function seedFixtures(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1,$2,'Axis Guard Harness Project','active',$3,$4)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO assessments (id, organization_id, project_id, status, name, assessment_type, answers_json, created_at, updated_at, created_by)
       VALUES ($1,$2,$3,'DRAFT','Axis Guard DRD Assessment','DRD',$4,$5,$5,$6)
       ON CONFLICT (id) DO UPDATE SET answers_json = EXCLUDED.answers_json`,
      [
        ASSESSMENT_ID,
        SEED.ORG_ID,
        PROJECT_ID,
        JSON.stringify(CORRUPT_ANSWERS),
        now,
        SEED.USER_ID,
      ]
    );
  } finally {
    await client.end();
  }
}

async function cleanupFixtures(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    if (createdReportId) {
      await client.query(`DELETE FROM assessment_reports WHERE id = $1`, [createdReportId]);
    }
    await client.query(`DELETE FROM assessments WHERE id = $1`, [ASSESSMENT_ID]);
    await client.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  requireLocalDbUrl();
  await seed(); // idempotent — org/user
  await seedFixtures();
  token = mintToken();

  const { default: router } = await import('../../server/src/routes/assessment-reports.routes.js');
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/assessment-reports', router);
}, 60_000);

afterAll(async () => {
  await cleanupFixtures();
}, 30_000);

describe('O1 W7 — POST /api/assessment-reports clamps out-of-range axis_data before it ever hits Postgres', () => {
  it('creates the report successfully (never 500s on corrupt upstream answers — fail-safe by clamping, not rejecting)', async () => {
    const res = await request(app)
      .post('/api/assessment-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentId: ASSESSMENT_ID, name: 'Axis Guard Report' });

    expect(res.status, `unexpected status, body=${JSON.stringify(res.body)}`).toBe(201);
    expect(res.body).toHaveProperty('id');
    createdReportId = String(res.body.id);
  }, 30_000);

  it('the persisted axis_data never contains the raw out-of-range value (100), and the corrupt axis is clamped to its levelCount (7)', async () => {
    expect(createdReportId, 'previous test must have created the report').toBeTruthy();

    const client = pgClient();
    await client.connect();
    let axisData: Record<string, { actual: number; target: number }>;
    try {
      const { rows } = await client.query(
        `SELECT axis_data FROM assessment_reports WHERE id = $1`,
        [createdReportId]
      );
      expect(rows).toHaveLength(1);
      axisData = JSON.parse(rows[0].axis_data || '{}');
    } finally {
      await client.end();
    }

    // Axis "1" (Digital Processes, levelCount=7) received the corrupt 100 —
    // it must be clamped, i.e. present and <= 7, never the raw 100.
    expect(axisData['1']).toBeDefined();
    expect(axisData['1'].actual).not.toBe(100);
    expect(axisData['1'].actual).toBeLessThanOrEqual(7);
    expect(axisData['1'].target).not.toBe(100);
    expect(axisData['1'].target).toBeLessThanOrEqual(7);

    // Control axis "6" (Cybersecurity, levelCount=5) was already in-range and
    // must pass through untouched (no false-positive clamping).
    expect(axisData['6']).toEqual({ actual: 3, target: 4 });

    // Belt-and-braces: no cell anywhere in the stored axis_data exceeds a
    // generous absolute ceiling (widest DRD axis is 7 levels) — guards against
    // any other area silently carrying a percentage-shaped value through.
    for (const [axisId, cellRaw] of Object.entries(axisData)) {
      if (!cellRaw || typeof cellRaw !== 'object') continue;
      const cell = cellRaw as { actual?: number; target?: number };
      expect(cell.actual ?? 0, `axis "${axisId}" actual out of range`).toBeLessThanOrEqual(7);
      expect(cell.target ?? 0, `axis "${axisId}" target out of range`).toBeLessThanOrEqual(7);
    }
  }, 15_000);
});
