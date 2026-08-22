import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

import { duplicateDigitizationAnalysisCommand } from '../digitizationAnalysisDuplicateCommandService.js';

const url = process.env.DATABASE_URL || '',
  run = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const suite = run ? describe : describe.skip;
suite('ECO-W13 analysis duplicate command (real PostgreSQL)', () => {
  it('copies assessment and planning graph, resets authority, and replays exactly', async () => {
    const p = `eco-w13-${randomUUID().slice(0, 8)}`,
      org = `${p}-org`,
      user = `${p}-user`,
      initiative = `${p}-initiative`,
      source = `${p}-source`;
    const c = new Client({ connectionString: url });
    await c.connect();
    let duplicate = '';
    try {
      await c.query(`INSERT INTO organizations(id,name) VALUES($1,'ECO W13')`, [org]);
      await c.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,role) VALUES($1,$2,$3,'ECO','W13','ADMIN')`,
        [user, org, `${user}@test.local`]
      );
      await c.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
        [randomUUID(), org, user]
      );
      await c.query(
        `INSERT INTO initiatives(id,organization_id,name,status,created_at,updated_at) VALUES($1,$2,'Source initiative','DRAFT',now(),now())`,
        [initiative, org]
      );
      await c.query(
        `INSERT INTO digitization_analyses(id,name,description,status,organization_id,initiative_id,created_by,overall_score,completion_percent,axis_scores,created_at,updated_at) VALUES($1,'Source','Body','completed',$2,$3,$4,4.2,80,'{}',now(),now())`,
        [source, org, initiative, user]
      );
      await c.query(
        `INSERT INTO digitization_axis_scores(id,analysis_id,axis_id,area_id,current_level,target_level,notes,assessed_by,assessed_at) VALUES($1,$2,'people','p1',3,5,'note',$3,now())`,
        [randomUUID(), source, user]
      );
      await c.query(
        `INSERT INTO analysis_financials(id,analysis_id,initiative_id,organization_id,initial_investment,currency,created_by) VALUES($1,$2,$3,$4,100,'EUR',$5)`,
        [randomUUID(), source, initiative, org, user]
      );
      await c.query(
        `INSERT INTO analysis_financial_scenarios(id,analysis_id,organization_id,scenario_type,name,assumptions,financial_data,metrics,is_active,created_by) VALUES($1,$2,$3,'base','Base','[]','{}','{}',TRUE,$4)`,
        [randomUUID(), source, org, user]
      );
      const result = await duplicateDigitizationAnalysisCommand({
        organizationId: org,
        userId: user,
        sourceAnalysisId: source,
        idempotencyKey: 'clone',
        expectedSourceVersion: 1,
        name: 'Safe clone',
      });
      duplicate = result.analysisId;
      expect(result).toMatchObject({
        name: 'Safe clone',
        status: 'DRAFT',
        version: 1,
        axisScoreCount: 1,
        financialsCopied: true,
        scenarioCount: 1,
        replay: false,
      });
      const replay = await duplicateDigitizationAnalysisCommand({
        organizationId: org,
        userId: user,
        sourceAnalysisId: source,
        idempotencyKey: 'clone',
        expectedSourceVersion: 1,
        name: 'Safe clone',
      });
      expect(replay.analysisId).toBe(duplicate);
      expect(replay.replay).toBe(true);
      const header = (
        await c.query(
          `SELECT status,initiative_id,command_version FROM digitization_analyses WHERE id=$1`,
          [duplicate]
        )
      ).rows[0];
      expect(header).toMatchObject({ status: 'draft', initiative_id: null, command_version: 1 });
      expect(
        Number(
          (
            await c.query(`SELECT count(*) n FROM digitization_axis_scores WHERE analysis_id=$1`, [
              duplicate,
            ])
          ).rows[0].n
        )
      ).toBe(1);
      expect(
        (
          await c.query(
            `SELECT initiative_id,initial_investment FROM analysis_financials WHERE analysis_id=$1`,
            [duplicate]
          )
        ).rows[0]
      ).toMatchObject({ initiative_id: null, initial_investment: 100 });
      expect(
        Number(
          (
            await c.query(`SELECT count(*) n FROM benefit_tracking WHERE initiative_id=$1`, [
              initiative,
            ])
          ).rows[0].n
        )
      ).toBe(0);
    } finally {
      await c.query('BEGIN');
      await c.query(`SET LOCAL session_replication_role=replica`);
      await c.query(
        `DELETE FROM finance_digitization_analysis_duplicate_command_receipts WHERE organization_id=$1`,
        [org]
      );
      await c.query(`DELETE FROM analysis_financial_scenarios WHERE organization_id=$1`, [org]);
      await c.query(`DELETE FROM analysis_financials WHERE organization_id=$1`, [org]);
      await c.query(`DELETE FROM digitization_axis_scores WHERE analysis_id=ANY($1::text[])`, [
        [source, duplicate].filter(Boolean),
      ]);
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
