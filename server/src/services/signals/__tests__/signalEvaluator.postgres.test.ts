import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { RuleHit, SignalQuery, SignalRule } from '../../../types/workSignals.js';
import { rollupSignals } from '../../v8/executionVisibilityService.js';
import { evaluateSignalRules } from '../signalEvaluator.js';

const connectionString = process.env.DATABASE_URL;
const describePg = connectionString ? describe : describe.skip;
const pool = connectionString ? new Pool({ connectionString }) : null;

const db: SignalQuery = {
  async query<T>(sql: string, params: unknown[] = []) {
    let index = 0;
    const postgresSql = sql.replace(/\?/g, () => `$${++index}`);
    const result = await pool!.query(postgresSql, params);
    return result.rows as T[];
  },
};

const hit = (subjectId: string, severity = 1): RuleHit => ({
  subjectId,
  observedValue: severity,
  observedAt: new Date().toISOString(),
  data: { assigneeId: 'user-a' },
});

const rule = (params: {
  id?: string;
  version?: number;
  hits: () => RuleHit[];
  throws?: boolean;
  max?: number;
}): SignalRule => ({
  ruleId: params.id ?? 'exec.task.overdue',
  ruleVersion: params.version ?? 1,
  domain: 'EXECUTION',
  signalType: 'task_overdue',
  severity: (value) => (Number(value.observedValue) > 2 ? 'critical' : 'warning'),
  subjectType: 'task',
  titleKey: 'signals.exec.task.overdue.title',
  bodyKey: 'signals.exec.task.overdue.body',
  evaluate: async () => {
    if (params.throws) throw new Error('fixture query failed');
    return params.hits();
  },
  dedupeKey: (value) => `exec.task.overdue:${value.subjectId}`,
  evidence: (value) => [
    {
      ref: value.subjectId,
      refType: 'task',
      version: null,
      observedValue: value.observedValue,
      observedAt: value.observedAt,
    },
  ],
  action: (value) => ({
    kind: 'OPEN_TASK',
    route: `/tasks/${value.subjectId}`,
    params: { taskId: value.subjectId },
    permission: 'tasks.read',
  }),
  audience: () => ({ userId: 'user-a', role: null }),
  maxPerRunPerOrg: params.max ?? 25,
  minSeverityToSurface: 'info',
});

describePg('signal evaluator on Postgres', () => {
  const orgA = randomUUID();
  const orgB = randomUUID();

  beforeAll(async () => {
    await pool!.query('SELECT 1');
  });

  beforeEach(async () => {
    await pool!.query('DELETE FROM work_signals WHERE organization_id = ANY($1)', [[orgA, orgB]]);
    await pool!.query('DELETE FROM work_signal_runs WHERE organization_id = ANY($1)', [
      [orgA, orgB],
    ]);
    await pool!.query('DELETE FROM v8_execution_signals WHERE organization_id = ANY($1)', [
      [orgA, orgB],
    ]);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('is idempotent and auto-resolves when the condition clears', async () => {
    let hits = [hit('task-1')];
    const fixture = rule({ hits: () => hits });
    const first = await evaluateSignalRules({ db, organizationId: orgA, rules: [fixture] });
    const second = await evaluateSignalRules({ db, organizationId: orgA, rules: [fixture] });
    expect(first.signalsOpened).toBe(1);
    expect(second.signalsOpened).toBe(0);
    expect(second.signalsUpdated).toBe(1);
    hits = [];
    const third = await evaluateSignalRules({ db, organizationId: orgA, rules: [fixture] });
    expect(third.signalsResolved).toBe(1);
    const resolved = await pool!.query(
      'SELECT status,resolved_reason FROM work_signals WHERE organization_id=$1',
      [orgA]
    );
    expect(resolved.rows).toEqual([
      expect.objectContaining({ status: 'RESOLVED', resolved_reason: 'CONDITION_CLEARED' }),
    ]);
  });

  it('supersedes an old rule version and opens the replacement', async () => {
    const hits = () => [hit('task-2')];
    await evaluateSignalRules({ db, organizationId: orgA, rules: [rule({ version: 1, hits })] });
    const result = await evaluateSignalRules({
      db,
      organizationId: orgA,
      rules: [rule({ version: 2, hits })],
    });
    expect(result.signalsResolved).toBe(1);
    expect(result.signalsOpened).toBe(1);
    const rows = await pool!.query(
      'SELECT status,rule_version FROM work_signals WHERE organization_id=$1 ORDER BY rule_version',
      [orgA]
    );
    expect(rows.rows).toEqual([
      { status: 'SUPERSEDED', rule_version: 1 },
      { status: 'OPEN', rule_version: 2 },
    ]);
  });

  it('records a rule error as PARTIAL and keeps that rule open', async () => {
    await evaluateSignalRules({
      db,
      organizationId: orgA,
      rules: [rule({ hits: () => [hit('task-3')] })],
    });
    const result = await evaluateSignalRules({
      db,
      organizationId: orgA,
      rules: [rule({ hits: () => [], throws: true })],
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.errors[0]).toMatchObject({ ruleId: 'exec.task.overdue' });
    const rows = await pool!.query(
      "SELECT count(*)::int AS count FROM work_signals WHERE organization_id=$1 AND status='OPEN'",
      [orgA]
    );
    expect(rows.rows[0].count).toBe(1);
  });

  it('caps one rule at 25 highest-severity hits', async () => {
    const result = await evaluateSignalRules({
      db,
      organizationId: orgA,
      rules: [rule({ hits: () => Array.from({ length: 100 }, (_, i) => hit(`task-${i}`, i)) })],
    });
    expect(result.signalsOpened).toBe(25);
    const rows = await pool!.query(
      "SELECT count(*)::int AS count FROM work_signals WHERE organization_id=$1 AND severity='critical'",
      [orgA]
    );
    expect(rows.rows[0].count).toBe(25);
  });

  it('never modifies another tenant', async () => {
    await evaluateSignalRules({
      db,
      organizationId: orgB,
      rules: [rule({ hits: () => [hit('tenant-b-task')] })],
    });
    const before = await pool!.query(
      'SELECT signal_id,status,last_observed_at FROM work_signals WHERE organization_id=$1',
      [orgB]
    );
    await evaluateSignalRules({
      db,
      organizationId: orgA,
      rules: [rule({ hits: () => [hit('tenant-a-task')] })],
    });
    const after = await pool!.query(
      'SELECT signal_id,status,last_observed_at FROM work_signals WHERE organization_id=$1',
      [orgB]
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('keeps the canonical signal and marks the run PARTIAL when the legacy adapter fails', async () => {
    const result = await evaluateSignalRules({
      db,
      organizationId: orgA,
      rules: [rule({ hits: () => [hit('adapter-failure-task')] })],
      executionAdapter: async () => {
        throw new Error('legacy unavailable');
      },
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.errors[0]).toMatchObject({
      ruleId: 'exec.task.overdue',
      message: expect.stringContaining('legacy unavailable'),
    });
    const canonical = await pool!.query(
      'SELECT status FROM work_signals WHERE organization_id=$1 AND subject_id=$2',
      [orgA, 'adapter-failure-task']
    );
    expect(canonical.rows).toEqual([{ status: 'OPEN' }]);
  });

  it('persists one legacy row for two runs, rolls it up, and isolates the other tenant', async () => {
    const subjectId = randomUUID();
    const fixture = rule({ hits: () => [hit(subjectId)] });
    const first = await evaluateSignalRules({ db, organizationId: orgA, rules: [fixture] });
    const second = await evaluateSignalRules({ db, organizationId: orgA, rules: [fixture] });

    expect(first.status).toBe('OK');
    expect(second.status).toBe('OK');
    const persisted = await pool!.query(
      'SELECT signal_type FROM v8_execution_signals WHERE organization_id=$1',
      [orgA]
    );
    expect(persisted.rows).toEqual([{ signal_type: 'overdue_tasks_count' }]);

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    await expect(rollupSignals(orgA, from, to)).resolves.toMatchObject({ total: 1 });
    await expect(rollupSignals(orgB, from, to)).resolves.toMatchObject({ total: 0 });
  });
});
