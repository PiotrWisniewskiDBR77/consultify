/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
  throw new Error('MAT-MVP-PPT-001 requires disposable local PostgreSQL');
}

const secret = 'mat-ppt-mounted-auth-secret-at-least-32-characters';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `mat-ppt-${Date.now()}-${randomUUID().slice(0, 6)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const userA = `${prefix}-user-a`;
const userB = `${prefix}-user-b`;
const pool = new Pool({ connectionString: url });

function bearer(userId: string, organizationId: string) {
  return {
    Authorization: `Bearer ${jwt.sign(
      { id: userId, email: `${userId}@example.test`, organizationId, role: 'ADMIN' },
      secret,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`,
  };
}

async function seedPrincipal(organizationId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
     VALUES($1,$2,'enterprise','active',1,$3)`,
    [organizationId, organizationId, now]
  );
  await pool.query(
    `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
     VALUES($1,$2,$3,'unused','ADMIN','active',$4)`,
    [userId, organizationId, `${userId}@example.test`, now]
  );
  await pool.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
     VALUES($1,$2,$3,'ADMIN','ACTIVE',$4)`,
    [`${userId}-membership`, organizationId, userId, now]
  );
}

async function seedDeck(deckId: string, content: object): Promise<void> {
  await pool.query(
    `INSERT INTO presentation_decks
       (id,organization_id,title,template_id,deck_json,version,status,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,1,'draft',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [deckId, orgA, 'Governed board deck', `${prefix}-template`, JSON.stringify(content)]
  );
}

describe('MAT-MVP-PPT-001 mounted deck lifecycle on real PostgreSQL', () => {
  let app: express.Express;

  beforeAll(async () => {
    await seedPrincipal(orgA, userA);
    await seedPrincipal(orgB, userB);
    const presentations = await import('../../../routes/presentations.routes.js');
    app = express();
    app.use(express.json({ limit: '20mb' }));
    app.use('/api/presentations', presentations.default);
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM presentation_decks WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('requires mounted authentication for editor autosave', async () => {
    expect(
      (await request(app).put('/api/presentations/decks/missing/autosave').send({ cards: [] }))
        .status
    ).toBe(401);
  });

  it('autosaves, versions and restores exact notes/a11y content after a cold reopen', async () => {
    const deckId = `${prefix}-roundtrip`;
    const original = {
      cards: [
        {
          card_id: 'slide-1',
          title: 'Original',
          speaker_notes: 'Explain the baseline',
          blocks: [{ type: 'image', alt_text: 'Factory flow before transformation' }],
        },
      ],
    };
    await seedDeck(deckId, original);

    const autosave = await request(app)
      .put(`/api/presentations/decks/${deckId}/autosave`)
      .set(bearer(userA, orgA))
      .set('x-deck-version', '1')
      .send({ title: 'Edited title', cards: [{ card_id: 'slide-1', title: 'Edited' }] });
    expect(autosave.status).toBe(200);
    expect(autosave.body.version).toBe(2);

    const versions = await request(app)
      .get(`/api/presentations/decks/${deckId}/versions`)
      .set(bearer(userA, orgA));
    expect(versions.status).toBe(200);
    expect(versions.body.data).toHaveLength(1);

    const restore = await request(app)
      .post(`/api/presentations/decks/${deckId}/versions/${versions.body.data[0].id}/restore`)
      .set(bearer(userA, orgA))
      .send({ expectedVersion: 2 });
    expect(restore.status).toBe(200);
    expect(restore.body).toMatchObject({ version: 3, restoredFromVersion: 1 });

    const cold = new Pool({ connectionString: url, max: 1 });
    try {
      const reopened = await cold.query(
        `SELECT deck_json,version,template_id FROM presentation_decks
         WHERE id=$1 AND organization_id=$2`,
        [deckId, orgA]
      );
      expect(reopened.rowCount).toBe(1);
      expect(reopened.rows[0].version).toBe(3);
      expect(reopened.rows[0].template_id).toBe(`${prefix}-template`);
      expect(JSON.parse(reopened.rows[0].deck_json)).toEqual(original);
    } finally {
      await cold.end();
    }
  });

  it('permits exactly one of two concurrent edits and persists one immutable snapshot', async () => {
    const deckId = `${prefix}-race`;
    await seedDeck(deckId, { cards: [{ card_id: 'slide-1', title: 'v1' }] });
    const edit = (title: string) =>
      request(app)
        .put(`/api/presentations/decks/${deckId}/autosave`)
        .set(bearer(userA, orgA))
        .set('x-deck-version', '1')
        .send({ cards: [{ card_id: 'slide-1', title }] });

    const results = await Promise.all([edit('writer-a'), edit('writer-b')]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const stored = await pool.query(
      `SELECT d.version,COUNT(v.id)::int AS snapshots
       FROM presentation_decks d LEFT JOIN presentation_deck_versions v ON v.deck_id=d.id
       WHERE d.id=$1 GROUP BY d.version`,
      [deckId]
    );
    expect(stored.rows[0]).toMatchObject({ version: 2, snapshots: 1 });
  });

  it('does not reveal another tenant deck or its version history', async () => {
    const deckId = `${prefix}-tenant`;
    await seedDeck(deckId, { cards: [] });
    const response = await request(app)
      .get(`/api/presentations/decks/${deckId}/versions`)
      .set(bearer(userB, orgB));
    expect(response.status).toBe(404);
  });
});
