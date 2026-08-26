/** @vitest-environment node */

/**
 * FIX-4 (day19-fixes P2, 2026-08-26): `retryMeetingNoteMaterialization` used
 * to run unconditionally. Called on a REJECTED note (contract: "reject →
 * zero materials"), it still executed stages 1-2 of materialization
 * (creating a `wave5_artifacts` content row and registering it in
 * `v8_output_artifacts`) before the handoff spine finally refused the
 * non-'approved' proposal at stage 3 — leaving an orphaned, nobody-approved
 * artifact behind (and a 500, not a clean conflict response).
 *
 * This suite proves, on the real router + real Postgres, that retrying a
 * rejected note's materialization now returns 409 and creates NO artifact
 * rows anywhere — not in `wave5_artifacts`, not in `v8_output_artifacts`,
 * and the `meeting_note_materializations` attempt ledger (if touched at
 * all) never reaches 'materialized'.
 *
 * REQUIRES a real Postgres reachable via DATABASE_URL with
 * NODE_ENV=test RUN_DB_TESTS=1.
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    req.userRole = req.headers['x-test-role'] || 'admin';
    req.user = { id, organizationId, role: req.userRole, email: `${id}@example.com` };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PREFIX = `day19fix4-${randomUUID().slice(0, 8)}`;
const ORG_A = `${PREFIX}-org-a`;
const USER_A = `${PREFIX}-user-a`;
const headers = () => ({
  'x-test-org-id': ORG_A,
  'x-test-user-id': USER_A,
  'x-test-role': 'admin',
});

describe('Meetings day19-fixes FIX-4 — materialization retry precondition', () => {
  let app: express.Express;
  let pool: Pool;

  async function countArtifactRows(contentId: string): Promise<{ wave5: number; registry: number }> {
    const wave5 = await pool.query(
      `SELECT 1 FROM wave5_artifacts WHERE artifact_id = $1 AND organization_id = $2`,
      [contentId, ORG_A]
    );
    const registry = await pool.query(
      `SELECT 1 FROM v8_artifact_origin_links WHERE organization_id = $1 AND origin_record_id = $2`,
      [ORG_A, contentId]
    );
    return { wave5: wave5.rowCount || 0, registry: registry.rowCount || 0 };
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || process.env.RUN_DB_TESTS !== '1')
      throw new Error('real local PG required');
    const { default: routes } = await import('../../../server/src/routes/meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_note_materializations WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM meeting_notes WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM v8_output_artifacts WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM wave5_artifacts WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM meetings WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.end();
  });

  it('retrying a REJECTED note materialization returns 409 and creates zero artifact rows', async () => {
    const created = await request(app).post('/api/meeting').set(headers()).send({
      title: 'Retry precondition — rejected note',
      startAt: '2026-11-02T08:00:00.000Z',
      endAt: '2026-11-02T09:00:00.000Z',
    });
    expect(created.status).toBe(201);
    const meetingId = created.body.meeting.id;

    const generated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(headers())
      .send({ transcript: 'Ann: we decided to ship Friday. Bob: action item prep the plan.' });
    expect(generated.status).toBe(201);
    const noteId = generated.body.meetingNoteId;
    const contentId = `meeting-material-${noteId}`;

    const before = await countArtifactRows(contentId);
    expect(before).toEqual({ wave5: 0, registry: 0 });

    const rejected = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(headers())
      .send({ action: 'reject', reason: 'not relevant' });
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
    expect(rejected.body.note.status).toBe('rejected');
    expect(rejected.body.receipt).toBeNull();

    const afterReject = await countArtifactRows(contentId);
    expect(afterReject).toEqual({ wave5: 0, registry: 0 });

    const retry = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/materialization/retry`)
      .set(headers());
    expect(retry.status, JSON.stringify(retry.body)).toBe(409);
    expect(retry.body.code).toBe('RETRY_NOT_ALLOWED');

    const afterRetry = await countArtifactRows(contentId);
    expect(afterRetry).toEqual({ wave5: 0, registry: 0 });

    // Cold, independent re-read: the note is still rejected, still has no
    // receipt, and no materialization attempt was ever recorded for it.
    const cold = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const noteRow = await cold.query(
        `SELECT status FROM meeting_notes WHERE id = $1 AND organization_id = $2`,
        [noteId, ORG_A]
      );
      expect(noteRow.rows[0].status).toBe('rejected');
      const attemptRow = await cold.query(
        `SELECT status FROM meeting_note_materializations WHERE note_id = $1 AND organization_id = $2`,
        [noteId, ORG_A]
      );
      expect(attemptRow.rowCount).toBe(0);
    } finally {
      await cold.end();
    }
  });
});
