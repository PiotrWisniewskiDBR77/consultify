import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import signalsRoutes from '../../../server/src/routes/signals.routes.js';
import myWorkSignalsRoutes from '../../../server/src/routes/my-work/signals.routes.js';

const connectionString = process.env.DATABASE_URL;
const describePg = connectionString ? describe : describe.skip;
const pool = connectionString ? new Pool({ connectionString }) : null;
const orgA = `org-feed-a-${randomUUID()}`;
const orgB = `org-feed-b-${randomUUID()}`;
const userId = `user-feed-${randomUUID()}`;

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.headers['x-test-deny'] === '1') return res.status(403).json({ error: 'Forbidden' });
  Object.assign(req, {
    userId,
    organizationId: String(req.headers['x-test-org'] || orgA),
    userRole: String(req.headers['x-test-role'] || 'MEMBER'),
    can: (permission: string) => permission === 'tasks.read',
  });
  next();
});
app.use('/api/signals', signalsRoutes);
app.use('/my-work', myWorkSignalsRoutes);

async function seedSignal(params: {
  org?: string;
  role?: string | null;
  audienceUser?: string | null;
  severity?: string;
  domain?: string;
  type?: string;
}) {
  const runId = randomUUID();
  const signalId = randomUUID();
  const org = params.org ?? orgA;
  await pool!.query(
    `INSERT INTO work_signal_runs(run_id,organization_id,kind,trigger,status,started_at,finished_at,duration_ms)
     VALUES ($1,$2,'DETERMINISTIC','CRON','OK',now(),now(),1)`,
    [runId, org]
  );
  await pool!.query(
    `INSERT INTO work_signals(
       signal_id,organization_id,dedupe_key,domain,signal_type,origin,severity,
       subject_type,subject_id,audience_user_id,audience_role,title_key,body_key,
       evidence,action,rule_id,rule_version,run_id)
     VALUES ($1,$2,$3,$4,$5,'DETERMINISTIC',$6,'task',$7,$8,$9,
       'signals.exec.task.overdue.title','signals.exec.task.overdue.body',$10,$11,
       'exec.task.overdue',1,$12)`,
    [
      signalId,
      org,
      `fixture:${signalId}`,
      params.domain ?? 'EXECUTION',
      params.type ?? 'task_overdue',
      params.severity ?? 'warning',
      `task-${signalId}`,
      params.audienceUser ?? null,
      params.role ?? null,
      JSON.stringify([
        {
          ref: `task-${signalId}`,
          refType: 'task',
          version: null,
          observedValue: 4,
          observedAt: new Date().toISOString(),
        },
      ]),
      JSON.stringify({
        kind: 'OPEN_TASK',
        route: `/tasks/task-${signalId}`,
        params: {},
        permission: 'tasks.read',
      }),
      runId,
    ]
  );
  return signalId;
}

describePg('GET /api/signals canonical Postgres feed', () => {
  beforeAll(async () => {
    await pool!.query('SELECT 1');
  });
  beforeEach(async () => {
    await pool!.query('DELETE FROM work_signals WHERE organization_id = ANY($1)', [[orgA, orgB]]);
    await pool!.query('DELETE FROM work_signal_runs WHERE organization_id = ANY($1)', [
      [orgA, orgB],
    ]);
    await pool!.query('DELETE FROM my_work_signal_prefs WHERE user_id=$1', [userId]);
    await pool!.query('DELETE FROM my_work_signal_snoozes WHERE user_id=$1', [userId]);
    await pool!.query('DELETE FROM my_work_signal_dismissals WHERE user_id=$1', [userId]);
  });
  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('returns the legacy superset plus source, freshness, destination and isMine', async () => {
    await seedSignal({ audienceUser: userId, severity: 'blocker' });
    const response = await request(app).get('/api/signals').set('accept-language', 'pl');
    expect(response.status).toBe(200);
    expect(response.body.signals[0]).toMatchObject({
      severity: 'CRITICAL',
      severityRaw: 'blocker',
      isMine: true,
      title: 'Zadanie po terminie',
      destination: expect.objectContaining({ allowed: true }),
      source: expect.objectContaining({ ruleId: 'exec.task.overdue' }),
      freshness: expect.objectContaining({ nextRunAt: null }),
    });
    for (const key of [
      'key',
      'type',
      'title',
      'body',
      'severity',
      'createdAt',
      'projectId',
      'projectName',
      'entityType',
      'entityId',
    ]) {
      expect(response.body.signals[0]).toHaveProperty(key);
    }
  });

  it('returns an honest empty list', async () => {
    const response = await request(app).get('/api/signals');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ signals: [], nextCursor: null });
  });

  it('never returns another organization even for the same audience user', async () => {
    await seedSignal({ org: orgB, audienceUser: userId });
    const response = await request(app).get('/api/signals').set('x-test-org', orgA);
    expect(response.body.signals).toEqual([]);
  });

  it('filters a different audience role', async () => {
    await seedSignal({ role: 'PROJECT_MANAGER' });
    const response = await request(app).get('/api/signals').set('x-test-role', 'MEMBER');
    expect(response.body.signals).toEqual([]);
  });

  it('normalizes role case from the database', async () => {
    await seedSignal({ role: 'admin' });
    const response = await request(app).get('/api/signals').set('x-test-role', 'ADMIN');
    expect(response.body.signals).toHaveLength(1);
  });

  it('ignores a role supplied in the query string', async () => {
    await seedSignal({ role: 'ADMIN' });
    const response = await request(app).get('/api/signals?role=ADMIN').set('x-test-role', 'MEMBER');
    expect(response.body.signals).toEqual([]);
  });

  it('does not allow an organization query parameter to switch tenants', async () => {
    await seedSignal({ org: orgB });
    const response = await request(app)
      .get(`/api/signals?organizationId=${orgB}`)
      .set('x-test-org', orgA);
    expect(response.body.signals).toEqual([]);
  });

  it('preserves 403 from the membership guard', async () => {
    const response = await request(app).get('/api/signals').set('x-test-deny', '1');
    expect(response.status).toBe(403);
  });

  it('respects muted domain, snooze and dismissal readbacks', async () => {
    const muted = await seedSignal({ domain: 'EXECUTION', type: 'muted-type' });
    const snoozed = await seedSignal({ type: 'snoozed-type' });
    const dismissed = await seedSignal({ type: 'dismissed-type' });
    const visible = await seedSignal({ domain: 'DECISION', type: 'visible-type' });
    await pool!.query(
      `INSERT INTO my_work_signal_prefs(user_id,organization_id,muted_types_json,muted_domains_json)
       VALUES ($1,$2,'[]','["EXECUTION"]')`,
      [userId, orgA]
    );
    await pool!.query(
      "INSERT INTO my_work_signal_snoozes(user_id,signal_key,snoozed_until) VALUES ($1,$2,'2099-01-01')",
      [userId, snoozed]
    );
    await pool!.query(
      "INSERT INTO my_work_signal_dismissals(user_id,signal_key,dismissed_at) VALUES ($1,$2,'2026-08-26')",
      [userId, dismissed]
    );
    const response = await request(app).get('/api/signals');
    expect(response.body.signals.map((signal: { key: string }) => signal.key)).toEqual([visible]);
    expect(response.body.signals.map((signal: { key: string }) => signal.key)).not.toContain(muted);
  });

  it('paginates without OFFSET', async () => {
    await seedSignal({});
    await seedSignal({});
    const first = await request(app).get('/api/signals?limit=1');
    expect(first.body.signals).toHaveLength(1);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await request(app).get(`/api/signals?limit=1&cursor=${first.body.nextCursor}`);
    expect(second.body.signals).toHaveLength(1);
    expect(second.body.signals[0].key).not.toBe(first.body.signals[0].key);
  });

  it('records an honest disabled on-demand run', async () => {
    delete process.env.ENABLE_SIGNAL_PRODUCER;
    const response = await request(app).post('/api/signals/refresh').send({});
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      producerEnabled: false,
      run: { status: 'SKIPPED_DISABLED' },
    });
    const rows = await pool!.query(
      "SELECT status FROM work_signal_runs WHERE organization_id=$1 AND trigger='ON_DEMAND'",
      [orgA]
    );
    expect(rows.rows).toEqual([{ status: 'SKIPPED_DISABLED' }]);
  });

  it('throttles a second on-demand run from the durable ledger', async () => {
    delete process.env.ENABLE_SIGNAL_PRODUCER;
    expect((await request(app).post('/api/signals/refresh').send({})).status).toBe(200);
    const second = await request(app).post('/api/signals/refresh').send({});
    expect(second.status).toBe(429);
    expect(second.body.retryAfterSeconds).toBeGreaterThan(0);
    const count = await pool!.query(
      "SELECT count(*)::int AS count FROM work_signal_runs WHERE organization_id=$1 AND trigger='ON_DEMAND'",
      [orgA]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('rejects a foreign organization in the refresh body without writing it', async () => {
    const response = await request(app)
      .post('/api/signals/refresh')
      .set('x-test-org', orgA)
      .send({ organizationId: orgB });
    expect(response.status).toBe(400);
    const count = await pool!.query(
      "SELECT count(*)::int AS count FROM work_signal_runs WHERE organization_id=$1 AND trigger='ON_DEMAND'",
      [orgB]
    );
    expect(count.rows[0].count).toBe(0);
  });

  it('snoozes and dismisses an owned signal with database readback', async () => {
    const signalId = await seedSignal({ audienceUser: userId });
    expect(
      (
        await request(app)
          .post(`/my-work/signals/${signalId}/snooze`)
          .set('x-test-role', 'MEMBER')
          .send({ preset: '1h' })
      ).status
    ).toBe(200);
    expect(
      (await request(app).post(`/my-work/signals/${signalId}/dismiss`).set('x-test-role', 'MEMBER'))
        .status
    ).toBe(200);
    const rows = await pool!.query(
      `SELECT s.signal_key AS snoozed, d.signal_key AS dismissed
         FROM my_work_signal_snoozes s JOIN my_work_signal_dismissals d
           ON d.user_id=s.user_id AND d.signal_key=s.signal_key
        WHERE s.user_id=$1 AND s.signal_key=$2`,
      [userId, signalId]
    );
    expect(rows.rows).toEqual([{ snoozed: signalId, dismissed: signalId }]);
  });

  it('returns 404 and writes nothing for a foreign-org signal key', async () => {
    const signalId = await seedSignal({ org: orgB, audienceUser: userId });
    const response = await request(app)
      .post(`/my-work/signals/${signalId}/snooze`)
      .set('x-test-org', orgA);
    expect(response.status).toBe(404);
    const rows = await pool!.query(
      'SELECT count(*)::int AS count FROM my_work_signal_snoozes WHERE user_id=$1 AND signal_key=$2',
      [userId, signalId]
    );
    expect(rows.rows[0].count).toBe(0);
  });

  it('returns 404 for a signal addressed to a different role', async () => {
    const signalId = await seedSignal({ role: 'ADMIN' });
    const response = await request(app)
      .post(`/my-work/signals/${signalId}/dismiss`)
      .set('x-test-role', 'MEMBER');
    expect(response.status).toBe(404);
  });

  it('mutes a type and a domain and feed readback respects both', async () => {
    await seedSignal({ type: 'type-muted', domain: 'DECISION' });
    await seedSignal({ type: 'other-type', domain: 'FINANCE' });
    expect(
      (await request(app).post('/my-work/signals/mute-type').send({ type: 'type-muted' })).status
    ).toBe(200);
    expect(
      (await request(app).post('/my-work/signals/mute-domain').send({ domain: 'FINANCE' })).status
    ).toBe(200);
    const response = await request(app).get('/my-work/signals');
    expect(response.status).toBe(200);
    expect(response.body.signals).toEqual([]);
  });

  it('handles unknown and legacy notification keys without a 500', async () => {
    expect((await request(app).post(`/my-work/signals/${randomUUID()}/dismiss`)).status).toBe(404);
    expect((await request(app).post('/my-work/signals/notification:legacy/snooze')).status).toBe(
      404
    );
  });
});
