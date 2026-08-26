import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SignalQuery, SignalRule } from '../../../types/workSignals.js';
import { evaluateSignalRules } from '../signalEvaluator.js';
import { initiativeNoBaselineRule } from '../rules/execution/initiativeNoBaseline.js';
import { taskBlockedStaleRule } from '../rules/execution/taskBlockedStale.js';
import { taskDueSoonNotStartedRule } from '../rules/execution/taskDueSoonNotStarted.js';
import { taskOverdueRule } from '../rules/execution/taskOverdue.js';

const connectionString = process.env.DATABASE_URL;
const describePg = connectionString ? describe : describe.skip;
const pool = connectionString ? new Pool({ connectionString }) : null;
const db: SignalQuery = {
  async query<T>(sql: string, params: unknown[] = []) {
    let index = 0;
    const result = await pool!.query(
      sql.replace(/\?/g, () => `$${++index}`),
      params
    );
    return result.rows as T[];
  },
};
const now = new Date('2026-08-26T12:00:00.000Z');

interface RuleFixture {
  name: string;
  rule: SignalRule;
  seedHit(org: string, id: string): Promise<void>;
  seedMiss(org: string, id: string): Promise<void>;
  clear(org: string, id: string): Promise<void>;
}

const ensureOrganization = async (org: string) => {
  await pool!.query(
    "INSERT INTO organizations(id,name,status) VALUES ($1,'Signal fixture','active') ON CONFLICT (id) DO NOTHING",
    [org]
  );
  await pool!.query(
    "INSERT INTO users(id,email,status) VALUES ('user-owner','signal-fixture@example.invalid','active') ON CONFLICT (id) DO NOTHING"
  );
};

const insertTask = async (params: {
  org: string;
  id: string;
  status: string;
  due: string;
  updated: string;
}) => {
  await ensureOrganization(params.org);
  await pool!.query(
    `INSERT INTO tasks(id,organization_id,title,status,due_date,updated_at,assignee_id)
     VALUES ($1,$2,'Fixture',$3,$4,$5,'user-owner')`,
    [params.id, params.org, params.status, params.due, params.updated]
  );
};

const fixtures: RuleFixture[] = [
  {
    name: 'exec.task.overdue',
    rule: taskOverdueRule,
    seedHit: (org, id) =>
      insertTask({
        org,
        id,
        status: 'todo',
        due: '2026-08-20T12:00:00Z',
        updated: now.toISOString(),
      }),
    seedMiss: (org, id) =>
      insertTask({
        org,
        id,
        status: 'done',
        due: '2026-08-20T12:00:00Z',
        updated: now.toISOString(),
      }),
    clear: async (org, id) => {
      await pool!.query("UPDATE tasks SET status='done' WHERE organization_id=$1 AND id=$2", [
        org,
        id,
      ]);
    },
  },
  {
    name: 'exec.task.due_soon_not_started',
    rule: taskDueSoonNotStartedRule,
    seedHit: (org, id) =>
      insertTask({
        org,
        id,
        status: 'todo',
        due: '2026-08-28T12:00:00Z',
        updated: now.toISOString(),
      }),
    seedMiss: (org, id) =>
      insertTask({
        org,
        id,
        status: 'in_progress',
        due: '2026-08-28T12:00:00Z',
        updated: now.toISOString(),
      }),
    clear: async (org, id) => {
      await pool!.query(
        "UPDATE tasks SET status='in_progress' WHERE organization_id=$1 AND id=$2",
        [org, id]
      );
    },
  },
  {
    name: 'exec.task.blocked_stale',
    rule: taskBlockedStaleRule,
    seedHit: (org, id) =>
      insertTask({
        org,
        id,
        status: 'blocked',
        due: '2026-09-01T12:00:00Z',
        updated: '2026-08-19T12:00:00Z',
      }),
    seedMiss: (org, id) =>
      insertTask({
        org,
        id,
        status: 'blocked',
        due: '2026-09-01T12:00:00Z',
        updated: '2026-08-24T12:00:00Z',
      }),
    clear: async (org, id) => {
      await pool!.query('UPDATE tasks SET updated_at=$1 WHERE organization_id=$2 AND id=$3', [
        now,
        org,
        id,
      ]);
    },
  },
  {
    name: 'exec.initiative.no_baseline',
    rule: initiativeNoBaselineRule,
    seedHit: async (org, id) => {
      await ensureOrganization(org);
      await pool!.query(
        "INSERT INTO initiatives(id,organization_id,name,status,owner_execution_id) VALUES ($1,$2,'Fixture','EXECUTING','user-owner')",
        [id, org]
      );
    },
    seedMiss: async (org, id) => {
      await ensureOrganization(org);
      await pool!.query(
        "INSERT INTO initiatives(id,organization_id,name,status) VALUES ($1,$2,'Fixture','DONE')",
        [id, org]
      );
    },
    clear: async (org, id) => {
      await pool!.query(
        "INSERT INTO initiative_schedule_baselines(id,organization_id,initiative_id,version,snapshot) VALUES ($1,$2,$3,1,'{}')",
        [randomUUID(), org, id]
      );
    },
  },
];

describePg('four EXECUTION rules on real tenant data', () => {
  beforeAll(async () => {
    await pool!.query('SELECT 1');
  });
  afterAll(async () => {
    if (pool) await pool.end();
  });

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      it('produces one evidence-backed hit with a destination', async () => {
        const org = `org-${randomUUID()}`;
        const id = randomUUID();
        await fixture.seedHit(org, id);
        const hits = await fixture.rule.evaluate({ organizationId: org, db, now });
        expect(hits).toHaveLength(1);
        expect(fixture.rule.evidence(hits[0])[0]).toMatchObject({ ref: id });
        expect(fixture.rule.action(hits[0]).route).toContain(id);
        expect(fixture.rule.audience(hits[0]).userId).toBe('user-owner');
      });

      it('does not hit just outside the condition', async () => {
        const org = `org-${randomUUID()}`;
        await fixture.seedMiss(org, randomUUID());
        expect(await fixture.rule.evaluate({ organizationId: org, db, now })).toEqual([]);
      });

      it('auto-resolves after the source condition clears', async () => {
        const org = `org-${randomUUID()}`;
        const id = randomUUID();
        await fixture.seedHit(org, id);
        await evaluateSignalRules({ db, organizationId: org, rules: [fixture.rule], now });
        await fixture.clear(org, id);
        await evaluateSignalRules({ db, organizationId: org, rules: [fixture.rule], now });
        const row = await pool!.query(
          'SELECT status,resolved_reason FROM work_signals WHERE organization_id=$1',
          [org]
        );
        expect(row.rows[0]).toMatchObject({
          status: 'RESOLVED',
          resolved_reason: 'CONDITION_CLEARED',
        });
      });

      it('does not read an identical record from another tenant', async () => {
        const orgA = `org-${randomUUID()}`;
        const orgB = `org-${randomUUID()}`;
        await fixture.seedHit(orgB, randomUUID());
        expect(await fixture.rule.evaluate({ organizationId: orgA, db, now })).toEqual([]);
      });
    });
  }
});
