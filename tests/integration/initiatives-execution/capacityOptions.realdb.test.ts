import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCapacityOptions,
  selectCapacityOption,
} from '../../../server/src/domain/initiatives-execution/capacityOptions';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Capacity Options realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool),
    org = 'org-aco27',
    planId = 'plan-aco27',
    capacityId = 'capacity-aco27',
    comparisonId = 'comparison-aco27';
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
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'plan_scenario',$2,4,$3::jsonb),($1,'capacity_scenario',$4,3,$5::jsonb)`,
      [
        org,
        planId,
        JSON.stringify({
          scenarioId: planId,
          status: 'PUBLISHED',
          scenarioVersion: 4,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [
            {
              periodId: '2026-W35',
              start: '2026-08-24T00:00:00.000Z',
              end: '2026-08-31T00:00:00.000Z',
            },
          ],
          memberships: ['i1'],
        }),
        capacityId,
        JSON.stringify({
          scenarioId: capacityId,
          status: 'PUBLISHED',
          scenarioVersion: 3,
          planScenarioId: planId,
          planScenarioVersion: 4,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [
            {
              periodId: '2026-W35',
              start: '2026-08-24T00:00:00.000Z',
              end: '2026-08-31T00:00:00.000Z',
            },
          ],
          commitments: [],
        }),
      ]
    );
  });
  afterAll(async () => pool.end());
  const known = (unit: string, base: number) => ({
      low: base - 1,
      base,
      high: base + 1,
      unit,
      knowledgeState: 'ESTIMATED' as const,
      confidence: 'MEDIUM' as const,
      sourceRefs: [{ ref: 'model:1', version: 2 }],
    }),
    unknown = (unit: string) => ({
      low: null,
      base: null,
      high: null,
      unit,
      knowledgeState: 'UNKNOWN' as const,
      confidence: 'UNKNOWN' as const,
      sourceRefs: [],
    }),
    option = (kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY', id: string) => ({
      optionId: id,
      kind,
      assumptions: [
        {
          assumption: `Assumption ${id}`,
          ownerId: 'planner',
          sourceRef: { ref: 'plan:assumption', version: 1 },
          knowledgeState: 'ESTIMATED' as const,
        },
      ],
      affectedMemberships: [{ initiativeId: 'i1', membershipVersion: 2 }],
      affectedPeriods: ['2026-W35'],
      affectedResources: [{ resourceRef: 'team:A', version: 2 }],
      impact: {
        date: known('days', 5),
        scope: kind === 'SCOPE_SPLIT' ? known('items', 2) : unknown('items'),
        cost: kind === 'ADD_CAPACITY' ? known('PLN', 100) : unknown('PLN'),
        risk: known('score', 3),
      },
      rationale: id,
    });
  const envelope = (v: number, key: string, payload: any, create = false) => ({
    organizationId: org,
    actorId: 'planner',
    aggregateType: 'capacity_options',
    aggregateId: comparisonId,
    expectedVersion: v,
    clientRequestId: key,
    correlationId: key,
    policyId: 'capacity-options',
    policyVersion: 1,
    commandType: create ? 'capacity-options.create' : 'capacity-options.select',
    createIfMissing: create,
    payload,
  });
  it('persists exactly three comparable proposals and selection only as governed draft input', async () => {
    await createCapacityOptions(
      uow,
      envelope(
        0,
        'create',
        {
          planRef: { scenarioId: planId, version: 4 },
          capacityRef: { scenarioId: capacityId, version: 3 },
          options: [
            option('RESEQUENCE', 'resequence'),
            option('SCOPE_SPLIT', 'split'),
            option('ADD_CAPACITY', 'add'),
          ],
        },
        true
      )
    );
    const selected = await selectCapacityOption(
        uow,
        envelope(1, 'select', { optionId: 'resequence', nextKind: 'SCHEDULE_DECISION' })
      ),
      replay = await selectCapacityOption(
        uow,
        envelope(1, 'select', { optionId: 'resequence', nextKind: 'SCHEDULE_DECISION' })
      );
    expect(replay.status).toBe('REPLAYED');
    expect(selected.response).toEqual(
      expect.objectContaining({
        status: 'SELECTED',
        selectedOptionId: 'resequence',
        nextGovernedInput: {
          kind: 'SCHEDULE_DECISION',
          optionId: 'resequence',
          comparisonId,
          comparisonVersion: 2,
        },
      })
    );
    expect(await reader.listCapacityOptions(org)).toEqual([
      expect.objectContaining({
        comparisonId,
        version: 2,
        options: expect.arrayContaining([
          expect.objectContaining({ kind: 'RESEQUENCE' }),
          expect.objectContaining({ kind: 'SCOPE_SPLIT' }),
          expect.objectContaining({ kind: 'ADD_CAPACITY' }),
        ]),
      }),
    ]);
    const sources = await pool.query(
      `SELECT aggregate_type,version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=ANY($2) ORDER BY aggregate_type`,
      [org, [planId, capacityId]]
    );
    expect(sources.rows.map((r) => [r.aggregate_type, r.version, r.payload_json.status])).toEqual([
      ['capacity_scenario', 3, 'PUBLISHED'],
      ['plan_scenario', 4, 'PUBLISHED'],
    ]);
    expect(await reader.listCapacityOptions('foreign')).toEqual([]);
  });
});
