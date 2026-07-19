/**
 * Acceptance E2E (RED→GREEN) — 3 brakujące tabele assessment.
 *
 * RED (przed migracją 20260719_red_assess_missing_tables.sql): tabele
 * assessment_versions / assessment_reviews / assessment_questions NIE ISTNIAŁY
 * na realnym torze Postgres (tylko referencje w dialekcie SQLite, nie-autorun),
 * więc 3 żywe endpointy zwracały 500 (42P01 undefined_table):
 *   - GET /api/assessment-workflow/:assessmentId/versions       (assessment_versions)
 *   - GET /api/assessment-workflow/pending-reviews              (assessment_reviews)
 *   - GET /api/assessment-evidence/:assessmentId/report         (assessment_questions)
 *
 * GREEN (po migracji): każdy endpoint zwraca 200; a że seedujemy po 1 realnym
 * wierszu do versions/reviews — read-back MUSI ten wiersz zwrócić (nie tylko
 * pustą listę), co dowodzi że schemat pokrywa realny kontrakt query, nie tylko
 * samo istnienie tabeli.
 *
 * Zero mocków biznesu: realny router + realny verifyToken (router.use) + realny
 * Postgres (:5443 parity). Prefiks sprzątania: odbior--astab--.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const A_ID = 'odbior--astab--assessment-0001';
const V_ID = 'odbior--astab--version-0001';
const R_ID = 'odbior--astab--review-0001';
const W_ID = 'odbior--astab--workflow-0001';

let app: Express;
let token: string;

async function buildAssessApp(): Promise<Express> {
  const workflowRouter = (
    await import('../../server/src/routes/assessment/assessment-workflow.routes.js')
  ).default;
  const evidenceRouter = (await import('../../server/src/routes/assessmentEvidence.routes.js'))
    .default;

  const a = express();
  a.use(express.json({ limit: '5mb' }));
  // Both routers self-apply verifyToken via router.use — mount them raw.
  a.use('/api/assessment-workflow', workflowRouter);
  a.use('/api/assessment-evidence', evidenceRouter);
  return a;
}

beforeAll(async () => {
  await seed(); // base org + user (idempotent)
  const client = pgClient();
  await client.connect();
  try {
    // 1 assessment owned by the seed org (evidence report needs a real context).
    await client.query(
      `INSERT INTO assessments (id, organization_id, name, assessment_type)
       VALUES ($1, $2, 'Odbior AsTab Assessment', 'DRD')
       ON CONFLICT (id) DO NOTHING`,
      [A_ID, SEED.ORG_ID]
    );
    // 1 frozen version — read-back proof for assessment_versions.
    await client.query(
      `INSERT INTO assessment_versions
         (id, assessment_id, version, data, assessment_data, change_summary, change_log, changed_axes, created_by)
       VALUES ($1, $2, 1, $3, $3, 'seed', 'seed', '[]', $4)
       ON CONFLICT (id) DO NOTHING`,
      [V_ID, A_ID, '{"axes":[]}', SEED.USER_ID]
    );
    // 1 pending review assigned to the seed user — read-back proof for assessment_reviews.
    await client.query(
      `INSERT INTO assessment_reviews
         (id, workflow_id, assessment_id, reviewer_id, status, message)
       VALUES ($1, $2, $3, $4, 'PENDING', 'seed review')
       ON CONFLICT (id) DO NOTHING`,
      [R_ID, W_ID, A_ID, SEED.USER_ID]
    );
  } finally {
    await client.end();
  }

  app = await buildAssessApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM assessment_reviews WHERE id = $1', [R_ID]);
    await client.query('DELETE FROM assessment_versions WHERE id = $1', [V_ID]);
    await client.query('DELETE FROM assessments WHERE id = $1', [A_ID]);
  } finally {
    await client.end();
  }
});

describe('Acceptance RED→GREEN: 3 missing assessment tables (real runtime)', () => {
  it('assessment_versions: GET /:id/versions -> 200 and returns the seeded version', async () => {
    const res = await request(app)
      .get(`/api/assessment-workflow/${A_ID}/versions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200); // was 500 (undefined_table) pre-migration
    expect(Array.isArray(res.body.versions)).toBe(true);
    const seeded = res.body.versions.find((v: any) => v.id === V_ID);
    expect(seeded).toBeTruthy();
    expect(seeded.version).toBe(1);
  }, 30_000);

  it('assessment_reviews: GET /pending-reviews -> 200 and returns the seeded review', async () => {
    const res = await request(app)
      .get('/api/assessment-workflow/pending-reviews')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200); // was 500 (undefined_table) pre-migration
    expect(Array.isArray(res.body.reviews)).toBe(true);
    const seeded = res.body.reviews.find((r: any) => r.id === R_ID);
    expect(seeded).toBeTruthy();
    expect(seeded.assessmentId).toBe(A_ID);
    expect(seeded.status).toBe('PENDING');
  }, 30_000);

  it('assessment_questions: GET /assessment-evidence/:id/report -> 200 (empty framework, not 500)', async () => {
    const res = await request(app)
      .get(`/api/assessment-evidence/${A_ID}/report`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200); // was 500 (undefined_table) pre-migration
    // Report shape present; assessment_questions had no rows -> falls back cleanly.
    expect(res.body).toHaveProperty('completenessPercent');
    expect(Array.isArray(res.body.dimensions)).toBe(true);
  }, 30_000);

  it('rejects unauthenticated (real auth enforced on the mounted routers)', async () => {
    const res = await request(app).get('/api/assessment-workflow/pending-reviews');
    expect(res.status).toBe(401);
  });
});
