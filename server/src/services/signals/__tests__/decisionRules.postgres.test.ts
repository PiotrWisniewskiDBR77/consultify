import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import type { SignalQuery, SignalRule } from '../../../types/workSignals.js';
import { evaluateSignalRules } from '../signalEvaluator.js';
import { decisionBlockingDependentsRule } from '../rules/decision/blockingDependents.js';
import { decisionPendingStaleRule } from '../rules/decision/pendingStale.js';

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
const now = new Date('2026-08-26T12:00:00Z');

const seedDecision = async (params: {
  org: string;
  id: string;
  stale: boolean;
  blocking: boolean;
}) => {
  await pool!.query(
    "INSERT INTO organizations(id,name,status) VALUES ($1,'Decision fixture','active') ON CONFLICT (id) DO NOTHING",
    [params.org]
  );
  await pool!.query(
    "INSERT INTO users(id,email,status) VALUES ('decision-owner','decision-fixture@example.invalid','active') ON CONFLICT (id) DO NOTHING"
  );
  await pool!.query(
    `INSERT INTO decisions(id,organization_id,title,type,decision_maker_id,created_by,status,created_at)
     VALUES ($1,$2,'Fixture','SCOPE','decision-owner','decision-owner','pending',$3)`,
    [params.id, params.org, params.stale ? '2026-08-18T12:00:00Z' : '2026-08-24T12:00:00Z']
  );
  if (params.blocking) {
    await pool!.query(
      `INSERT INTO decision_impacts(id,decision_id,impacted_type,impacted_id,is_blocker)
       VALUES ($1,$2,'task',$3,TRUE)`,
      [randomUUID(), params.id, `task-${randomUUID()}`]
    );
  }
};

const cases: Array<{ name: string; rule: SignalRule; blocking: boolean; stale: boolean }> = [
  { name: 'dec.pending_stale', rule: decisionPendingStaleRule, blocking: false, stale: true },
  {
    name: 'dec.blocking_dependents',
    rule: decisionBlockingDependentsRule,
    blocking: true,
    stale: false,
  },
];

describePg('two DECISION rules on real tenant data', () => {
  afterAll(async () => {
    if (pool) await pool.end();
  });

  for (const fixture of cases) {
    describe(fixture.name, () => {
      it('hits with evidence, destination, and normalized role audience', async () => {
        const org = `org-${randomUUID()}`;
        const id = randomUUID();
        await seedDecision({ org, id, stale: fixture.stale, blocking: fixture.blocking });
        const hits = await fixture.rule.evaluate({ organizationId: org, db, now });
        expect(hits).toHaveLength(1);
        expect(fixture.rule.evidence(hits[0]).length).toBeGreaterThan(0);
        expect(fixture.rule.action(hits[0]).route).toContain(id);
        expect(fixture.rule.audience(hits[0])).toEqual({ userId: null, role: 'PROJECT_MANAGER' });
      });

      it('does not hit outside its condition', async () => {
        const org = `org-${randomUUID()}`;
        await seedDecision({ org, id: randomUUID(), stale: false, blocking: false });
        expect(await fixture.rule.evaluate({ organizationId: org, db, now })).toEqual([]);
      });

      it('auto-resolves after the pending condition clears', async () => {
        const org = `org-${randomUUID()}`;
        const id = randomUUID();
        await seedDecision({ org, id, stale: fixture.stale, blocking: fixture.blocking });
        await evaluateSignalRules({ db, organizationId: org, rules: [fixture.rule], now });
        await pool!.query(
          "UPDATE decisions SET status='approved' WHERE organization_id=$1 AND id=$2",
          [org, id]
        );
        await evaluateSignalRules({ db, organizationId: org, rules: [fixture.rule], now });
        const rows = await pool!.query(
          'SELECT status,resolved_reason FROM work_signals WHERE organization_id=$1',
          [org]
        );
        expect(rows.rows[0]).toMatchObject({
          status: 'RESOLVED',
          resolved_reason: 'CONDITION_CLEARED',
        });
      });

      it('does not read the other tenant', async () => {
        const orgA = `org-${randomUUID()}`;
        const orgB = `org-${randomUUID()}`;
        await seedDecision({
          org: orgB,
          id: randomUUID(),
          stale: fixture.stale,
          blocking: fixture.blocking,
        });
        expect(await fixture.rule.evaluate({ organizationId: orgA, db, now })).toEqual([]);
      });
    });
  }
});
