import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDefinitionRemediationWork } from '../../../server/src/domain/initiatives-execution/createDefinitionRemediationWork';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { resolveDefinitionRemediationWork } from '../../../server/src/domain/initiatives-execution/resolveDefinitionRemediationWork';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Definition remediation Task and Decision realDB', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);

  beforeAll(async () => {
    for (const migrationName of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ]) {
      await pool.query(await readFile(path.resolve('server/migrations', migrationName), 'utf8'));
    }
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_delivery_receipts, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO ie_aggregate_state
      (organization_id, aggregate_type, aggregate_id, version, payload_json)
      VALUES ('org-work','initiative','initiative-work-1',1,
        '{"initiativeId":"initiative-work-1","projectId":"project-work","lifecycleState":"REGISTERED_DRAFT"}'::jsonb)`);
  });

  const envelope = {
    organizationId: 'org-work',
    actorId: 'initiative-owner',
    aggregateType: 'initiative',
    aggregateId: 'initiative-work-1',
    expectedVersion: 1,
    clientRequestId: 'definition-remediation-1',
    correlationId: 'definition-remediation-correlation-1',
    policyId: 'standard-industrial',
    policyVersion: 3,
    commandType: 'initiative.definition-remediation.create',
    payload: {
      findingId: 'definition:financial-analysis:EVIDENCE_REQUIRED',
      financeTask: {
        taskId: 'task-finance-evidence-1',
        title: 'Provide reconciled Finance evidence',
        assigneeId: 'finance-owner',
        dueAt: '2026-08-20T12:00:00.000Z',
      },
      technicalDecision: {
        decisionId: 'decision-technical-option-1',
        title: 'Select technical option',
        authorityId: 'technical-authority',
        dueAt: '2026-08-21T12:00:00.000Z',
        options: ['Do nothing', 'SMED automation'],
      },
    },
  };

  it('atomically creates same-ID Task and Decision, links both and replays once', async () => {
    const first = await createDefinitionRemediationWork(unitOfWork, envelope);
    const replay = await createDefinitionRemediationWork(unitOfWork, envelope);
    expect(first.response).toEqual({
      initiativeId: 'initiative-work-1',
      findingId: envelope.payload.findingId,
      taskId: envelope.payload.financeTask.taskId,
      decisionId: envelope.payload.technicalDecision.decisionId,
    });
    expect(replay).toEqual({ ...first, status: 'REPLAYED' });
    const aggregates = await pool.query(
      `SELECT aggregate_type, aggregate_id FROM ie_aggregate_state
        WHERE organization_id = 'org-work' ORDER BY aggregate_type, aggregate_id`
    );
    expect(aggregates.rows).toEqual([
      { aggregate_type: 'decision', aggregate_id: 'decision-technical-option-1' },
      { aggregate_type: 'initiative', aggregate_id: 'initiative-work-1' },
      { aggregate_type: 'task', aggregate_id: 'task-finance-evidence-1' },
    ]);
    expect((await pool.query('SELECT 1 FROM ie_aggregate_relations')).rowCount).toBe(2);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_outbox_events')).rowCount).toBe(1);
  });

  it('allows only accountable actors to complete evidence and select a listed option', async () => {
    await createDefinitionRemediationWork(unitOfWork, envelope);
    await expect(
      resolveDefinitionRemediationWork(unitOfWork, {
        organizationId: 'org-work',
        actorId: 'wrong-user',
        aggregateType: 'task',
        aggregateId: envelope.payload.financeTask.taskId,
        expectedVersion: 1,
        clientRequestId: 'resolve-finance-unauthorized',
        correlationId: 'resolve-finance-unauthorized-correlation',
        policyId: 'standard-industrial',
        policyVersion: 3,
        commandType: 'initiative.definition-remediation.resolve',
        payload: { workType: 'FINANCE_EVIDENCE', evidenceRefs: ['finance:reconciliation:v1'] },
      })
    ).rejects.toThrow('Only the Task assignee');

    const completed = await resolveDefinitionRemediationWork(unitOfWork, {
      organizationId: 'org-work',
      actorId: 'finance-owner',
      aggregateType: 'task',
      aggregateId: envelope.payload.financeTask.taskId,
      expectedVersion: 1,
      clientRequestId: 'resolve-finance-1',
      correlationId: 'resolve-finance-correlation-1',
      policyId: 'standard-industrial',
      policyVersion: 3,
      commandType: 'initiative.definition-remediation.resolve',
      payload: { workType: 'FINANCE_EVIDENCE', evidenceRefs: ['finance:reconciliation:v1'] },
    });
    const decided = await resolveDefinitionRemediationWork(unitOfWork, {
      organizationId: 'org-work',
      actorId: 'technical-authority',
      aggregateType: 'decision',
      aggregateId: envelope.payload.technicalDecision.decisionId,
      expectedVersion: 1,
      clientRequestId: 'resolve-technical-1',
      correlationId: 'resolve-technical-correlation-1',
      policyId: 'standard-industrial',
      policyVersion: 3,
      commandType: 'initiative.definition-remediation.resolve',
      payload: {
        workType: 'TECHNICAL_OPTION',
        selectedOption: 'SMED automation',
        rationale: 'Best balance of risk and delivery value.',
      },
    });
    expect(completed.response.status).toBe('COMPLETED');
    expect(decided.response.status).toBe('DECIDED');
    expect(
      await pool.query(
        `SELECT aggregate_type, payload_json->>'status' status FROM ie_aggregate_state
          WHERE organization_id = 'org-work' AND aggregate_type IN ('task','decision')
          ORDER BY aggregate_type`
      )
    ).toMatchObject({
      rows: [
        { aggregate_type: 'decision', status: 'DECIDED' },
        { aggregate_type: 'task', status: 'COMPLETED' },
      ],
    });
  });

  afterAll(async () => pool.end());
});
