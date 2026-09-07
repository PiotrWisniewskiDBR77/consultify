/** @vitest-environment node */

/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5 — „Nowa analiza" WYPELNIONA (realny PostgreSQL).
 *
 * POWOD ISTNIENIA: pomiar 07.09 — `CapacityScenarioSurface.createAnalysis` skladal
 * scenariusz w PRZEGLADARCE z `knowledgeState: 'UNKNOWN'` na kazdym okresie i zerem
 * rol, wiec karta analizy otwierala sie pusta („Luki i presja" pokazywaly 12 luk przy
 * 5 zaplanowanych tygodniach). Ten test sprawdza, ze arkusz policzony z opublikowanego
 * planu i z podazy organizacji ZAPISUJE SIE w bazie i wraca z LICZBAMI.
 *
 * MUTACJA (dowod RED): zwroc z `buildRoleSheet` okresy bez pola `roles` —
 * asercja na liniach rol i na skalarze rownym sumie przestaje przechodzic.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { buildRoleSheet } from '../capacityRoleSheet.js';
import { findRoleGaps } from '../capacityOptionsAdvisor.js';
import { mutateCapacityScenario, type CapacityScenario } from '../capacityScenario.js';
import { mutatePlanScenario, type PlanScenario } from '../planScenario.js';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork.js';
import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

const NO_RETRY = { retry: 0 } as const;

describe('P15-K5 — analiza obciazenia liczona z planu (realny PostgreSQL)', NO_RETRY, () => {
  const organizationId = randomUUID();
  const actorId = randomUUID();
  const portfolioId = `portfolio-${randomUUID()}`;
  const planId = `plan-${randomUUID()}`;
  const capacityId = `capacity-${randomUUID()}`;
  const initiativeOne = `ini-1-${randomUUID()}`;
  const initiativeTwo = `ini-2-${randomUUID()}`;
  let pool: Pool;

  const periods = [
    { periodId: 'T1', start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
    { periodId: 'T2', start: '2026-09-14T00:00:00.000Z', end: '2026-09-21T00:00:00.000Z' },
  ];
  const roleDemand = [
    { roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fte: 2 },
    { roleId: 'analityk', roleLabel: 'Analityk', fte: 0.5 },
  ];
  const plan: PlanScenario = {
    scenarioId: planId,
    name: 'Plan K5 realdb',
    scenarioVersion: 0,
    status: 'DRAFT',
    portfolioScenarioId: portfolioId,
    portfolioScenarioVersion: 1,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods,
    windows: [initiativeOne, initiativeTwo].map((initiativeId) => ({
      initiativeId,
      initiativeVersion: 1,
      earliest: periods[0].start,
      target: periods[0].start,
      latest: periods[0].end,
      confidence: 'MEDIUM' as const,
      rationale: 'P15-K5 fixture',
      dependencySnapshot: [],
      constraintSnapshot: [],
      roleDemand,
    })),
    assumptions: [],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  };

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL) });
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'P15-K5 fixture',
    ]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES
       ($1,'portfolio_scenario',$2,1,$3::jsonb),($1,'initiative',$4,1,$5::jsonb),($1,'initiative',$6,1,$7::jsonb)`,
      [
        organizationId,
        portfolioId,
        JSON.stringify({
          scenarioId: portfolioId,
          scenarioVersion: 1,
          status: 'PUBLISHED',
          scope: { portfolioId: 'p15-k5', goalIds: [], asOf: '2026-09-06T00:00:00.000Z' },
          model: { modelId: 'fixture', version: 1 },
          memberships: [initiativeOne, initiativeTwo].map((initiativeId, index) => ({
            initiativeId,
            initiativeVersion: 1,
            disposition: 'INCLUDED',
            scoreDecomposition: {},
            rank: index + 1,
            rankOverride: null,
            coverage: { state: 'UNKNOWN', value: null, reason: 'fixture' },
            overlap: { state: 'UNKNOWN', value: null, reason: 'fixture' },
            roughDemand: { state: 'UNKNOWN', value: null, reason: 'fixture' },
            confidence: 'LOW',
            rationale: 'fixture',
          })),
          decompositionKeys: [],
          createdBy: actorId,
          updatedBy: actorId,
          publishedBy: actorId,
          publishedAt: '2026-09-06T00:00:00.000Z',
          previousPublishedVersion: null,
        }),
        initiativeOne,
        JSON.stringify({ initiativeId: initiativeOne, lifecycleState: 'APPROVED_BACKLOG' }),
        initiativeTwo,
        JSON.stringify({ initiativeId: initiativeTwo, lifecycleState: 'APPROVED_BACKLOG' }),
      ]
    );
  });

  afterAll(async () => {
    if (!pool) return;
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('CREATE + compute zapisuje arkusz okres x rola z liczbami i luka per rola', async () => {
    const uow = new PostgresMaterialCommandUnitOfWork(pool);
    const base = {
      organizationId,
      actorId,
      correlationId: randomUUID(),
      policyId: 'p15-k5-compute',
      policyVersion: 1,
      createIfMissing: true,
    };
    await mutatePlanScenario(uow, {
      ...base,
      aggregateType: 'plan_scenario',
      aggregateId: planId,
      expectedVersion: 0,
      clientRequestId: randomUUID(),
      commandType: 'plan.scenario.mutate',
      payload: { operation: 'CREATE', scenario: plan },
    });
    const published = await mutatePlanScenario(uow, {
      ...base,
      aggregateType: 'plan_scenario',
      aggregateId: planId,
      expectedVersion: 1,
      clientRequestId: randomUUID(),
      commandType: 'plan.scenario.mutate',
      createIfMissing: false,
      payload: { operation: 'PUBLISH', scenario: { ...plan, scenarioVersion: 1 } },
    });
    expect(published.response.status).toBe('PUBLISHED');

    // Podaz: 3 osoby jako Controls Engineer (2,5 FTE lacznie), 0 Analitykow.
    const sheet = buildRoleSheet({
      plan: published.response,
      supply: [
        { roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fteWeekly: 2.5, headcount: 3 },
      ],
      ownerId: actorId,
    });
    const scenario: CapacityScenario = {
      scenarioId: capacityId,
      name: 'Analiza K5 realdb',
      scenarioVersion: 0,
      status: 'DRAFT',
      planScenarioId: planId,
      planScenarioVersion: published.response.scenarioVersion,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods: sheet,
      constraints: [],
      proposedAssignments: [],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
    };
    const created = await mutateCapacityScenario(uow, {
      ...base,
      aggregateType: 'capacity_scenario',
      aggregateId: capacityId,
      expectedVersion: 0,
      clientRequestId: randomUUID(),
      commandType: 'capacity.scenario.mutate',
      payload: { operation: 'CREATE', scenario },
    });
    expect(created.status).toBe('APPLIED');

    // Odczyt z BAZY, nie z pamieci: analiza ma byc WYPELNIONA po ponownym wczytaniu.
    const reader = new PostgresInitiativeReader(pool);
    const found = await reader.findCapacityScenario(organizationId, capacityId);
    const week1 = found?.scenario.periods.find((period) => period.periodId === 'T1');
    expect(week1?.roles).toHaveLength(2);
    const engineer = week1?.roles?.find((role) => role.roleId === 'controls-engineer');
    expect(engineer?.demand).toBe(4); // 2 inicjatywy x 2 FTE
    expect(engineer?.supply).toBe(2.5);
    expect(engineer?.supplySource).toBe('RESOURCE_PLAN');
    const analyst = week1?.roles?.find((role) => role.roleId === 'analityk');
    expect(analyst?.demand).toBe(1);
    expect(analyst?.supply).toBeNull(); // nikt nie ma tego stanowiska -> „Nieznane", nie zero
    expect(analyst?.supplySource).toBe('UNKNOWN');
    // Skalar okresu = suma ZNANYCH linii (solver i doradca czytaja skalar).
    expect(week1?.demand.base).toBe(5);
    expect(week1?.supply.base).toBe(2.5);

    const gaps = findRoleGaps(found?.scenario as CapacityScenario);
    expect(gaps.map((gap) => gap.roleId)).toEqual(['controls-engineer']);
    expect(gaps[0].gap).toBe(-1.5);

    // Rejestr: „Role" liczy role z popytem, „Luki" pary (okres, rola).
    const listed = (await reader.listCapacityScenarios(organizationId)).find(
      (item) => item.id === capacityId
    );
    expect(listed?.roleCount).toBe(2);
    expect(listed?.gapCount).toBe(1);
  });
});
