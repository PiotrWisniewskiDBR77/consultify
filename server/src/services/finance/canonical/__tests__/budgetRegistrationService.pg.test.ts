import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('budgetRegistrationService (real PostgreSQL)', () => {
  const orgId = `org-budget-registration-${randomUUID()}`;
  const foreignOrgId = `org-budget-registration-foreign-${randomUUID()}`;
  const userId = `user-budget-registration-${randomUUID()}`;
  const sourceId = `tool-budget-registration-${randomUUID()}`;
  const foreignSourceId = `tool-budget-registration-foreign-${randomUUID()}`;
  let client: Client;
  let registerBudget: typeof import('../budgetRegistrationService.js').registerBudget;
  let applyBudgetLineCommand: typeof import('../budgetLineCommandService.js').applyBudgetLineCommand;
  let projectBudgetScenario: typeof import('../budgetProjectionCommandService.js').projectBudgetScenario;
  let updateBudgetScenarioAdjustments: typeof import('../budgetProjectionCommandService.js').updateBudgetScenarioAdjustments;

  const counts = async () =>
    (
      await client.query(
        `SELECT
          (SELECT count(*)::int FROM budgets WHERE organization_id=$1) budgets,
          (SELECT count(*)::int FROM budget_lines WHERE budget_id IN
             (SELECT id FROM budgets WHERE organization_id=$1)) lines,
          (SELECT count(*)::int FROM budget_scenarios WHERE budget_id IN
             (SELECT id FROM budgets WHERE organization_id=$1)) scenarios,
          (SELECT count(*)::int FROM finance_budget_registration_receipts
             WHERE organization_id=$1) receipts,
          (SELECT count(*)::int FROM finance_budget_line_command_receipts
             WHERE organization_id=$1) line_receipts,
          (SELECT count(*)::int FROM finance_budget_projection_command_receipts
             WHERE organization_id=$1) projection_receipts,
          (SELECT count(*)::int FROM finance_budget_scenario_adjustment_command_receipts
             WHERE organization_id=$1) adjustment_receipts`,
        [orgId]
      )
    ).rows[0];

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    ({ registerBudget } = await import('../budgetRegistrationService.js'));
    ({ applyBudgetLineCommand } = await import('../budgetLineCommandService.js'));
    ({ projectBudgetScenario, updateBudgetScenarioAdjustments } =
      await import('../budgetProjectionCommandService.js'));
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Budget registration'),($2,'Foreign budget registration')`,
      [orgId, foreignOrgId]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Budget','Owner','ADMIN')`,
      [userId, orgId, `${userId}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgId, userId]
    );
    await client.query(
      `INSERT INTO tool_sessions(id,organization_id,tool_type,name,created_by)
       VALUES($1,$2,'dynamic-swot','Budget source',$3),
             ($4,$5,'dynamic-swot','Foreign budget source',$3)`,
      [sourceId, orgId, userId, foreignSourceId, foreignOrgId]
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL session_replication_role=replica`);
      await client.query(
        `DELETE FROM finance_budget_scenario_adjustment_command_receipts WHERE organization_id=$1`,
        [orgId]
      );
      await client.query(
        `DELETE FROM finance_budget_projection_command_receipts WHERE organization_id=$1`,
        [orgId]
      );
      await client.query(
        `DELETE FROM finance_budget_line_command_receipts WHERE organization_id=$1`,
        [orgId]
      );
      await client.query(
        `DELETE FROM finance_budget_registration_receipts WHERE organization_id=$1`,
        [orgId]
      );
      await client.query(
        `DELETE FROM budget_scenarios WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id=$1)`,
        [orgId]
      );
      await client.query(
        `DELETE FROM budget_lines WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id=$1)`,
        [orgId]
      );
      await client.query(`DELETE FROM budgets WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM tool_sessions WHERE id IN ($1,$2)`, [
        sourceId,
        foreignSourceId,
      ]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgId, foreignOrgId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    expect(await counts()).toEqual({
      budgets: 0,
      lines: 0,
      scenarios: 0,
      receipts: 0,
      line_receipts: 0,
      projection_receipts: 0,
      adjustment_receipts: 0,
    });
    expect(
      (
        await client.query(
          `SELECT count(*)::int count FROM pg_locks WHERE locktype='advisory' AND granted`
        )
      ).rows[0].count
    ).toBe(0);
    await client.end();
  });

  const command = (key: string) => ({
    organizationId: orgId,
    userId,
    title: 'FY2027 governed operating budget',
    description: 'Created from MyWork',
    periodStart: '2027-01-01',
    periodEnd: '2027-12-31',
    granularity: 'monthly' as const,
    currency: 'PLN',
    sourceKind: 'tool_session' as const,
    sourceToolSessionId: sourceId,
    idempotencyKey: key,
  });

  it('atomically registers the exact aggregate and cold provenance', async () => {
    const result = await registerBudget(command(`happy-${randomUUID()}`));
    expect(result).toMatchObject({ lineCount: 15, scenarioCount: 3, replay: false });
    const cold = (
      await client.query(
        `SELECT b.title,b.period_start,b.period_end,b.granularity,b.currency,
          b.source_tool_session_id,b.registration_request_sha256,
          count(DISTINCT bl.id)::int line_count,count(DISTINCT bs.id)::int scenario_count
         FROM budgets b
         JOIN budget_lines bl ON bl.budget_id=b.id
         JOIN budget_scenarios bs ON bs.budget_id=b.id
         WHERE b.organization_id=$1 AND b.id=$2
         GROUP BY b.id`,
        [orgId, result.budget.id]
      )
    ).rows[0];
    expect(cold).toMatchObject({
      title: 'FY2027 governed operating budget',
      period_start: '2027-01-01',
      period_end: '2027-12-31',
      granularity: 'monthly',
      currency: 'PLN',
      source_tool_session_id: sourceId,
      line_count: 15,
      scenario_count: 3,
    });
    expect(cold.registration_request_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('supports the mounted Budget Workspace manual source without inferred lineage', async () => {
    const result = await registerBudget({
      ...command(`manual-${randomUUID()}`),
      sourceKind: 'manual',
      sourceToolSessionId: undefined,
      title: 'Explicit manual budget',
    });
    expect(result.replay).toBe(false);
    expect(
      (
        await client.query(
          `SELECT source_tool_session_id FROM budgets WHERE organization_id=$1 AND id=$2`,
          [orgId, result.budget.id]
        )
      ).rows
    ).toEqual([{ source_tool_session_id: null }]);
  });

  it('converges eight concurrent retries and rejects a changed payload', async () => {
    const key = `concurrent-${randomUUID()}`;
    const before = await counts();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => registerBudget(command(key)))
    );
    expect(new Set(results.map((row) => row.budget.id))).toEqual(new Set([results[0].budget.id]));
    expect(results.filter((row) => !row.replay)).toHaveLength(1);
    expect(results.filter((row) => row.replay)).toHaveLength(7);
    const after = await counts();
    expect(Number(after.budgets) - Number(before.budgets)).toBe(1);
    expect(Number(after.lines) - Number(before.lines)).toBe(15);
    expect(Number(after.scenarios) - Number(before.scenarios)).toBe(3);
    expect(Number(after.receipts) - Number(before.receipts)).toBe(1);
    await expect(registerBudget({ ...command(key), title: 'Changed' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_PAYLOAD_COLLISION',
      status: 409,
    });
    await expect(
      client.query(
        `UPDATE finance_budget_registration_receipts SET request_sha256=request_sha256 WHERE organization_id=$1 AND idempotency_key=$2`,
        [orgId, key]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      client.query(
        `DELETE FROM finance_budget_registration_receipts WHERE organization_id=$1 AND idempotency_key=$2`,
        [orgId, key]
      )
    ).rejects.toThrow(/immutable/);
  });

  it('checks live authority before replaying a winning receipt', async () => {
    const key = `authority-${randomUUID()}`;
    const first = await registerBudget(command(key));
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    await expect(registerBudget(command(key))).rejects.toMatchObject({
      code: 'ORG_MEMBERSHIP_REVOKED',
      status: 403,
    });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE',role='MEMBER' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    await expect(registerBudget(command(key))).rejects.toMatchObject({
      code: 'FINANCE_EDIT_FORBIDDEN',
      status: 403,
    });
    await client.query(
      `UPDATE organization_members SET role='OWNER' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    expect(await registerBudget(command(key))).toEqual({ ...first, replay: true });
  });

  it('rejects foreign source and invalid periods with zero writes', async () => {
    const before = await counts();
    await expect(
      registerBudget({
        ...command(`foreign-${randomUUID()}`),
        sourceToolSessionId: foreignSourceId,
      })
    ).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND', status: 404 });
    await expect(
      registerBudget({ ...command(`period-${randomUUID()}`), periodEnd: '2027-01-01' })
    ).rejects.toMatchObject({ code: 'INVALID_BUDGET_PERIOD', status: 400 });
    expect(await counts()).toEqual(before);
  });

  it('rolls aggregate rows back when the immutable receipt cannot be inserted', async () => {
    const before = await counts();
    const fn = `reject_budget_receipt_${randomUUID().replaceAll('-', '')}`;
    const trg = `reject_budget_receipt_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected budget receipt failure'; END $$`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON finance_budget_registration_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      await expect(registerBudget(command(`rollback-${randomUUID()}`))).rejects.toThrow(
        /injected budget receipt failure/
      );
      expect(await counts()).toEqual(before);
    } finally {
      await client.query(`DROP TRIGGER ${trg} ON finance_budget_registration_receipts`);
      await client.query(`DROP FUNCTION ${fn}()`);
    }
  });

  it('updates one exact line, increments the parent version and replays byte-stably', async () => {
    const budget = await registerBudget(command(`line-happy-budget-${randomUUID()}`));
    const line = (
      await client.query(
        `SELECT id FROM budget_lines WHERE budget_id=$1 ORDER BY display_order LIMIT 1`,
        [budget.budget.id]
      )
    ).rows[0];
    const key = `line-happy-${randomUUID()}`;
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      lineId: line.id,
      expectedVersion: 1,
      idempotencyKey: key,
      patch: { baselineValue: '1234.50', isLocked: true },
    };
    const first = await applyBudgetLineCommand(input);
    expect(first).toMatchObject({ budgetVersion: 2, replay: false });
    expect(first.line).toMatchObject({ baselineValue: '1234.50', isLocked: true });
    expect(await applyBudgetLineCommand(input)).toEqual({ ...first, replay: true });
    const cold = (
      await client.query(
        `SELECT b.version,bl.baseline_value::text,bl.is_locked,
          (SELECT count(*)::int FROM finance_budget_line_command_receipts
            WHERE organization_id=$1 AND budget_id=$2) receipt_count
         FROM budgets b JOIN budget_lines bl ON bl.budget_id=b.id
         WHERE b.organization_id=$1 AND b.id=$2 AND bl.id=$3`,
        [orgId, budget.budget.id, line.id]
      )
    ).rows[0];
    expect(cold).toEqual({
      version: 2,
      baseline_value: '1234.50',
      is_locked: true,
      receipt_count: 1,
    });
    await expect(
      applyBudgetLineCommand({ ...input, patch: { baselineValue: '999' } })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    await expect(
      client.query(
        `UPDATE finance_budget_line_command_receipts
            SET request_sha256=request_sha256
          WHERE organization_id=$1 AND budget_id=$2 AND idempotency_key=$3`,
        [orgId, budget.budget.id, key]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      client.query(
        `DELETE FROM finance_budget_line_command_receipts
          WHERE organization_id=$1 AND budget_id=$2 AND idempotency_key=$3`,
        [orgId, budget.budget.id, key]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      applyBudgetLineCommand({
        ...input,
        idempotencyKey: `stale-${randomUUID()}`,
        patch: { baselineValue: '999' },
      })
    ).rejects.toMatchObject({ code: 'BUDGET_VERSION_CONFLICT', status: 409 });
  });

  it('converges eight line-command retries and checks live authority before replay', async () => {
    const budget = await registerBudget(command(`line-concurrent-budget-${randomUUID()}`));
    const line = (
      await client.query(
        `SELECT id FROM budget_lines WHERE budget_id=$1 ORDER BY display_order LIMIT 1`,
        [budget.budget.id]
      )
    ).rows[0];
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      lineId: line.id,
      expectedVersion: 1,
      idempotencyKey: `line-concurrent-${randomUUID()}`,
      patch: { source: 'manual' as const, driverFormula: 'revenue * 0.9' },
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => applyBudgetLineCommand(input))
    );
    expect(results.filter((row) => !row.replay)).toHaveLength(1);
    expect(results.filter((row) => row.replay)).toHaveLength(7);
    expect(new Set(results.map((row) => row.budgetVersion))).toEqual(new Set([2]));
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    await expect(applyBudgetLineCommand(input)).rejects.toMatchObject({
      code: 'ORG_MEMBERSHIP_REVOKED',
      status: 403,
    });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
  });

  it('rejects foreign line ownership and terminal budget mutation with zero line effect', async () => {
    const first = await registerBudget(command(`line-owner-a-${randomUUID()}`));
    const second = await registerBudget(command(`line-owner-b-${randomUUID()}`));
    const foreignLine = (
      await client.query(
        `SELECT id FROM budget_lines WHERE budget_id=$1 ORDER BY display_order LIMIT 1`,
        [second.budget.id]
      )
    ).rows[0];
    await expect(
      applyBudgetLineCommand({
        organizationId: orgId,
        userId,
        budgetId: first.budget.id,
        lineId: foreignLine.id,
        expectedVersion: 1,
        idempotencyKey: `foreign-line-${randomUUID()}`,
        patch: { baselineValue: '7' },
      })
    ).rejects.toMatchObject({ code: 'BUDGET_LINE_NOT_FOUND', status: 404 });
    await client.query(`UPDATE budgets SET status='APPROVED' WHERE id=$1`, [first.budget.id]);
    await expect(
      applyBudgetLineCommand({
        organizationId: orgId,
        userId,
        budgetId: first.budget.id,
        lineId: (
          await client.query(
            `SELECT id FROM budget_lines WHERE budget_id=$1 ORDER BY display_order LIMIT 1`,
            [first.budget.id]
          )
        ).rows[0].id,
        expectedVersion: 1,
        idempotencyKey: `terminal-line-${randomUUID()}`,
        patch: { baselineValue: '8' },
      })
    ).rejects.toMatchObject({ code: 'BUDGET_IMMUTABLE', status: 409 });
    expect(
      (
        await client.query(
          `SELECT count(*)::int count FROM finance_budget_line_command_receipts
            WHERE organization_id=$1 AND budget_id=$2`,
          [orgId, first.budget.id]
        )
      ).rows[0].count
    ).toBe(0);
  });

  it('rolls the line and parent version back when its receipt insert fails', async () => {
    const budget = await registerBudget(command(`line-rollback-budget-${randomUUID()}`));
    const line = (
      await client.query(
        `SELECT id,baseline_value::text FROM budget_lines
          WHERE budget_id=$1 ORDER BY display_order LIMIT 1`,
        [budget.budget.id]
      )
    ).rows[0];
    const fn = `reject_budget_line_receipt_${randomUUID().replaceAll('-', '')}`;
    const trg = `reject_budget_line_receipt_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected budget line receipt failure'; END $$`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON finance_budget_line_command_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      await expect(
        applyBudgetLineCommand({
          organizationId: orgId,
          userId,
          budgetId: budget.budget.id,
          lineId: line.id,
          expectedVersion: 1,
          idempotencyKey: `line-rollback-${randomUUID()}`,
          patch: { baselineValue: '77' },
        })
      ).rejects.toThrow(/injected budget line receipt failure/);
      expect(
        (
          await client.query(
            `SELECT b.version,bl.baseline_value::text FROM budgets b
              JOIN budget_lines bl ON bl.budget_id=b.id
             WHERE b.id=$1 AND bl.id=$2`,
            [budget.budget.id, line.id]
          )
        ).rows[0]
      ).toEqual({ version: 1, baseline_value: line.baseline_value });
    } finally {
      await client.query(`DROP TRIGGER ${trg} ON finance_budget_line_command_receipts`);
      await client.query(`DROP FUNCTION ${fn}()`);
    }
  });

  it('projects one exact scenario, increments the parent version and replays byte-stably', async () => {
    const budget = await registerBudget(command(`projection-happy-budget-${randomUUID()}`));
    const revenue = (
      await client.query(`SELECT id FROM budget_lines WHERE budget_id=$1 AND line_code='REVENUE'`, [
        budget.budget.id,
      ])
    ).rows[0];
    await applyBudgetLineCommand({
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      lineId: revenue.id,
      expectedVersion: 1,
      idempotencyKey: `projection-seed-${randomUUID()}`,
      patch: { baselineValue: '1200' },
    });
    const scenario = (
      await client.query(
        `SELECT id FROM budget_scenarios WHERE budget_id=$1 AND scenario_type='base'`,
        [budget.budget.id]
      )
    ).rows[0];
    const key = `projection-happy-${randomUUID()}`;
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      scenarioId: scenario.id,
      expectedVersion: 2,
      idempotencyKey: key,
    };
    const first = await projectBudgetScenario(input);
    expect(first).toMatchObject({ budgetVersion: 3, replay: false });
    expect(first.projectionSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.scenario.projections.periods).toHaveLength(12);
    expect(first.scenario.projections.lines.REVENUE['2027-01']).toBe(1200);
    expect(await projectBudgetScenario(input)).toEqual({ ...first, replay: true });
    const cold = (
      await client.query(
        `SELECT b.version,s.projections,s.summary_metrics,
          (SELECT count(*)::int FROM finance_budget_projection_command_receipts
            WHERE organization_id=$1 AND budget_id=$2) receipt_count
         FROM budgets b JOIN budget_scenarios s ON s.budget_id=b.id
         WHERE b.organization_id=$1 AND b.id=$2 AND s.id=$3`,
        [orgId, budget.budget.id, scenario.id]
      )
    ).rows[0];
    expect(cold.version).toBe(3);
    expect(cold.projections).toEqual(first.scenario.projections);
    expect(cold.summary_metrics).toEqual(first.scenario.summaryMetrics);
    expect(cold.receipt_count).toBe(1);
    await expect(
      projectBudgetScenario({ ...input, scenarioId: `${scenario.id}-changed` })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    await expect(
      client.query(
        `UPDATE finance_budget_projection_command_receipts
            SET projection_sha256=projection_sha256
          WHERE organization_id=$1 AND budget_id=$2 AND idempotency_key=$3`,
        [orgId, budget.budget.id, key]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      client.query(
        `DELETE FROM finance_budget_projection_command_receipts
          WHERE organization_id=$1 AND budget_id=$2 AND idempotency_key=$3`,
        [orgId, budget.budget.id, key]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      projectBudgetScenario({
        ...input,
        idempotencyKey: `projection-stale-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'BUDGET_VERSION_CONFLICT', status: 409 });
  });

  it('converges eight projection retries and checks live authority before replay', async () => {
    const budget = await registerBudget(command(`projection-concurrent-budget-${randomUUID()}`));
    const scenario = (
      await client.query(
        `SELECT id FROM budget_scenarios WHERE budget_id=$1 AND scenario_type='optimistic'`,
        [budget.budget.id]
      )
    ).rows[0];
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      scenarioId: scenario.id,
      expectedVersion: 1,
      idempotencyKey: `projection-concurrent-${randomUUID()}`,
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => projectBudgetScenario(input))
    );
    expect(results.filter((row) => !row.replay)).toHaveLength(1);
    expect(results.filter((row) => row.replay)).toHaveLength(7);
    expect(new Set(results.map((row) => row.projectionSha256))).toHaveLength(1);
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    await expect(projectBudgetScenario(input)).rejects.toMatchObject({
      code: 'ORG_MEMBERSHIP_REVOKED',
      status: 403,
    });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
  });

  it('rejects foreign scenario ownership and terminal budget projection with zero effect', async () => {
    const first = await registerBudget(command(`projection-owner-a-${randomUUID()}`));
    const second = await registerBudget(command(`projection-owner-b-${randomUUID()}`));
    const firstScenario = (
      await client.query(`SELECT id FROM budget_scenarios WHERE budget_id=$1 LIMIT 1`, [
        first.budget.id,
      ])
    ).rows[0];
    const foreignScenario = (
      await client.query(`SELECT id FROM budget_scenarios WHERE budget_id=$1 LIMIT 1`, [
        second.budget.id,
      ])
    ).rows[0];
    await expect(
      projectBudgetScenario({
        organizationId: orgId,
        userId,
        budgetId: first.budget.id,
        scenarioId: foreignScenario.id,
        expectedVersion: 1,
        idempotencyKey: `foreign-projection-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'BUDGET_SCENARIO_NOT_FOUND', status: 404 });
    await client.query(`UPDATE budgets SET status='APPROVED' WHERE id=$1`, [first.budget.id]);
    await expect(
      projectBudgetScenario({
        organizationId: orgId,
        userId,
        budgetId: first.budget.id,
        scenarioId: firstScenario.id,
        expectedVersion: 1,
        idempotencyKey: `terminal-projection-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'BUDGET_IMMUTABLE', status: 409 });
    expect(
      (
        await client.query(
          `SELECT count(*)::int count FROM finance_budget_projection_command_receipts
            WHERE organization_id=$1 AND budget_id=$2`,
          [orgId, first.budget.id]
        )
      ).rows[0].count
    ).toBe(0);
  });

  it('rolls projection JSON and parent version back when its receipt insert fails', async () => {
    const budget = await registerBudget(command(`projection-rollback-budget-${randomUUID()}`));
    const scenario = (
      await client.query(
        `SELECT id,projections,summary_metrics FROM budget_scenarios WHERE budget_id=$1 LIMIT 1`,
        [budget.budget.id]
      )
    ).rows[0];
    const fn = `reject_budget_projection_receipt_${randomUUID().replaceAll('-', '')}`;
    const trg = `reject_budget_projection_receipt_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected budget projection receipt failure'; END $$`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON finance_budget_projection_command_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      await expect(
        projectBudgetScenario({
          organizationId: orgId,
          userId,
          budgetId: budget.budget.id,
          scenarioId: scenario.id,
          expectedVersion: 1,
          idempotencyKey: `projection-rollback-${randomUUID()}`,
        })
      ).rejects.toThrow(/injected budget projection receipt failure/);
      expect(
        (
          await client.query(
            `SELECT b.version,s.projections,s.summary_metrics FROM budgets b
              JOIN budget_scenarios s ON s.budget_id=b.id
             WHERE b.id=$1 AND s.id=$2`,
            [budget.budget.id, scenario.id]
          )
        ).rows[0]
      ).toEqual({
        version: 1,
        projections: scenario.projections,
        summary_metrics: scenario.summary_metrics,
      });
    } finally {
      await client.query(`DROP TRIGGER ${trg} ON finance_budget_projection_command_receipts`);
      await client.query(`DROP FUNCTION ${fn}()`);
    }
  });

  it('updates one exact scenario adjustment aggregate and replays without stale projections', async () => {
    const budget = await registerBudget(command(`adjustment-happy-budget-${randomUUID()}`));
    const scenario = (
      await client.query(
        `SELECT id FROM budget_scenarios WHERE budget_id=$1 AND scenario_type='optimistic'`,
        [budget.budget.id]
      )
    ).rows[0];
    await client.query(
      `UPDATE budget_scenarios SET projections='{"periods":["stale"]}'::jsonb,
        summary_metrics='{"totalRevenue":1}'::jsonb WHERE id=$1`,
      [scenario.id]
    );
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      scenarioId: scenario.id,
      expectedVersion: 1,
      idempotencyKey: `adjustment-happy-${randomUUID()}`,
      adjustments: { revenueGrowth: 12.5, costReduction: 3 },
    };
    const first = await updateBudgetScenarioAdjustments(input);
    expect(first).toMatchObject({ budgetVersion: 2, replay: false });
    expect(first.adjustmentsSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await updateBudgetScenarioAdjustments(input)).toEqual({ ...first, replay: true });
    const cold = (
      await client.query(
        `SELECT b.version,s.adjustments,s.projections,s.summary_metrics,
          (SELECT count(*)::int FROM finance_budget_scenario_adjustment_command_receipts
            WHERE organization_id=$1 AND budget_id=$2) receipt_count
         FROM budgets b JOIN budget_scenarios s ON s.budget_id=b.id
         WHERE b.organization_id=$1 AND b.id=$2 AND s.id=$3`,
        [orgId, budget.budget.id, scenario.id]
      )
    ).rows[0];
    expect(cold).toMatchObject({
      version: 2,
      adjustments: input.adjustments,
      projections: {},
      summary_metrics: {},
      receipt_count: 1,
    });
    await expect(
      updateBudgetScenarioAdjustments({
        ...input,
        adjustments: { revenueGrowth: 99 },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    await expect(
      client.query(
        `DELETE FROM finance_budget_scenario_adjustment_command_receipts
          WHERE organization_id=$1 AND budget_id=$2 AND idempotency_key=$3`,
        [orgId, budget.budget.id, input.idempotencyKey]
      )
    ).rejects.toThrow(/immutable/);
  });

  it('converges adjustment retries, checks live authority and rolls back receipt failure', async () => {
    const budget = await registerBudget(command(`adjustment-concurrent-budget-${randomUUID()}`));
    const scenario = (
      await client.query(`SELECT id FROM budget_scenarios WHERE budget_id=$1 LIMIT 1`, [
        budget.budget.id,
      ])
    ).rows[0];
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      scenarioId: scenario.id,
      expectedVersion: 1,
      idempotencyKey: `adjustment-concurrent-${randomUUID()}`,
      adjustments: { revenueGrowth: 7 },
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => updateBudgetScenarioAdjustments(input))
    );
    expect(results.filter((row) => !row.replay)).toHaveLength(1);
    expect(results.filter((row) => row.replay)).toHaveLength(7);
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    await expect(updateBudgetScenarioAdjustments(input)).rejects.toMatchObject({
      code: 'ORG_MEMBERSHIP_REVOKED',
      status: 403,
    });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );

    const rollbackBudget = await registerBudget(
      command(`adjustment-rollback-budget-${randomUUID()}`)
    );
    const rollbackScenario = (
      await client.query(`SELECT id,adjustments FROM budget_scenarios WHERE budget_id=$1 LIMIT 1`, [
        rollbackBudget.budget.id,
      ])
    ).rows[0];
    const fn = `reject_budget_adjustment_receipt_${randomUUID().replaceAll('-', '')}`;
    const trg = `reject_budget_adjustment_receipt_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected budget adjustment receipt failure'; END $$`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON finance_budget_scenario_adjustment_command_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      await expect(
        updateBudgetScenarioAdjustments({
          ...input,
          budgetId: rollbackBudget.budget.id,
          scenarioId: rollbackScenario.id,
          idempotencyKey: `adjustment-rollback-${randomUUID()}`,
        })
      ).rejects.toThrow(/injected budget adjustment receipt failure/);
      expect(
        (
          await client.query(
            `SELECT b.version,s.adjustments FROM budgets b JOIN budget_scenarios s ON s.budget_id=b.id
             WHERE b.id=$1 AND s.id=$2`,
            [rollbackBudget.budget.id, rollbackScenario.id]
          )
        ).rows[0]
      ).toEqual({ version: 1, adjustments: rollbackScenario.adjustments });
    } finally {
      await client.query(
        `DROP TRIGGER ${trg} ON finance_budget_scenario_adjustment_command_receipts`
      );
      await client.query(`DROP FUNCTION ${fn}()`);
    }
  });
});
