import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
  const approverId = `user-budget-approver-${randomUUID()}`;
  const viewerId = `user-budget-viewer-${randomUUID()}`;
  const foreignUserId = `user-budget-foreign-${randomUUID()}`;
  const sourceId = `tool-budget-registration-${randomUUID()}`;
  const foreignSourceId = `tool-budget-registration-foreign-${randomUUID()}`;
  let client: Client;
  let registerBudget: typeof import('../budgetRegistrationService.js').registerBudget;
  let applyBudgetLineCommand: typeof import('../budgetLineCommandService.js').applyBudgetLineCommand;
  let projectBudgetScenario: typeof import('../budgetProjectionCommandService.js').projectBudgetScenario;
  let updateBudgetScenarioAdjustments: typeof import('../budgetProjectionCommandService.js').updateBudgetScenarioAdjustments;
  let approveBudgetCommand: typeof import('../budgetApprovalCommandService.js').approveBudgetCommand;
  let discardBudgetCommand: typeof import('../budgetDiscardCommandService.js').discardBudgetCommand;
  let importBudgetDocumentCommand: typeof import('../budgetDocumentImportCommandService.js').importBudgetDocumentCommand;
  let listBudgets: typeof import('../../../budgetingService.js').listBudgets;
  let getBudget: typeof import('../../../budgetingService.js').getBudget;

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
             WHERE organization_id=$1) adjustment_receipts,
          (SELECT count(*)::int FROM finance_budget_approval_command_receipts
             WHERE organization_id=$1) approval_receipts,
          (SELECT count(*)::int FROM finance_budget_document_import_receipts
             WHERE organization_id=$1) document_receipts,
          (SELECT count(*)::int FROM budget_snapshots WHERE budget_id IN
             (SELECT id FROM budgets WHERE organization_id=$1)) snapshots`,
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
    ({ approveBudgetCommand } = await import('../budgetApprovalCommandService.js'));
    ({ discardBudgetCommand } = await import('../budgetDiscardCommandService.js'));
    ({ importBudgetDocumentCommand } = await import('../budgetDocumentImportCommandService.js'));
    ({ listBudgets, getBudget } = await import('../../../budgetingService.js'));
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Budget registration'),($2,'Foreign budget registration')`,
      [orgId, foreignOrgId]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Budget','Owner','ADMIN'),
             ($4,$2,$5,'Budget','Approver','ADMIN'),
             ($6,$2,$7,'Budget','Viewer','USER'),
             ($8,$9,$10,'Budget','Foreign','ADMIN')`,
      [
        userId,
        orgId,
        `${userId}@test.local`,
        approverId,
        `${approverId}@test.local`,
        viewerId,
        `${viewerId}@test.local`,
        foreignUserId,
        foreignOrgId,
        `${foreignUserId}@test.local`,
      ]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgId, userId]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
      [randomUUID(), orgId, approverId]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'MEMBER','ACTIVE',now()),($4,$5,$6,'ADMIN','ACTIVE',now())`,
      [randomUUID(), orgId, viewerId, randomUUID(), foreignOrgId, foreignUserId]
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
        `DELETE FROM finance_budget_document_import_receipts WHERE organization_id=$1`,
        [orgId]
      );
      await client.query(
        `DELETE FROM finance_budget_discard_command_receipts WHERE organization_id=$1`,
        [orgId]
      );
      await client.query(
        `DELETE FROM finance_budget_approval_command_receipts WHERE organization_id=$1`,
        [orgId]
      );
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
        `DELETE FROM budget_snapshots WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id=$1)`,
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
      await client.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
        orgId,
        foreignOrgId,
      ]);
      await client.query(`DELETE FROM users WHERE id IN ($1,$2,$3,$4)`, [
        userId,
        approverId,
        viewerId,
        foreignUserId,
      ]);
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
      approval_receipts: 0,
      document_receipts: 0,
      snapshots: 0,
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

  it('approves a fully projected budget with maker-checker, exact snapshot and replay', async () => {
    const budget = await registerBudget(command(`approval-happy-budget-${randomUUID()}`));
    const scenarios = (
      await client.query(`SELECT id FROM budget_scenarios WHERE budget_id=$1 ORDER BY id`, [
        budget.budget.id,
      ])
    ).rows;
    let currentVersion = 1;
    for (const scenario of scenarios) {
      const projection = await projectBudgetScenario({
        organizationId: orgId,
        userId,
        budgetId: budget.budget.id,
        scenarioId: scenario.id,
        expectedVersion: currentVersion,
        idempotencyKey: `approval-projection-${scenario.id}-${randomUUID()}`,
      });
      currentVersion = projection.budgetVersion;
    }
    const input = {
      organizationId: orgId,
      userId: approverId,
      budgetId: budget.budget.id,
      expectedVersion: currentVersion,
      idempotencyKey: `approval-happy-${randomUUID()}`,
    };
    const first = await approveBudgetCommand(input);
    expect(first).toMatchObject({
      status: 'APPROVED',
      budgetVersion: currentVersion + 1,
      approvedBy: approverId,
      replay: false,
    });
    expect(first.snapshotSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await approveBudgetCommand(input)).toEqual({ ...first, replay: true });
    const cold = (
      await client.query(
        `SELECT b.status,b.version,b.approved_by,s.snapshot_data,
          r.snapshot_sha256,r.response_json,
          (SELECT count(*)::int FROM budget_snapshots WHERE budget_id=b.id) snapshot_count
         FROM budgets b
         JOIN finance_budget_approval_command_receipts r
           ON r.budget_id=b.id AND r.organization_id=b.organization_id
         JOIN budget_snapshots s ON s.id=r.snapshot_id AND s.budget_id=b.id
         WHERE b.organization_id=$1 AND b.id=$2`,
        [orgId, budget.budget.id]
      )
    ).rows[0];
    expect(cold).toMatchObject({
      status: 'APPROVED',
      version: currentVersion + 1,
      approved_by: approverId,
      snapshot_sha256: first.snapshotSha256,
      snapshot_count: 1,
    });
    expect(cold.snapshot_data.lines).toHaveLength(15);
    expect(cold.snapshot_data.scenarios).toHaveLength(3);
    await expect(
      client.query(
        `UPDATE finance_budget_approval_command_receipts SET snapshot_sha256=snapshot_sha256
          WHERE organization_id=$1 AND budget_id=$2`,
        [orgId, budget.budget.id]
      )
    ).rejects.toThrow(/immutable/);
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, approverId]
    );
    await expect(approveBudgetCommand(input)).rejects.toMatchObject({
      code: 'ORG_MEMBERSHIP_REVOKED',
      status: 403,
    });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, approverId]
    );
  });

  it('rejects self approval and rolls snapshot/status back when receipt insertion fails', async () => {
    const budget = await registerBudget(command(`approval-negative-budget-${randomUUID()}`));
    const scenarios = (
      await client.query(`SELECT id FROM budget_scenarios WHERE budget_id=$1 ORDER BY id`, [
        budget.budget.id,
      ])
    ).rows;
    let currentVersion = 1;
    for (const scenario of scenarios) {
      currentVersion = (
        await projectBudgetScenario({
          organizationId: orgId,
          userId,
          budgetId: budget.budget.id,
          scenarioId: scenario.id,
          expectedVersion: currentVersion,
          idempotencyKey: `approval-negative-projection-${scenario.id}-${randomUUID()}`,
        })
      ).budgetVersion;
    }
    await expect(
      approveBudgetCommand({
        organizationId: orgId,
        userId,
        budgetId: budget.budget.id,
        expectedVersion: currentVersion,
        idempotencyKey: `approval-self-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'SELF_APPROVAL_FORBIDDEN', status: 403 });

    const fn = `reject_budget_approval_receipt_${randomUUID().replaceAll('-', '')}`;
    const trg = `reject_budget_approval_receipt_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected budget approval receipt failure'; END $$`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON finance_budget_approval_command_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      await expect(
        approveBudgetCommand({
          organizationId: orgId,
          userId: approverId,
          budgetId: budget.budget.id,
          expectedVersion: currentVersion,
          idempotencyKey: `approval-rollback-${randomUUID()}`,
        })
      ).rejects.toThrow(/injected budget approval receipt failure/);
      expect(
        (
          await client.query(
            `SELECT status,version,
              (SELECT count(*)::int FROM budget_snapshots WHERE budget_id=$1) snapshot_count
             FROM budgets WHERE id=$1`,
            [budget.budget.id]
          )
        ).rows[0]
      ).toEqual({ status: 'DRAFT', version: currentVersion, snapshot_count: 0 });
    } finally {
      await client.query(`DROP TRIGGER ${trg} ON finance_budget_approval_command_receipts`);
      await client.query(`DROP FUNCTION ${fn}()`);
    }
  });

  it('soft-discards one DRAFT budget, preserves its graph and replays exactly', async () => {
    const budget = await registerBudget(command(`discard-happy-${randomUUID()}`));
    await client.query(
      `INSERT INTO budget_snapshots(id,budget_id,version,snapshot_data) VALUES($1,$2,1,'{}')`,
      [`snapshot-${randomUUID()}`, budget.budget.id]
    );
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      expectedVersion: 1,
      idempotencyKey: `discard-${randomUUID()}`,
      reason: 'Superseded planning draft',
    };
    const first = await discardBudgetCommand(input);
    expect(first).toMatchObject({ status: 'ARCHIVED', budgetVersion: 2, replay: false });
    expect(await discardBudgetCommand(input)).toEqual({ ...first, replay: true });
    const cold = (
      await client.query(
        `SELECT b.status,b.version,(SELECT count(*)::int FROM budget_lines WHERE budget_id=b.id) lines,(SELECT count(*)::int FROM budget_scenarios WHERE budget_id=b.id) scenarios,(SELECT count(*)::int FROM budget_snapshots WHERE budget_id=b.id) snapshots,(SELECT count(*)::int FROM finance_budget_registration_receipts WHERE budget_id=b.id) registrations,(SELECT count(*)::int FROM finance_budget_discard_command_receipts WHERE budget_id=b.id) discards FROM budgets b WHERE b.id=$1`,
        [budget.budget.id]
      )
    ).rows[0];
    expect(cold).toEqual({
      status: 'ARCHIVED',
      version: 2,
      lines: 15,
      scenarios: 3,
      snapshots: 1,
      registrations: 1,
      discards: 1,
    });
    await expect(
      client.query(
        `UPDATE finance_budget_discard_command_receipts SET reason=reason WHERE budget_id=$1`,
        [budget.budget.id]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      client.query(`DELETE FROM finance_budget_discard_command_receipts WHERE budget_id=$1`, [
        budget.budget.id,
      ])
    ).rejects.toThrow(/immutable/);
    await expect(
      client.query(`UPDATE budgets SET title=title WHERE id=$1`, [budget.budget.id])
    ).rejects.toThrow(/archived budget is immutable/);
    await expect(
      client.query(`UPDATE budget_lines SET line_name=line_name WHERE budget_id=$1`, [
        budget.budget.id,
      ])
    ).rejects.toThrow(/archived budget aggregate is immutable/);
    await expect(
      client.query(`DELETE FROM budget_scenarios WHERE budget_id=$1`, [budget.budget.id])
    ).rejects.toThrow(/archived budget aggregate is immutable/);
    await expect(
      client.query(
        `INSERT INTO budget_lines(id,budget_id,line_code,line_name,statement_type,source) VALUES($1,$2,'X','X','P&L','manual')`,
        [`line-${randomUUID()}`, budget.budget.id]
      )
    ).rejects.toThrow(/archived budget aggregate is immutable/);
    await expect(
      client.query(
        `INSERT INTO budget_scenarios(id,budget_id,scenario_type,name) VALUES($1,$2,'base','Late')`,
        [`scenario-${randomUUID()}`, budget.budget.id]
      )
    ).rejects.toThrow(/archived budget aggregate is immutable/);
    await expect(
      client.query(
        `INSERT INTO budget_snapshots(id,budget_id,version,snapshot_data) VALUES($1,$2,99,'{}')`,
        [`snapshot-${randomUUID()}`, budget.budget.id]
      )
    ).rejects.toThrow(/archived budget aggregate is immutable/);
    await expect(
      client.query(
        `INSERT INTO budget_initiative_links(id,budget_id,initiative_id,organization_id) VALUES($1,$2,$3,$4)`,
        [`link-${randomUUID()}`, budget.budget.id, `missing-${randomUUID()}`, orgId]
      )
    ).rejects.toThrow(/archived budget aggregate is immutable/);

    const active = await registerBudget(command(`discard-move-source-${randomUUID()}`));
    const activeLine = (
      await client.query(`SELECT id FROM budget_lines WHERE budget_id=$1 LIMIT 1`, [
        active.budget.id,
      ])
    ).rows[0].id;
    await expect(
      client.query(`UPDATE budget_lines SET budget_id=$1 WHERE id=$2`, [
        budget.budget.id,
        activeLine,
      ])
    ).rejects.toThrow(/archived budget aggregate is immutable/);

    expect((await listBudgets(orgId)).some((item) => item.id === budget.budget.id)).toBe(false);
    expect(await getBudget(orgId, budget.budget.id)).toBeNull();
  });

  it('enforces authority and tenant scope before replay', async () => {
    const budget = await registerBudget(command(`discard-authority-${randomUUID()}`));
    const key = `discard-authority-${randomUUID()}`;
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      expectedVersion: 1,
      idempotencyKey: key,
      reason: 'Authority test',
    };
    const first = await discardBudgetCommand(input);
    expect(first.replay).toBe(false);
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    try {
      await expect(discardBudgetCommand(input)).rejects.toMatchObject({
        code: 'ORG_MEMBERSHIP_REVOKED',
        status: 403,
      });
    } finally {
      await client.query(
        `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
        [orgId, userId]
      );
    }
    await expect(discardBudgetCommand({ ...input, userId: viewerId })).rejects.toMatchObject({
      code: 'FINANCE_EDIT_FORBIDDEN',
      status: 403,
    });
    await expect(
      discardBudgetCommand({
        ...input,
        organizationId: foreignOrgId,
        userId: foreignUserId,
        idempotencyKey: `foreign-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'BUDGET_NOT_FOUND', status: 404 });
  });

  it('converges concurrent discard retries and rejects a changed payload', async () => {
    const budget = await registerBudget(command(`discard-concurrent-${randomUUID()}`));
    const key = `discard-concurrent-${randomUUID()}`;
    const input = {
      organizationId: orgId,
      userId,
      budgetId: budget.budget.id,
      expectedVersion: 1,
      idempotencyKey: key,
      reason: 'Concurrent discard',
    };
    const results = await Promise.all(Array.from({ length: 8 }, () => discardBudgetCommand(input)));
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    expect(results.filter((result) => result.replay)).toHaveLength(7);
    expect(
      (
        await client.query(
          `SELECT count(*)::int count FROM finance_budget_discard_command_receipts WHERE organization_id=$1 AND budget_id=$2`,
          [orgId, budget.budget.id]
        )
      ).rows[0].count
    ).toBe(1);
    await expect(
      discardBudgetCommand({ ...input, reason: 'Changed payload' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
  });

  it('fails closed for stale and APPROVED budgets and rolls archive back on receipt failure', async () => {
    const stale = await registerBudget(command(`discard-stale-${randomUUID()}`));
    await expect(
      discardBudgetCommand({
        organizationId: orgId,
        userId,
        budgetId: stale.budget.id,
        expectedVersion: 2,
        idempotencyKey: `discard-stale-${randomUUID()}`,
        reason: 'stale',
      })
    ).rejects.toMatchObject({ code: 'BUDGET_VERSION_CONFLICT', status: 409 });
    const approved = await registerBudget(command(`discard-approved-${randomUUID()}`));
    await client.query(`UPDATE budgets SET status='APPROVED' WHERE id=$1`, [approved.budget.id]);
    await expect(
      discardBudgetCommand({
        organizationId: orgId,
        userId,
        budgetId: approved.budget.id,
        expectedVersion: 1,
        idempotencyKey: `discard-approved-${randomUUID()}`,
        reason: 'no',
      })
    ).rejects.toMatchObject({ code: 'APPROVED_BUDGET_ARCHIVE_FORBIDDEN', status: 409 });
    const rollback = await registerBudget(command(`discard-rollback-${randomUUID()}`));
    const fn = `reject_budget_discard_${randomUUID().replaceAll('-', '')}`,
      trg = `reject_budget_discard_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected budget discard receipt failure'; END $$`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON finance_budget_discard_command_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      await expect(
        discardBudgetCommand({
          organizationId: orgId,
          userId,
          budgetId: rollback.budget.id,
          expectedVersion: 1,
          idempotencyKey: `discard-rollback-${randomUUID()}`,
          reason: 'rollback',
        })
      ).rejects.toThrow(/injected budget discard/);
      expect(
        (await client.query(`SELECT status,version FROM budgets WHERE id=$1`, [rollback.budget.id]))
          .rows[0]
      ).toEqual({ status: 'DRAFT', version: 1 });
    } finally {
      await client.query(`DROP TRIGGER ${trg} ON finance_budget_discard_command_receipts`);
      await client.query(`DROP FUNCTION ${fn}()`);
    }
  });

  const documentImport = (
    budgetId: string,
    expectedVersion: number,
    key: string,
    overrides: Partial<Parameters<typeof importBudgetDocumentCommand>[0]> = {}
  ) => ({
    organizationId: orgId,
    userId,
    budgetId,
    expectedVersion,
    idempotencyKey: key,
    sourceFileName: 'budzet.csv',
    sourceMimeType: 'text/csv',
    sourceFileSize: 42,
    sourceFileSha256: 'a'.repeat(64),
    documentText: 'Przychody;1 234,50\nKoszty operacyjne;234,50\nInna pozycja;99,00',
    ...overrides,
  });

  it('atomically replaces canonical values with locale parsing, diagnostics and immutable provenance', async () => {
    const budget = await registerBudget(command(`document-happy-${randomUUID()}`));
    const result = await importBudgetDocumentCommand(
      documentImport(budget.budget.id, 1, `document-happy-${randomUUID()}`)
    );
    expect(result).toMatchObject({ budgetVersion: 2, linesImported: 2, replay: false });
    expect(result.unappliedDiagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'UNSUPPORTED_ROW' })])
    );
    expect(
      (
        await client.query(
          `SELECT line_code,baseline_value::text value,source FROM budget_lines WHERE budget_id=$1 AND line_code IN ('REVENUE','OPEX') ORDER BY line_code`,
          [budget.budget.id]
        )
      ).rows
    ).toEqual([
      { line_code: 'OPEX', value: '234.5', source: 'baseline' },
      { line_code: 'REVENUE', value: '1234.5', source: 'baseline' },
    ]);
    const receipt = (
      await client.query(
        `SELECT source_file_name,source_file_sha256,imported_by FROM finance_budget_document_import_receipts WHERE budget_id=$1`,
        [budget.budget.id]
      )
    ).rows[0];
    expect(receipt).toEqual({
      source_file_name: 'budzet.csv',
      source_file_sha256: 'a'.repeat(64),
      imported_by: userId,
    });
    await expect(
      client.query(
        `UPDATE finance_budget_document_import_receipts SET source_file_name='tampered.csv' WHERE budget_id=$1`,
        [budget.budget.id]
      )
    ).rejects.toThrow(/immutable/);
    await expect(
      client.query(`DELETE FROM finance_budget_document_import_receipts WHERE budget_id=$1`, [
        budget.budget.id,
      ])
    ).rejects.toThrow(/immutable/);
  });

  it('authorizes before replay and rejects revoked, wrong-role and cross-tenant callers', async () => {
    const budget = await registerBudget(command(`document-auth-${randomUUID()}`));
    const input = documentImport(budget.budget.id, 1, `document-auth-${randomUUID()}`);
    await importBudgetDocumentCommand(input);
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    await expect(importBudgetDocumentCommand(input)).rejects.toMatchObject({
      code: 'ORG_MEMBERSHIP_REVOKED',
    });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    await expect(importBudgetDocumentCommand({ ...input, userId: viewerId })).rejects.toMatchObject(
      { code: 'FINANCE_EDIT_FORBIDDEN' }
    );
    await expect(
      importBudgetDocumentCommand({
        ...input,
        organizationId: foreignOrgId,
        userId: foreignUserId,
        idempotencyKey: `document-foreign-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'BUDGET_NOT_FOUND' });
  });

  it('fails the whole command for locked or stale aggregates without partial writes', async () => {
    const budget = await registerBudget(command(`document-locked-${randomUUID()}`));
    await client.query(
      `UPDATE budget_lines SET is_locked=true WHERE budget_id=$1 AND line_code='OPEX'`,
      [budget.budget.id]
    );
    await expect(
      importBudgetDocumentCommand(
        documentImport(budget.budget.id, 1, `document-locked-${randomUUID()}`)
      )
    ).rejects.toMatchObject({ code: 'BUDGET_LINE_LOCKED' });
    expect(
      (
        await client.query(
          `SELECT count(*)::int count FROM budget_lines WHERE budget_id=$1 AND baseline_value<>0`,
          [budget.budget.id]
        )
      ).rows[0].count
    ).toBe(0);
    await expect(
      importBudgetDocumentCommand(
        documentImport(budget.budget.id, 2, `document-stale-${randomUUID()}`, {
          documentText: 'Przychody;100',
        })
      )
    ).rejects.toMatchObject({ code: 'BUDGET_VERSION_CONFLICT' });
  });

  it('provides exact replay/collision and concurrency exactly-one semantics', async () => {
    const budget = await registerBudget(command(`document-replay-${randomUUID()}`));
    const input = documentImport(budget.budget.id, 1, `document-replay-${randomUUID()}`, {
      documentText: 'Przychody;100',
    });
    expect((await importBudgetDocumentCommand(input)).replay).toBe(false);
    expect((await importBudgetDocumentCommand(input)).replay).toBe(true);
    await expect(
      importBudgetDocumentCommand({ ...input, sourceFileSha256: 'b'.repeat(64) })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION' });

    const concurrent = await registerBudget(command(`document-concurrent-${randomUUID()}`));
    const settled = await Promise.allSettled([
      importBudgetDocumentCommand(
        documentImport(concurrent.budget.id, 1, `document-concurrent-a-${randomUUID()}`, {
          documentText: 'Przychody;100',
        })
      ),
      importBudgetDocumentCommand(
        documentImport(concurrent.budget.id, 1, `document-concurrent-b-${randomUUID()}`, {
          documentText: 'Przychody;200',
          sourceFileSha256: 'c'.repeat(64),
        })
      ),
    ]);
    expect(settled.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((entry) => entry.status === 'rejected')).toHaveLength(1);
    expect(
      (
        await client.query(
          `SELECT count(*)::int count FROM finance_budget_document_import_receipts WHERE budget_id=$1`,
          [concurrent.budget.id]
        )
      ).rows[0].count
    ).toBe(1);
  });

  it('rolls back all line and version changes when receipt persistence fails', async () => {
    const budget = await registerBudget(command(`document-rollback-${randomUUID()}`));
    const fn = `reject_budget_document_${randomUUID().replaceAll('-', '')}`;
    const trg = `reject_budget_document_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected document receipt failure'; END $$`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON finance_budget_document_import_receipts FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      await expect(
        importBudgetDocumentCommand(
          documentImport(budget.budget.id, 1, `document-rollback-${randomUUID()}`, {
            documentText: 'Przychody;100',
          })
        )
      ).rejects.toThrow(/injected document receipt/);
      expect(
        (
          await client.query(
            `SELECT b.version,l.baseline_value::text value FROM budgets b JOIN budget_lines l ON l.budget_id=b.id AND l.line_code='REVENUE' WHERE b.id=$1`,
            [budget.budget.id]
          )
        ).rows[0]
      ).toEqual({ version: 1, value: '0' });
    } finally {
      await client.query(`DROP TRIGGER ${trg} ON finance_budget_document_import_receipts`);
      await client.query(`DROP FUNCTION ${fn}()`);
    }
  });

  it('migration fails closed before DDL on an occupied partial receipt identity', async () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'server/migrations/20261055_finance_budget_document_import_command.sql'
      ),
      'utf8'
    );
    await client.query('BEGIN');
    try {
      await client.query(`DROP TABLE finance_budget_document_import_receipts CASCADE`);
      await client.query(`DROP FUNCTION finance_budget_document_import_receipt_immutable()`);
      await client.query(
        `CREATE TABLE finance_budget_document_import_receipts(hostile_marker TEXT NOT NULL)`
      );
      await expect(client.query(migration)).rejects.toThrow(
        /ECO-W39 owned migration identity already exists/
      );
    } finally {
      await client.query('ROLLBACK');
    }
    expect(
      (
        await client.query(
          `SELECT count(*)::int count FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_budget_document_import_receipts'`
        )
      ).rows[0].count
    ).toBeGreaterThan(1);
  });

  it('DatabaseInitializer boot fails hostile W39 and never blesses its ledger row', async () => {
    const { discoverTablePlatformMigrationFiles, initializeDatabase } =
      await import('../../../../database/DatabaseInitializer.js');
    const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
    const target = '20261055_finance_budget_document_import_command.sql';
    const migration = fs.readFileSync(path.join(migrationsDir, target), 'utf8');
    await client.query(`CREATE TABLE IF NOT EXISTS tp_migration_history (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE, executed_at TIMESTAMPTZ NOT NULL DEFAULT now(), checksum TEXT, duration_ms INTEGER
    )`);
    const existing = new Set(
      (await client.query(`SELECT filename FROM tp_migration_history`)).rows.map(
        (row) => row.filename as string
      )
    );
    const added = discoverTablePlatformMigrationFiles(migrationsDir).filter(
      (filename) => filename !== target && !existing.has(filename)
    );
    for (const filename of added) {
      await client.query(
        `INSERT INTO tp_migration_history(filename,duration_ms) VALUES($1,0) ON CONFLICT DO NOTHING`,
        [filename]
      );
    }
    try {
      await client.query(`DROP TABLE finance_budget_document_import_receipts CASCADE`);
      await client.query(`DROP FUNCTION finance_budget_document_import_receipt_immutable()`);
      await client.query(
        `CREATE TABLE finance_budget_document_import_receipts(hostile_marker TEXT NOT NULL)`
      );
      const priorSkip = process.env.POSTGRES_SKIP_INIT_IN_TEST;
      delete process.env.POSTGRES_SKIP_INIT_IN_TEST;
      try {
        const boot = await initializeDatabase();
        expect(boot.success).toBe(false);
        expect(boot.message).toMatch(
          /Table Platform migration 20261055_finance_budget_document_import_command\.sql failed: ECO-W39 owned migration identity already exists/
        );
      } finally {
        if (priorSkip === undefined) delete process.env.POSTGRES_SKIP_INIT_IN_TEST;
        else process.env.POSTGRES_SKIP_INIT_IN_TEST = priorSkip;
      }
      expect(
        (
          await client.query(
            `SELECT count(*)::int count FROM tp_migration_history WHERE filename=$1`,
            [target]
          )
        ).rows[0].count
      ).toBe(0);
      expect(
        (
          await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_budget_document_import_receipts'`
          )
        ).rows
      ).toEqual([{ column_name: 'hostile_marker' }]);
    } finally {
      await client.query(`DROP TABLE IF EXISTS finance_budget_document_import_receipts CASCADE`);
      await client.query(
        `DROP FUNCTION IF EXISTS finance_budget_document_import_receipt_immutable()`
      );
      await client.query(migration);
      if (added.length > 0)
        await client.query(`DELETE FROM tp_migration_history WHERE filename=ANY($1::text[])`, [
          added,
        ]);
    }
  });
});
