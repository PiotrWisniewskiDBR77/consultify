/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userRole = 'ADMIN';
    req.user = { id: req.headers['x-user'], organizationId: req.headers['x-org'], role: 'ADMIN' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('disposable local PostgreSQL required');
const prefix = `day28-title-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const foreign = `${prefix}-foreign`;
const user = `${prefix}-admin`;
const other = `${prefix}-other`;
const meeting = `${prefix}-meeting`;
const artifactA = `${prefix}-artifact-a`;
const artifactB = `${prefix}-artifact-b`;
const pool = new Pool({ connectionString: url });
const headers = { 'x-org': org, 'x-user': user };

describe('Meetings day28 C — materialTitle access resolution', () => {
  let app: express.Express;

  beforeAll(async () => {
    const now = new Date().toISOString();
    for (const id of [org, foreign]) {
      await pool.query(
        `INSERT INTO organizations (id,name,plan,status,is_active,created_at)
         VALUES ($1,$2,'enterprise','active',1,$3)`,
        [id, id, now]
      );
    }
    for (const id of [user, other]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,password,role,status,created_at)
         VALUES ($1,$2,$3,'unused','ADMIN','active',$4)`,
        [id, org, `${id}@example.invalid`, now]
      );
    }
    await pool.query(
      `INSERT INTO meetings (id,organization_id,title,start_at,end_at,status,created_by,created_at,updated_at)
       VALUES ($1,$2,'Material title meeting',$3,$3,'planned',$4,$3,$3)`,
      [meeting, org, now, user]
    );
    for (const [artifactId, title] of [
      [artifactA, 'Restricted board pack'],
      [artifactB, 'Second restricted pack'],
    ]) {
      await pool.query(
        `INSERT INTO v8_output_artifacts
          (artifact_id,organization_id,output_type,delivery_state,created_by,created_at,last_transition_at,
           artifact_family,title_snapshot,owner_user_id,canonical_home,visibility_scope,is_draft)
         VALUES ($1,$2,'report','ready',$3,$4,$4,'document',$5,$3,'outputs_library','private',0)`,
        [artifactId, org, user, now, title]
      );
    }
    const notes = [
      [`${prefix}-note-a1`, artifactA],
      [`${prefix}-note-a2`, artifactA],
      [`${prefix}-note-b`, artifactB],
      [`${prefix}-note-empty`, null],
    ] as const;
    for (const [noteId, artifactId] of notes) {
      await pool.query(
        `INSERT INTO meeting_notes
          (id,organization_id,meeting_id,source,language,transcript_hash,summary,key_points_json,
           decisions_json,action_items_json,status,created_by,created_at,updated_at)
         VALUES ($1,$2,$3,'heuristic','en',$1,$1,'[]','[]','[]','approved',$4,$5,$5)`,
        [noteId, org, meeting, user, now]
      );
      if (artifactId) {
        await pool.query(
          `INSERT INTO meeting_note_materializations
            (id,organization_id,meeting_id,note_id,status,artifact_id,attempts,created_at,updated_at)
           VALUES ($1,$2,$3,$4,'materialized',$5,1,$6,$6)`,
          [`${prefix}-mat-${noteId}`, org, meeting, noteId, artifactId, now]
        );
      }
    }
    const routes = (await import('../../../server/src/routes/meeting.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_note_materializations WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM meeting_notes WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM meetings WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM v8_output_artifacts WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, foreign]);
    await pool.end();
  });

  it('returns the real title when the caller owns the private artifact', async () => {
    const response = await request(app).get(`/api/meeting/${meeting}/notes`).set(headers);
    expect(response.status).toBe(200);
    const note = response.body.notes.find((item: any) => item.id === `${prefix}-note-a1`);
    expect(note).toMatchObject({
      materialArtifactId: artifactA,
      materialTitle: 'Restricted board pack',
    });
  });

  it('returns null without dropping materialArtifactId after access is revoked', async () => {
    await pool.query(`UPDATE v8_output_artifacts SET owner_user_id=$1 WHERE artifact_id=$2`, [
      other,
      artifactA,
    ]);
    const response = await request(app).get(`/api/meeting/${meeting}/notes`).set(headers);
    const note = response.body.notes.find((item: any) => item.id === `${prefix}-note-a1`);
    expect(note).toMatchObject({ materialArtifactId: artifactA, materialTitle: null });
    await pool.query(`UPDATE v8_output_artifacts SET owner_user_id=$1 WHERE artifact_id=$2`, [
      user,
      artifactA,
    ]);
  });

  it('returns honest nulls for a note without materialization', async () => {
    const response = await request(app).get(`/api/meeting/${meeting}/notes`).set(headers);
    const note = response.body.notes.find((item: any) => item.id === `${prefix}-note-empty`);
    expect(note).toMatchObject({ materialArtifactId: null, materialTitle: null });
  });

  it('does not disclose a meeting or material title across tenants', async () => {
    const response = await request(app)
      .get(`/api/meeting/${meeting}/notes`)
      .set({ 'x-org': foreign, 'x-user': `${prefix}-foreign-admin` });
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain('Restricted board pack');
  });

  it('returns an honest 404 with no title for a missing meeting', async () => {
    const response = await request(app).get(`/api/meeting/${prefix}-missing/notes`).set(headers);
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain('Restricted board pack');
  });

  it('resolves N=4 notes sharing K=2 unique artifacts without changing their identities', async () => {
    const response = await request(app).get(`/api/meeting/${meeting}/notes`).set(headers);
    expect(response.status).toBe(200);
    expect(response.body.notes).toHaveLength(4);
    expect(
      response.body.notes.filter((item: any) => item.materialArtifactId === artifactA)
    ).toHaveLength(2);
    expect(
      response.body.notes.filter((item: any) => item.materialArtifactId === artifactB)
    ).toHaveLength(1);
  });
});
