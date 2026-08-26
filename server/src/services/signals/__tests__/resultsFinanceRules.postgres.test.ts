import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import type { SignalQuery, SignalRule } from '../../../types/workSignals.js';
import { evaluateSignalRules } from '../signalEvaluator.js';
import { budgetOverspendRule } from '../rules/finance/budgetOverspend.js';
import { kpiThresholdBreachedRule } from '../rules/results/kpiThresholdBreached.js';

const connectionString = process.env.DATABASE_URL;
const describePg = connectionString ? describe : describe.skip;
const pool = connectionString ? new Pool({ connectionString }) : null;
const db: SignalQuery = {
  async query<T>(sql: string, params: unknown[] = []) {
    let index = 0;
    return (
      await pool!.query(
        sql.replace(/\?/g, () => `$${++index}`),
        params
      )
    ).rows as T[];
  },
};
const now = new Date('2026-08-26T12:00:00Z');

async function base(org: string, initiative: string) {
  await pool!.query(
    "INSERT INTO organizations(id,name,status) VALUES ($1,'RF fixture','active') ON CONFLICT (id) DO NOTHING",
    [org]
  );
  await pool!.query(
    "INSERT INTO users(id,email,status) VALUES ('rf-owner','rf-fixture@example.invalid','active') ON CONFLICT (id) DO NOTHING"
  );
  await pool!.query(
    "INSERT INTO initiatives(id,organization_id,name,status) VALUES ($1,$2,'RF fixture','EXECUTING')",
    [initiative, org]
  );
}

interface Fixture {
  name: string;
  rule: SignalRule;
  seed(org: string, initiative: string, hit: boolean): Promise<string>;
  clear(id: string): Promise<void>;
}

const fixtures: Fixture[] = [
  {
    name: 'res.kpi_threshold_breached',
    rule: kpiThresholdBreachedRule,
    async seed(org, initiative, hit) {
      await base(org, initiative);
      const kpi = `kpi-${randomUUID()}`;
      const signal = `sig-${randomUUID()}`;
      await pool!.query(
        `INSERT INTO v8_kpi_definitions(kpi_id,organization_id,name,mode,initiative_id,metric_type,measurement_cadence,status,current_value,target_value)
         VALUES ($1,$2,'KPI','initiative_linked',$3,'percentage','monthly','deviation',70,90)`,
        [kpi, org, initiative]
      );
      await pool!.query(
        `INSERT INTO v8_kpi_signals(signal_id,organization_id,kpi_id,signal_type,severity,description,evidence_pointers,next_action_status,created_at)
         VALUES ($1,$2,$3,'THRESHOLD','critical','fixture','[]',$4,$5)`,
        [signal, org, kpi, hit ? 'pending' : 'acknowledged', now.toISOString()]
      );
      return signal;
    },
    clear: async (id) => {
      await pool!.query(
        "UPDATE v8_kpi_signals SET next_action_status='acknowledged' WHERE signal_id=$1",
        [id]
      );
    },
  },
  {
    name: 'fin.budget_overspend',
    rule: budgetOverspendRule,
    async seed(org, initiative, hit) {
      await base(org, initiative);
      const id = randomUUID();
      await pool!.query(
        `INSERT INTO budget_overspend_signals(id,organization_id,initiative_id,signal_type,severity,planned_amount,actual_amount,is_dismissed)
         VALUES ($1,$2,$3,'THRESHOLD_EXCEEDED','CRITICAL',100,$4,FALSE)`,
        [id, org, initiative, hit ? 140 : 90]
      );
      return id;
    },
    clear: async (id) => {
      await pool!.query('UPDATE budget_overspend_signals SET is_dismissed=TRUE WHERE id=$1', [id]);
    },
  },
];

describePg('RESULTS and FINANCE rules on Postgres', () => {
  afterAll(async () => {
    if (pool) await pool.end();
  });
  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      it('produces a real evidence-backed hit and destination', async () => {
        const org = `org-${randomUUID()}`;
        const initiative = randomUUID();
        await fixture.seed(org, initiative, true);
        const hits = await fixture.rule.evaluate({ organizationId: org, db, now });
        expect(hits).toHaveLength(1);
        expect(fixture.rule.evidence(hits[0])).not.toEqual([]);
        expect(fixture.rule.action(hits[0]).route).not.toBe('');
      });
      it('does not hit outside its condition', async () => {
        const org = `org-${randomUUID()}`;
        await fixture.seed(org, randomUUID(), false);
        expect(await fixture.rule.evaluate({ organizationId: org, db, now })).toEqual([]);
      });
      it('auto-resolves when the source clears', async () => {
        const org = `org-${randomUUID()}`;
        const sourceId = await fixture.seed(org, randomUUID(), true);
        await evaluateSignalRules({ db, organizationId: org, rules: [fixture.rule], now });
        await fixture.clear(sourceId);
        await evaluateSignalRules({ db, organizationId: org, rules: [fixture.rule], now });
        const rows = await pool!.query('SELECT status FROM work_signals WHERE organization_id=$1', [
          org,
        ]);
        expect(rows.rows[0].status).toBe('RESOLVED');
      });
      it('does not read another tenant', async () => {
        const orgA = `org-${randomUUID()}`;
        const orgB = `org-${randomUUID()}`;
        await fixture.seed(orgB, randomUUID(), true);
        expect(await fixture.rule.evaluate({ organizationId: orgA, db, now })).toEqual([]);
      });
    });
  }
});
