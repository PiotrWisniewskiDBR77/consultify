/** @vitest-environment node */

/**
 * FIX-3 (day28 duty fix-round, P1-2 / instruction §C.4) — REVERTED, errata.
 *
 * `retryMeetingNoteMaterialization` (meetingBoundaryService.ts:874-881) used
 * to call `getMeetingNote(input)` with `input = {organizationId, meetingId,
 * noteId, materializedBy}` — no `userId`, no `roleKey`. `getMeetingNote`
 * only resolves `materialTitle` through `getArtifactForUser` when BOTH
 * `row.material_artifact_id` AND `input.userId` are truthy
 * (meetingBoundaryService.ts:304).
 *
 * `e201c1a60f` applied variant (a) from §C.4: pass `userId:
 * input.materializedBy, roleKey: 'owner'` to that FIRST getMeetingNote call,
 * expecting (per the instruction's own text) that "retry na notatce ze
 * zmaterializowanym materiałem zwraca niepusty materialTitle."
 *
 * This test proves that promise false, with the line applied AND with it
 * reverted (identical failure either way — see the FIX-3 commit message for
 * both stdout captures): `retryMeetingNoteMaterialization`'s RESPONSE note
 * is not the `note` variable that resolved through getMeetingNote at all —
 * it is `updated || note` where `updated = await setNoteStatus(...)`
 * (meetingBoundaryService.ts ~952), and `setNoteStatus` does a bare
 * `UPDATE meeting_notes ... RETURNING *`. `meeting_notes` has no
 * `material_artifact_id` / `material_title` columns (those exist only via
 * the LEFT JOIN inside getMeetingNote's own SELECT) — so `updated`, and
 * therefore the retry endpoint's JSON response, structurally can never
 * carry a resolved title or artifact id, regardless of what userId/roleKey
 * the FIRST getMeetingNote call received. The userId/roleKey addition was
 * inert: harmless (getArtifactForUser never throws, and retryAllowed reads
 * proposalState/materializationStatus from the JOIN, not the title branch),
 * but it did not and could not deliver the §C.4(a) contract. Reverted per
 * this FIX's own instruction ("jeśli test wykaże, że zmiana jest błędna —
 * revert tej linii zamiast testu-przykrywki") rather than asserting a
 * cover-up expectation. The real gap (`setNoteStatus` not re-joining the
 * material columns) is a separate, larger change than "one line" and is
 * left as an open finding for a future decision — see the FIX-3 commit
 * message / day28 fix-round report.
 *
 * REQUIRES a real Postgres reachable via DATABASE_URL with
 * NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false.
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

const PREFIX = `day28fix3-${randomUUID().slice(0, 8)}`;
const ORG_A = `${PREFIX}-org-a`;
const USER_A = `${PREFIX}-user-a`;
const headers = () => ({
  'x-test-org-id': ORG_A,
  'x-test-user-id': USER_A,
  'x-test-role': 'admin',
});

describe('Meetings day28-fixes FIX-3 — retry materialTitle (instruction §C.4a)', () => {
  let app: express.Express;
  let pool: Pool;

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

  it('retry on a note whose material is already registered still returns a null materialTitle (§C.4 errata, not a defect introduced here)', async () => {
    const created = await request(app).post('/api/meeting').set(headers()).send({
      title: 'Retry materialTitle — §C.4(a)',
      startAt: '2026-11-03T08:00:00.000Z',
      endAt: '2026-11-03T09:00:00.000Z',
    });
    expect(created.status).toBe(201);
    const meetingId = created.body.meeting.id;

    const generated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(headers())
      .send({ transcript: 'Ann: we decided to ship Friday. Bob: action item prep the plan.' });
    expect(generated.status).toBe(201);
    const noteId = generated.body.meetingNoteId;

    const approved = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(headers())
      .send({ action: 'approve' });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.receipt).toBeTruthy();
    const materialArtifactId = approved.body.receipt.targetRecordId;
    expect(materialArtifactId).toBeTruthy();

    // The real title Instance C.2 case 1 expects to see resolved, read
    // directly from the source of truth so the assertion below isn't
    // trivially satisfied by any non-empty string.
    const artifactRow = await pool.query(
      `SELECT title_snapshot FROM v8_output_artifacts WHERE artifact_id = $1 AND organization_id = $2`,
      [materialArtifactId, ORG_A]
    );
    const expectedTitle = artifactRow.rows[0]?.title_snapshot;
    expect(expectedTitle).toBeTruthy();

    // Force the LAST recorded attempt to 'failed' so retryAllowed is true
    // (retryMeetingNoteMaterialization: proposalState === 'approved' ||
    // materializationStatus === 'failed') without disturbing the artifact
    // that already exists and is already registered — the scenario §C.4(a)
    // actually describes ("notatce ze zmaterializowanym materiałem").
    const flipped = await pool.query(
      `UPDATE meeting_note_materializations SET status = 'failed'
         WHERE organization_id = $1 AND note_id = $2
         RETURNING artifact_id`,
      [ORG_A, noteId]
    );
    expect(flipped.rows[0]?.artifact_id).toBe(materialArtifactId);

    const retry = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/materialization/retry`)
      .set(headers());
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);

    // Honest documentation of the real contract, not the §C.4(a) goal: the
    // response's `note` comes from setNoteStatus's bare
    // `UPDATE meeting_notes ... RETURNING *`, which has no
    // material_artifact_id / material_title columns to return — see the
    // header comment. This is true whether or not the retry function's
    // FIRST getMeetingNote call is given userId/roleKey, which is why that
    // line was reverted rather than kept for a cosmetic-only effect.
    expect(retry.body.note.materialArtifactId, JSON.stringify(retry.body)).toBeNull();
    expect(retry.body.note.materialTitle, JSON.stringify(retry.body)).toBeNull();
    // The artifact itself is untouched and still correctly titled — this
    // FIX did not corrupt or lose the material, it only failed to surface
    // its title through this one response envelope.
    const stillRegistered = await pool.query(
      `SELECT title_snapshot FROM v8_output_artifacts WHERE artifact_id = $1 AND organization_id = $2`,
      [materialArtifactId, ORG_A]
    );
    expect(stillRegistered.rows[0]?.title_snapshot).toBe(expectedTitle);
  });
});
