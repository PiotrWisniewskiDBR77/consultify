/**
 * T9-1 — Whiteboard facilitation: phase state machine · shared timer · end/freeze.
 *
 * REAL-runtime E2E: local Postgres (full schema) + the REAL realtime-platform
 * router + its REAL verifyToken (the router applies auth internally, mirroring the
 * Gateway mount at /api/realtime-v4). No business-logic mocks.
 *
 * Proves:
 *   1. Facilitator sets a phase  → persisted + read back (start→organize→converge).
 *   2. Illegal lifecycle transition (organize→handoff) → 409; unknown phase → 400.
 *   3. Timer arm → timer_ends_at written to the DB column; stop → column cleared.
 *   4. End → status='ended' + ended_at + turnout summary (participants/votes).
 *   5. A CLOSED session is frozen → participant vote (and phase/timer control) → 409.
 *
 * All fixtures use the reversible `odbior--t9f--` prefix and are removed in afterAll.
 * Writes ONLY to the LOCAL Postgres (harness guard enforces this).
 */
import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, requireLocalDbUrl } from './harness.js';
import { SEED } from './seed.mjs';

const P = 'odbior--t9f--';

async function buildRealtimeApp(): Promise<Express> {
  const router = (await import('../../server/src/routes/realtime-platform.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // The router applies its OWN verifyToken internally (mirrors the real Gateway).
  app.use('/api/realtime-v4', router as unknown as express.Router);
  return app;
}

describe('T9-1 facilitation phase/timer/end', () => {
  let app: Express;
  let token: string;
  let client: pg.Client;

  beforeAll(async () => {
    requireLocalDbUrl();
    await import('./seed.mjs').then((m) => m.seed());
    app = await buildRealtimeApp();
    token = mintToken();
    client = new pg.Client({ connectionString: requireLocalDbUrl() });
    await client.connect();
    // Defensive: guarantee the T9-1 column exists even on a DB seeded before mig 790.
    await client.query(
      `ALTER TABLE tool_facilitation_sessions ADD COLUMN IF NOT EXISTS timer_ends_at TIMESTAMP`
    );
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await client.end();
  });

  async function cleanup(): Promise<void> {
    await client.query(
      `DELETE FROM tool_facilitation_votes WHERE facilitation_session_id IN
        (SELECT id FROM tool_facilitation_sessions WHERE organization_id=$1 AND tool_session_id LIKE $2)`,
      [SEED.ORG_ID, `${P}%`]
    );
    await client.query(
      `DELETE FROM tool_facilitation_roles WHERE facilitation_session_id IN
        (SELECT id FROM tool_facilitation_sessions WHERE organization_id=$1 AND tool_session_id LIKE $2)`,
      [SEED.ORG_ID, `${P}%`]
    );
    await client.query(
      `DELETE FROM tool_facilitation_sessions WHERE organization_id=$1 AND tool_session_id LIKE $2`,
      [SEED.ORG_ID, `${P}%`]
    );
  }

  async function createSession(toolSessionId: string): Promise<string> {
    const res = await request(app)
      .post('/api/realtime-v4/facilitation/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolSessionId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    return res.body.id as string;
  }

  it('facilitator sets phase → persisted + read back (start→organize→converge)', async () => {
    const sessionId = await createSession(`${P}tool-phase`);

    // Initial current_phase is null → first assignment allowed.
    let res = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'organize' });
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe('organize');

    // Read back from the DB.
    let db = await client.query(
      `SELECT current_phase FROM tool_facilitation_sessions WHERE id=$1`,
      [sessionId]
    );
    expect(db.rows[0].current_phase).toBe('organize');

    // Read back via the API (GET session returns the row directly).
    res = await request(app)
      .get(`/api/realtime-v4/facilitation/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.current_phase).toBe('organize');

    // organize → converge is a legal lifecycle transition.
    res = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'converge' });
    expect(res.status).toBe(200);
    db = await client.query(`SELECT current_phase FROM tool_facilitation_sessions WHERE id=$1`, [
      sessionId,
    ]);
    expect(db.rows[0].current_phase).toBe('converge');
  });

  it('rejects an illegal lifecycle transition (organize→handoff) with 409', async () => {
    const sessionId = await createSession(`${P}tool-badtrans`);
    await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'organize' })
      .expect(200);

    const res = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'handoff' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REALTIME_FACILITATION_PHASE_TRANSITION_INVALID');

    // Unchanged in the DB.
    const db = await client.query(
      `SELECT current_phase FROM tool_facilitation_sessions WHERE id=$1`,
      [sessionId]
    );
    expect(db.rows[0].current_phase).toBe('organize');
  });

  it('rejects an unknown phase value with 400', async () => {
    const sessionId = await createSession(`${P}tool-unknown`);
    const res = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'totally-bogus' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_FACILITATION_PHASE_UNKNOWN');
  });

  it('allows a signal-phase overlay hop (organize→voting→converge)', async () => {
    // Regression guard: the phase column is an overloaded signal bus. Toggling
    // voting/board through it must NOT be blocked by the lifecycle state machine.
    const sessionId = await createSession(`${P}tool-signal`);
    for (const phase of ['organize', 'voting', 'converge']) {
      const res = await request(app)
        .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phase });
      expect(res.status).toBe(200);
    }
  });

  it('arms the shared timer → timer_ends_at persisted; stop clears it', async () => {
    const sessionId = await createSession(`${P}tool-timer`);
    const endsAt = Date.now() + 5 * 60 * 1000;

    let res = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/timer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ timerState: { timerEndsAt: endsAt, timerSeconds: 300 } });
    expect(res.status).toBe(200);
    expect(res.body.timerEndsAt).toBe(endsAt);
    expect(res.body.running).toBe(true);

    // end_at must be a real, non-null DB value close to what we armed. Read the
    // epoch TZ-robustly: `timer_ends_at` is `timestamp without time zone`, so we
    // pin its interpretation to UTC in SQL rather than relying on node-pg's
    // local-time parse of a tz-less column.
    let db = await client.query(
      `SELECT timer_ends_at,
              (EXTRACT(EPOCH FROM timer_ends_at AT TIME ZONE 'UTC') * 1000)::bigint AS ends_ms,
              timer_state
         FROM tool_facilitation_sessions WHERE id=$1`,
      [sessionId]
    );
    expect(db.rows[0].timer_ends_at).not.toBeNull();
    expect(Math.abs(Number(db.rows[0].ends_ms) - endsAt)).toBeLessThan(2000);
    // Normalised timer_state carries `endsAt` (the field the client reads on rehydrate).
    const ts = JSON.parse(db.rows[0].timer_state);
    expect(ts.endsAt).toBe(endsAt);

    // Stop clears the column.
    res = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/timer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ timerState: { timerEndsAt: null } });
    expect(res.status).toBe(200);
    expect(res.body.timerEndsAt).toBeNull();

    db = await client.query(`SELECT timer_ends_at FROM tool_facilitation_sessions WHERE id=$1`, [
      sessionId,
    ]);
    expect(db.rows[0].timer_ends_at).toBeNull();
  });

  it('ends the session → closed + ended_at + turnout summary; then freezes mutations', async () => {
    const sessionId = await createSession(`${P}tool-end`);

    // Some turnout before closing: assign a role and cast a vote.
    await request(app)
      .post(`/api/realtime-v4/facilitation/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: SEED.USER_ID, roleName: 'facilitator' })
      .expect(201);
    await request(app)
      .post(`/api/realtime-v4/facilitation/sessions/${sessionId}/votes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ voteTargetId: `${P}node-1`, voteValue: 1 })
      .expect(201);

    // End.
    const res = await request(app)
      .post(`/api/realtime-v4/facilitation/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ended');
    expect(res.body.endedAt).toBeTruthy();
    expect(res.body.summary.participants).toBe(1);
    expect(res.body.summary.votes).toBe(1);
    expect(res.body.summary.outcomes).toBe(0);

    // DB reflects the closed state.
    const db = await client.query(
      `SELECT status, ended_at FROM tool_facilitation_sessions WHERE id=$1`,
      [sessionId]
    );
    expect(db.rows[0].status).toBe('ended');
    expect(db.rows[0].ended_at).not.toBeNull();

    // FREEZE: a participant mutation (vote) on a closed session is rejected.
    const voteAfter = await request(app)
      .post(`/api/realtime-v4/facilitation/sessions/${sessionId}/votes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ voteTargetId: `${P}node-2`, voteValue: 1 });
    expect(voteAfter.status).toBe(409);
    expect(voteAfter.body.code).toBe('REALTIME_FACILITATION_SESSION_ENDED');

    // Facilitator control (phase, timer) is also frozen on a closed session.
    const phaseAfter = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'handoff' });
    expect(phaseAfter.status).toBe(409);
    expect(phaseAfter.body.code).toBe('REALTIME_FACILITATION_SESSION_ENDED');

    const timerAfter = await request(app)
      .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/timer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ timerState: { timerEndsAt: Date.now() + 1000 } });
    expect(timerAfter.status).toBe(409);
    expect(timerAfter.body.code).toBe('REALTIME_FACILITATION_SESSION_ENDED');

    // The rejected vote never landed.
    const votes = await client.query(
      `SELECT COUNT(*)::int AS n FROM tool_facilitation_votes WHERE facilitation_session_id=$1`,
      [sessionId]
    );
    expect(votes.rows[0].n).toBe(1);
  });
});
