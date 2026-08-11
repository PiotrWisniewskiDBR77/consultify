import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import express from 'express';
import { Pool } from 'pg';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const databaseUrl = process.env.DATABASE_URL?.trim();
test.skip(!databaseUrl, 'DATABASE_URL is required for Initiatives/Execution browser acceptance');

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
let server: Server;
let portfolioGovernanceEnabled = false;

test.beforeAll(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS initiative_candidates (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, source_type TEXT NOT NULL,
    source_id TEXT, title TEXT NOT NULL, rationale TEXT, fit_score REAL,
    status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT
  )`);
  for (const migrationName of [
    '932_initiatives_execution_material_commands.sql',
    '933_initiative_card_versions.sql',
    '934_organization_governance_profiles.sql',
  ]) {
    await pool.query(await readFile(path.resolve('server/migrations', migrationName), 'utf8'));
  }
  await pool.query(
    'TRUNCATE initiative_candidates, ie_initiative_card_versions, ie_initiative_card_selection, ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
  );
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-e2e-actor') || 'validator',
      organizationId: 'nordwerk-browser',
      role: 'USER',
    };
    next();
  });
  app.use(
    '/api/initiatives/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
      reader: new PostgresInitiativeReader(pool),
      authorize: async (_actor, projectId) => projectId === 'operations-transformation-2027',
      resolvePolicy: async () => ({
        policyId: 'standard-industrial',
        version: 3,
        baseline: 'STANDARD',
        strictness: 3,
        source: 'PROJECT',
        config: portfolioGovernanceEnabled
          ? {
              selfApproval: false,
              enforceGateGovernance: true,
              gates: {
                PORTFOLIO: {
                  quorum: 1,
                  requiredRoles: ['GATE_AUTHORITY'],
                  separation: true,
                  slaHours: 48,
                },
                SCHEDULE: {
                  quorum: 1,
                  requiredRoles: ['GATE_AUTHORITY'],
                  separation: true,
                  slaHours: 48,
                },
                HANDOFF: {
                  quorum: 1,
                  requiredRoles: ['GATE_AUTHORITY'],
                  separation: true,
                  slaHours: 48,
                },
                CLOSURE: {
                  quorum: 1,
                  requiredRoles: ['GATE_AUTHORITY'],
                  separation: true,
                  slaHours: 48,
                },
              },
              roleBindings: [
                { roleKey: 'GATE_AUTHORITY', principalId: 'portfolio-authority' },
                { roleKey: 'GATE_AUTHORITY', principalId: 'schedule-authority' },
                { roleKey: 'GATE_AUTHORITY', principalId: 'execution-manager' },
                { roleKey: 'GATE_AUTHORITY', principalId: 'closure-authority' },
              ],
            }
          : { selfApproval: false },
      }),
    })
  );
  await new Promise<void>((resolve) => {
    server = app.listen(3311, '127.0.0.1', resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  await pool.end();
});

test('Assessment finding → Submit Proposal → validate → Register → exact Card survives reload', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'validator' });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html');
  await expect(page.getByRole('main', { name: 'Assessment finding' })).toBeVisible();
  await expect(page.getByText('Assessment / finding / version 3')).toBeVisible();
  await page.getByRole('button', { name: 'Submit Proposal' }).click();
  const proposalRow = page.getByRole('row', {
    name: /Automated Changeover Optimization READY CLEAR/,
  });
  await expect(proposalRow).toBeVisible();
  await proposalRow.click();
  await expect(page.getByText('Median changeover is 95 minutes.').first()).toBeVisible();
  await expect(page.getByText('assessment-finding v3')).toBeVisible();
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByRole('region', { name: 'Source validation workspace' })).toBeVisible();
  await expect(page.getByText('Assessment / finding')).toBeVisible();
  await expect(page.getByText('standard-industrial v3 (PROJECT)')).toBeVisible();
  await page.getByRole('button', { name: 'Back to proposals' }).click();
  await page.getByRole('row', { name: /Automated Changeover Optimization READY CLEAR/ }).click();
  await page.getByRole('button', { name: /^Register$/ }).click();
  await expect(page.getByRole('heading', { name: 'Register as a new Initiative?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Register' }).click();
  const open = page.getByRole('button', { name: /Open Initiative/ });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole('region', { name: 'Initiative Card' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Automated Changeover Optimization' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Summary \/ Scope/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Comments, Activity & History/ })).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-registered-initiative-card.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/sourceProposalId=proposal-aco-browser/);
  await expect(page.getByText('Median changeover is 95 minutes.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Initiative' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/sourceProposalId=proposal-aco-browser/);
  await expect(page.getByText('Median changeover is 95 minutes.').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Source proposals workspace' })).toBeFocused();
  await page.getByRole('button', { name: 'Open Initiative' }).click();
  await page.getByLabel('problem').fill('Human baseline truth');
  await page.getByLabel('outcome').fill('Reduce changeover');
  await page.getByRole('button', { name: 'Publish first version' }).click();
  const initiativeId = (
    await pool.query(
      `SELECT aggregate_id FROM ie_aggregate_state WHERE organization_id='nordwerk-browser' AND aggregate_type='initiative'`
    )
  ).rows[0].aggregate_id as string;
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            `SELECT version FROM ie_aggregate_state WHERE organization_id='nordwerk-browser' AND aggregate_type='initiative' AND aggregate_id=$1`,
            [initiativeId]
          )
        ).rows[0]?.version
    )
    .toBe(2);
  const createAI = async (
    proposalId: string,
    cardVersion: number,
    initiativeVersion: number,
    output: Record<string, unknown>
  ) => {
    const response = await page.request.post(
      `http://127.0.0.1:3311/api/initiatives/runtime-v1/ai-analysis-proposals/${proposalId}`,
      {
        headers: { 'x-e2e-actor': 'validator' },
        data: {
          expectedVersion: 0,
          clientRequestId: `${proposalId}-create`,
          initiativeId,
          initiativeVersion,
          cardKey: 'summary-scope',
          cardVersion,
          sourceRef: {
            aggregateType: 'initiative',
            aggregateId: initiativeId,
            version: initiativeVersion,
          },
          model: { provider: 'openai', model: 'gpt-aco', version: '1' },
          prompt: { promptId: 'aco-prompt', version: 1 },
          template: { templateId: 'aco-template', version: 1 },
          inputHash: `${proposalId}-hash`,
          output,
          evidenceRefs: [{ ref: 'assessment:ASM-F-ACO-BROWSER', version: 3 }],
          counterEvidenceRefs: [{ ref: 'operator-interview', version: 1 }],
          confidence: 'HIGH',
          requestedBy: 'validator',
          authorizedReviewerId: 'human-reviewer',
        },
      }
    );
    expect(response.ok()).toBeTruthy();
  };
  await createAI('ai-aco-edit', 1, 2, { problem: 'AI proposed truth' });
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'human-reviewer' });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=my-work');
  await page.getByRole('row', { name: new RegExp(`${initiativeId}:summary-scope v1`) }).click();
  await expect(page.getByText('Proposal ai-aco-edit')).toBeVisible();
  await page.getByLabel('AI review rationale').fill('Independent human correction');
  await page.getByLabel('AI edited fragment').fill('{"problem":"Human corrected truth"}');
  await page.getByRole('button', { name: 'Publish human edit' }).click();
  await expect(page.getByText(/Card v2; v1 retained with AI lineage/)).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            `SELECT content_json->>'problem' problem FROM ie_initiative_card_versions WHERE organization_id='nordwerk-browser' AND initiative_id=$1 AND card_key='summary-scope' AND card_version=2`,
            [initiativeId]
          )
        ).rows[0]?.problem
    )
    .toBe('Human corrected truth');
  await createAI('ai-aco-reject', 2, 3, { problem: 'Rejected AI truth' });
  await page.reload();
  await page.getByRole('row', { name: new RegExp(`${initiativeId}:summary-scope v2`) }).click();
  await expect(page.getByText('Proposal ai-aco-reject')).toBeVisible();
  await page.getByLabel('AI review rationale').fill('Counter-evidence disproves output');
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText(/REJECT · no truth change/)).toBeVisible();
  expect(
    (
      await pool.query(
        `SELECT max(card_version) max FROM ie_initiative_card_versions WHERE organization_id='nordwerk-browser' AND initiative_id=$1 AND card_key='summary-scope'`,
        [initiativeId]
      )
    ).rows[0].max
  ).toBe(2);

  const stored = await pool.query(
    `SELECT aggregate_id, version, payload_json->>'lifecycleState' lifecycle_state
       FROM ie_aggregate_state
      WHERE organization_id = 'nordwerk-browser' AND aggregate_type = 'initiative'`
  );
  expect(stored.rows).toHaveLength(1);
  expect(stored.rows[0]).toMatchObject({ version: 3, lifecycle_state: 'REGISTERED_DRAFT' });
  expect(
    (
      await pool.query(
        `SELECT 1 FROM ie_aggregate_relations
          WHERE organization_id = 'nordwerk-browser' AND relation_type = 'SOURCE_REGISTRATION'`
      )
    ).rowCount
  ).toBe(1);
  const proposal = await pool.query(
    `SELECT version, provenance_json, policy_id, policy_version, status
       FROM initiative_candidates WHERE organization_id='nordwerk-browser' AND id='proposal-aco-browser'`
  );
  expect(proposal.rows[0]).toMatchObject({
    version: 2,
    policy_id: 'standard-industrial',
    policy_version: 3,
    status: 'accepted',
    provenance_json: { system: 'Assessment', recordType: 'finding' },
  });
});

test('READY_FOR_DECISION → persistent published Portfolio Scenario without lifecycle mutation', async ({
  page,
}) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(15_000);
  const runSuffix = `${Date.now()}`;
  const portfolioScenarioId = `aco-portfolio-scenario-${runSuffix}`;
  const planScenarioId = `aco-plan-scenario-${runSuffix}`;
  const capacityScenarioId = `aco-capacity-scenario-${runSuffix}`;
  const planPeriods = [
    {
      periodId: '2026-P10',
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-11-01T00:00:00.000Z',
    },
    {
      periodId: '2026-P11',
      start: '2026-11-01T00:00:00.000Z',
      end: '2026-12-01T00:00:00.000Z',
    },
    {
      periodId: '2026-P12',
      start: '2026-12-01T00:00:00.000Z',
      end: '2027-01-01T00:00:00.000Z',
    },
  ];
  const aggregate = (
    await pool.query(
      `SELECT aggregate_id FROM ie_aggregate_state
       WHERE organization_id='nordwerk-browser' AND aggregate_type='initiative'`
    )
  ).rows[0];
  expect(aggregate).toBeTruthy();
  const initiativeId = aggregate.aggregate_id as string;
  const base = 'http://127.0.0.1:3311/api/initiatives/runtime-v1';
  const api = async (actor: string, path: string, data?: Record<string, unknown>) => {
    let lastFailure = `${path}: request was not sent`;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = data
          ? await page.request.post(`${base}${path}`, {
              headers: { 'x-e2e-actor': actor },
              data,
            })
          : await page.request.get(`${base}${path}`, { headers: { 'x-e2e-actor': actor } });
        if (response.ok()) {
          const body = await response.json();
          await response.dispose();
          return body;
        }
        lastFailure = `${path}: ${response.status()} ${await response.text()}`;
        const retryable = response.status() >= 500;
        await response.dispose();
        if (!retryable) break;
      } catch (error) {
        lastFailure = `${path}: ${error instanceof Error ? error.message : String(error)}`;
      }
      await page.waitForTimeout(250 * attempt);
    }
    expect(false, lastFailure).toBeTruthy();
    throw new Error(lastFailure);
  };
  const current = () => api('initiative-owner', `/initiatives/${initiativeId}`);
  const publishReview = async (
    cardKey: string,
    expectedCardVersion: number,
    content: Record<string, unknown>,
    phase: string
  ) => {
    let initiative = await current();
    await api('initiative-owner', `/initiatives/${initiativeId}/cards/${cardKey}/publications`, {
      expectedVersion: initiative.version,
      expectedCardVersion,
      clientRequestId: `aco-p2-${phase}-${cardKey}-publish`,
      applicability: 'REQUIRED',
      completion: 'COMPLETE',
      quality: 'SUFFICIENT',
      freshness: 'CURRENT',
      reviewState: 'REQUESTED',
      content,
      evidenceRefs: [`aco-p2:${phase}:${cardKey}:v1`],
      waiverDecisionId: null,
    });
    initiative = await current();
    await api('independent-reviewer', `/initiatives/${initiativeId}/cards/${cardKey}/reviews`, {
      expectedVersion: initiative.version,
      expectedCardVersion: expectedCardVersion + 1,
      clientRequestId: `aco-p2-${phase}-${cardKey}-review`,
      outcome: 'ACCEPTED',
      rationale: 'Independent evidence review for the accepted browser precondition.',
    });
  };

  const definition: Record<string, Record<string, unknown>> = {
    'summary-scope': {
      problem: 'Median changeover is 95 minutes.',
      outcome: 'Reduce median changeover time.',
      inScope: ['Line 4'],
      outOfScope: ['Line 5'],
    },
    'strategic-fit': { objectives: ['OEE'], rationale: 'Supports operating strategy.' },
    'success-criteria': { successCriteria: ['Median <= 60 minutes'], measurementPlan: 'Weekly' },
    'outcomes-benefits': { outcomes: ['Faster changeovers'], benefits: ['Recovered capacity'] },
    options: { doNothing: 'Remain at 95 minutes', alternatives: ['SMED automation'] },
    'people-team': { team: ['Operations', 'Engineering'], capacityAssumptions: 'Part-time' },
    'roles-raci': { accountableOwnerId: 'initiative-owner', roles: ['Controls Engineer'] },
    stakeholders: { ownerId: 'initiative-owner', sponsorId: 'sponsor-1' },
  };
  const definitionVersions: Record<string, number> = { 'summary-scope': 2 };
  for (const [cardKey, content] of Object.entries(definition))
    await publishReview(cardKey, definitionVersions[cardKey] ?? 0, content, 'definition');

  let initiative = await current();
  await api('initiative-owner', `/initiatives/${initiativeId}/gates/definition/requests`, {
    expectedVersion: initiative.version,
    clientRequestId: 'aco-p2-definition-request',
    decisionId: 'aco-p2-definition-decision',
    authorityId: 'definition-authority',
    dueAt: '2026-08-22T12:00:00.000Z',
  });
  initiative = await current();
  await api('definition-authority', `/initiatives/${initiativeId}/gates/definition/decisions`, {
    expectedVersion: initiative.version,
    clientRequestId: 'aco-p2-definition-approve',
    decisionId: 'aco-p2-definition-decision',
    outcome: 'APPROVED',
    rationale: 'Definition independently accepted.',
  });
  initiative = await current();
  expect(initiative.initiative.lifecycleState).toBe('DEFINED');
  await api('initiative-owner', `/initiatives/${initiativeId}/gates/analysis/start`, {
    expectedVersion: initiative.version,
    clientRequestId: 'aco-p2-analysis-start',
  });

  const analysis: Record<string, Record<string, unknown>> = {
    options: { doNothing: 'Continue', alternatives: ['SMED'], recommendedOption: 'SMED' },
    'financial-analysis': { financeRef: 'finance:aco:v1', scenarioVersion: 1 },
    kpi: { kpiRefs: ['kpi:changeover:v1'], measurementPlan: 'Weekly' },
    'resources-capacity': { capacityEstimate: 2, confidence: 'MEDIUM' },
    dependencies: { dependencies: ['dependency:controls:v1'] },
    'risk-raid': { risks: ['risk:commissioning:v1'], accountableOwners: ['operations-owner'] },
    'technical-specification': { technicalAssessment: 'Viable' },
    'change-adoption': { changeImpact: 'Operator training' },
    stakeholders: { ownerId: 'initiative-owner', sponsorId: 'sponsor-1' },
    'feasibility-completeness': { feasibilityConclusion: 'Feasible' },
  };
  for (const [cardKey, values] of Object.entries(analysis))
    await publishReview(
      cardKey,
      cardKey === 'options' || cardKey === 'stakeholders' ? 2 : 0,
      {
        ...values,
        challenge: 'What evidence would falsify this conclusion?',
        counterEvidence: ['operator-interview:v1'],
        acceptedHumanTruth: 'Accepted by independent reviewer.',
      },
      'analysis'
    );
  initiative = await current();
  await api('initiative-owner', `/initiatives/${initiativeId}/gates/analysis/requests`, {
    expectedVersion: initiative.version,
    clientRequestId: 'aco-p2-analysis-request',
    decisionId: 'aco-p2-analysis-decision',
    authorityId: 'analysis-authority',
    dueAt: '2026-08-23T12:00:00.000Z',
  });
  initiative = await current();
  await api('analysis-authority', `/initiatives/${initiativeId}/gates/analysis/decisions`, {
    expectedVersion: initiative.version,
    clientRequestId: 'aco-p2-analysis-approve',
    decisionId: 'aco-p2-analysis-decision',
    outcome: 'APPROVED',
    rationale: 'Analysis independently accepted.',
  });
  initiative = await current();
  expect(initiative.initiative.lifecycleState).toBe('READY_FOR_DECISION');
  const frozenVersion = initiative.version as number;

  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'portfolio-owner' });
  await page.goto(
    `/tests/e2e/fixtures/initiatives-execution-aco.html?mode=portfolio&initiativeId=${encodeURIComponent(initiativeId)}`
  );
  await page.getByRole('button', { name: 'Nowy wariant' }).click();
  await page.getByLabel('Scenario ID').fill(portfolioScenarioId);
  await page.getByRole('button', { name: 'Utwórz wariant' }).click();
  await page.getByLabel('Add Initiative').selectOption(initiativeId);
  await page.getByLabel(`Version ${initiativeId}`).fill(String(frozenVersion));
  await page.getByLabel(`Rank ${initiativeId}`).fill('1');
  await page.getByLabel(`Confidence ${initiativeId}`).selectOption('MEDIUM');
  await page
    .getByLabel(`Rationale ${initiativeId}`)
    .fill('Best value and strategic fit; rough demand remains UNKNOWN.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(`Scenario Workbench · ${portfolioScenarioId} v1`)).toBeVisible();
  await page.getByRole('button', { name: 'Publish scenario' }).click();
  await expect(page.getByText(`Scenario Workbench · ${portfolioScenarioId} v2`)).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Portfolio Scenario Workbench' }).getByText('PUBLISHED')
  ).toBeVisible();
  await expect(page.getByText('Unknown').first()).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-portfolio-scenario-step-19.png',
    fullPage: true,
  });
  const afterPortfolio = await current();
  expect(afterPortfolio.version).toBe(frozenVersion);
  expect(afterPortfolio.initiative.lifecycleState).toBe('READY_FOR_DECISION');

  portfolioGovernanceEnabled = true;
  await pool.query(
    `INSERT INTO ie_governance_policies
       (organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json,status)
     VALUES ('nordwerk-browser','PROJECT','operations-transformation-2027','standard-industrial',3,
             'STANDARD',3,$1::jsonb,'ACTIVE')
     ON CONFLICT (organization_id,scope_type,scope_id,policy_id,version)
     DO UPDATE SET config_json=EXCLUDED.config_json,status='ACTIVE'`,
    [
      JSON.stringify({
        selfApproval: false,
        enforceGateGovernance: true,
        gates: {
          PORTFOLIO: {
            quorum: 1,
            requiredRoles: ['GATE_AUTHORITY'],
            separation: true,
            slaHours: 48,
          },
          SCHEDULE: {
            quorum: 1,
            requiredRoles: ['GATE_AUTHORITY'],
            separation: true,
            slaHours: 48,
          },
          HANDOFF: {
            quorum: 1,
            requiredRoles: ['GATE_AUTHORITY'],
            separation: true,
            slaHours: 48,
          },
          CLOSURE: {
            quorum: 1,
            requiredRoles: ['GATE_AUTHORITY'],
            separation: true,
            slaHours: 48,
          },
        },
      }),
    ]
  );
  await pool.query(
    `INSERT INTO ie_governance_role_bindings
       (organization_id,policy_id,policy_version,role_key,principal_id,project_id)
     VALUES ('nordwerk-browser','standard-industrial',3,'GATE_AUTHORITY','portfolio-authority',
             'operations-transformation-2027')
     ON CONFLICT DO NOTHING`
  );
  await pool.query(
    `INSERT INTO ie_governance_role_bindings
       (organization_id,policy_id,policy_version,role_key,principal_id,project_id)
     VALUES
       ('nordwerk-browser','standard-industrial',3,'GATE_AUTHORITY','schedule-authority',
        'operations-transformation-2027'),
       ('nordwerk-browser','standard-industrial',3,'GATE_AUTHORITY','execution-manager',
        'operations-transformation-2027'),
       ('nordwerk-browser','standard-industrial',3,'GATE_AUTHORITY','closure-authority',
        'operations-transformation-2027')
     ON CONFLICT DO NOTHING`
  );
  await page.getByLabel('Decision authority').fill('portfolio-authority');
  await page.getByLabel('Decision due').fill('2026-08-30T12:00');
  await page.getByRole('button', { name: 'Request', exact: true }).click();
  await expect(
    page.getByLabel('Portfolio Scenario Workbench').getByText(/PENDING ·/)
  ).toBeVisible();

  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'portfolio-authority' });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=portfolio-decision');
  const portfolioSignoffRow = page.getByRole('row', { name: /Gate Sign-off PORTFOLIO/ });
  await expect(portfolioSignoffRow).toBeVisible();
  await portfolioSignoffRow.click();
  await page.getByLabel('Sign-off rationale').fill('Portfolio authority sign-off.');
  await page.getByRole('button', { name: 'Record my sign-off' }).click();
  await expect(page.getByText(/1\/1 · SATISFIED/)).toBeVisible();
  const portfolioDecisionRow = page.getByRole('row', {
    name: new RegExp(`Portfolio Decision ${initiativeId}`),
  });
  await expect(portfolioDecisionRow).toBeVisible();
  await portfolioDecisionRow.click();
  await expect(page.getByRole('region', { name: 'Membership snapshot' })).toBeVisible();
  await page
    .getByLabel('Portfolio Decision rationale')
    .fill('Approve the exact independently reviewed Initiative and Portfolio snapshot.');
  const approvePortfolio = page.getByRole('button', { name: 'Record Portfolio Decision' });
  await expect(approvePortfolio).toBeEnabled();
  await approvePortfolio.click();
  await expect(page.getByText(/lifecycle readback APPROVED_BACKLOG/)).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-portfolio-decision-step-20.png',
    fullPage: true,
  });
  const afterPortfolioDecision = await current();
  expect(afterPortfolioDecision.initiative.lifecycleState).toBe('APPROVED_BACKLOG');

  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'initiative-owner' });
  await page.goto(
    `/tests/e2e/fixtures/initiatives-execution-aco.html?mode=plan&initiativeId=${encodeURIComponent(initiativeId)}`
  );
  await page.getByRole('button', { name: 'Nowy plan' }).click();
  await page.getByLabel('Plan Scenario ID').fill(planScenarioId);
  await page.getByLabel('Portfolio Scenario ID').fill(portfolioScenarioId);
  await page.getByLabel('Portfolio Scenario version').fill('2');
  await page.getByLabel('Plan window unit').fill('MONTH');
  await page.getByLabel('Plan timezone').fill('Europe/Warsaw');
  await page.getByLabel('Plan ordered periods').fill(JSON.stringify(planPeriods));
  await page.getByRole('button', { name: 'Utwórz plan' }).click();
  await page.getByLabel('Add Plan Initiative').selectOption(initiativeId);
  await page
    .getByLabel(`Initiative version ${initiativeId}`)
    .fill(String(afterPortfolioDecision.version));
  await page.getByLabel(`earliest ${initiativeId}`).fill('2026-10-01T08:00');
  await page.getByLabel(`target ${initiativeId}`).fill('2026-11-15T12:00');
  await page.getByLabel(`latest ${initiativeId}`).fill('2026-12-31T18:00');
  await page.getByLabel(`Confidence ${initiativeId}`).selectOption('MEDIUM');
  await page
    .getByLabel(`Window rationale ${initiativeId}`)
    .fill('Tentative window aligned to the approved Portfolio snapshot.');
  await page
    .getByLabel(`Dependencies ${initiativeId}`)
    .fill('dependency:controls-ready:v1\ndependency:operator-training:v1');
  await page.getByRole('button', { name: 'Add constraint' }).click();
  await page
    .getByLabel('Plan assumptions')
    .fill('Shutdown window remains provisional.\nSupplier lead time is estimated.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(`Plan Workbench · ${planScenarioId}:v1`)).toBeVisible();
  await page.getByRole('button', { name: 'Publish Plan Scenario' }).click();
  await expect(page.getByText(`Plan Workbench · ${planScenarioId}:v2`)).toBeVisible();
  await expect(page.getByText(`Portfolio ${portfolioScenarioId}:v2`)).toBeVisible();
  await expect(page.getByText('UNKNOWN: Constraint requires validation')).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-plan-scenario-steps-21-22.png',
    fullPage: true,
  });
  const afterPlan = await current();
  expect(afterPlan.version).toBe(afterPortfolioDecision.version);
  expect(afterPlan.initiative.lifecycleState).toBe('APPROVED_BACKLOG');
  const publishedPlan = await api('initiative-owner', `/plan-scenarios/${planScenarioId}`);
  expect(publishedPlan.scenario).toMatchObject({
    scenarioId: planScenarioId,
    scenarioVersion: 2,
    status: 'PUBLISHED',
    portfolioScenarioId,
    portfolioScenarioVersion: 2,
    windowUnit: 'MONTH',
    timezone: 'Europe/Warsaw',
    periods: planPeriods,
  });

  const range = (
    knowledgeState: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN',
    values: [number, number, number] | null,
    ownerId: string,
    sourceRef: string | null,
    reason: string | null
  ) => ({
    knowledgeState,
    low: values?.[0] ?? null,
    base: values?.[1] ?? null,
    high: values?.[2] ?? null,
    sourceRef,
    sourceVersion: sourceRef ? 1 : null,
    asOf: '2026-08-10T00:00:00.000Z',
    confidence:
      knowledgeState === 'KNOWN' ? 'HIGH' : knowledgeState === 'ESTIMATED' ? 'MEDIUM' : 'UNKNOWN',
    ownerId,
    reason,
  });
  const capacityScenario = {
    scenarioId: capacityScenarioId,
    scenarioVersion: 0,
    status: 'DRAFT',
    planScenarioId,
    planScenarioVersion: 2,
    windowUnit: publishedPlan.scenario.windowUnit,
    timezone: publishedPlan.scenario.timezone,
    periods: publishedPlan.scenario.periods.map(
      (period: { periodId: string; start: string; end: string }, index: number) => ({
        ...period,
        demand:
          index === 0
            ? range('ESTIMATED', [1.5, 2, 2.5], 'capacity-owner', 'estimate:controls-demand', null)
            : range(
                'UNKNOWN',
                null,
                'capacity-owner',
                null,
                'Supplier demand is not yet evidenced.'
              ),
        supply:
          index === 0
            ? range('KNOWN', [2, 2, 2], 'resource-manager', 'resource:controls-team', null)
            : range('ESTIMATED', [1, 1.5, 2], 'resource-manager', 'forecast:controls-team', null),
      })
    ),
    constraints: [
      {
        constraintId: 'aco-controls-availability',
        state: 'UNKNOWN',
        detail: 'Controls engineer availability requires confirmation.',
        ownerId: 'resource-manager',
      },
    ],
    proposedAssignments: [
      {
        assignmentId: `aco-assignment-${runSuffix}`,
        initiativeId,
        resourceOrRoleId: 'role:controls-engineer',
        periodIds: planPeriods.map((period) => period.periodId),
        demand: range(
          'ESTIMATED',
          [1.5, 2, 2.5],
          'capacity-owner',
          'estimate:controls-demand',
          null
        ),
        rationale: 'Proposed allocation pending assignee and resource-manager acceptance.',
      },
    ],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  };
  const createdCapacity = await api(
    'initiative-owner',
    `/capacity-scenarios/${capacityScenarioId}`,
    {
      expectedVersion: 0,
      clientRequestId: `aco-capacity-create-${runSuffix}`,
      operation: 'CREATE',
      scenario: capacityScenario,
    }
  );
  expect(createdCapacity.response).toMatchObject({
    scenarioId: capacityScenarioId,
    scenarioVersion: 1,
    status: 'DRAFT',
    planScenarioId,
    planScenarioVersion: 2,
    windowUnit: publishedPlan.scenario.windowUnit,
    timezone: publishedPlan.scenario.timezone,
    periods: publishedPlan.scenario.periods.map(
      (period: { periodId: string; start: string; end: string }) => period
    ),
  });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=capacity');
  await expect(page.getByRole('combobox', { name: 'Active Capacity Scenario' })).toHaveValue(
    capacityScenarioId
  );
  await page.getByRole('row', { name: /2026-P10 PERIOD/ }).click();
  await page.getByRole('button', { name: 'Otwórz narzędzia obciążenia' }).click();
  await expect(
    page.getByText(new RegExp(`Exact Plan ${planScenarioId} v2`))
  ).toBeVisible();
  await expect(page.getByText('UNKNOWN — no numeric value').first()).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Active Capacity Scenario' }).locator('option:checked')
  ).toHaveText(new RegExp(`${capacityScenarioId} · PUBLISHED · v2`));
  const publishedCapacity = await api(
    'initiative-owner',
    `/capacity-scenarios/${capacityScenarioId}`
  );
  expect(publishedCapacity.scenario).toMatchObject({
    scenarioVersion: 2,
    status: 'PUBLISHED',
    windowUnit: publishedPlan.scenario.windowUnit,
    timezone: publishedPlan.scenario.timezone,
  });
  expect(
    publishedCapacity.scenario.periods.map(({ periodId, start, end }: any) => ({
      periodId,
      start,
      end,
    }))
  ).toEqual(publishedPlan.scenario.periods);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-capacity-scenario-steps-23-26.png',
    fullPage: true,
  });

  const comparisonId = `aco-capacity-options-${runSuffix}`;
  const optionImpact = (
    unit: string,
    values: [number, number, number] | null,
    sourceRef: string | null
  ) => ({
    low: values?.[0] ?? null,
    base: values?.[1] ?? null,
    high: values?.[2] ?? null,
    unit,
    knowledgeState: values ? ('ESTIMATED' as const) : ('UNKNOWN' as const),
    confidence: values ? ('MEDIUM' as const) : ('UNKNOWN' as const),
    sourceRefs: sourceRef ? [{ ref: sourceRef, version: 1 }] : [],
  });
  const option = (kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY') => ({
    optionId: `aco-${kind.toLowerCase()}-${runSuffix}`,
    kind,
    assumptions: [
      {
        assumption: `${kind} impact remains an estimate until governed selection.`,
        ownerId: 'capacity-owner',
        sourceRef: { ref: `capacity-assumption:${kind.toLowerCase()}`, version: 1 },
        knowledgeState: 'ESTIMATED',
      },
    ],
    affectedMemberships: [{ initiativeId, membershipVersion: afterPortfolioDecision.version }],
    affectedPeriods: planPeriods.map((period) => period.periodId),
    affectedResources: [{ resourceRef: 'role:controls-engineer', version: 1 }],
    impact: {
      date: optionImpact('days', kind === 'RESEQUENCE' ? [5, 10, 15] : null, 'forecast:dates'),
      scope: optionImpact('items', kind === 'SCOPE_SPLIT' ? [1, 2, 3] : null, 'analysis:scope'),
      cost: optionImpact(
        'PLN',
        kind === 'ADD_CAPACITY' ? [8000, 10000, 14000] : null,
        'finance:cost'
      ),
      risk: optionImpact('score', [2, 3, 4], 'risk:capacity'),
    },
    rationale: `${kind} is compared without mutating Plan, baseline, allocation or commitment.`,
  });
  await api('capacity-owner', `/capacity-options/${comparisonId}`, {
    expectedVersion: 0,
    clientRequestId: `aco-capacity-options-create-${runSuffix}`,
    planRef: { scenarioId: planScenarioId, version: 2 },
    capacityRef: { scenarioId: capacityScenarioId, version: 2 },
    options: [option('RESEQUENCE'), option('SCOPE_SPLIT'), option('ADD_CAPACITY')],
  });
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Active Capacity Scenario' })).toHaveValue(
    capacityScenarioId
  );
  await page.getByRole('button', { name: 'Otwórz narzędzia obciążenia' }).click();
  const optionsRegion = page.getByRole('region', { name: 'Capacity options comparison' });
  await expect(optionsRegion.getByRole('region')).toHaveCount(3);
  await page.getByLabel('Capacity governed next input').selectOption('SCHEDULE_DECISION');
  await page
    .getByRole('region', { name: 'Capacity option Resequence' })
    .getByRole('button', { name: 'Select as governed input' })
    .click();
  await expect(page.getByText(/Governed input: SCHEDULE_DECISION/)).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-capacity-options-step-27.png',
    fullPage: true,
  });

  const commitmentId = `aco-commitment-${runSuffix}`;
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'resource-manager' });
  await page.getByText(`aco-assignment-${runSuffix}`).click();
  await page.getByLabel('Capacity commitmentId').fill(commitmentId);
  await page.getByLabel('Capacity resourceManagerId').fill('resource-manager');
  await page.getByLabel('Capacity assigneeId').fill('controls-engineer');
  await page.getByLabel('Capacity expiresAt').fill('2026-09-30T12:00');
  await page.getByRole('button', { name: 'Request commitment' }).click();
  await expect(page.getByText('Commitment requested · v1', { exact: true })).toBeVisible();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'controls-engineer' });
  await page.getByRole('button', { name: 'Assignee accept' }).click();
  await expect(page.getByText('Assignee accepted · v2', { exact: true })).toBeVisible();
  await page
    .getByLabel('Capacity commitment rationale')
    .fill('Assignee accepted exact allocation.');
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'resource-manager' });
  await page.getByRole('button', { name: 'RM confirm' }).click();
  await expect(page.getByText('CONFIRMED · v3', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-resource-commitment-steps-28-29.png',
    fullPage: true,
  });

  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'initiative-owner' });
  await page.goto(
    `/tests/e2e/fixtures/initiatives-execution-aco.html?initiativeId=${encodeURIComponent(initiativeId)}`
  );
  const scheduleRegion = page.getByRole('region', { name: 'Schedule readiness' });
  await expect(scheduleRegion).toBeVisible();
  await page.getByLabel('Schedule Portfolio reference').fill(`${portfolioScenarioId}@2`);
  await page.getByLabel('Schedule Plan reference').fill(`${planScenarioId}@2`);
  await page.getByLabel('Schedule Capacity reference').fill(`${capacityScenarioId}@2`);
  await page.getByLabel('Schedule commitment IDs').fill(commitmentId);
  await page
    .getByLabel('Schedule critical period IDs')
    .fill(planPeriods.map((period) => period.periodId).join('\n'));
  await page.getByLabel('Schedule authority').fill('schedule-authority');
  await page.getByLabel('Schedule Execution Manager').fill('execution-manager');
  await page.getByLabel('Schedule Decision due').fill('2026-09-30T12:00');
  await page.getByRole('button', { name: 'Request Schedule Decision' }).click();
  await expect(scheduleRegion.getByText(/Schedule Decision .* is pending/)).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-schedule-request-step-30.png',
    fullPage: true,
  });

  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'schedule-authority' });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=schedule-handoff');
  const scheduleSignoff = page.getByRole('row', { name: /Gate Sign-off SCHEDULE/ });
  await expect(scheduleSignoff).toBeVisible();
  await scheduleSignoff.click();
  await page.getByLabel('Sign-off rationale').fill('Schedule authority accepts exact inputs.');
  await page.getByRole('button', { name: 'Record my sign-off' }).click();
  await expect(page.getByText(/1\/1 · SATISFIED/)).toBeVisible();
  const scheduleDecision = page.getByRole('row', {
    name: new RegExp(`Schedule Decision ${initiativeId}`),
  });
  await expect(scheduleDecision).toBeVisible();
  await scheduleDecision.click();
  await page
    .getByLabel('Schedule Decision rationale')
    .fill('Approve exact Portfolio, Plan, Capacity and confirmed commitment snapshots.');
  await page.getByRole('button', { name: 'Approve schedule' }).click();
  await expect(page.getByText(/SCHEDULED · frozen Handoff Package/)).toBeVisible();
  const scheduledInitiative = await current();
  expect(scheduledInitiative.initiative.lifecycleState).toBe('SCHEDULED');
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-schedule-decision-step-31.png',
    fullPage: true,
  });

  const handoffPackageId = scheduledInitiative.initiative.handoffPackageId as string;
  expect(handoffPackageId).toBeTruthy();
  const handoffPackage = await api('initiative-owner', `/handoff-packages/${handoffPackageId}`);
  const executionCaseId = `aco-execution-case-${runSuffix}`;
  const requestHandoff = async (decisionId: string, expectedVersion: number, requestKey: string) =>
    api('initiative-owner', `/initiatives/${initiativeId}/handoff/requests`, {
      expectedVersion,
      clientRequestId: requestKey,
      decisionId,
      handoffPackageId,
      handoffPackageVersion: handoffPackage.version,
      executionCaseId,
      authorityId: 'execution-manager',
      dueAt: '2026-10-01T12:00:00.000Z',
      rolloutChildren: {
        pilot: [{ rolloutId: `aco-pilot-${runSuffix}`, kind: 'PILOT' }],
        waves: [{ rolloutId: `aco-wave-${runSuffix}`, kind: 'WAVE' }],
      },
    });
  const returnedDecisionId = `aco-handoff-return-${runSuffix}`;
  const handoffReady = await current();
  expect(handoffReady.initiative.lifecycleState).toBe('SCHEDULED');
  const returnedRequest = await requestHandoff(
    returnedDecisionId,
    handoffReady.version,
    `aco-handoff-return-request-${runSuffix}`
  );
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=schedule-handoff');
  let handoffSignoff = page.getByRole('row', { name: /Gate Sign-off HANDOFF/ });
  await expect(handoffSignoff).toBeVisible();
  await handoffSignoff.click();
  await page.getByLabel('Sign-off rationale').fill('Execution Manager reviewed frozen package.');
  await page.getByRole('button', { name: 'Record my sign-off' }).click();
  const returnedHandoff = page.getByRole('row', {
    name: new RegExp(`Handoff Acceptance ${initiativeId}`),
  });
  await expect(returnedHandoff).toBeVisible();
  await returnedHandoff.click();
  await page.getByLabel('Handoff rationale').fill('Return until controls coverage is evidenced.');
  await page.getByLabel('Handoff itemId').fill(`aco-blocker-${runSuffix}`);
  await page.getByLabel('Handoff description').fill('Controls coverage evidence is missing.');
  await page.getByLabel('Handoff ownerId').fill('initiative-owner');
  await page.getByLabel('Handoff dueAt').fill('2026-09-20T12:00');
  await page.getByRole('button', { name: 'Return with blockers' }).click();
  await expect(returnedHandoff).not.toBeVisible();
  await expect
    .poll(async () => (await current()).version, {
      message: 'Return command must commit and reload before the retry reads Initiative version',
    })
    .toBe(returnedRequest.aggregateVersion + 1);
  const afterReturn = await current();
  expect(afterReturn.initiative.lifecycleState).toBe('SCHEDULED');
  const missingCase = await page.request.get(`${base}/execution-cases/${executionCaseId}`, {
    headers: { 'x-e2e-actor': 'execution-manager' },
  });
  expect(missingCase.status()).toBe(404);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-handoff-return-step-32.png',
    fullPage: true,
  });

  const acceptedDecisionId = `aco-handoff-accept-${runSuffix}`;
  await requestHandoff(
    acceptedDecisionId,
    afterReturn.version,
    `aco-handoff-accept-request-${runSuffix}`
  );
  await page.reload();
  handoffSignoff = page.getByRole('row', { name: /Gate Sign-off HANDOFF/ });
  await expect(handoffSignoff).toBeVisible();
  await handoffSignoff.click();
  await page
    .getByLabel('Sign-off rationale')
    .fill('Retry package accepted after blocker remediation.');
  await page.getByRole('button', { name: 'Record my sign-off' }).click();
  const acceptedHandoff = page.getByRole('row', {
    name: new RegExp(`Handoff Acceptance ${initiativeId}`),
  });
  await expect(acceptedHandoff).toBeVisible();
  await acceptedHandoff.click();
  await page.getByLabel('Handoff rationale').fill('Accept exact frozen Handoff Package.');
  await page.getByRole('button', { name: 'Accept handoff' }).click();
  await expect(
    page.getByText(new RegExp(`Execution Case ${executionCaseId} · ACTIVE`))
  ).toBeVisible();
  const afterAccept = await current();
  expect(afterAccept.initiative.lifecycleState).toBe('IN_EXECUTION');
  expect(afterAccept.initiative.executionCaseId).toBe(executionCaseId);
  const executionCase = await api('execution-manager', `/execution-cases/${executionCaseId}`);
  expect(executionCase).toMatchObject({
    executionCaseId,
    detail: { initiativeId, state: 'ACTIVE' },
  });
  const executionRegistry = await api('execution-manager', '/execution-cases');
  expect(
    executionRegistry.cases.filter(
      (item: { initiativeId: string }) => item.initiativeId === initiativeId
    )
  ).toEqual([
    expect.objectContaining({ executionCaseId, initiativeId, state: 'ACTIVE', version: 1 }),
  ]);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-handoff-accept-steps-33-34.png',
    fullPage: true,
  });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=execution-realizations');
  const realizationRow = page.getByRole('row', { name: /Automated Changeover Optimization/ });
  await expect(realizationRow).toBeVisible();
  await realizationRow.click();
  await page.getByRole('button', { name: 'Otwórz', exact: true }).click();
  await expect(page.getByText(new RegExp(`Execution Case .*${executionCaseId}`))).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-execution-registry-step-34.png',
    fullPage: true,
  });

  expect(executionCase.detail.rolloutChildren).toEqual({
    pilot: [{ rolloutId: `aco-pilot-${runSuffix}`, kind: 'PILOT' }],
    waves: [{ rolloutId: `aco-wave-${runSuffix}`, kind: 'WAVE' }],
  });
  expect(executionRegistry.cases).toHaveLength(1);

  const milestoneId = `aco-milestone-${runSuffix}`;
  let taskId = '';
  let decisionId = '';
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=execution-work');
  await page.getByLabel('Execution Case for work').selectOption(executionCaseId);
  await page.getByRole('button', { name: 'Nowy kamień milowy' }).click();
  await page.getByLabel('Milestone id').fill(milestoneId);
  await page.getByLabel('Milestone title').fill('Controls commissioning complete');
  await page.getByLabel('Milestone ownerId').fill('execution-manager');
  await page.getByLabel('Milestone targetAt').fill('2026-11-15T12:00');
  await page.getByLabel('Milestone forecastAt').fill('2026-11-20T12:00');
  await page.getByLabel('Milestone evidenceRefs').fill('handoff:controls-baseline:v1');
  await page.getByRole('button', { name: 'Utwórz kamień milowy' }).click();
  await expect(page.getByText(new RegExp(`${milestoneId} v1`))).toBeVisible();

  await page.getByRole('button', { name: 'Nowa decyzja' }).click();
  await page.getByLabel('Work title').fill('Approve controls commissioning window');
  await page.getByLabel('Work authorityId').fill('execution-manager');
  await page.getByLabel('Work dueAt').fill('2026-10-15T12:00');
  await page.getByRole('button', { name: 'Utwórz decyzję' }).click();
  const decisionTitle = 'Approve controls commissioning window';
  await expect
    .poll(async () => {
      const work = await api('execution-manager', `/execution-cases/${executionCaseId}/work`);
      const created = work.decisions.find(
        (item: { title: string }) => item.title === decisionTitle
      );
      decisionId = created?.decisionId ?? '';
      return created;
    })
    .toMatchObject({ title: decisionTitle, version: 1, status: 'DRAFT' });
  const workAfterDecision = await api(
    'execution-manager',
    `/execution-cases/${executionCaseId}/work`
  );
  expect(workAfterDecision.decisions).toEqual([
    expect.objectContaining({ decisionId, title: decisionTitle, version: 1, status: 'DRAFT' }),
  ]);
  const decisionRow = page.getByRole('row', { name: new RegExp(decisionTitle) });
  await expect(decisionRow).toBeVisible();

  await page.getByRole('button', { name: 'Nowe zadanie' }).click();
  await page.getByLabel('Work title').fill('Commission controls for Line 4');
  await page
    .getByLabel('Work description')
    .fill('Blocked until the commissioning decision is made.');
  await page.getByLabel('Work assigneeId').fill('controls-engineer');
  await page.getByLabel('Work ownerId').fill('execution-manager');
  await page.getByLabel('Work dueAt').fill('2026-10-20T12:00');
  await page.getByLabel('Work slaAt').fill('2026-10-18T12:00');
  await page.getByLabel('Work blockers').fill(decisionId);
  await page.getByLabel('Work milestoneIds').fill(milestoneId);
  await page.getByRole('button', { name: 'Utwórz zadanie' }).click();
  await expect
    .poll(async () => {
      const work = await api('execution-manager', `/execution-cases/${executionCaseId}/work`);
      const created = work.tasks.find(
        (item: { title: string }) => item.title === 'Commission controls for Line 4'
      );
      taskId = created?.taskId ?? '';
      return created;
    })
    .toMatchObject({ title: 'Commission controls for Line 4', version: 1 });
  const taskRow = page.getByRole('row', { name: /Commission controls for Line 4/ });
  await expect(taskRow).toBeVisible();
  await taskRow.click();
  await page.getByRole('button', { name: 'Otwórz element pracy' }).click();
  const blastRadius = page.getByRole('region', { name: 'Task milestone blast radius' });
  await expect(blastRadius.getByText(new RegExp(milestoneId))).toBeVisible();
  await expect(blastRadius.getByRole('alert')).toContainText('Blocked Task affects 1 Milestone');
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-execution-work-steps-35-37.png',
    fullPage: true,
  });

  await expect(decisionRow).toBeVisible();
  await decisionRow.dblclick();
  await expect(page.getByRole('region', { name: 'Governed Decision controls' })).toBeVisible();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'initiative-owner' });
  await page.getByRole('button', { name: 'Przekaż do decyzji' }).click();
  await expect
    .poll(async () => {
      const work = await api('execution-manager', `/execution-cases/${executionCaseId}/work`);
      const decision = work.decisions.find(
        (item: { decisionId: string }) => item.decisionId === decisionId
      );
      return decision ? { status: decision.status, version: decision.version } : null;
    })
    .toEqual({ status: 'PENDING', version: 2 });
  await expect(decisionRow.getByRole('status')).toContainText('Pending');
  await expect(decisionRow).toBeVisible();
  await decisionRow.dblclick();
  await expect(page.getByRole('region', { name: 'Governed Decision controls' })).toBeVisible();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page
    .getByLabel('Work rationale')
    .fill('Approve with one accountable commissioning follow-up.');
  await page.getByLabel('Work conditions').fill('Provide signed controls test evidence.');
  await page.getByLabel('Work description').fill('Capture and attach controls test evidence.');
  await page.getByLabel('Work assigneeId').fill('controls-engineer');
  await page.getByLabel('Work ownerId').fill('execution-manager');
  await page.getByLabel('Work dueAt').fill('2026-10-18T12:00');
  await page.getByLabel('Work slaAt').fill('2026-10-17T12:00');
  await page.getByRole('button', { name: 'CONDITIONALLY_APPROVED' }).click();
  await expect
    .poll(async () => {
      const work = await api('execution-manager', `/execution-cases/${executionCaseId}/work`);
      return work.decisions.find((item: { decisionId: string }) => item.decisionId === decisionId)
        ?.status;
    })
    .toBe('CONDITIONALLY_APPROVED');
  await expect(decisionRow).toContainText(/conditionally approved/i);
  const conditionalWork = await api(
    'execution-manager',
    `/execution-cases/${executionCaseId}/work`
  );
  expect(
    conditionalWork.tasks.filter(
      (item: { taskId: string }) => item.taskId === `follow-up:${decisionId}`
    )
  ).toHaveLength(1);
  expect(conditionalWork.decisions).toEqual([
    expect.objectContaining({
      decisionId,
      status: 'CONDITIONALLY_APPROVED',
      followUpTaskId: `follow-up:${decisionId}`,
    }),
  ]);
  expect(conditionalWork.tasks).toEqual(
    expect.arrayContaining([expect.objectContaining({ taskId, status: 'BLOCKED', version: 1 })])
  );
  await expect(taskRow).toBeVisible();
  await taskRow.dblclick();
  await expect(page.getByRole('region', { name: 'Governed Task controls' })).toBeVisible();
  await expect(page.getByLabel('Work blockers')).toHaveValue(decisionId);
  await page.getByLabel('Work blockers').fill('');
  await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect
    .poll(async () => {
      const work = await api('execution-manager', `/execution-cases/${executionCaseId}/work`);
      const task = work.tasks.find((item: { taskId: string }) => item.taskId === taskId);
      return task ? { status: task.status, version: task.version } : null;
    })
    .toEqual({ status: 'OPEN', version: 2 });
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-conditional-decision-step-38.png',
    fullPage: true,
  });

  const allocationId = `aco-operational-allocation-${runSuffix}`;
  const operationalTimeBasis = {
    windowUnit: publishedPlan.scenario.windowUnit,
    timezone: publishedPlan.scenario.timezone,
    periods: publishedPlan.scenario.periods,
  };
  const evidenceRef = (ref: string) => ({
    ref,
    version: 1,
    knowledgeState: 'KNOWN',
    confidence: 'HIGH',
    asOf: '2026-08-10T00:00:00.000Z',
    reason: null,
  });
  const allocationProposal = {
    allocationId,
    executionCaseId,
    initiativeId,
    taskId,
    assigneeId: 'controls-engineer',
    resourceManagerId: 'resource-manager',
    timeBasis: operationalTimeBasis,
    demand: { unit: 'FTE', low: 0.4, base: 0.5, high: 0.6, knowledgeState: 'ESTIMATED' },
    availabilityRef: evidenceRef('availability:controls-engineer:2026-P10-P12'),
    calendarRef: evidenceRef('calendar:controls-engineer:2026-P10-P12'),
    remainingEstimateRef: evidenceRef(`remaining-estimate:${taskId}:v2`),
    skillRequirements: ['controls-commissioning'],
    costRef: { ref: 'cost-rate:controls-engineer', version: 1 },
  };
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=execution-resources');
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page.getByLabel('Execution Case for resources').selectOption(executionCaseId);
  await page.getByRole('button', { name: 'Zaproponuj przydział' }).click();
  await page.getByText('Dane zaawansowane', { exact: true }).click();
  await page
    .getByLabel('Operational Allocation proposal JSON')
    .fill(JSON.stringify(allocationProposal));
  await page.getByRole('button', { name: 'Symuluj' }).click();
  await expect(page.getByRole('status')).toContainText('READY');
  await page.getByRole('button', { name: 'Zapisz propozycję' }).click();
  const allocationRow = page
    .getByRole('row', {
      name: new RegExp(`controls-engineer.*${taskId.slice(-8)}`, 'i'),
    })
    .filter({ has: page.getByRole('button', { name: 'Row actions' }) });
  await expect(allocationRow).toContainText('Proposed');
  await allocationRow.click();
  await page.getByLabel('Allocation rationale').fill('Request exact-window controls capacity.');
  await page.getByRole('button', { name: 'Przekaż do akceptacji' }).click();
  await expect(allocationRow).toContainText('Requested');
  await allocationRow.click();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'controls-engineer' });
  await page.getByLabel('Allocation rationale').fill('I accept the exact-window assignment.');
  await page.getByRole('button', { name: 'Akceptuj przydział' }).click();
  await expect(allocationRow).toContainText('Assignee accepted');
  await allocationRow.click();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'resource-manager' });
  await page.getByLabel('Allocation rationale').fill('Capacity evidence verified and confirmed.');
  await page.getByRole('button', { name: 'Potwierdź', exact: true }).click();
  await expect(allocationRow).toContainText('Confirmed');
  const allocationReadback = await api(
    'resource-manager',
    `/execution-cases/${executionCaseId}/allocations`
  );
  expect(allocationReadback.items).toEqual([
    expect.objectContaining({
      allocationId,
      executionCaseId,
      initiativeId,
      taskId,
      assigneeId: 'controls-engineer',
      resourceManagerId: 'resource-manager',
      status: 'CONFIRMED',
      version: 4,
      timeBasis: operationalTimeBasis,
    }),
  ]);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-operational-allocation-step-39.png',
    fullPage: true,
  });

  const interventionId = `aco-intervention-${runSuffix}`;
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=execution-control');
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page.getByRole('button', { name: 'Dodaj sygnał' }).click();
  await page.getByLabel('Management signal sourceId').fill(milestoneId);
  await page.getByLabel('Management signal sourceVersion', { exact: true }).fill('2');
  await page.getByLabel('Management signal snapshotRef').fill(`milestone:${milestoneId}:stale:v2`);
  await page.getByLabel('Management signal occurredAt').fill('2026-12-01T12:00');
  await page.getByRole('button', { name: 'Zapisz sygnał' }).click();
  const staleSignalRow = page.getByRole('row', { name: new RegExp(milestoneId) });
  await expect(staleSignalRow).toBeVisible();
  await page.getByLabel('Management signal occurredAt').fill('2026-12-01T13:00');
  await page
    .getByLabel('Management signal snapshotRef')
    .fill(`milestone:${milestoneId}:stale:v2:repeat`);
  await page.getByRole('button', { name: 'Zapisz sygnał' }).click();
  await staleSignalRow.click();
  await expect(page.getByRole('row', { name: 'Wystąpienia 2' })).toBeVisible();
  await expect(page.getByText(`milestone:${milestoneId}:stale:v2`, { exact: true })).toBeVisible();
  await expect(
    page.getByText(`milestone:${milestoneId}:stale:v2:repeat`, { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Dodaj do przygotowywanej interwencji' }).click();

  await page.getByLabel('Management signal kind').selectOption('CAPACITY_CONFLICT');
  await page.getByLabel('Management signal sourceId').fill(capacityScenarioId);
  await page.getByLabel('Management signal sourceVersion', { exact: true }).fill('2');
  await page
    .getByLabel('Management signal snapshotRef')
    .fill(`capacity:${capacityScenarioId}:conflict:v2`);
  await page.getByLabel('Management signal severity').selectOption('CRITICAL');
  await page.getByLabel('Management signal occurredAt').fill('2026-12-01T13:05');
  await page.getByRole('button', { name: 'Zapisz sygnał' }).click();
  const capacitySignalRow = page.getByRole('row', { name: new RegExp(capacityScenarioId) });
  await expect(capacitySignalRow).toBeVisible();
  await capacitySignalRow.click();
  await page.getByRole('button', { name: 'Dodaj do przygotowywanej interwencji' }).click();

  await page.getByLabel('Intervention draft interventionId').fill(interventionId);
  await page.getByLabel('Intervention draft ownerId').fill('execution-manager');
  await page.getByLabel('Intervention draft authorityId').fill('intervention-authority');
  await page.getByLabel('Intervention draft slaAt').fill('2026-12-02T12:00');
  await page
    .getByLabel('Intervention draft hypotheses')
    .fill('Stale commissioning forecast and capacity conflict share the same Plan sequence.');
  await page
    .getByLabel('Intervention draft evidenceRefs')
    .fill(`milestone:${milestoneId}:stale:v2\ncapacity:${capacityScenarioId}:conflict:v2`);
  await page
    .getByLabel('Intervention draft counterEvidenceRefs')
    .fill('allocation:controls-engineer:confirmed:v4');
  await page
    .getByLabel('Intervention draft unknowns')
    .fill('Supplier commissioning slot remains UNKNOWN.');
  await page
    .getByLabel('Intervention draft blastRadiusRefs')
    .fill(`plan:${planScenarioId}@2\ncase:${executionCaseId}@7\ntask:${taskId}@2`);
  await page
    .getByLabel('Intervention draft doNothingImpacts')
    .fill(`${milestoneId}|Forecast remains stale\n${capacityScenarioId}|Conflict persists`);
  await page.getByLabel('Intervention draft actionOptionId').fill('governed-resequence');
  await page
    .getByLabel('Intervention draft actionLabel')
    .fill('Apply independently approved Plan resequence');
  await page
    .getByLabel('Intervention draft actionImpacts')
    .fill(`${planScenarioId}|Order changes within the same published time basis`);
  await page.getByLabel('Intervention draft actionConfidence').selectOption('MEDIUM');
  await page.getByLabel('Intervention draft actionReversibility').selectOption('REVERSIBLE');
  await page.getByRole('button', { name: 'Draft or merge Intervention Case' }).click();
  const interventionRow = page.getByRole('row', { name: new RegExp(interventionId) });
  await expect(interventionRow).toContainText('Draft');
  await interventionRow.click();
  await expect(
    page.getByRole('row', {
      name: 'Niewiadome Supplier commissioning slot remains UNKNOWN.',
    })
  ).toBeVisible();
  await expect(
    page.getByText('ACTION: Apply independently approved Plan resequence', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Request independent Decision' }).click();
  await expect(interventionRow).toContainText(/pending decision/i);
  await interventionRow.click();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'intervention-authority' });
  await page.getByLabel('Intervention selected option').fill('governed-resequence');
  await page
    .getByLabel('Intervention rationale')
    .fill('The selected option is reversible and preserves exact lineage.');
  await page.getByRole('button', { name: 'Approve option' }).click();
  await expect(interventionRow).toContainText(/approved/i);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-management-intervention-steps-40-42.png',
    fullPage: true,
  });

  const interventionComparisonId = `aco-intervention-capacity-options-${runSuffix}`;
  const interventionResequence = option('RESEQUENCE');
  await api('capacity-owner', `/capacity-options/${interventionComparisonId}`, {
    expectedVersion: 0,
    clientRequestId: `aco-intervention-options-create-${runSuffix}`,
    planRef: { scenarioId: planScenarioId, version: 2 },
    capacityRef: { scenarioId: capacityScenarioId, version: 2 },
    options: [interventionResequence, option('SCOPE_SPLIT'), option('ADD_CAPACITY')],
  });
  await api('capacity-owner', `/capacity-options/${interventionComparisonId}/select`, {
    expectedVersion: 1,
    clientRequestId: `aco-intervention-options-select-${runSuffix}`,
    optionId: interventionResequence.optionId,
    nextKind: 'MATERIAL_CHANGE',
  });
  const planBeforeChange = (await api('execution-manager', `/plan-scenarios/${planScenarioId}`))
    .scenario;
  const planAfterChange = {
    ...planBeforeChange,
    windows: planBeforeChange.windows.map((window: any) => ({
      ...window,
      target: '2026-11-20T12:00:00.000Z',
      rationale: `${window.rationale} Governed resequence after Capacity conflict.`,
    })),
  };
  const materialChangeId = `aco-plan-material-change-${runSuffix}`;
  await page.reload();
  const interventionAfterReload = page.getByRole('row', { name: new RegExp(interventionId) });
  await interventionAfterReload.click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByLabel('Governed comparison').selectOption(interventionComparisonId);
  await page.getByLabel('Governed proposalId').fill(materialChangeId);
  await page.getByLabel('Governed oldSnapshot').fill(JSON.stringify(planBeforeChange));
  await page.getByLabel('Governed newSnapshot').fill(JSON.stringify(planAfterChange));
  await page.getByLabel('Governed ownerId').fill('execution-manager');
  await page.getByLabel('Governed authorityId').fill('plan-authority');
  await page.getByLabel('Governed policyRef').fill('plan-resequence-materiality');
  await page.getByLabel('Governed policyVersion').fill('1');
  const knownImpact = {
    knowledgeState: 'KNOWN',
    refs: [{ ref: `intervention:${interventionId}`, version: 3 }],
  };
  await page.getByLabel('Governed blastRadius').fill(
    JSON.stringify({
      tasks: knownImpact,
      decisions: knownImpact,
      milestones: knownImpact,
      risks: knownImpact,
      capacity: knownImpact,
      approvals: knownImpact,
      handoff: knownImpact,
    })
  );
  await page.getByRole('button', { name: 'Create governed Plan Material Change' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'MATERIAL_CHANGE_DRAFTED' })
  ).toContainText('MATERIAL_CHANGE_DRAFTED');
  await api('execution-manager', `/material-changes/${materialChangeId}/transitions`, {
    expectedVersion: 1,
    clientRequestId: `aco-plan-change-request-${runSuffix}`,
    action: 'REQUEST',
  });
  await api('plan-authority', `/material-changes/${materialChangeId}/transitions`, {
    expectedVersion: 2,
    clientRequestId: `aco-plan-change-approve-${runSuffix}`,
    action: 'DECIDE',
    outcome: 'APPROVE',
    conditions: [],
    rationale: 'Approve selected Capacity RESEQUENCE with exact blast radius.',
  });
  const publishReceiptId = `aco-plan-change-publish-${runSuffix}`;
  const publishedChange = await api(
    'execution-manager',
    `/material-changes/${materialChangeId}/transitions`,
    {
      expectedVersion: 3,
      clientRequestId: publishReceiptId,
      action: 'PUBLISH',
    }
  );
  expect(publishedChange).toMatchObject({
    aggregateVersion: 4,
    response: { status: 'PUBLISHED', publishedTargetVersion: 3 },
  });
  const planAfterPublish = (await api('execution-manager', `/plan-scenarios/${planScenarioId}`))
    .scenario;
  expect(planAfterPublish).toMatchObject({ windows: planAfterChange.windows });
  const currentInitiativeForImpact = await current();
  const currentCaseForImpact = await api(
    'execution-manager',
    `/execution-cases/${executionCaseId}`
  );
  const currentWorkForImpact = await api(
    'execution-manager',
    `/execution-cases/${executionCaseId}/work`
  );
  const currentTaskForImpact = currentWorkForImpact.tasks.find(
    (item: { taskId: string }) => item.taskId === taskId
  );
  const planChangeReadback = publishedChange.response;
  const exactPlanChange = {
    planScenarioId,
    oldVersion: 2,
    newVersion: 3,
    oldHash: planChangeReadback.oldHash,
    newHash: planChangeReadback.newHash,
    selectedCapacityOptionRef: {
      comparisonId: interventionComparisonId,
      comparisonVersion: 2,
      optionId: interventionResequence.optionId,
    },
    affected: {
      initiatives: [{ id: initiativeId, version: currentInitiativeForImpact.version }],
      executionCases: [{ id: executionCaseId, version: currentCaseForImpact.version }],
      tasks: [{ id: taskId, version: currentTaskForImpact.version }],
    },
  };
  await page.getByLabel('Governed affected').fill(JSON.stringify(exactPlanChange));
  await page.getByLabel('Intervention receiptId').fill(publishReceiptId);
  await page.getByLabel('Intervention aggregateType').fill('material_change');
  await page.getByLabel('Intervention aggregateId').fill(materialChangeId);
  await page.getByLabel('Intervention version').fill('4');
  await page.getByLabel('Intervention state').fill('PUBLISHED');
  await page.getByLabel('Intervention verifyBy').fill('2026-12-15T12:00');
  await page
    .getByLabel('Intervention expectedEffect')
    .fill('Milestone forecast and Capacity conflict improve in the next measurement.');
  await page
    .getByLabel('Intervention measurementRef')
    .fill(`measurement:plan-resequence:${planScenarioId}`);
  await page.getByLabel('Intervention measurementVersion').fill('1');
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page.getByRole('button', { name: 'Apply canonical receipt' }).click();
  await expect(interventionAfterReload).toContainText(/verification due/i);
  await interventionAfterReload.click();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'portfolio-authority' });
  await page.getByLabel('Intervention verification outcome').selectOption('INEFFECTIVE');
  await page
    .getByLabel('Intervention verification evidence')
    .fill(`measurement:plan-resequence:${planScenarioId}:ineffective:v1`);
  await page.getByRole('button', { name: 'Verify intervention' }).click();
  await expect(interventionAfterReload).toContainText(/escalated/i);
  await expect(
    page.getByRole('status').filter({ hasText: 'INEFFECTIVE · ESCALATED' })
  ).toContainText('INEFFECTIVE · ESCALATED');
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-plan-intervention-step-43.png',
    fullPage: true,
  });

  const reportDefinitionId = `aco-report-definition-${runSuffix}`;
  const reportRunId = `aco-report-run-${runSuffix}`;
  const refreshedReportRunId = `aco-report-refresh-${runSuffix}`;
  const reportFollowUpTaskId = `aco-report-follow-up-${runSuffix}`;
  const reportDefinition = {
    name: 'ACO execution control',
    purpose: 'Governed delivery, capacity and intervention follow-up',
    audience: ['Steering Committee'],
    cadence: 'P1W',
    scope: { type: 'EXECUTION_PORTFOLIO', refs: [`execution-case:${executionCaseId}`] },
    outputSchema: { type: 'object' },
    sections: [{ sectionId: 'control', title: 'Delivery control', mandatory: true }],
    sourceBindings: [
      { bindingId: 'case', sourceType: 'execution_case', required: true, scope: 'ACTIVE' },
    ],
    formulas: [],
    units: ['FTE'],
    currencies: ['PLN'],
    windows: [{ windowId: 'quarter', duration: 'P3M', timezone: 'Europe/Warsaw' }],
    access: { audienceRoles: ['STEERING'], classification: 'CONFIDENTIAL' },
    redaction: { rules: [], defaultState: 'FULL' },
    freshnessThresholdMinutes: 1440,
    confidenceThreshold: 'MEDIUM',
    ownerId: 'execution-manager',
    approverId: 'report-approver',
  };
  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=execution-reports');
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page.getByRole('button', { name: 'Nowa definicja' }).click();
  await page.getByLabel('Report Definition ID').fill(reportDefinitionId);
  await page.getByLabel('Report Definition contract JSON').fill(JSON.stringify(reportDefinition));
  await page.getByLabel('Report Definition project IDs').fill('operations-transformation-2027');
  await page.getByRole('button', { name: 'Create Definition' }).click();
  const definitionRow = page.getByRole('row', { name: /ACO execution control/ });
  await expect(definitionRow).toContainText(/draft/i);
  await definitionRow.click();
  await page.getByRole('button', { name: 'Validate Definition' }).click();
  await expect(definitionRow).toContainText(/validated/i);
  await definitionRow.click();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'report-approver' });
  await page
    .getByLabel('Report Definition publish rationale')
    .fill('Independent approval of exact sources, freshness and access contract.');
  await page.getByRole('button', { name: 'Publish Definition' }).click();
  await expect(definitionRow).toContainText(/published/i);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-report-definition-step-44.png',
    fullPage: true,
  });

  const reportCase = await api('execution-manager', `/execution-cases/${executionCaseId}`);
  const reportDraft = {
    reportRunId,
    parentRunRef: null,
    audience: ['Steering Committee'],
    scopeRefs: [`execution-case:${executionCaseId}`],
    period: { start: '2026-10-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' },
    asOf: '2026-12-16T00:00:00.000Z',
    sources: [
      {
        sourceType: 'execution_case',
        sourceId: executionCaseId,
        version: reportCase.version,
        capturedAt: '2026-12-16T00:00:00.000Z',
        freshness: 'CURRENT',
        formula: null,
        unit: null,
        currency: null,
        window: { start: '2026-10-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' },
        confidence: 'HIGH',
        accessState: 'FULL',
        redactions: [],
      },
    ],
    ownerId: 'execution-manager',
    approverId: 'report-approver',
  };
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'execution-manager' });
  await page.getByRole('button', { name: 'Nowy raport' }).click();
  await page
    .getByLabel('ReportRun published Definition version')
    .selectOption(`${reportDefinitionId}@1`);
  await page.getByLabel('ReportRun draft JSON').fill(JSON.stringify(reportDraft));
  await page.getByRole('button', { name: 'Create or refresh ReportRun' }).click();
  const reportRow = page
    .getByRole('row')
    .filter({ hasText: 'ACO execution control · 16 gru 2026' })
    .first();
  await expect(reportRow).toContainText(/draft/i);
  await reportRow.click();
  await expect(page.getByText('CURRENT · FULL · confidence HIGH', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Validate sources' }).click();
  await expect(reportRow).toContainText(/validated/i);
  await reportRow.click();
  await page.getByRole('button', { name: 'Freeze snapshot' }).click();
  await expect(reportRow).toContainText(/frozen/i);
  await reportRow.click();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'report-approver' });
  await page.getByLabel('Report approval rationale').fill('Independent source review accepted.');
  await page.getByRole('button', { name: 'Independent approve', exact: true }).click();
  await expect(reportRow).toContainText(/approved/i);
  await reportRow.click();
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'report-approver' });
  await page.getByLabel('Report distribution receiptId').fill(`aco-distribution-${runSuffix}`);
  await page.getByLabel('Report distribution audience').fill('Steering Committee');
  await page.getByLabel('Report distribution distributedAt').fill('2026-12-16T12:00');
  await page.getByRole('button', { name: 'Publish/share frozen approved snapshot' }).click();
  await expect(reportRow).toContainText(/published/i);
  await expect(
    page.getByRole('status').filter({ hasText: `aco-distribution-${runSuffix}` })
  ).toContainText(`aco-distribution-${runSuffix}`);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-report-run-steps-45-46.png',
    fullPage: true,
  });

  await reportRow.click();
  await page.getByLabel('Report follow-up executionCaseId').selectOption(executionCaseId);
  await page.getByLabel('Report follow-up taskId').fill(reportFollowUpTaskId);
  await page.getByLabel('Report follow-up title').fill('Resolve ineffective intervention finding');
  await page
    .getByLabel('Report follow-up description')
    .fill('Canonical follow-up from the published frozen ReportRun.');
  await page.getByLabel('Report follow-up assigneeId').fill('controls-engineer');
  await page.getByLabel('Report follow-up ownerId').fill('execution-manager');
  await page.getByLabel('Report follow-up dueAt').fill('2026-12-20T12:00');
  await page.getByLabel('Report follow-up slaAt').fill('2026-12-19T12:00');
  await page
    .getByLabel('Report follow-up evidenceRefs')
    .fill(`report-run:${reportRunId}@5\nintervention:${interventionId}@5`);
  await page.getByRole('button', { name: 'Create and link canonical follow-up Task' }).click();
  await expect(page.getByRole('status').filter({ hasText: reportFollowUpTaskId })).toContainText(
    reportFollowUpTaskId
  );
  const reportWork = await api('execution-manager', `/execution-cases/${executionCaseId}/work`);
  expect(reportWork.tasks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ taskId: reportFollowUpTaskId, executionCaseId, version: 1 }),
    ])
  );
  const publishedReport = (await api('execution-manager', '/report-runs')).items.find(
    (item: { reportRunId: string }) => item.reportRunId === reportRunId
  );
  expect(publishedReport).toMatchObject({
    version: 6,
    status: 'PUBLISHED',
    followUpTaskRef: { taskId: reportFollowUpTaskId, version: 1 },
  });
  const refreshDraft = {
    ...reportDraft,
    reportRunId: refreshedReportRunId,
    parentRunRef: { reportRunId, version: 6 },
    asOf: '2026-12-17T00:00:00.000Z',
    sources: reportDraft.sources.map((source) => ({
      ...source,
      capturedAt: '2026-12-17T00:00:00.000Z',
    })),
  };
  await page.getByLabel('ReportRun draft JSON').fill(JSON.stringify(refreshDraft));
  await page.getByRole('button', { name: 'Create or refresh ReportRun' }).click();
  const refreshRow = page
    .getByRole('row')
    .filter({ hasText: 'ACO execution control · 17 gru 2026' })
    .first();
  await expect(refreshRow).toContainText(/draft/i);
  await refreshRow.click();
  await expect(page.getByText(`Parent ${reportRunId} v6`)).toBeVisible();
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-report-follow-up-refresh-step-47.png',
    fullPage: true,
  });

  await page.goto('/tests/e2e/fixtures/initiatives-execution-aco.html?mode=execution-work');
  await page.getByLabel('Execution Case for work').selectOption(executionCaseId);
  const openDeliveryTasks = (
    await api('execution-manager', `/execution-cases/${executionCaseId}/work`)
  ).tasks.filter((item: { status: string }) => item.status === 'OPEN');
  await expect(page.getByRole('row', { name: /Conditional follow-up/ })).toBeVisible();
  for (const deliveryTask of openDeliveryTasks) {
    await page.setExtraHTTPHeaders({ 'x-e2e-actor': deliveryTask.assigneeId });
    const taskRow = page.getByRole('row', { name: new RegExp(deliveryTask.title) });
    await taskRow.dblclick();
    await expect(page.getByRole('region', { name: 'Governed Task controls' })).toBeVisible();
    await page
      .getByLabel('Work evidenceRefs')
      .fill(`delivery-evidence:${deliveryTask.taskId}:v${deliveryTask.version}`);
    await page.getByRole('button', { name: 'Oznacz jako wykonane' }).click();
    await expect(taskRow).toContainText(/completed/i);
  }
  const completedWork = await api('execution-manager', `/execution-cases/${executionCaseId}/work`);
  expect(completedWork.tasks.filter((item: { status: string }) => item.status === 'OPEN')).toEqual(
    []
  );
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-delivery-tasks-step-48.png',
    fullPage: true,
  });

  const deliveryDecisionId = `aco-delivery-${runSuffix}`;
  const deliveryParents = await Promise.all([
    current(),
    api('execution-manager', `/execution-cases/${executionCaseId}`),
  ]);
  const deliveryContract = {
    initiativeId,
    executionCaseId,
    initiativeVersion: deliveryParents[0].version,
    executionCaseVersion: deliveryParents[1].version,
    authorityId: 'delivery-authority',
    ownerId: 'execution-manager',
    baselineRef: { ref: `handoff:${handoffPackageId}`, version: 1 },
    scopeRef: { ref: `plan:${planScenarioId}`, version: 3 },
    deliverableRefs: [{ ref: `report:${reportRunId}`, version: 6 }],
    milestoneRefs: [{ ref: `milestone:${milestoneId}`, version: 2 }],
    openTaskRefs: [],
    openDecisionRefs: [],
    riskResiduals: [],
    financeActualRefs: [{ ref: `finance-actuals:${executionCaseId}`, version: 1 }],
    operationalHandoverRef: { ref: `handoff:${handoffPackageId}`, version: 1 },
    benefitOwnerId: 'benefit-owner',
    kpiMeasurementContractRefs: [{ ref: 'kpi:changeover-minutes', version: 1 }],
  };
  const invalidDelivery = await page.request.post(
    `${base}/delivery-acceptances/${deliveryDecisionId}-invalid/request`,
    {
      headers: { 'x-e2e-actor': 'execution-manager' },
      data: {
        expectedVersion: 0,
        clientRequestId: `aco-delivery-invalid-${runSuffix}`,
        ...deliveryContract,
        benefitOwnerId: '',
      },
    }
  );
  expect(invalidDelivery.ok()).toBeFalsy();
  await api('execution-manager', `/delivery-acceptances/${deliveryDecisionId}/request`, {
    expectedVersion: 0,
    clientRequestId: `aco-delivery-request-${runSuffix}`,
    ...deliveryContract,
  });
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'delivery-authority' });
  await page.goto(
    '/tests/e2e/fixtures/initiatives-execution-aco.html?mode=delivery-results-closure'
  );
  const deliveryRow = page.getByRole('row', { name: /Delivery Acceptance/ });
  await deliveryRow.click();
  await page
    .getByLabel('Acceptance rationale')
    .fill('Exact delivery evidence independently accepted.');
  await page.getByRole('button', { name: 'Accept delivery' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'DELIVERY receipt' })).toContainText(
    'DELIVERED'
  );
  const benefitsPackId = `benefits-${deliveryDecisionId}`;
  expect((await current()).initiative.lifecycleState).toBe('DELIVERED');
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-delivery-acceptance-steps-49-50.png',
    fullPage: true,
  });

  const resultsCaseId = `aco-results-${runSuffix}`;
  await api('benefit-owner', `/results-acceptances/${resultsCaseId}/request`, {
    expectedVersion: 0,
    clientRequestId: `aco-results-request-${runSuffix}`,
    packId: benefitsPackId,
    packVersion: 1,
    initiativeId,
    authorityId: 'results-authority',
  });
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'results-authority' });
  await page.reload();
  const resultsRow = page.getByRole('row', { name: /Results Acceptance/ });
  await resultsRow.click();
  await page.getByLabel('Acceptance rationale').fill('KPI baseline requires correction.');
  await page.getByLabel('Results description').fill('Correct weekly KPI baseline evidence.');
  await page.getByLabel('Results ownerId').fill('benefit-owner');
  await page.getByLabel('Results dueAt').fill('2026-12-20T12:00');
  await page.getByRole('button', { name: 'Reject with blockers' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'RESULTS receipt' })).toContainText(
    'DELIVERED'
  );
  expect((await current()).initiative.lifecycleState).toBe('DELIVERED');
  await api('benefit-owner', `/results-acceptances/${resultsCaseId}/request`, {
    expectedVersion: 2,
    clientRequestId: `aco-results-rerequest-${runSuffix}`,
    packId: benefitsPackId,
    packVersion: 1,
    initiativeId,
    authorityId: 'results-authority',
  });
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'results-authority' });
  await page.reload();
  await page.getByRole('row', { name: /Results Acceptance/ }).click();
  await page.getByLabel('Acceptance rationale').fill('Corrected Results evidence accepted.');
  await page.getByRole('button', { name: 'Accept results' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'RESULTS receipt' })).toContainText(
    'BENEFITS_TRACKING'
  );
  expect((await current()).initiative).toMatchObject({
    lifecycleState: 'BENEFITS_TRACKING',
    resultsCaseId,
  });
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-results-acceptance-steps-51-52.png',
    fullPage: true,
  });

  const observationId = `aco-results-observation-${runSuffix}`;
  const notMeasuredObservationId = `aco-results-not-measured-${runSuffix}`;
  const financeId = `aco-finance-${runSuffix}`;
  const effectivenessId = `aco-effectiveness-${runSuffix}`;
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'benefit-owner' });
  await page.reload();
  await page.getByLabel('Finance reconciliation ID').fill(financeId);
  await page.getByLabel('Finance reconciliation contract JSON').fill(
    JSON.stringify({
      projectId: 'operations-transformation-2027',
      status: 'AVAILABLE',
      sourceRef: { ref: 'finance:ledger', version: 5 },
      asOf: '2026-12-17T00:00:00.000Z',
      currency: 'PLN',
      amount: 58,
      rationale: 'Reconciled closed period.',
      ownerId: 'finance-owner',
    })
  );
  await page.getByRole('button', { name: 'Create Finance reconciliation' }).click();
  const observationContract = {
    resultsCaseRef: { resultsCaseId, version: 4 },
    kpiId: 'weekly-changeover-minutes',
    baselineValue: 95,
    observedValue: 58,
    targetValue: 58,
    formula: 'median(changeover_minutes)',
    unit: 'minutes',
    currency: null,
    window: {
      start: '2026-12-07T00:00:00.000Z',
      end: '2026-12-14T00:00:00.000Z',
      cadence: 'P1W',
    },
    sourceRef: { ref: 'results:changeover-weekly', version: 7 },
    asOf: '2026-12-14T00:00:00.000Z',
    confidence: 'HIGH',
    knowledgeState: 'KNOWN',
    measurementState: 'MEASURED',
    financeReconciliationRef: null,
    rationale: 'Accepted weekly 95 to 58 minute observation.',
    producerId: 'benefit-owner',
  };
  await page.getByLabel('Results KPI observation ID').fill(observationId);
  await page
    .getByLabel('Results KPI observation contract JSON')
    .fill(JSON.stringify(observationContract));
  await page.getByRole('button', { name: 'Create Results KPI observation' }).click();
  await expect(page.getByLabel(`Select observation ${observationId}`)).toBeVisible();
  await page.getByLabel('Results KPI observation ID').fill(notMeasuredObservationId);
  await page.getByLabel('Results KPI observation contract JSON').fill(
    JSON.stringify({
      ...observationContract,
      kpiId: 'weekly-benefit-value-pln',
      currency: 'PLN',
      unit: 'PLN',
      measurementState: 'NOT_MEASURED',
      observedValue: 0,
      knowledgeState: 'KNOWN',
      confidence: 'HIGH',
      financeReconciliationRef: { reconciliationId: financeId, version: 1 },
      rationale: 'Explicit NOT_MEASURED path must preserve UNKNOWN, never zero.',
    })
  );
  await page.getByRole('button', { name: 'Create Results KPI observation' }).click();
  await expect(page.getByLabel(`Select observation ${notMeasuredObservationId}`)).toBeVisible();
  const notMeasuredReadback = (
    await api('benefit-owner', `/results-observations?resultsCaseId=${resultsCaseId}`)
  ).items.find(
    (item: { observationId: string }) => item.observationId === notMeasuredObservationId
  );
  expect(notMeasuredReadback).toMatchObject({
    observedValue: null,
    knowledgeState: 'UNKNOWN',
    confidence: 'UNKNOWN',
    financeReconciliationRef: null,
  });
  await page.getByLabel(`Select observation ${observationId}`).check();
  await page.getByLabel(`Select observation ${notMeasuredObservationId}`).check();
  await page.getByLabel('Effectiveness Case ID').fill(effectivenessId);
  await page.getByLabel('Effectiveness Case contract JSON').fill(
    JSON.stringify({
      initiativeId,
      executionCaseId,
      benefitsHandoffPackRef: { packId: benefitsPackId, version: 1 },
      resultsAcceptanceRef: { resultsCaseId, version: 4 },
      benefitOwnerId: 'benefit-owner',
      reviewerId: 'effectiveness-reviewer',
      closureAuthorityId: 'closure-authority',
    })
  );
  await page.getByRole('button', { name: 'Create with selected exact observations' }).click();
  const effectivenessRow = page.getByRole('row', { name: new RegExp(effectivenessId) });
  await expect(effectivenessRow).toContainText(/tracking/i);
  await effectivenessRow.click();
  await page.getByRole('button', { name: 'Request review' }).click();
  await expect
    .poll(async () => {
      const item = (await api('benefit-owner', '/effectiveness')).items.find(
        (candidate: { effectivenessCaseId: string }) =>
          candidate.effectivenessCaseId === effectivenessId
      );
      return item?.status ?? null;
    })
    .toBe('PENDING_REVIEW');
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'effectiveness-reviewer' });
  await page.reload();
  const effectivenessReviewRow = page.getByRole('row', { name: new RegExp(effectivenessId) });
  await expect(effectivenessReviewRow).toContainText(/pending review/i);
  await effectivenessReviewRow.click();
  await page.getByLabel('Effectiveness rationale').fill('Independent Results evidence confirmed.');
  await page.getByRole('button', { name: 'CONFIRMED' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Effectiveness Snapshot' })
  ).toContainText('CONFIRMED');
  const reviewedInitiative = await current();
  expect(reviewedInitiative.initiative.lifecycleState).toBe('EFFECTIVENESS_REVIEWED');
  const effectivenessReadback = (await api('effectiveness-reviewer', '/effectiveness')).items.find(
    (item: { effectivenessCaseId: string }) => item.effectivenessCaseId === effectivenessId
  );
  expect(effectivenessReadback).toMatchObject({ status: 'REVIEWED', reviewOutcome: 'CONFIRMED' });
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-results-effectiveness-steps-53-55.png',
    fullPage: true,
  });

  const closureCaseId = `aco-closure-${runSuffix}`;
  const closureSnapshotId = `aco-closure-snapshot-${runSuffix}`;
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'benefit-owner' });
  await page.reload();
  await page.getByLabel('Closure Effectiveness Case').selectOption(effectivenessId);
  await page.getByLabel('Closure request closureCaseId').fill(closureCaseId);
  await page.getByLabel('Closure request authorityId').fill('closure-authority');
  await page
    .getByLabel('Closure request lessons')
    .fill('Retain weekly owner and evidence lineage from mobilization.');
  await page
    .getByLabel('Closure request lineageRefs')
    .fill(`results:${resultsCaseId}@4\neffectiveness:${effectivenessId}@3`);
  await page.getByLabel('Closure request followUpKind').fill('OWNED_ITEM');
  await page.getByLabel('Closure request followUpItemId').fill(`sustain-${runSuffix}`);
  await page
    .getByLabel('Closure request followUpDescription')
    .fill('Quarterly sustainment review.');
  await page.getByLabel('Closure request followUpOwnerId').fill('benefit-owner');
  await page.getByLabel('Closure request followUpDueAt').fill('2027-03-31T12:00');
  await page.getByLabel('Closure request retentionClassification').fill('TRANSFORMATION_RECORD');
  await page.getByLabel('Closure request retentionPolicyRef').fill('retention-policy');
  await page.getByLabel('Closure request retentionPolicyVersion').fill('3');
  await page.getByRole('button', { name: 'Request independent Closure' }).click();
  const closureRow = page.getByRole('row', { name: new RegExp(closureCaseId) });
  await expect(closureRow).toContainText(/pending/i);
  await page.setExtraHTTPHeaders({ 'x-e2e-actor': 'closure-authority' });
  await page.reload();
  const closureSignoffRow = page.getByRole('row', { name: /Gate Sign-off CLOSURE/ });
  await closureSignoffRow.click();
  await page.getByLabel('Sign-off rationale').fill('Independent closure quorum approved.');
  await page.getByRole('button', { name: 'Record my sign-off' }).click();
  await expect(page.getByText(/APPROVE recorded for CLOSURE/)).toBeVisible();
  await page.getByRole('row', { name: new RegExp(closureCaseId) }).click();
  await page.getByLabel('Closure outcome').selectOption('CLOSE');
  await page.getByLabel('Closure rationale').fill('Lessons, follow-up and retention accepted.');
  await page.getByLabel('Closure Snapshot ID').fill(closureSnapshotId);
  await page.getByRole('button', { name: 'Decide Closure' }).click();
  await expect(page.getByRole('status').filter({ hasText: closureSnapshotId })).toContainText(
    'CLOSED'
  );
  expect((await current()).initiative.lifecycleState).toBe('CLOSED');

  await page.reload();
  await page.getByRole('row', { name: new RegExp(closureCaseId) }).click();
  await page.getByLabel('Legal hold').check();
  await expect(page.getByRole('alert').filter({ hasText: 'Archive blocked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Archive Manifest' })).toBeDisabled();
  await page.getByLabel('Legal hold').uncheck();
  await page.getByLabel('Retention policy ref').fill('retention-policy');
  await page.getByLabel('Archive export ref').fill(`export:${closureSnapshotId}`);
  await page.getByRole('button', { name: 'Create Archive Manifest' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Archive Manifest' })).toContainText(
    'read-only'
  );
  const archived = await current();
  expect(archived.initiative.lifecycleState).toBe('ARCHIVED');
  const archivedVersion = archived.version;
  const archivedWorkReadback = await api(
    'records-manager',
    `/execution-cases/${executionCaseId}/work`
  );
  const archiveManifestReadback = await api('records-manager', '/archives');
  const mutationAfterArchive = await page.request.post(
    `${base}/execution-cases/${executionCaseId}/tasks/forbidden-${runSuffix}`,
    {
      headers: { 'x-e2e-actor': 'execution-manager' },
      data: {
        expectedVersion: 0,
        expectedCaseVersion: (await api('execution-manager', `/execution-cases/${executionCaseId}`))
          .version,
        clientRequestId: `aco-archive-mutation-${runSuffix}`,
        executionCaseId,
        initiativeId,
        title: 'Forbidden archived mutation',
        description: 'Must remain read-only.',
        assigneeId: 'controls-engineer',
        ownerId: 'execution-manager',
        dueAt: '2027-01-01T00:00:00.000Z',
        slaAt: '2026-12-31T00:00:00.000Z',
        evidenceRefs: ['forged:restore'],
        blockerDecisionIds: [],
        dependencyTaskIds: [],
        milestoneIds: [],
      },
    }
  );
  expect(mutationAfterArchive.ok()).toBeFalsy();
  const forgedSecondArchive = await page.request.post(`${base}/archives/forged-${runSuffix}`, {
    headers: { 'x-e2e-actor': 'records-manager' },
    data: {
      expectedVersion: 0,
      clientRequestId: `aco-forged-restore-${runSuffix}`,
      initiativeId,
      expectedInitiativeVersion: archivedVersion,
      closureSnapshotRef: { snapshotId: closureSnapshotId, version: 1 },
      retentionPolicyRef: { ref: 'restore-not-supported', version: 1 },
      legalHold: false,
      exportRefs: [{ ref: 'forged:restore', version: 1 }],
    },
  });
  expect(forgedSecondArchive.ok()).toBeFalsy();
  const forgedRestore = await page.request.post(`${base}/initiatives/${initiativeId}/restore`, {
    headers: { 'x-e2e-actor': 'records-manager' },
    data: {
      expectedVersion: archivedVersion,
      clientRequestId: `aco-forged-restore-route-${runSuffix}`,
      lifecycleState: 'IN_EXECUTION',
    },
  });
  expect([403, 404]).toContain(forgedRestore.status());
  expect((await current()).version).toBe(archivedVersion);
  expect((await current()).initiative.lifecycleState).toBe('ARCHIVED');
  expect(await api('records-manager', `/execution-cases/${executionCaseId}/work`)).toEqual(
    archivedWorkReadback
  );
  expect(await api('records-manager', '/archives')).toEqual(archiveManifestReadback);
  await page.screenshot({
    path: 'docs/implementation/evidence/aco-browser-closure-archive-steps-56-59.png',
    fullPage: true,
  });
});
