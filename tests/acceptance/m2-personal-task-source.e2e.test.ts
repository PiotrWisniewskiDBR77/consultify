/** @vitest-environment node */
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const TASK_ID = 'odbior--m2--document-task-0001';
const DOCUMENT_ID = 'odbior--m2--document-0001';
let app: Express;

beforeAll(async () => {
  await seed();
  const db = pgClient();
  await db.connect();
  try {
    await db.query(
      `INSERT INTO tasks
         (id,organization_id,title,status,priority,assignee_id,owner_id,reporter_id,created_by,
          source_type,source_id)
       VALUES ($1,$2,'Review document: M2 receipt','todo','medium',$3,$3,$3,$3,'document',$4)
       ON CONFLICT (id) DO UPDATE SET
         assignee_id=EXCLUDED.assignee_id,
         owner_id=EXCLUDED.owner_id,
         source_type=EXCLUDED.source_type,
         source_id=EXCLUDED.source_id`,
      [TASK_ID, SEED.ORG_ID, SEED.USER_ID, DOCUMENT_ID]
    );
  } finally {
    await db.end();
  }

  const router = (await import('../../server/src/routes/my-work.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/my-work', router);
}, 60_000);

afterAll(async () => {
  const db = pgClient();
  await db.connect();
  try {
    await db.query('DELETE FROM tasks WHERE id=$1', [TASK_ID]);
  } finally {
    await db.end();
  }
});

describe('M2 personal task source receipt on real PostgreSQL', () => {
  it('returns the persisted document source through the owner-scoped detail API', async () => {
    const response = await request(app)
      .get(`/api/my-work/personal-tasks/${TASK_ID}`)
      .set('Authorization', `Bearer ${mintToken()}`);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      id: TASK_ID,
      title: 'Review document: M2 receipt',
      ownerId: SEED.USER_ID,
      sourceType: 'document',
      sourceId: DOCUMENT_ID,
    });
  });
});
