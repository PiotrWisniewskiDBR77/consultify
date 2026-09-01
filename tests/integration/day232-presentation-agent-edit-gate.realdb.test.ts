/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day232 presentation agent edit state gate through ApiGateway/JWT/Postgres', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const foreignUserId = randomUUID();
  const deckId = randomUUID();
  let authorization = '';
  let foreignAuthorization = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../server/src/Gateway.js'),
      import('../../server/src/config/Config.js'),
    ]);
    app.use(express.json({ limit: '10mb' }));
    ApiGateway.getInstance().initializeRoutes(app);

    for (const [orgId, memberId, label] of [
      [organizationId, userId, 'owner'],
      [foreignOrganizationId, foreignUserId, 'foreign'],
    ]) {
      await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
        orgId,
        `Day232 ${label}`,
      ]);
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
         VALUES($1,$2,$3,'unused','OWNER','active',1)`,
        [memberId, orgId, `day232-${label}-${memberId}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), orgId, memberId]
      );
    }
    const originalDeck = {
      deck_id: deckId,
      title: 'Day232 gate deck',
      cards: [
        {
          card_id: randomUUID(),
          deck_id: deckId,
          order_index: 0,
          intent: 'summary',
          layout_id: 'content_full',
          title: 'Original title',
          blocks: [{ type: 'text', content: { text: 'A very long original sentence for shortening.' } }],
          source_refs: [],
        },
      ],
    };
    await pool.query(
      `INSERT INTO presentation_decks(id,organization_id,title,template_id,status,version,deck_json)
       VALUES($1,$2,$3,'default','draft',1,$4)`,
      [deckId, organizationId, originalDeck.title, JSON.stringify(originalDeck)]
    );
    const sign = (memberId: string, orgId: string, label: string) =>
      `Bearer ${jwt.sign(
        {
          id: memberId,
          userId: memberId,
          organizationId: orgId,
          organization_id: orgId,
          role: 'OWNER',
          email: `day232-${label}-${memberId}@test.invalid`,
        },
        config.JWT_SECRET,
        { expiresIn: '30m', jwtid: randomUUID() }
      )}`;
    authorization = sign(userId, organizationId, 'owner');
    foreignAuthorization = sign(foreignUserId, foreignOrganizationId, 'foreign');
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM presentation_decks WHERE id=$1`, [deckId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[userId, foreignUserId]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as any).closePool?.();
  });

  async function propose(): Promise<string> {
    const response = await request(app)
      .post(`/api/presentations/decks/${deckId}/agent-edit`)
      .set('Authorization', authorization)
      .send({ prompt: 'skróć slajd 1' });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data.status).toBe('proposal');
    const operationId = String(response.body.data.operationId);
    expect(
      (await pool.query(`SELECT status FROM presentation_ai_operations WHERE id=$1`, [operationId]))
        .rows[0].status
    ).toBe('draft');
    return operationId;
  }

  it('accepts a draft once, then rejects replay with byte-identical deck_json and unchanged version', async () => {
    const operationId = await propose();
    const before = (await pool.query(`SELECT deck_json,version FROM presentation_decks WHERE id=$1`, [deckId]))
      .rows[0];
    const first = await request(app)
      .post(`/api/presentations/decks/${deckId}/agent-edit/${operationId}/accept`)
      .set('Authorization', authorization)
      .send({});
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const applied = (await pool.query(`SELECT deck_json,version FROM presentation_decks WHERE id=$1`, [deckId]))
      .rows[0];
    expect(applied.version).toBe(before.version + 1);
    expect(applied.deck_json).not.toBe(before.deck_json);
    expect(
      (await pool.query(`SELECT status FROM presentation_ai_operations WHERE id=$1`, [operationId]))
        .rows[0].status
    ).toBe('applied');

    const replay = await request(app)
      .post(`/api/presentations/decks/${deckId}/agent-edit/${operationId}/accept`)
      .set('Authorization', authorization)
      .send({});
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe('AI_PROPOSAL_ALREADY_RESOLVED');
    const afterReplay = (
      await pool.query(`SELECT deck_json,version FROM presentation_decks WHERE id=$1`, [deckId])
    ).rows[0];
    expect(afterReplay).toEqual(applied);
  });

  it('rejects reject-to-accept replay and leaves deck_json and version unchanged', async () => {
    const operationId = await propose();
    const before = (await pool.query(`SELECT deck_json,version FROM presentation_decks WHERE id=$1`, [deckId]))
      .rows[0];
    const reject = await request(app)
      .post(`/api/presentations/decks/${deckId}/agent-edit/${operationId}/reject`)
      .set('Authorization', authorization)
      .send({});
    expect(reject.status).toBe(200);
    expect(
      (await pool.query(`SELECT status FROM presentation_ai_operations WHERE id=$1`, [operationId]))
        .rows[0].status
    ).toBe('rejected');
    const accept = await request(app)
      .post(`/api/presentations/decks/${deckId}/agent-edit/${operationId}/accept`)
      .set('Authorization', authorization)
      .send({});
    expect(accept.status).toBe(409);
    expect(accept.body.code).toBe('AI_PROPOSAL_ALREADY_RESOLVED');
    expect(
      (await pool.query(`SELECT deck_json,version FROM presentation_decks WHERE id=$1`, [deckId]))
        .rows[0]
    ).toEqual(before);
  });

  it('keeps foreign-organization proposal lookup indistinguishable as 404', async () => {
    const operationId = await propose();
    const response = await request(app)
      .post(`/api/presentations/decks/${deckId}/agent-edit/${operationId}/accept`)
      .set('Authorization', foreignAuthorization)
      .send({});
    expect(response.status).toBe(404);
    expect(
      (await pool.query(`SELECT status FROM presentation_ai_operations WHERE id=$1`, [operationId]))
        .rows[0].status
    ).toBe('draft');
  });
});
