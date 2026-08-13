import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  mutateCapacityScenario,
  type CapacityScenario,
} from '../../../server/src/domain/initiatives-execution/capacityScenario';
import {
  acceptResourceCommitment,
  decideResourceCommitment,
  requestResourceCommitment,
} from '../../../server/src/domain/initiatives-execution/resourceCommitment';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Capacity Scenario and Resource Commitment realDB', () => {
  const pool = new Pool({ connectionString: url, max: 3 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie061',
    id = 'capacity-ie061',
    initiativeId = 'initiative-ie061';
  const known = {
    knowledgeState: 'ESTIMATED' as const,
    low: 1,
    base: 2,
    high: 3,
    sourceRef: 'resource-plan:1',
    sourceVersion: 1,
    asOf: '2026-08-09T20:00:00Z',
    confidence: 'LOW' as const,
    ownerId: 'rm',
    reason: null,
  };
  const scenario: CapacityScenario = {
    scenarioId: id,
    scenarioVersion: 0,
    status: 'DRAFT',
    planScenarioId: 'plan-ie061',
    planScenarioVersion: 1,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      {
        periodId: 'w1',
        start: '2026-10-01T00:00:00Z',
        end: '2026-10-08T00:00:00Z',
        demand: known,
        supply: {
          ...known,
          knowledgeState: 'UNKNOWN',
          low: null,
          base: null,
          high: null,
          sourceRef: null,
          sourceVersion: null,
          confidence: 'UNKNOWN',
          reason: 'Non-project load unknown',
        },
      },
    ],
    constraints: [
      {
        constraintId: 'controls',
        state: 'UNCONFIRMED',
        detail: 'Engineer acceptance pending',
        ownerId: 'rm',
      },
    ],
    proposedAssignments: [
      {
        assignmentId: 'a1',
        initiativeId,
        resourceOrRoleId: 'controls-engineer',
        periodIds: ['w1'],
        demand: known,
        rationale: 'Critical skill',
      },
    ],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  };
  const env = (
    type: string,
    aggregateId: string,
    actor: string,
    version: number,
    key: string,
    commandType: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: type,
    aggregateId,
    expectedVersion: version,
    clientRequestId: key,
    correlationId: key,
    policyId: 'standard',
    policyVersion: 1,
    commandType,
    createIfMissing: create,
    payload,
  });
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', f), 'utf8'));
  });
  beforeEach(async () => {
    for (const t of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'plan_scenario','plan-ie061',1,$2::jsonb),($1,'initiative',$3,8,$4::jsonb),($1,'portfolio_scenario','portfolio-list-ie061',1,$5::jsonb)`,
      [
        org,
        JSON.stringify({
          scenarioId: 'plan-ie061',
          scenarioVersion: 1,
          status: 'PUBLISHED',
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [{ periodId: 'w1', start: '2026-10-01T00:00:00Z', end: '2026-10-08T00:00:00Z' }],
        }),
        initiativeId,
        JSON.stringify({ initiativeId, lifecycleState: 'APPROVED_BACKLOG' }),
        JSON.stringify({
          scenarioId: 'portfolio-list-ie061',
          name: 'Baseline',
          scenarioVersion: 1,
          status: 'PUBLISHED',
          model: { modelId: 'm', version: 1 },
          scope: { portfolioId: 'p1', goalIds: [], asOf: '2026-08-09T20:00:00Z' },
        }),
      ]
    );
  });
  afterAll(async () => pool.end());
  it('publishes Capacity without allocation writes and confirms only after named assignee acceptance', async () => {
    await mutateCapacityScenario(
      uow,
      env(
        'capacity_scenario',
        id,
        'rm',
        0,
        'c-create',
        'capacity.scenario.mutate',
        { operation: 'CREATE', scenario },
        true
      )
    );
    await mutateCapacityScenario(
      uow,
      env('capacity_scenario', id, 'rm', 1, 'c-publish', 'capacity.scenario.mutate', {
        operation: 'PUBLISH',
        scenario,
      })
    );
    await requestResourceCommitment(
      uow,
      env(
        'resource_commitment',
        'commit-1',
        'rm',
        0,
        'r-request',
        'resource.commitment.request',
        {
          capacityScenarioId: id,
          capacityScenarioVersion: 2,
          assignmentId: 'a1',
          initiativeId,
          resourceManagerId: 'rm',
          assigneeId: 'engineer',
          expiresAt: '2026-12-01T00:00:00Z',
        },
        true
      )
    );
    await expect(
      decideResourceCommitment(
        uow,
        env('resource_commitment', 'commit-1', 'rm', 1, 'early', 'resource.commitment.decide', {
          outcome: 'CONFIRMED',
          conditions: [],
          rationale: 'Confirm',
          policyOverrideDecisionId: null,
        })
      )
    ).rejects.toThrow(/acceptance/);
    await acceptResourceCommitment(
      uow,
      env(
        'resource_commitment',
        'commit-1',
        'engineer',
        1,
        'accept',
        'resource.commitment.accept',
        {}
      )
    );
    await decideResourceCommitment(
      uow,
      env('resource_commitment', 'commit-1', 'rm', 2, 'confirm', 'resource.commitment.decide', {
        outcome: 'CONFIRMED',
        conditions: [],
        rationale: 'Accepted and confirmed',
        policyOverrideDecisionId: null,
      })
    );
    const initiative = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative'`,
      [org]
    );
    expect(initiative.rows[0].payload_json).toEqual({
      initiativeId,
      lifecycleState: 'APPROVED_BACKLOG',
    });
    const list = await reader.listPortfolioScenarios(org);
    expect(list).toEqual([
      expect.objectContaining({
        id: 'portfolio-list-ie061',
        name: 'Baseline',
        state: 'PUBLISHED',
        version: 1,
      }),
    ]);
    expect(await reader.listCapacityScenarios(org)).toEqual([
      expect.objectContaining({
        id,
        state: 'PUBLISHED',
        version: 2,
        planRef: { scenarioId: 'plan-ie061', scenarioVersion: 1 },
        unit: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw' },
        knowledgeSummary: expect.objectContaining({ unknown: 1 }),
      }),
    ]);
  });
});
