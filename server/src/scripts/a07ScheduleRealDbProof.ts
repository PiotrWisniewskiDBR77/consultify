import assert from 'node:assert/strict';

import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });

const proofDb = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
  get(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, row: unknown) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows[0] ?? null);
    if (callback)
      void promise.then(
        (row) => callback(null, row),
        (error) => callback(error as Error, null)
      );
    return callback ? proofDb : promise;
  },
  all(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, rows: unknown[]) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows);
    if (callback)
      void promise.then(
        (rows) => callback(null, rows),
        (error) => callback(error as Error, [])
      );
    return callback ? proofDb : promise;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((result) => ({ changes: result.rowCount ?? 0 }));
    if (callback)
      void promise.then(
        (result) => callback.call({ changes: result.changes }, null),
        (error) => callback.call({ changes: 0 }, error as Error)
      );
    return callback ? proofDb : promise;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize(callback: () => void) {
    callback();
  },
  close: () => Promise.resolve(),
};

(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const runtime = await import('../services/wave8AgentRuntimeService.js');
  await runtime.ensureWave8AgentRuntimeSchema();
  const due = '2026-08-07T10:00:00.000Z';
  await runtime.launchWave8Agent({
    organizationId: 'org-a07',
    userId: 'owner-a07',
    agentId: 'research-agent',
    goal: 'Run weekly PMO exception review',
    requestedTools: [],
    schedule: {
      cadence: 'once',
      nextRunAt: due,
      ownerUserId: 'owner-a07',
      timezone: 'Europe/Warsaw',
    },
  });

  const [workerA, workerB] = await Promise.all([
    runtime.processDueWave8AgentSchedules({ now: due, workerId: 'worker-a' }),
    runtime.processDueWave8AgentSchedules({ now: due, workerId: 'worker-b' }),
  ]);
  assert.equal(workerA.length + workerB.length, 1, 'overlapping workers must execute one cycle');
  let schedules = await runtime.listWave8AgentSchedules({ organizationId: 'org-a07' });
  assert.equal(schedules[0].status, 'completed');
  assert.equal(schedules[0].attemptCount, 1);
  assert.equal(schedules[0].timezone, 'Europe/Warsaw');
  assert.equal(schedules[0].mandate.version, 1);
  assert.equal(schedules[0].mandate.approvedBy, 'owner-a07');
  assert.equal(schedules[0].mandate.goal, 'Run weekly PMO exception review');

  await runtime.launchWave8Agent({
    organizationId: 'org-a07',
    userId: 'owner-a07',
    agentId: 'research-agent',
    goal: 'Recover after worker restart',
    requestedTools: [],
    schedule: { cadence: 'once', nextRunAt: due, ownerUserId: 'owner-a07', timezone: 'UTC' },
  });
  await pool.query(
    `UPDATE wave8_agent_schedules SET lease_owner = 'dead-worker', lease_expires_at = $1
     WHERE status = 'active'`,
    ['2026-08-07T09:55:00.000Z']
  );
  const recovered = await runtime.processDueWave8AgentSchedules({
    now: due,
    workerId: 'restart-worker',
  });
  assert.equal(recovered.length, 1, 'expired lease must be recoverable after restart');
  const foreign = await runtime.processDueWave8AgentSchedules({
    organizationId: 'org-foreign',
    now: due,
  });
  assert.equal(foreign.length, 0, 'tenant-scoped sweep must not read another organization');

  await runtime.launchWave8Agent({
    organizationId: 'org-a07',
    userId: 'owner-a07',
    agentId: 'research-agent',
    goal: 'Revocable future governance mandate',
    requestedTools: [],
    schedule: {
      cadence: 'daily',
      nextRunAt: due,
      ownerUserId: 'owner-a07',
      timezone: 'Europe/Warsaw',
    },
  });
  schedules = await runtime.listWave8AgentSchedules({ organizationId: 'org-a07' });
  const revocable = schedules.find((schedule) => schedule.status === 'active');
  assert.ok(revocable);
  const paused = await runtime.transitionWave8AgentSchedule({
    organizationId: 'org-a07',
    scheduleId: revocable.scheduleId,
    actorUserId: 'owner-a07',
    action: 'pause',
  });
  assert.equal(paused.status, 'paused');
  assert.equal(
    (await runtime.processDueWave8AgentSchedules({ now: due, workerId: 'paused-worker' })).length,
    0
  );
  const resumed = await runtime.transitionWave8AgentSchedule({
    organizationId: 'org-a07',
    scheduleId: revocable.scheduleId,
    actorUserId: 'owner-a07',
    action: 'resume',
  });
  assert.equal(resumed.status, 'active');
  const cancelled = await runtime.transitionWave8AgentSchedule({
    organizationId: 'org-a07',
    scheduleId: revocable.scheduleId,
    actorUserId: 'owner-a07',
    action: 'cancel',
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.mandateVersion, 4);
  assert.equal(
    (await runtime.processDueWave8AgentSchedules({ now: due, workerId: 'cancelled-worker' }))
      .length,
    0
  );

  await runtime.launchWave8Agent({
    organizationId: 'org-a07',
    userId: 'owner-a07',
    agentId: 'research-agent',
    goal: 'Bounded timeout and retry proof',
    requestedTools: [],
    schedule: {
      cadence: 'once',
      nextRunAt: due,
      ownerUserId: 'owner-a07',
      timezone: 'UTC',
      timeoutSeconds: 1,
      maxAttempts: 2,
    },
  });
  const timeoutSchedule = await pool.query(
    `SELECT schedule_id FROM wave8_agent_schedules WHERE goal = $1`,
    ['Bounded timeout and retry proof']
  );
  const timeoutScheduleId = timeoutSchedule.rows[0].schedule_id;
  await runtime.processDueWave8AgentSchedules({
    now: due,
    workerId: 'timeout-worker-1',
    executeSchedule: (_input, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error(String(signal.reason))));
      }),
  });
  let timeoutState = (await runtime.listWave8AgentSchedules({ organizationId: 'org-a07' })).find(
    (schedule) => schedule.scheduleId === timeoutScheduleId
  );
  assert.equal(timeoutState.status, 'active');
  assert.equal(timeoutState.attemptCount, 1);
  assert.equal(timeoutState.lastError, 'schedule_execution_timeout:1');
  assert.equal(timeoutState.retryAt, '2026-08-07T10:00:30.000Z');

  await runtime.processDueWave8AgentSchedules({
    now: '2026-08-07T10:00:31.000Z',
    workerId: 'timeout-worker-2',
    executeSchedule: (_input, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error(String(signal.reason))));
      }),
  });
  timeoutState = (await runtime.listWave8AgentSchedules({ organizationId: 'org-a07' })).find(
    (schedule) => schedule.scheduleId === timeoutScheduleId
  );
  assert.equal(timeoutState.status, 'failed');
  assert.equal(timeoutState.attemptCount, 2);
  const resumedTimeout = await runtime.transitionWave8AgentSchedule({
    organizationId: 'org-a07',
    scheduleId: timeoutScheduleId,
    actorUserId: 'owner-a07',
    action: 'resume',
  });
  assert.equal(resumedTimeout.status, 'active');
  assert.equal(resumedTimeout.attemptCount, 0);

  await runtime.launchWave8Agent({
    organizationId: 'org-a07',
    userId: 'owner-a07',
    agentId: 'research-agent',
    goal: 'External dependency recovery proof',
    requestedTools: [],
    schedule: { cadence: 'once', nextRunAt: due, ownerUserId: 'owner-a07', timezone: 'UTC' },
  });
  const dependencySchedule = await pool.query(
    `SELECT schedule_id FROM wave8_agent_schedules WHERE goal = $1`,
    ['External dependency recovery proof']
  );
  const dependencyScheduleId = dependencySchedule.rows[0].schedule_id;
  await runtime.processDueWave8AgentSchedules({
    now: '2026-08-07T10:00:32.000Z',
    workerId: 'dependency-worker',
    executeSchedule: async (input) => {
      if (input.goal === 'External dependency recovery proof') {
        throw new Error('external_dependency:finance_connector_unavailable');
      }
      return { run: { runId: `proof-${input.goal}` } };
    },
  });
  const dependencyBlocked = (
    await runtime.listWave8AgentSchedules({ organizationId: 'org-a07' })
  ).find((schedule) => schedule.scheduleId === dependencyScheduleId);
  assert.equal(dependencyBlocked.status, 'blocked_external');
  assert.equal(
    dependencyBlocked.blockedReason,
    'external_dependency:finance_connector_unavailable'
  );
  const dependencyResumed = await runtime.transitionWave8AgentSchedule({
    organizationId: 'org-a07',
    scheduleId: dependencyScheduleId,
    actorUserId: 'owner-a07',
    action: 'resume',
  });
  assert.equal(dependencyResumed.status, 'active');
  assert.equal(dependencyResumed.blockedReason, null);

  const notifications = await runtime.listWave8AgentNotifications({ organizationId: 'org-a07' });
  const dependencyNotification = notifications.find(
    (notification) => notification.notificationType === 'agent_schedule_dependency_blocked'
  );
  assert.ok(dependencyNotification, 'dependency exception must be delivered to the in-app feed');
  assert.equal(dependencyNotification.payload.actionable, true);
  assert.equal(
    dependencyNotification.payload.actionUrl,
    `/my-work/agents?scheduleId=${dependencyScheduleId}`
  );

  schedules = await runtime.listWave8AgentSchedules({ organizationId: 'org-a07' });
  assert.equal(schedules.filter((schedule) => schedule.status === 'completed').length, 3);

  console.log(
    JSON.stringify({
      proof: 'A07_REALDB_GREEN',
      overlappingExecutions: 1,
      recoveredAfterExpiredLease: 1,
      tenantIsolation: true,
      pauseResumeCancel: true,
      hardTimeout: true,
      boundedRetry: true,
      externalDependencyResume: true,
      actionableNotificationReadback: true,
      approvedMandateSnapshot: true,
      schedules: schedules.length,
    })
  );
}

main().finally(() => pool.end());
