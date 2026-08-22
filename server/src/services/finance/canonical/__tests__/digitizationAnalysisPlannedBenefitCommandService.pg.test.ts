import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

import { persistDigitizationAnalysisPlannedBenefit } from '../digitizationAnalysisPlannedBenefitCommandService.js';

const url = process.env.DATABASE_URL || '';
const run =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && url.startsWith('postgres');
const suite = run ? describe : describe.skip;
suite('ECO-W07 planned benefits command (real PostgreSQL)', () => {
  it('writes plan exactly once and never changes Results-owned Actual', async () => {
    const p = `eco-w07-${randomUUID().slice(0, 8)}`,
      org = `${p}-org`,
      user = `${p}-user`,
      initiative = `${p}-initiative`,
      analysis = `${p}-analysis`;
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      await c.query(`INSERT INTO organizations(id,name) VALUES($1,'ECO W07')`, [org]);
      await c.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,role) VALUES($1,$2,$3,'ECO','W07','ADMIN')`,
        [user, org, `${user}@test.local`]
      );
      await c.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
        [randomUUID(), org, user]
      );
      await c.query(
        `INSERT INTO initiatives(id,organization_id,name,status,created_at,updated_at) VALUES($1,$2,'ECO W07','DRAFT',now(),now())`,
        [initiative, org]
      );
      await c.query(
        `INSERT INTO digitization_analyses(id,name,status,organization_id,initiative_id,created_by,created_at,updated_at) VALUES($1,'ECO W07','draft',$2,$3,$4,now(),now())`,
        [analysis, org, initiative, user]
      );
      const first = await persistDigitizationAnalysisPlannedBenefit({
        organizationId: org,
        userId: user,
        analysisId: analysis,
        idempotencyKey: 'first',
        expectedVersion: 1,
        trackingPeriod: '2026-Q1',
        plannedBenefits: 100,
      });
      expect(first.version).toBe(2);
      const replay = await persistDigitizationAnalysisPlannedBenefit({
        organizationId: org,
        userId: user,
        analysisId: analysis,
        idempotencyKey: 'first',
        expectedVersion: 1,
        trackingPeriod: '2026-Q1',
        plannedBenefits: 100,
      });
      expect(replay.replay).toBe(true);
      const second = await persistDigitizationAnalysisPlannedBenefit({
        organizationId: org,
        userId: user,
        analysisId: analysis,
        idempotencyKey: 'second',
        expectedVersion: 2,
        trackingPeriod: '2026-Q1',
        plannedBenefits: 120,
      });
      expect(second.version).toBe(3);
      const row = (
        await c.query(
          `SELECT planned_cost_savings,actual_cost_savings FROM benefit_tracking WHERE id=$1`,
          [first.benefitTrackingId]
        )
      ).rows[0];
      expect(Number(row.planned_cost_savings)).toBe(120);
      expect(Number(row.actual_cost_savings)).toBe(0);
      await expect(
        persistDigitizationAnalysisPlannedBenefit({
          organizationId: org,
          userId: user,
          analysisId: analysis,
          idempotencyKey: 'stale',
          expectedVersion: 2,
          trackingPeriod: '2026-Q1',
          plannedBenefits: 999,
        })
      ).rejects.toMatchObject({ code: 'DIGITIZATION_ANALYSIS_VERSION_CONFLICT' });
      expect(
        Number(
          (
            await c.query(
              `SELECT count(*) n FROM finance_digitization_analysis_planned_benefit_command_receipts WHERE organization_id=$1`,
              [org]
            )
          ).rows[0].n
        )
      ).toBe(2);
    } finally {
      await c.query('BEGIN');
      await c.query(`SET LOCAL session_replication_role=replica`);
      await c.query(
        `DELETE FROM finance_digitization_analysis_planned_benefit_command_receipts WHERE organization_id=$1`,
        [org]
      );
      await c.query(`DELETE FROM benefit_tracking WHERE organization_id=$1`, [org]);
      await c.query(`DELETE FROM digitization_analyses WHERE organization_id=$1`, [org]);
      await c.query(`DELETE FROM initiatives WHERE organization_id=$1`, [org]);
      await c.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
      await c.query(`DELETE FROM users WHERE id=$1`, [user]);
      await c.query(`DELETE FROM organizations WHERE id=$1`, [org]);
      await c.query('COMMIT');
      await c.end();
    }
  });
});
