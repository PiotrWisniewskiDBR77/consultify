import type express from 'express';
import request from 'supertest';

import { aiInputHash } from '../../../../server/src/domain/initiatives-execution/aiEvidenceGovernance';
import { ANALYSIS_CARD_KEYS } from '../../../../server/src/domain/initiatives-execution/analysisReadiness';

export interface GoldenThreadFixture {
  organizationId: string;
  projectId: string;
  proposalId: string;
  proposalVersion: number;
  sourceVersion: number;
  initiativeId: string;
  initiativeVersion: number;
  lifecycleState: 'READY_FOR_DECISION';
  definitionDecisionId: string;
  analysisDecisionId: string;
  policy: { policyId: string; policyVersion: number };
  cardVersions: Record<string, number>;
  quorumRefs: Record<
    'DEFINITION' | 'ANALYSIS',
    { quorumId: string; version: number; receiptId: string }
  >;
}

export async function createInitiativesAnalysisGoldenThread(
  app: express.Express,
  input: {
    prefix?: string;
    organizationId?: string;
    projectId?: string;
    title?: string;
    problem?: string;
    proposedOutcome?: string;
    ownerId?: string;
    reviewerId?: string;
    authorityId?: string;
    financeActorId?: string;
    technicalActorId?: string;
    runtimeBasePath?: string;
    headersForActor?: (actorId: string) => Record<string, string>;
    sourceType?: string;
    sourceId?: string;
    sourceVersion?: number;
    provenanceSystem?: string;
    provenanceRecordType?: string;
    provenanceEvidenceRefs?: string[];
    immutableSource?: boolean;
  } = {}
): Promise<GoldenThreadFixture> {
  const prefix = input.prefix ?? 'golden';
  const organizationId = input.organizationId ?? 'org-golden-thread';
  const projectId = input.projectId ?? 'project-golden-thread';
  const proposalId = `${prefix}-proposal`;
  const initiativeId = `${prefix}-initiative`;
  const owner = input.ownerId ?? `${prefix}-owner`;
  const reviewer = input.reviewerId ?? `${prefix}-reviewer`;
  const authority = input.authorityId ?? `${prefix}-gate-authority`;
  const financeActor = input.financeActorId ?? `${prefix}-finance`;
  const technicalActor = input.technicalActorId ?? `${prefix}-technical`;
  const title = input.title ?? 'Golden thread initiative';
  const problem = input.problem ?? 'Observed operating loss requires governed intervention.';
  const proposedOutcome = input.proposedOutcome ?? 'Recover measurable operating capacity.';
  const runtimeBasePath = input.runtimeBasePath ?? '/runtime-v1';
  const sourceType = input.sourceType ?? 'discovery-insight';
  const sourceId = input.sourceId ?? `${prefix}-source`;
  const sourceVersion = input.sourceVersion ?? 1;
  const provenanceSystem = input.provenanceSystem ?? 'golden-thread';
  const provenanceRecordType = input.provenanceRecordType ?? sourceType;
  const provenanceEvidenceRefs = input.provenanceEvidenceRefs ?? [`evidence:${prefix}:source:v1`];
  const withActor = <T extends request.Test>(test: T, actor: string): T => {
    test.set('x-test-user', actor).set('x-test-org', organizationId);
    const headers = input.headersForActor?.(actor);
    if (headers) test.set(headers);
    return test;
  };
  const api = (actor: string) => ({
    get: (url: string) => withActor(request(app).get(url), actor),
    post: (url: string) => withActor(request(app).post(url), actor),
  });

  const submitted = await api(owner)
    .post(`${runtimeBasePath}/source-proposals`)
    .send({
      proposalId,
      expectedVersion: 0,
      clientRequestId: `${prefix}-source-submit`,
      sourceType,
      sourceId,
      sourceVersion,
      provenance: {
        system: provenanceSystem,
        recordType: provenanceRecordType,
        capturedAt: '2026-08-10T00:00:00.000Z',
        evidenceRefs: provenanceEvidenceRefs,
      },
      title,
      problem,
      proposedOutcome,
      projectId,
      initiativeOwnerId: owner,
      visibility: 'PROJECT',
    })
    .expect(201);
  const policy = {
    policyId:
      submitted.body.proposal.policyRef?.policyId ?? submitted.body.response.policy.policyId,
    policyVersion:
      submitted.body.proposal.policyRef?.policyVersion ??
      submitted.body.response.policy.policyVersion,
  };
  const registered = await api(owner)
    .post(`${runtimeBasePath}/registrations`)
    .send({
      initiativeId,
      expectedVersion: 0,
      clientRequestId: `${prefix}-register`,
      proposalId,
      proposalVersion: 1,
      sourceType,
      sourceId,
      sourceVersion,
      title,
      problem,
      proposedOutcome,
      projectId,
      visibility: 'PROJECT',
      initiativeOwnerId: owner,
    })
    .expect(201);
  let initiativeVersion = registered.body.aggregateVersion as number;
  const definition: Record<string, Record<string, unknown>> = {
    'summary-scope': {
      problem: 'Operating loss',
      outcome: 'Recovered capacity',
      inScope: ['Line A'],
      outOfScope: ['Unrelated lines'],
    },
    'strategic-fit': { objectives: ['OEE'], rationale: 'Strategic capacity recovery' },
    'success-criteria': { successCriteria: ['OEE +5pp'], measurementPlan: 'Weekly' },
    'outcomes-benefits': { outcomes: ['Stable flow'], benefits: ['Recovered hours'] },
    options: { doNothing: 'Accept loss', alternatives: ['SMED'], recommendedOption: 'SMED' },
    'people-team': { team: ['Operations'], capacityAssumptions: 'Estimated' },
    'roles-raci': { accountableOwnerId: owner, roles: ['Operations'] },
    stakeholders: { ownerId: owner, sponsorId: authority },
  };
  const cardVersions: Record<string, number> = {};
  const publishReview = async (
    cardKey: string,
    content: Record<string, unknown>,
    suffix: string
  ) => {
    const expectedCardVersion = cardVersions[cardKey] ?? 0;
    const published = await api(owner)
      .post(`${runtimeBasePath}/initiatives/${initiativeId}/cards/${cardKey}/publications`)
      .send({
        expectedVersion: initiativeVersion,
        expectedCardVersion,
        clientRequestId: `${prefix}-${suffix}-${cardKey}-publish`,
        applicability: 'REQUIRED',
        completion: 'COMPLETE',
        quality: 'SUFFICIENT',
        freshness: 'CURRENT',
        reviewState: 'REQUESTED',
        content,
        evidenceRefs: [`evidence:${prefix}:${cardKey}:${suffix}`],
        waiverDecisionId: null,
      })
      .expect(201);
    initiativeVersion = published.body.aggregateVersion;
    cardVersions[cardKey] = expectedCardVersion + 1;
    const reviewed = await api(reviewer)
      .post(`${runtimeBasePath}/initiatives/${initiativeId}/cards/${cardKey}/reviews`)
      .send({
        expectedVersion: initiativeVersion,
        expectedCardVersion: cardVersions[cardKey],
        clientRequestId: `${prefix}-${suffix}-${cardKey}-review`,
        outcome: 'ACCEPTED',
        rationale: 'Independent evidence review.',
      })
      .expect(201);
    initiativeVersion = reviewed.body.aggregateVersion;
    cardVersions[cardKey] += 1;
  };
  for (const [key, content] of Object.entries(definition))
    await publishReview(key, content, 'definition-v1');

  const remediation = await api(owner)
    .post(`${runtimeBasePath}/initiatives/${initiativeId}/definition-remediation`)
    .send({
      expectedVersion: initiativeVersion,
      clientRequestId: `${prefix}-remediation`,
      findingId: 'definition:financial-analysis:EVIDENCE_REQUIRED',
      financeTask: {
        taskId: `${prefix}-finance-task`,
        title: 'Reconcile evidence',
        assigneeId: financeActor,
        dueAt: '2026-08-20T12:00:00.000Z',
      },
      technicalDecision: {
        decisionId: `${prefix}-technical-decision`,
        title: 'Select option',
        authorityId: technicalActor,
        dueAt: '2026-08-20T12:00:00.000Z',
        options: ['Do nothing', 'SMED'],
      },
    })
    .expect(201);
  initiativeVersion = remediation.body.aggregateVersion;
  await api(financeActor)
    .post(`${runtimeBasePath}/my-work/definition-remediation/task/${prefix}-finance-task/resolve`)
    .send({
      expectedVersion: 1,
      clientRequestId: `${prefix}-finance-resolve`,
      workType: 'FINANCE_EVIDENCE',
      evidenceRefs: [`finance:${prefix}:v1`],
    })
    .expect(200);
  await api(technicalActor)
    .post(
      `${runtimeBasePath}/my-work/definition-remediation/decision/${prefix}-technical-decision/resolve`
    )
    .send({
      expectedVersion: 1,
      clientRequestId: `${prefix}-technical-resolve`,
      workType: 'TECHNICAL_OPTION',
      selectedOption: 'SMED',
      rationale: 'Evidence-supported option.',
    })
    .expect(200);

  let finalProposalVersion = 1;
  let finalSourceVersion = sourceVersion;
  if (!input.immutableSource) {
    await api(owner)
      .post(`${runtimeBasePath}/source-proposals/${proposalId}/revisions`)
      .send({
        expectedVersion: 1,
        expectedProposalVersion: 2,
        expectedSourceVersion: sourceVersion,
        sourceVersion: sourceVersion + 1,
        clientRequestId: `${prefix}-source-revise`,
        projectId,
        provenance: {
          system: provenanceSystem,
          recordType: provenanceRecordType,
          capturedAt: '2026-08-11T00:00:00.000Z',
          evidenceRefs: [...provenanceEvidenceRefs, `evidence:${prefix}:source:revision`],
        },
      })
      .expect(201);

    const refreshed = await api(owner)
      .post(`${runtimeBasePath}/initiatives/${initiativeId}/source-refresh`)
      .send({
        expectedVersion: initiativeVersion,
        clientRequestId: `${prefix}-source-refresh`,
        expectedProposalVersion: 3,
        expectedSourceVersion: sourceVersion + 1,
      })
      .expect(201);
    initiativeVersion = refreshed.body.aggregateVersion;
    for (const key of Object.keys(definition)) cardVersions[key] += 1;
    for (const [key, content] of Object.entries(definition))
      await publishReview(key, content, 'definition-v2');
    finalProposalVersion = 3;
    finalSourceVersion = sourceVersion + 1;
  }

  const quorumRefs = {} as GoldenThreadFixture['quorumRefs'];
  const decideGate = async (gate: 'DEFINITION' | 'ANALYSIS', decisionId: string) => {
    const base = gate.toLowerCase();
    const readiness = await api(owner)
      .get(`${runtimeBasePath}/initiatives/${initiativeId}/gates/${base}/readiness`)
      .expect(200);
    if (readiness.body.readiness !== 'READY')
      throw new Error(`${gate} readiness: ${JSON.stringify(readiness.body)}`);
    const requested = await api(owner)
      .post(`${runtimeBasePath}/initiatives/${initiativeId}/gates/${base}/requests`)
      .send({
        expectedVersion: initiativeVersion,
        clientRequestId: `${prefix}-${base}-request`,
        decisionId,
        authorityId: authority,
        dueAt: '2026-08-25T12:00:00.000Z',
      })
      .expect(201);
    initiativeVersion = requested.body.aggregateVersion;
    const queue = await api(authority).get(`${runtimeBasePath}/my-work/gate-signoffs`).expect(200);
    const item = queue.body.items.find((candidate: any) => candidate.decisionId === decisionId);
    const binding = item.actorBindings.find((candidate: any) => candidate.eligible);
    await api(authority)
      .post(`${runtimeBasePath}/initiatives/${initiativeId}/gate-signoffs`)
      .send({
        expectedVersion: 0,
        expectedQuorumVersion: item.quorum.version,
        clientRequestId: `${prefix}-${base}-signoff`,
        gate,
        decisionId,
        requesterId: owner,
        roleKey: binding.roleKey,
        outcome: 'APPROVE',
        delegationProof: binding.delegationProof,
        rationale: 'Gate evidence accepted.',
      })
      .expect(200);
    const after = await api(authority).get(`${runtimeBasePath}/my-work/gate-signoffs`).expect(200);
    const satisfied = after.body.items.find(
      (candidate: any) => candidate.decisionId === decisionId
    );
    quorumRefs[gate] = {
      quorumId: satisfied.quorum.quorumId,
      version: satisfied.quorum.version,
      receiptId: satisfied.quorum.receiptId,
    };
    const decided = await api(authority)
      .post(`${runtimeBasePath}/initiatives/${initiativeId}/gates/${base}/decisions`)
      .send({
        expectedVersion: initiativeVersion,
        clientRequestId: `${prefix}-${base}-decide`,
        decisionId,
        outcome: 'APPROVED',
        rationale: 'Independent approval.',
        governanceQuorumRef: quorumRefs[gate],
      })
      .expect(201);
    initiativeVersion = decided.body.aggregateVersion;
  };
  const definitionDecisionId = `${prefix}-definition-decision`;
  await decideGate('DEFINITION', definitionDecisionId);

  const started = await api(owner)
    .post(`${runtimeBasePath}/initiatives/${initiativeId}/gates/analysis/start`)
    .send({ expectedVersion: initiativeVersion, clientRequestId: `${prefix}-analysis-start` })
    .expect(201);
  initiativeVersion = started.body.aggregateVersion;
  const analysisValues: Record<string, Record<string, unknown>> = {
    options: { doNothing: 'Continue loss', alternatives: ['SMED'], recommendedOption: 'SMED' },
    'financial-analysis': { financeRef: 'finance:v1', scenarioVersion: 1 },
    kpi: { kpiRefs: ['kpi:oee'], measurementPlan: 'Weekly' },
    'resources-capacity': { capacityEstimate: 2, confidence: 'MEDIUM' },
    dependencies: { dependencies: ['maintenance-window'] },
    'risk-raid': { risks: ['adoption'], accountableOwners: [owner] },
    'technical-specification': { technicalAssessment: 'Feasible' },
    'change-adoption': { changeImpact: 'Operator training' },
    stakeholders: { ownerId: owner, sponsorId: authority },
    'feasibility-completeness': { feasibilityConclusion: 'Feasible' },
  };
  for (const key of ANALYSIS_CARD_KEYS)
    await publishReview(
      key,
      {
        ...analysisValues[key],
        challenge: 'What would falsify this?',
        counterEvidence: ['counter:e1'],
        acceptedHumanTruth: 'Accepted after challenge.',
      },
      'analysis'
    );

  const aiCard = 'technical-specification';
  const aiProposalId = `${prefix}-ai-proposal`;
  await api(owner)
    .post(`${runtimeBasePath}/ai-analysis-proposals/${aiProposalId}`)
    .send({
      expectedVersion: 0,
      clientRequestId: `${prefix}-ai-create`,
      initiativeId,
      initiativeVersion,
      cardKey: aiCard,
      cardVersion: cardVersions[aiCard],
      sourceRef: { aggregateType: 'source_proposal', aggregateId: proposalId, version: finalProposalVersion },
      model: { provider: 'openai', model: 'golden-model', version: '1' },
      prompt: { promptId: 'analysis', version: 1 },
      template: { templateId: aiCard, version: 1 },
      inputHash: aiInputHash({ proposalId, version: finalProposalVersion }),
      output: { technicalAssessment: 'AI candidate' },
      evidenceRefs: [{ ref: 'evidence:ai', version: 1 }],
      counterEvidenceRefs: [{ ref: 'counter:ai', version: 1 }],
      confidence: 'MEDIUM',
      requestedBy: owner,
      authorizedReviewerId: reviewer,
    })
    .expect(200);
  await api(reviewer)
    .post(`${runtimeBasePath}/ai-analysis-proposals/${aiProposalId}/review`)
    .send({
      expectedVersion: 1,
      clientRequestId: `${prefix}-ai-review`,
      outcome: 'EDIT',
      rationale: 'Human corrected.',
      editedFragment: {
        technicalAssessment: 'Human accepted assessment',
        acceptedHumanTruth: 'Human accepted assessment',
      },
    })
    .expect(200);
  initiativeVersion += 1;
  cardVersions[aiCard] += 1;
  const cardsAfterAi = await api(owner)
    .get(`${runtimeBasePath}/initiatives/${initiativeId}/cards`)
    .expect(200);
  const aiTruthCard = cardsAfterAi.body.cards.find((card: any) => card.cardKey === aiCard);
  const republishedAiTruth = await api(owner)
    .post(`${runtimeBasePath}/initiatives/${initiativeId}/cards/${aiCard}/publications`)
    .send({
      expectedVersion: initiativeVersion,
      expectedCardVersion: cardVersions[aiCard],
      clientRequestId: `${prefix}-ai-truth-request-review`,
      applicability: 'REQUIRED',
      completion: 'COMPLETE',
      quality: 'SUFFICIENT',
      freshness: 'CURRENT',
      reviewState: 'REQUESTED',
      content: aiTruthCard.content,
      evidenceRefs: aiTruthCard.evidenceRefs,
      waiverDecisionId: null,
    })
    .expect(201);
  initiativeVersion = republishedAiTruth.body.aggregateVersion;
  cardVersions[aiCard] += 1;
  const aiReviewed = await api(reviewer)
    .post(`${runtimeBasePath}/initiatives/${initiativeId}/cards/${aiCard}/reviews`)
    .send({
      expectedVersion: initiativeVersion,
      expectedCardVersion: cardVersions[aiCard],
      clientRequestId: `${prefix}-ai-card-review`,
      outcome: 'ACCEPTED',
      rationale: 'AI lineage and human truth verified.',
    })
    .expect(201);
  initiativeVersion = aiReviewed.body.aggregateVersion;
  cardVersions[aiCard] += 1;

  const analysisDecisionId = `${prefix}-analysis-decision`;
  await decideGate('ANALYSIS', analysisDecisionId);
  const reloaded = await api(owner).get(`${runtimeBasePath}/initiatives/${initiativeId}`).expect(200);
  if (reloaded.body.initiative.lifecycleState !== 'READY_FOR_DECISION')
    throw new Error('Golden thread did not reach READY_FOR_DECISION');
  return {
    organizationId,
    projectId,
    proposalId,
    proposalVersion: finalProposalVersion,
    sourceVersion: finalSourceVersion,
    initiativeId,
    initiativeVersion,
    lifecycleState: 'READY_FOR_DECISION',
    definitionDecisionId,
    analysisDecisionId,
    policy,
    cardVersions,
    quorumRefs,
  };
}
