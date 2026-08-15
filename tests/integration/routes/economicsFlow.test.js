import app from '../../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = Date.now();
  process.env.SQLITE_PATH = `./test-integration-${workerId}-${runId}.db`;
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  process.env.ENABLE_TEST_GATEWAY = 'true';
});

// @vitest-environment node

const db = getDatabase();

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Economics Financial Analysis Flow', () => {
  let analysisId;
  let optimisticScenarioId;
  let initiativeId;

  const testOrgId = 'test-org-id';
  const testUserId = 'test-user-id';
  const testEmail = 'econ-flow@test.com';
  const testProjectId = 'econ-flow-proj';

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Economics Flow Org',
          'enterprise',
          'active',
        ]);
        db.run(
          'INSERT OR IGNORE INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'EconFlowUser', 'ADMIN'],
          resolve
        );
        db.run(
          'INSERT OR IGNORE INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
          [
          testProjectId,
          testOrgId,
          'Econ Flow Project',
          'active',
          ]
        );
      });
    });

  });

  it('creates an analysis and updates status', async () => {
    const createRes = await request(app)
      .post('/api/economics/analyses')
      .send({
        name: 'Flow Analysis',
        description: 'End-to-end flow',
        projectId: testProjectId,
        analysisType: 'financial',
      });

    expect(createRes.status).toBe(201);
    analysisId = createRes.body?.analysis?.id;
    expect(analysisId).toBeDefined();
    expect(createRes.body?.analysis?.status).toBe('DRAFT');

    const updateRes = await request(app)
      .put(`/api/economics/analyses/${analysisId}`)
      .send({ status: 'REVIEW' });

    expect(updateRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/economics/analyses/${analysisId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('REVIEW');
  });

  it('updates financials and generates scenarios', async () => {
    const financialRes = await request(app)
      .put(`/api/economics/analyses/${analysisId}/financials`)
      .send({
        financialData: {
          initialInvestment: 120000,
          implementationCost: 30000,
          annualOperatingCost: 8000,
          trainingCost: 5000,
          contingencyPercent: 10,
          annualCostSavings: 40000,
          annualRevenueIncrease: 15000,
          productivityGainsPercent: 5,
          riskReductionValue: 2000,
          implementationMonths: 6,
          benefitRealizationMonths: 3,
          analysisHorizonYears: 5,
          discountRate: 8,
          currency: 'PLN',
          assumptions: ['Baseline assumptions'],
        },
      });

    expect(financialRes.status).toBe(200);
    expect(financialRes.body?.metrics?.npv).toBeTypeOf('number');
    expect(financialRes.body?.metrics?.roi).toBeDefined();

    const scenariosRes = await request(app)
      .get(`/api/economics/analyses/${analysisId}/scenarios`);

    expect(scenariosRes.status).toBe(200);
    expect(scenariosRes.body?.scenarios?.length).toBeGreaterThanOrEqual(3);

    const optimistic = scenariosRes.body.scenarios.find(
      (scenario) => scenario.scenarioType === 'optimistic'
    );
    optimisticScenarioId = optimistic?.id;
    expect(optimisticScenarioId).toBeDefined();
  });

  it('activates a scenario and creates initiative', async () => {
    const activateRes = await request(app)
      .post(`/api/economics/analyses/${analysisId}/scenarios/${optimisticScenarioId}/activate`);

    expect([200, 201]).toContain(activateRes.status);

    const scenariosRes = await request(app)
      .get(`/api/economics/analyses/${analysisId}/scenarios`);

    const activeScenario = scenariosRes.body.scenarios.find((scenario) => scenario.isActive);
    expect(activeScenario?.scenarioType).toBe('optimistic');

    const initiativeRes = await request(app)
      .post(`/api/economics/analyses/${analysisId}/create-initiative`);

    expect(initiativeRes.status).toBe(201);
    initiativeId = initiativeRes.body?.initiativeId;
    expect(initiativeId).toBeDefined();
  });

  it('creates gate decision for the analysis', async () => {
    const decisionRes = await request(app)
      .post(`/api/economics/analyses/${analysisId}/decisions`)
      .send({ decisionType: 'select-scenario', decisionMakerId: testUserId });

    expect(decisionRes.status).toBe(201);
    expect(decisionRes.body?.decision?.id).toBeDefined();
  });
});
