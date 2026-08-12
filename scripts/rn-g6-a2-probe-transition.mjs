#!/usr/bin/env node
/**
 * RN-G6-A2 — Krok 3: real router + real auth + real Postgres probe.
 *
 * Calls the actual production route POST /api/initiatives/:id/start-execution
 * exactly as the interface would, against the illustrative dataset seeded by
 * rn-g6-a2-seed-gate-dataset.mjs, and prints the literal HTTP status + body.
 *
 * Must be run with `tsx` because it imports TypeScript server modules.
 * Requires: DATABASE_URL (local only), NODE_ENV=test, RUN_DB_TESTS=1,
 * MOCK_DB=false, JWT_SECRET pinned before any server/src import.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:55911/rn_a2s_gate_scale \
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx tsx scripts/rn-g6-a2-probe-transition.mjs <initiativeId>
 */
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'rn-g6-a2-probe-pinned-test-secret-fixed-32chars-min';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  console.error(`REFUSING: DATABASE_URL must be LOCAL. Got: ${DATABASE_URL || '(unset)'}`);
  process.exit(2);
}

const ORG_ID = 'rn-g6-a2-org-0001';
const USER_ID = 'rn-g6-a2-user-0001';
const EMAIL = 'rn-g6-a2-owner@acceptance.local';
const ROLE = 'OWNER';

const initiativeId = process.argv[2];
if (!initiativeId) {
  console.error('Usage: probe-transition.mjs <initiativeId>');
  process.exit(2);
}

const express = (await import('express')).default;
const request = (await import('supertest')).default;
const jwt = (await import('jsonwebtoken')).default;
const pg = (await import('pg')).default;

const { verifyToken } = await import('../server/src/middleware/auth.middleware.ts');
const initiativesRouter = (await import('../server/src/routes/pmo/initiatives.routes.ts')).default;

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api/initiatives', verifyToken, initiativesRouter);

const token = jwt.sign(
  {
    id: USER_ID,
    email: EMAIL,
    organizationId: ORG_ID,
    organization_id: ORG_ID,
    role: ROLE,
  },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

async function getRow(id) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT status, execution_started_at FROM initiatives WHERE id = $1`,
      [id]
    );
    return r.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

console.log('BEFORE:', await getRow(initiativeId));

const res = await request(app)
  .post(`/api/initiatives/${initiativeId}/start-execution`)
  .set('Authorization', `Bearer ${token}`)
  .send({});

console.log('STATUS:', res.status);
console.log('BODY:', JSON.stringify(res.body, null, 2));

console.log('AFTER:', await getRow(initiativeId));
