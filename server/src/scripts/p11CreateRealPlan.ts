import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { decideAnalysis, requestAnalysisDecision, startAnalysis } from '../domain/initiatives-execution/analysisDecision.js';
import { decideDefinition, requestDefinitionDecision } from '../domain/initiatives-execution/definitionDecision.js';
import type { MaterialCommandEnvelope } from '../domain/initiatives-execution/materialCommand.js';
import { mutatePlanScenario, type PlanScenario } from '../domain/initiatives-execution/planScenario.js';
import { decidePortfolio, requestPortfolioDecision } from '../domain/initiatives-execution/portfolioDecision.js';
import { mutatePortfolioScenario, type PortfolioScenario } from '../domain/initiatives-execution/portfolioScenario.js';
import { PostgresMaterialCommandUnitOfWork } from '../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import { publishInitiativeCard } from '../domain/initiatives-execution/publishInitiativeCard.js';
import { registerInitiative } from '../domain/initiatives-execution/registerInitiative.js';
import { reviewInitiativeCard } from '../domain/initiatives-execution/reviewInitiativeCard.js';
import { submitSourceProposal } from '../domain/initiatives-execution/submitSourceProposal.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL?.includes('127.0.0.1:54400/consultify_noc')) throw new Error('STOP: P11 script requires local consultify_noc on 54400');

const organizationId = 'cc9db573-260f-4a19-927f-f3cc1fbaea38';
const actorId = '76015d70-9117-444f-97a6-4f5eda9d7ad5';
const projectId = '11111111-2222-4333-8444-555555555555';
const portfolioId = 'p11-dec421-portfolio-20260906';
const planId = 'p11-dec421-plan-20260906';
const initiatives = [
  ['init-drd-test-02', 'AI Predictive Quality System'],
  ['init-drd-final-02', 'AI Governance & Ethics Framework'],
  ['init-adma-04', 'Change Management & Digital Culture Program'],
  ['init-siri-02', 'Predictive Maintenance — CNC Machines'],
  ['init-siri-01', 'OPC-UA Migration & Industrial Connectivity Standard'],
] as const;

const pool = new Pool({ connectionString: DATABASE_URL });
const uow = new PostgresMaterialCommandUnitOfWork(pool);
const policy = { policyId: 'p11-dec421-owner-decision', policyVersion: 1 };
const envelope = <T>(aggregateType: string, aggregateId: string, expectedVersion: number, commandType: string, payload: T, createIfMissing = false): MaterialCommandEnvelope<T> => ({
  organizationId, actorId, aggregateType, aggregateId, expectedVersion,
  clientRequestId: randomUUID(), correlationId: randomUUID(), ...policy, commandType, createIfMissing, payload,
});

const commonContent = {
  problem: 'Realny zakres DEC-421 dla planu transformacji DBR77.', outcome: 'Zweryfikowany wynik inicjatywy.',
  inScope: ['Zakres DBR77'], outOfScope: ['Produkcja i staging'], objectives: ['DEC-421'], rationale: 'Decyzja CTO P11.',
  successCriteria: ['Odbiór na realnym planie'], measurementPlan: 'Pomiar tygodniowy', outcomes: ['Rezultat biznesowy'], benefits: ['Przewidywalność'],
  doNothing: 'Utrzymanie stanu obecnego', alternatives: ['Realizacja etapowa'], recommendedOption: 'Realizacja etapowa',
  team: ['Controls Engineer'], capacityAssumptions: ['Dostępność mniejsza niż popyt'], accountableOwnerId: actorId,
  roles: ['Controls Engineer'], ownerId: actorId, sponsorId: actorId, financeRef: 'P11-DEC-421', scenarioVersion: 1,
  kpiRefs: ['P11-flow'], capacityEstimate: 'Controls Engineer: 2 FTE popytu / 1 FTE podaży', confidence: 'HIGH',
  dependencies: ['Wspólna dostępność Controls Engineer'], risks: ['Przeciążenie roli'], accountableOwners: [actorId],
  technicalAssessment: 'Wykonalne w horyzoncie 12 tygodni', changeImpact: 'Wymaga koordynacji portfela',
  feasibilityConclusion: 'Wykonalne po rozwiązaniu przeciążenia', challenge: 'Ograniczona podaż Controls Engineer',
  counterEvidence: 'Brak dodatkowego etatu w horyzoncie', acceptedHumanTruth: 'Plan zawiera jawne przeciążenie Controls Engineer.',
};
const cardKeys = ['summary-scope','strategic-fit','success-criteria','outcomes-benefits','options','people-team','roles-raci','stakeholders','financial-analysis','kpi','resources-capacity','dependencies','risk-raid','technical-specification','change-adoption','feasibility-completeness'];

async function prepareInitiative(initiativeId: string, title: string) {
  const proposalId = `p11-dec421-proposal-${initiativeId}`;
  await submitSourceProposal(uow, envelope('source_proposal', proposalId, 0, 'source-proposal.submit', {
    sourceType: 'p11_dec421_owner_decision', sourceId: initiativeId, sourceVersion: 1,
    provenance: { system: 'Consultify', recordType: 'existing_initiative', capturedAt: '2026-09-06T00:00:00.000Z', evidenceRefs: ['docs/program/PROGRAM_NAPRAWCZY_20260905/P11/99_DECYZJE_WLASCICIELA.md'] },
    title, problem: `Zaplanowanie inicjatywy ${title} w portfelu DBR77.`, proposedOutcome: 'Realizacja w horyzoncie 12 tygodni.', priority: 'HIGH' as const,
    projectId, initiativeOwnerId: actorId, visibility: 'PROJECT' as const,
  }, true));
  let version = 1;
  await registerInitiative(uow, envelope('initiative', initiativeId, 0, 'initiative.register', {
    proposalId, proposalVersion: 1, sourceType: 'p11_dec421_owner_decision', sourceId: initiativeId, sourceVersion: 1,
    title, problem: `Zaplanowanie inicjatywy ${title} w portfelu DBR77.`, proposedOutcome: 'Realizacja w horyzoncie 12 tygodni.', priority: 'HIGH' as const,
    projectId, visibility: 'PROJECT' as const, initiativeOwnerId: actorId, validatorCapability: 'INITIATIVE_REGISTER' as const,
  }, true));
  for (const cardKey of cardKeys) {
    await publishInitiativeCard(uow, envelope('initiative', initiativeId, version, 'initiative.card.publish', {
      cardKey, expectedCardVersion: 0, applicability: 'REQUIRED' as const, completion: 'COMPLETE' as const,
      quality: 'SUFFICIENT' as const, freshness: 'CURRENT' as const, reviewState: 'REQUESTED' as const,
      content: commonContent, evidenceRefs: ['P11-DEC-421-owner-decision'], waiverDecisionId: null,
    })); version += 1;
    await reviewInitiativeCard(uow, envelope('initiative', initiativeId, version, 'initiative.card.review', {
      cardKey, expectedCardVersion: 1, outcome: 'ACCEPTED' as const, rationale: 'Jawna akceptacja danych scenariusza P11.', selfApprovalAllowed: true,
    })); version += 1;
  }
  const definitionDecisionId = `p11-definition-${initiativeId}`;
  await requestDefinitionDecision(uow, envelope('initiative', initiativeId, version, 'initiative.definition.request', { decisionId: definitionDecisionId, authorityId: actorId, dueAt: '2026-09-30T00:00:00.000Z', selfApprovalAllowed: true })); version += 1;
  await decideDefinition(uow, envelope('initiative', initiativeId, version, 'initiative.definition.decide', { decisionId: definitionDecisionId, outcome: 'APPROVED' as const, rationale: 'Zakres gotowy do analizy.', selfApprovalAllowed: true })); version += 1;
  await startAnalysis(uow, envelope('initiative', initiativeId, version, 'initiative.analysis.start', {})); version += 1;
  const analysisDecisionId = `p11-analysis-${initiativeId}`;
  await requestAnalysisDecision(uow, envelope('initiative', initiativeId, version, 'initiative.analysis.request', { decisionId: analysisDecisionId, authorityId: actorId, dueAt: '2026-09-30T00:00:00.000Z', selfApprovalAllowed: true })); version += 1;
  await decideAnalysis(uow, envelope('initiative', initiativeId, version, 'initiative.analysis.decide', { decisionId: analysisDecisionId, outcome: 'APPROVED' as const, rationale: 'Analiza gotowa do decyzji portfelowej.', selfApprovalAllowed: true })); version += 1;
  return version;
}

async function main() {
  const existing = await pool.query(`SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2`, [organizationId, planId]);
  if (existing.rows[0]) {
    const currentPortfolio = await pool.query<{ version: number; payload_json: PortfolioScenario }>(`SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='portfolio_scenario' AND aggregate_id=$2`, [organizationId, portfolioId]);
    let portfolioVersion = currentPortfolio.rows[0].version;
    if (portfolioVersion === 2) {
      const updated = await mutatePortfolioScenario(uow, envelope('portfolio_scenario', portfolioId, 2, 'portfolio.scenario.mutate', { operation: 'UPDATE' as const, scenario: currentPortfolio.rows[0].payload_json }));
      const published = await mutatePortfolioScenario(uow, envelope('portfolio_scenario', portfolioId, 3, 'portfolio.scenario.mutate', { operation: 'PUBLISH' as const, scenario: updated.response }));
      portfolioVersion = published.response.scenarioVersion;
    }
    console.log(JSON.stringify({ status: 'EXISTS', planId, portfolioId, clickFlowPortfolioVersion: portfolioVersion, plan: existing.rows[0].payload_json })); return;
  }
  const readyVersions: Record<string, number> = {};
  for (const [id, title] of initiatives) readyVersions[id] = await prepareInitiative(id, title);
  const portfolioDraft: PortfolioScenario = { scenarioId: portfolioId, scenarioVersion: 0, status: 'DRAFT', scope: { portfolioId: projectId, goalIds: [], asOf: '2026-09-06T00:00:00.000Z' }, model: { modelId: 'p11-dec421-owner', version: 1 }, memberships: initiatives.map(([initiativeId], index) => ({ initiativeId, initiativeVersion: readyVersions[initiativeId], disposition: 'INCLUDED', scoreDecomposition: { priority: 5 - index }, rank: index + 1, rankOverride: null, coverage: { state: 'KNOWN', value: 1, basis: 'P11 owner decision' }, overlap: { state: 'KNOWN', value: [], basis: 'P11 owner decision' }, roughDemand: { state: 'KNOWN', value: { unit: 'FTE', low: 1, base: 2, high: 2 }, basis: 'Controls Engineer load' }, confidence: 'HIGH', rationale: 'Zakres realnego planu P11.' })), decompositionKeys: ['priority'], createdBy: '', updatedBy: '', publishedBy: null, publishedAt: null, previousPublishedVersion: null };
  const createdPortfolio = await mutatePortfolioScenario(uow, envelope('portfolio_scenario', portfolioId, 0, 'portfolio.scenario.mutate', { operation: 'CREATE' as const, scenario: portfolioDraft }, true));
  const publishedPortfolio = await mutatePortfolioScenario(uow, envelope('portfolio_scenario', portfolioId, 1, 'portfolio.scenario.mutate', { operation: 'PUBLISH' as const, scenario: createdPortfolio.response }));
  for (const [initiativeId] of initiatives) {
    let version = readyVersions[initiativeId]; const decisionId = `p11-portfolio-${initiativeId}`;
    await requestPortfolioDecision(uow, envelope('initiative', initiativeId, version, 'initiative.portfolio.request', { decisionId, authorityId: actorId, scenarioId: portfolioId, scenarioVersion: publishedPortfolio.response.scenarioVersion, dueAt: '2026-09-30T00:00:00.000Z', selfApprovalAllowed: true })); version += 1;
    await decidePortfolio(uow, envelope('initiative', initiativeId, version, 'initiative.portfolio.decide', { decisionId, outcome: 'APPROVED' as const, rationale: 'Inicjatywa zatwierdzona do realnego planu P11.', conditions: [], mergeTargetInitiativeId: null, selfApprovalAllowed: true })); readyVersions[initiativeId] = version + 1;
  }
  const start = new Date('2026-09-07T00:00:00.000Z');
  const periods = Array.from({ length: 12 }, (_, index) => ({ periodId: `Tydzień ${index + 1}`, start: new Date(start.getTime() + index * 604800000).toISOString(), end: new Date(start.getTime() + (index + 1) * 604800000).toISOString() }));
  const plan: PlanScenario = { scenarioId: planId, name: 'Plan transformacji DBR77 — Controls Engineering', scenarioVersion: 0, status: 'DRAFT', portfolioScenarioId: portfolioId, portfolioScenarioVersion: 2, windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods, windows: initiatives.map(([initiativeId], index) => ({ initiativeId, initiativeVersion: readyVersions[initiativeId], earliest: periods[index].start, target: periods[index + 1].start, latest: periods[Math.min(index + 4, 11)].end, confidence: 'HIGH', rationale: 'Plan 12-tygodniowy zatwierdzony przez właściciela.', dependencySnapshot: index ? [initiatives[index - 1][0]] : [], constraintSnapshot: [{ constraintId: 'controls-engineer-capacity', state: 'KNOWN', detail: 'Controls Engineer: popyt 2 FTE, podaż 1 FTE — przeciążenie 100%.' }] })), assumptions: ['Controls Engineer: podaż 1 FTE wobec popytu 2 FTE.'], createdBy: '', updatedBy: '', publishedBy: null, publishedAt: null };
  const createdPlan = await mutatePlanScenario(uow, envelope('plan_scenario', planId, 0, 'plan.scenario.mutate', { operation: 'CREATE' as const, scenario: plan }, true));
  console.log(JSON.stringify({ status: 'CREATED', planId, portfolioId, aggregateVersion: createdPlan.aggregateVersion, initiativeVersions: readyVersions }));
}

main().finally(() => pool.end());
