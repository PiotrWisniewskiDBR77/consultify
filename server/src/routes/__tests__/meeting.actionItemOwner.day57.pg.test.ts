/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { meetingIntelligenceService } from '../../services/ai/meetingIntelligenceService.js';
import { errorHandlerMiddleware } from '../../utils/ErrorHandler.js';

const orgId = 'w3-mtg-owner-org-v1';
const foreignOrgId = 'w3-mtg-foreign-org-v1';
const authorId = '57100000-0000-4000-8000-000000000001';
const actorId = '57100000-0000-4000-8000-000000000002';
const foreignId = '57100000-0000-4000-8000-000000000003';
const meetingId = 'w3-mtg-approved-meeting-v1';
const key = 'w3-mtg-day57-action-owner-v1';
const foreignKey = 'w3-mtg-day57-action-owner-foreign-v1';

function bearer(userId: string, organizationId: string, role = 'ADMIN'): string {
  return `Bearer ${jwt.sign({ id: userId, userId, organizationId, role }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  })}`;
}

describe('Day 57 Meeting action-item owner limitation — real Gateway and PG', () => {
  let app: express.Express;
  let pool: Pool;
  let noteId = '';
  let foreignNoteId = '';
  const taskIds: string[] = [];

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const [id, organizationId, email, role] of [
      [authorId, orgId, 'w3.mtg.day57.author@local.test', 'OWNER'],
      [actorId, orgId, 'w3.mtg.day57.actor@local.test', 'ADMIN'],
      [foreignId, foreignOrgId, 'w3.mtg.day57.foreign@local.test', 'OWNER'],
    ]) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused',$4,'active') ON CONFLICT(id) DO NOTHING`,
        [id, organizationId, email, role]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,'ACTIVE') ON CONFLICT(id) DO NOTHING`,
        [`w3-mtg-day57-membership-${id}`, organizationId, id, role]
      );
    }
    meetingIntelligenceService.setLLMClient(null);
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    app.use(errorHandlerMiddleware);

    const generated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set('Authorization', bearer(authorId, orgId, 'OWNER'))
      .send({
        transcript: 'Action item: Admin prepares the evidence package for the steering committee.',
        idempotencyKey: key,
      });
    expect(generated.status, JSON.stringify(generated.body)).toBe(201);
    expect(generated.body.note.source).toBe('heuristic');
    expect(generated.body.note.actionItems[0].owner).toBe('Unassigned');
    noteId = generated.body.meetingNoteId;
    await pool.query(`UPDATE meeting_notes SET action_items_json=$1 WHERE id=$2`, [
      JSON.stringify([
        { task: 'Pakiet dowodowy', owner: 'Admin', priority: 'high' },
        { task: 'Agenda bez właściciela', priority: 'low' },
        { task: 'Analiza z niepasującym właścicielem', owner: 'Nieistniejąca osoba' },
        { task: 'Analiza z adresem administratora', owner: 'w3.mtg.admin@local.test' },
      ]),
      noteId,
    ]);
    const approved = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set('Authorization', bearer(actorId, orgId))
      .send({ action: 'approve', reason: 'Day 57 local proof' });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);

    const foreignGenerated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set('Authorization', bearer(authorId, orgId, 'OWNER'))
      .send({
        transcript: 'Action item: validate the tenant fallback before release.',
        idempotencyKey: foreignKey,
      });
    expect(foreignGenerated.status).toBe(201);
    foreignNoteId = foreignGenerated.body.meetingNoteId;
    await pool.query(`UPDATE meeting_notes SET created_by=$1 WHERE id=$2`, [
      foreignId,
      foreignNoteId,
    ]);
    const foreignApproved = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${foreignNoteId}/decision`)
      .set('Authorization', bearer(actorId, orgId))
      .send({ action: 'approve', reason: 'Day 57 tenant fallback proof' });
    expect(foreignApproved.status).toBe(200);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM tasks WHERE id=ANY($1)`, [taskIds]);
    await pool.query(`DELETE FROM meeting_note_materializations WHERE note_id=ANY($1)`, [
      [noteId, foreignNoteId],
    ]);
    await pool.query(
      `DELETE FROM artifact_handoff_receipts WHERE proposal_id IN (SELECT proposal_id FROM meeting_notes WHERE id=ANY($1))`,
      [[noteId, foreignNoteId]]
    );
    await pool.query(
      `DELETE FROM artifact_handoff_proposals WHERE producer_record_id=$1 AND idempotency_key=ANY($2)`,
      [meetingId, [key, foreignKey]]
    );
    await pool.query(`DELETE FROM meeting_notes WHERE id=ANY($1)`, [[noteId, foreignNoteId]]);
    await pool.query(
      `DELETE FROM v8_artifact_origin_links WHERE artifact_id IN (SELECT artifact_id FROM v8_output_artifacts WHERE created_by=$1)`,
      [actorId]
    );
    await pool.query(`DELETE FROM v8_output_artifacts WHERE created_by=$1`, [actorId]);
    await pool.query(`DELETE FROM organization_members WHERE user_id=ANY($1)`, [
      [authorId, actorId, foreignId],
    ]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [[authorId, actorId, foreignId]]);
    await pool.end();
  });

  async function create(index: number, targetNoteId = noteId) {
    const response = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${targetNoteId}/action-items/${index}/task`)
      .set('Authorization', bearer(actorId, orgId));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    taskIds.push(response.body.task.id);
    return pool.query(`SELECT assignee_id,description FROM tasks WHERE id=$1`, [
      response.body.task.id,
    ]);
  }

  it('free-text Admin stays in description and assigns the note author', async () => {
    const row = await create(0);
    expect(row.rows[0]).toMatchObject({ assignee_id: authorId, description: 'Owner: Admin' });
  });

  it('missing owner falls back to the note author', async () => {
    expect((await create(1)).rows[0].assignee_id).toBe(authorId);
  });

  it('an unmatched owner label still falls back to the note author', async () => {
    expect((await create(2)).rows[0].assignee_id).toBe(authorId);
  });

  it('even a matching user email is not heuristically resolved', async () => {
    const row = await create(3);
    expect(row.rows[0].assignee_id).toBe(authorId);
    expect(row.rows[0].assignee_id).not.toBe(actorId);
  });

  it('a foreign stored author falls back to the authenticated actor', async () => {
    expect((await create(0, foreignNoteId)).rows[0].assignee_id).toBe(actorId);
  });

  it('a foreign tenant cannot convert the local note', async () => {
    const response = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set('Authorization', bearer(foreignId, foreignOrgId, 'OWNER'));
    expect(response.status).toBe(404);
    expect(response.body.code).not.toBe('BETA_LOCKED');
  });

  it('a replay returns the same task and leaves one row', async () => {
    const first = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set('Authorization', bearer(actorId, orgId));
    const second = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set('Authorization', bearer(actorId, orgId));
    expect(first.body.task.id).toBe(second.body.task.id);
    expect(second.body.replayed).toBe(true);
    const count = await pool.query(`SELECT count(*)::int n FROM tasks WHERE id=$1`, [
      first.body.task.id,
    ]);
    expect(count.rows[0].n).toBe(1);
  });

  it('local backfill count is measured explicitly', async () => {
    const result = await pool.query(
      `SELECT count(*)::int n FROM tasks WHERE assignee_id IS NULL AND source_type='meeting_note_action_item'`
    );
    expect(result.rows[0].n).toBe(0);
  });
});
