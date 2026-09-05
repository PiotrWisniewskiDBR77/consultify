/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';
import config from '../../server/src/config/Config.js';
import { ApiGateway } from '../../server/src/Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day 370 deep-thinking record type through ApiGateway/JWT/PostgreSQL', NO_RETRY, () => {
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const sessionId = `day370-session-${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;
  let otherAuthorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    for (const [id, name] of [[orgId, 'Day 370'], [otherOrgId, 'Day 370 other']]) {
      await sql.query("INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')", [id, name]);
    }
    for (const [id, organizationId, email] of [
      [userId, orgId, 'day370-owner@example.test'],
      [otherUserId, otherOrgId, 'day370-other@example.test'],
    ]) {
      await sql.query(
        "INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name) VALUES($1,$2,$3,'local-only','OWNER','active','Day','370')",
        [id, organizationId, email]
      );
      await sql.query(
        "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')",
        [randomUUID(), organizationId, id]
      );
    }
    const sign = (id: string, organizationId: string) => `Bearer ${jwt.sign(
      { id, userId: id, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    authorization = sign(userId, orgId);
    otherAuthorization = sign(otherUserId, otherOrgId);
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM my_idea_maps WHERE idea_id IN (SELECT id FROM my_ideas WHERE organization_id = $1)', [orgId]);
    await sql.query('DELETE FROM my_ideas WHERE organization_id = $1', [orgId]);
    await sql.query('DELETE FROM ai_decision_outcomes WHERE organization_id = $1', [orgId]);
    await sql.query('DELETE FROM initiatives WHERE organization_id = $1', [orgId]);
    await sql.query('DELETE FROM projects WHERE organization_id = $1', [orgId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id = ANY($1::text[])', [[orgId, otherOrgId]]);
    await sql.query('DELETE FROM users WHERE id = ANY($1::text[])', [[userId, otherUserId]]);
    await sql.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [[orgId, otherOrgId]]);
    await sql.end();
  });

  const counts = async () => ({
    decisions: Number((await sql.query('SELECT count(*)::int AS n FROM ai_decision_outcomes WHERE organization_id=$1', [orgId])).rows[0].n),
    initiatives: Number((await sql.query('SELECT count(*)::int AS n FROM initiatives WHERE organization_id=$1', [orgId])).rows[0].n),
  });

  it('keeps decision writes exclusively in ai_decision_outcomes with the existing response contract', async () => {
    const before = await counts();
    const response = await request(app).post('/api/ai/deep-thinking/save-decision').set('Authorization', authorization).send({
      sessionId,
      conversationId: sessionId,
      type: 'decision',
      content: '# Executive Summary\nDecision 370\n# Recommendation\nKeep the decision path',
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({ success: true });
    expect(typeof response.body.decisionId).toBe('string');
    expect(await counts()).toEqual({ decisions: before.decisions + 1, initiatives: before.initiatives });
  });

  it('writes initiative requests exclusively through the initiatives lineage contract', async () => {
    const before = await counts();
    const response = await request(app).post('/api/ai/deep-thinking/save-decision').set('Authorization', authorization).send({
      sessionId,
      conversationId: sessionId,
      type: 'initiative',
      content: '# Executive Summary\nInitiative 370\n# Recommendation\nCreate the governed initiative',
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({ success: true });
    expect(await counts()).toEqual({ decisions: before.decisions, initiatives: before.initiatives + 1 });
    expect(typeof response.body.initiativeId).toBe('string');
    const stored = await sql.query(
      'SELECT organization_id, source_type, source_id FROM initiatives WHERE id=$1',
      [response.body.initiativeId]
    );
    expect(stored.rows[0]).toEqual({ organization_id: orgId, source_type: 'ai_chat_deep_thinking', source_id: sessionId });
  });

  it('does not expose the created initiative through another organization list request', async () => {
    const response = await request(app).get('/api/initiatives').set('Authorization', otherAuthorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(sessionId);
  });

  it('creates exactly one chat idea and repeated existing-idea reads do not duplicate it', async () => {
    const sourceMessageId = `day370-idea-${randomUUID()}`;
    const before = Number((await sql.query(
      'SELECT count(*)::int AS n FROM my_ideas WHERE organization_id=$1 AND source_message_id=$2',
      [orgId, sourceMessageId]
    )).rows[0].n);
    const create = await request(app).post('/api/my-work/my-ideas/from-chat').set('Authorization', authorization).send({
      title: 'Day 370 durable idea',
      seedText: 'Persist before navigation',
      sourceConversationId: sessionId,
      sourceMessageId,
      startMode: 'describe_with_ai',
      preferredSystem: 'mindmap',
    });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    expect(create.body.ideaId).toMatch(/^idea-\d+-[a-z0-9]+$/);
    const afterCreate = Number((await sql.query(
      'SELECT count(*)::int AS n FROM my_ideas WHERE organization_id=$1 AND source_message_id=$2',
      [orgId, sourceMessageId]
    )).rows[0].n);
    expect(afterCreate).toBe(before + 1);
    const read = await request(app).get(`/api/my-work/my-ideas/${create.body.ideaId}`).set('Authorization', authorization);
    expect(read.status, JSON.stringify(read.body)).toBe(200);
    const afterRead = Number((await sql.query(
      'SELECT count(*)::int AS n FROM my_ideas WHERE organization_id=$1 AND source_message_id=$2',
      [orgId, sourceMessageId]
    )).rows[0].n);
    expect(afterRead).toBe(afterCreate);
  });
});
