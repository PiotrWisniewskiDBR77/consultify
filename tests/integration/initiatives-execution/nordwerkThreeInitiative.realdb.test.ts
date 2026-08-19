import { readFile } from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';

import {
  mutateCapacityScenario,
  type CapacityScenario,
} from '../../../server/src/domain/initiatives-execution/capacityScenario';
import {
  decidePortfolio,
  requestPortfolioDecision,
} from '../../../server/src/domain/initiatives-execution/portfolioDecision';
import {
  mutatePortfolioScenario,
  type PortfolioScenario,
} from '../../../server/src/domain/initiatives-execution/portfolioScenario';
import {
  mutatePlanScenario,
  type PlanScenario,
} from '../../../server/src/domain/initiatives-execution/planScenario';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';
import { createInitiativesAnalysisGoldenThread } from './helpers/goldenThreadFixture';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('NordWerk three-Initiative governed portfolio, plan and capacity journey', () => {
  const pool = new Pool({ connectionString: url, max: 2 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const reader = new PostgresInitiativeReader(pool);
  const organizationId = 'org-nordwerk-three';
  const projectId = 'operations-transformation-2027';
  const authorityId = 'nordwerk-gate-authority';
  const policy = {
    policyId: 'standard-industrial',
    version: 3,
    baseline: 'STANDARD' as const,
    strictness: 3,
    source: 'PROJECT' as const,
    config: {
      selfApproval: false,
      enforceGateGovernance: true,
      gates: {
        DEFINITION: {
          quorum: 1,
          requiredRoles: ['GATE_AUTHORITY'],
          separation: true,
          slaHours: 48,
        },
        ANALYSIS: {
          quorum: 1,
          requiredRoles: ['GATE_AUTHORITY'],
          separation: true,
          slaHours: 48,
        },
      },
      roleBindings: [{ roleKey: 'GATE_AUTHORITY', principalId: authorityId }],
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user: Record<string, string | undefined> }).user = {
      id: req.header('x-test-user') ?? undefined,
      organizationId: req.header('x-test-org') ?? undefined,
      role: 'USER',
    };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: uow,
      reader,
      authorize: async (actor, requestedProjectId) =>
        actor.organizationId === organizationId && requestedProjectId === projectId,
      resolvePolicy: async () => policy,
    })
  );

  const envelope = (
    aggregateType: string,
    aggregateId: string,
    actorId: string,
    expectedVersion: number,
    clientRequestId: string,
    commandType: string,
    payload: unknown,
    createIfMissing = false
  ) => ({
    organizationId,
    actorId,
    aggregateType,
    aggregateId,
    expectedVersion,
    clientRequestId,
    correlationId: clientRequestId,
    policyId: policy.policyId,
    policyVersion: policy.version,
    commandType,
    createIfMissing,
    payload,
  });

  beforeAll(async () => {
    for (const migration of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
      '934_organization_governance_profiles.sql',
      '935_plan_scenario_time_basis.sql',
    ]) await pool.query(await readFile(path.resolve('server/migrations', migration), 'utf8'));
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM initiative_candidates WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ie_initiative_card_versions WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ie_initiative_card_selection WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ie_governance_role_bindings WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ie_governance_policies WHERE organization_id=$1`, [organizationId]);
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    await pool.query(
      `INSERT INTO ie_governance_policies
        (organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json,status)
       VALUES($1,'PROJECT',$2,$3,$4,'STANDARD',3,$5::jsonb,'ACTIVE')`,
      [organizationId, projectId, policy.policyId, policy.version, JSON.stringify({ ...policy.config, roleBindings: undefined })]
    );
    await pool.query(
      `INSERT INTO ie_governance_role_bindings
        (organization_id,policy_id,policy_version,role_key,principal_id,project_id)
       VALUES($1,$2,$3,'GATE_AUTHORITY',$4,$5)`,
      [organizationId, policy.policyId, policy.version, authorityId, projectId]
    );
  });

  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, organizationId);
    await pool.end();
  });

  it('keeps three canonical lineages, resolves the envelope and exposes UNKNOWN capacity honestly', async () => {
    const definitions = [
      {
        prefix: 'nw-aco',
        title: 'Automated Changeover Optimization',
        problem: 'Median Line 4 changeover is 95 minutes.',
        proposedOutcome: 'Reduce the governed weekly median to at most 60 minutes.',
      },
      {
        prefix: 'nw-qms',
        title: 'QMS 4.0 Compliance Upgrade',
        problem: 'Critical batch genealogy is incomplete before the regulatory audit.',
        proposedOutcome: 'Provide independently accepted genealogy evidence for every critical batch.',
      },
      {
        prefix: 'nw-energy',
        title: 'Energy Reduction Programme',
        problem: 'Energy intensity is 142 kWh per unit and the tariff evidence is stale.',
        proposedOutcome: 'Reduce measured intensity to at most 125 kWh per unit over eight weeks.',
      },
    ];
    const fixtures = [];
    for (const definition of definitions) {
      fixtures.push(
        await createInitiativesAnalysisGoldenThread(app, {
          ...definition,
          organizationId,
          projectId,
          ownerId: `${definition.prefix}-owner`,
          reviewerId: `${definition.prefix}-reviewer`,
          authorityId,
        })
      );
    }
    expect(new Set(fixtures.map((fixture) => fixture.initiativeId)).size).toBe(3);
    expect(fixtures.every((fixture) => fixture.lifecycleState === 'READY_FOR_DECISION')).toBe(true);

    const [aco, qms, energy] = fixtures;
    const portfolioId = 'nw-portfolio-constrained';
    const portfolio: PortfolioScenario = {
      scenarioId: portfolioId,
      scenarioVersion: 0,
      status: 'DRAFT',
      scope: { portfolioId: projectId, goalIds: ['compliance', 'throughput', 'energy'], asOf: '2026-08-12T08:00:00Z' },
      model: { modelId: 'nordwerk-value-risk-capacity', version: 1 },
      decompositionKeys: ['mandatory', 'value', 'risk', 'readiness'],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
      previousPublishedVersion: null,
      memberships: [
        {
          initiativeId: qms.initiativeId,
          initiativeVersion: qms.initiativeVersion,
          disposition: 'INCLUDED',
          scoreDecomposition: { mandatory: 10, value: 4, risk: 9, readiness: 8 },
          rank: 1,
          rankOverride: null,
          coverage: { state: 'KNOWN', value: ['regulatory-compliance'], reason: 'Mandatory audit scope' },
          overlap: { state: 'ESTIMATED', value: [aco.initiativeId], basis: 'shared controls engineer' },
          roughDemand: { state: 'ESTIMATED', value: { unit: 'FTE', low: 1.3, base: 1.6, high: 2.1 }, basis: 'owner ranges' },
          confidence: 'HIGH',
          rationale: 'Mandatory before the audit and before ACO cutover.',
        },
        {
          initiativeId: aco.initiativeId,
          initiativeVersion: aco.initiativeVersion,
          disposition: 'CONDITIONAL',
          scoreDecomposition: { mandatory: 4, value: 9, risk: 6, readiness: 8 },
          rank: 2,
          rankOverride: { actorId: 'portfolio-owner', reason: 'QMS is mandatory and the PLN 2.0m envelope requires a reduced ACO pilot.', previousRank: 1, newRank: 2 },
          coverage: { state: 'KNOWN', value: ['throughput'], reason: 'Line 4 pilot only' },
          overlap: { state: 'ESTIMATED', value: [qms.initiativeId, energy.initiativeId], basis: 'controls and data pipeline' },
          roughDemand: { state: 'ESTIMATED', value: { unit: 'FTE', low: 1.4, base: 1.8, high: 2.3 }, basis: 'owner ranges' },
          confidence: 'MEDIUM',
          rationale: 'Approve only a reduced pilot so QMS plus ACO remains inside the envelope.',
        },
        {
          initiativeId: energy.initiativeId,
          initiativeVersion: energy.initiativeVersion,
          disposition: 'DEFERRED',
          scoreDecomposition: { mandatory: 2, value: 7, risk: 4, readiness: 2 },
          rank: 3,
          rankOverride: null,
          coverage: { state: 'UNKNOWN', value: null, reason: 'Tariff and baseline source require refresh.' },
          overlap: { state: 'ESTIMATED', value: [aco.initiativeId], basis: 'shared data pipeline' },
          roughDemand: { state: 'UNKNOWN', value: null, basis: 'Operational Data Analyst load is unknown.' },
          confidence: 'LOW',
          rationale: 'Deferred until source refresh and capacity evidence are current.',
        },
      ],
    };
    await mutatePortfolioScenario(
      uow,
      envelope('portfolio_scenario', portfolioId, 'portfolio-owner', 0, 'nw-portfolio-create', 'portfolio.scenario.mutate', { operation: 'CREATE', scenario: portfolio }, true)
    );
    await mutatePortfolioScenario(
      uow,
      envelope('portfolio_scenario', portfolioId, 'portfolio-owner', 1, 'nw-portfolio-publish', 'portfolio.scenario.mutate', { operation: 'PUBLISH', scenario: portfolio })
    );

    for (const [fixture, outcome, conditions] of [
      [qms, 'APPROVED', []],
      [aco, 'CONDITIONALLY_APPROVED', ['Reduce pilot envelope to PLN 1.1m and preserve QMS dependency.']],
      [energy, 'DEFERRED', []],
    ] as const) {
      const decisionId = `${fixture.initiativeId}-portfolio-decision`;
      await requestPortfolioDecision(
        uow,
        envelope('initiative', fixture.initiativeId, 'portfolio-owner', fixture.initiativeVersion, `${decisionId}-request`, 'initiative.portfolio.request', {
          decisionId,
          authorityId: 'sponsor',
          scenarioId: portfolioId,
          scenarioVersion: 2,
          dueAt: '2026-08-25T12:00:00Z',
          selfApprovalAllowed: false,
        })
      );
      await decidePortfolio(
        uow,
        envelope('initiative', fixture.initiativeId, 'sponsor', fixture.initiativeVersion + 1, `${decisionId}-decide`, 'initiative.portfolio.decide', {
          decisionId,
          outcome,
          rationale: outcome === 'DEFERRED' ? 'Refresh Energy evidence before reconsideration.' : 'Independent portfolio decision within the constrained envelope.',
          conditions: [...conditions],
          mergeTargetInitiativeId: null,
          selfApprovalAllowed: false,
        })
      );
    }
    const states = await pool.query(
      `SELECT aggregate_id,payload_json->>'lifecycleState' lifecycle
         FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id = ANY($2::text[])
        ORDER BY aggregate_id`,
      [organizationId, fixtures.map((fixture) => fixture.initiativeId)]
    );
    expect(Object.fromEntries(states.rows.map((row) => [row.aggregate_id, row.lifecycle]))).toEqual({
      [aco.initiativeId]: 'APPROVED_BACKLOG',
      [energy.initiativeId]: 'READY_FOR_DECISION',
      [qms.initiativeId]: 'APPROVED_BACKLOG',
    });

    const planId = 'nw-plan-q4';
    const periods = [
      { periodId: '2026-W44-W47', start: '2026-10-26T00:00:00Z', end: '2026-11-23T00:00:00Z' },
      { periodId: '2026-W48-W52', start: '2026-11-23T00:00:00Z', end: '2026-12-28T00:00:00Z' },
    ];
    const plan: PlanScenario = {
      scenarioId: planId,
      scenarioVersion: 0,
      status: 'DRAFT',
      portfolioScenarioId: portfolioId,
      portfolioScenarioVersion: 2,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods,
      windows: [
        {
          initiativeId: qms.initiativeId,
          initiativeVersion: qms.initiativeVersion + 2,
          earliest: '2026-10-26T00:00:00Z',
          target: '2026-11-16T00:00:00Z',
          latest: '2026-11-30T00:00:00Z',
          confidence: 'HIGH',
          rationale: 'Mandatory audit buffer.',
          dependencySnapshot: [],
          constraintSnapshot: [],
        },
        {
          initiativeId: aco.initiativeId,
          initiativeVersion: aco.initiativeVersion + 2,
          earliest: '2026-11-23T00:00:00Z',
          target: '2026-12-07T00:00:00Z',
          latest: '2026-12-28T00:00:00Z',
          confidence: 'MEDIUM',
          rationale: 'Starts after QMS architecture freeze.',
          dependencySnapshot: [{ dependencyId: 'qms-before-aco', predecessorInitiativeId: qms.initiativeId, state: 'RESOLVED' }],
          constraintSnapshot: [{ constraintId: 'controls-engineer', state: 'UNCONFIRMED', detail: 'Shared scarce resource.' }],
        },
      ],
      assumptions: ['PLN 2.0m sponsor envelope', 'No direct Initiative date writes'],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
    };
    await mutatePlanScenario(uow, envelope('plan_scenario', planId, 'planner', 0, 'nw-plan-create', 'plan.scenario.mutate', { operation: 'CREATE', scenario: plan }, true));
    await mutatePlanScenario(uow, envelope('plan_scenario', planId, 'planner', 1, 'nw-plan-publish', 'plan.scenario.mutate', { operation: 'PUBLISH', scenario: plan }));

    const demand = {
      knowledgeState: 'ESTIMATED' as const,
      low: 1.3,
      base: 1.6,
      high: 2,
      sourceRef: 'nordwerk-owner-ranges',
      sourceVersion: 1,
      asOf: '2026-08-12T08:00:00Z',
      confidence: 'MEDIUM' as const,
      ownerId: 'resource-manager',
      reason: 'QMS and ACO overlap around the controls architecture handoff.',
    };
    const capacity: CapacityScenario = {
      scenarioId: 'nw-capacity-q4',
      scenarioVersion: 0,
      status: 'DRAFT',
      planScenarioId: planId,
      planScenarioVersion: 2,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods: [
        { ...periods[0], demand, supply: { ...demand, low: 0.6, base: 0.8, high: 1, confidence: 'HIGH', reason: 'One Controls Engineer less confirmed non-project work.' } },
        { ...periods[1], demand: { ...demand, low: 0.8, base: 1, high: 1.2 }, supply: { ...demand, knowledgeState: 'UNKNOWN', low: null, base: null, high: null, sourceRef: null, sourceVersion: null, confidence: 'UNKNOWN', reason: 'Non-project load is not confirmed.' } },
      ],
      constraints: [{ constraintId: 'controls-engineer', state: 'UNCONFIRMED', detail: 'Demand 1.3-2.0 FTE exceeds confirmed supply range.', ownerId: 'resource-manager' }],
      proposedAssignments: [],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
    };
    await mutateCapacityScenario(uow, envelope('capacity_scenario', capacity.scenarioId, 'resource-manager', 0, 'nw-capacity-create', 'capacity.scenario.mutate', { operation: 'CREATE', scenario: capacity }, true));
    await mutateCapacityScenario(uow, envelope('capacity_scenario', capacity.scenarioId, 'resource-manager', 1, 'nw-capacity-publish', 'capacity.scenario.mutate', { operation: 'PUBLISH', scenario: capacity }));

    const capacityReadback = await reader.findCapacityScenario(organizationId, capacity.scenarioId);
    expect(capacityReadback?.scenario.periods[1].supply).toMatchObject({
      knowledgeState: 'UNKNOWN',
      low: null,
      base: null,
      high: null,
    });
    expect(await reader.listPlanScenarios(organizationId)).toEqual([
      expect.objectContaining({ id: planId, state: 'PUBLISHED', version: 2 }),
    ]);
    expect(await reader.listCapacityScenarios(organizationId)).toEqual([
      expect.objectContaining({
        id: capacity.scenarioId,
        state: 'PUBLISHED',
        version: 2,
        knowledgeSummary: expect.objectContaining({ unknown: 1 }),
      }),
    ]);

    const ledger = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipts,
         (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audits,
         (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox`,
      [organizationId]
    );
    expect(ledger.rows[0].receipts).toBeGreaterThan(100);
    expect(ledger.rows[0].audits).toBe(ledger.rows[0].receipts);
    expect(ledger.rows[0].outbox).toBe(ledger.rows[0].receipts);
  }, 180_000);
});
