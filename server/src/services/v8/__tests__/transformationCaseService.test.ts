import { describe, expect, it } from 'vitest';

import {
  AcceptBenefitsReviewSchema,
  AcceptDeliveryHandoffSchema,
  AcceptDrdResultsSchema,
  AcceptExecutionResultsSchema,
  AcceptExecutionStartSchema,
  AcceptFinanceKpiResultsSchema,
  AcceptInitiativeResultsSchema,
  AcceptInterviewResultsSchema,
  AcceptMobilizationResultsSchema,
  AcceptPortfolioDecisionResultsSchema,
  AcceptSustainabilityReviewSchema,
  ApproveTransformationPlanSchema,
  CancelTransformationCaseSchema,
  CreateTransformationCaseBodySchema,
  ProposeDrdAssessmentSchema,
  ProposeFinanceKpiPackSchema,
  ProposeInitialIdeasSchema,
  ProposeInterviewsSchema,
  ProposeMobilizationBlueprintSchema,
  ProposeOpportunitySynthesisSchema,
  ProposePortfolioDecisionSchema,
  ReviewDrdAssessmentProposalSchema,
  ReviewFinanceKpiPackSchema,
  ReviewInitialIdeasProposalSchema,
  ReviewInterviewsProposalSchema,
  ReviewMobilizationBlueprintSchema,
  ReviewOpportunitySynthesisSchema,
  ReviewPortfolioDecisionSchema,
  ResolvePortfolioDecisionSchema,
  ReviseTransformationCaseSchema,
} from '../../../types/transformationCase.js';
import {
  compileT01TransformationPlan,
  validateAndCompileTransformationPlan,
} from '../transformationCaseService.js';

describe('EPIC-AGENT-T01 transformation plan compiler', () => {
  const editableDraft = () =>
    compileT01TransformationPlan()
      .slice(0, 3)
      .map(({ stepId: _stepId, stepIndex: _index, status: _status, ...step }) => step);

  it('accepts reordered editable steps and assigns canonical indexes', () => {
    const draft = editableDraft();
    const reordered = [draft[0], draft[2], draft[1]];
    expect(validateAndCompileTransformationPlan(reordered).map((step) => step.stepIndex)).toEqual([
      0, 1, 2,
    ]);
  });

  it('rejects missing dependencies and dependency cycles before persistence', () => {
    const missing = editableDraft();
    missing[1] = { ...missing[1], dependsOn: ['not-a-stage'] };
    expect(() => validateAndCompileTransformationPlan(missing)).toThrow(/Unknown dependencies/);

    const cyclic = editableDraft();
    cyclic[0] = { ...cyclic[0], dependsOn: [cyclic[1].lifecycleStage] };
    cyclic[1] = { ...cyclic[1], dependsOn: [cyclic[0].lifecycleStage] };
    expect(() => validateAndCompileTransformationPlan(cyclic)).toThrow(/cycle/i);
  });

  it('preserves server-owned lifecycle and capability truth while allowing safe custom steps', async () => {
    const { enforceAuthoritativeStepTruth } = await import('../transformationCaseService.js');
    const current = compileT01TransformationPlan().slice(0, 2);
    const drafts = current.map(({stepId,stepIndex:_index,status:_status,...step})=>({...step,sourceStepId:stepId}));
    expect(() => enforceAuthoritativeStepTruth(drafts, current)).not.toThrow();
    expect(() => enforceAuthoritativeStepTruth([{...drafts[0],capabilityStatus:'REAL'}],current)).toThrow(/server-owned/);
    expect(() => enforceAuthoritativeStepTruth([{...drafts[0],lifecycleStage:'renamed_stage'}],current)).toThrow(/server-owned/);
    const custom={...drafts[0],sourceStepId:undefined,lifecycleStage:'custom_review',capabilityStatus:'PROPOSAL_ONLY' as const,blockerReason:'No verified runtime capability binding.'};
    expect(() => enforceAuthoritativeStepTruth([...drafts,custom],current)).not.toThrow();
    expect(() => enforceAuthoritativeStepTruth([...drafts,{...custom,capabilityStatus:'REAL',blockerReason:null}],current)).toThrow(/PROPOSAL_ONLY/);
    const referenced=current.map((step,index)=>index===1?{...step,dependsOn:[current[0].lifecycleStage]}:step);
    expect(() => enforceAuthoritativeStepTruth([drafts[1]],referenced)).toThrow(/referenced by/);
  });
  it('compiles the complete Teresa-to-final-output lifecycle in canonical order', () => {
    const plan = compileT01TransformationPlan();

    expect(plan).toHaveLength(15);
    expect(plan.map((step) => step.lifecycleStage)).toEqual([
      'mandate',
      'discovery',
      'initial_ideas',
      'interviews',
      'drd',
      'opportunity_synthesis',
      'initiative_candidates',
      'finance_kpi',
      'portfolio_decision',
      'mobilization',
      'execution',
      'delivery',
      'benefits',
      'sustainability',
      'final_outputs',
    ]);
    expect(plan.map((step) => step.stepIndex)).toEqual([...Array(15).keys()]);
    expect(new Set(plan.map((step) => step.stepId)).size).toBe(15);
  });

  it('reports capability truth and never claims a downstream adapter is real', () => {
    const plan = compileT01TransformationPlan();

    expect(plan[0].capabilityStatus).toBe('PARTIAL');
    expect(plan.slice(1).every((step) => step.capabilityStatus === 'NOT_CONNECTED')).toBe(true);
    expect(plan.every((step) => step.capabilityStatus !== 'REAL')).toBe(true);
    expect(plan.every((step) => Boolean(step.blockerReason))).toBe(true);
  });

  it('keeps every high-impact lifecycle transition behind human approval', () => {
    const plan = compileT01TransformationPlan();
    const governedStages = [
      'mandate',
      'interviews',
      'drd',
      'finance_kpi',
      'initiative_candidates',
      'portfolio_decision',
      'mobilization',
      'delivery',
      'benefits',
      'sustainability',
      'final_outputs',
    ];

    for (const stage of governedStages) {
      expect(plan.find((step) => step.lifecycleStage === stage)?.approvalClass).toBe(
        'requires_human_approval'
      );
    }
  });

  it('validates create, revision and cancellation command boundaries', () => {
    expect(() =>
      CreateTransformationCaseBodySchema.parse({ mandate: 'Plan transformacji' })
    ).not.toThrow();
    expect(() => CreateTransformationCaseBodySchema.parse({ mandate: '' })).toThrow();
    expect(() => ReviseTransformationCaseSchema.parse({ expectedVersion: 1 })).toThrow();
    expect(() =>
      ReviseTransformationCaseSchema.parse({ expectedVersion: 1, mandate: 'Nowy mandat' })
    ).not.toThrow();
    expect(() =>
      CancelTransformationCaseSchema.parse({ expectedVersion: 2, reason: 'Zmiana priorytetów' })
    ).not.toThrow();
  });

  it('requires explicit human decisions around the Ideas materialization boundary', () => {
    expect(() =>
      ApproveTransformationPlanSchema.parse({
        expectedVersion: 1,
        decisionReason: 'Zakres zaakceptowany',
      })
    ).not.toThrow();
    expect(() => ProposeInitialIdeasSchema.parse({ expectedVersion: 2, maxIdeas: 2 })).toThrow();
    expect(() =>
      ProposeInitialIdeasSchema.parse({ expectedVersion: 2, maxIdeas: 5 })
    ).not.toThrow();
    expect(() =>
      ReviewInitialIdeasProposalSchema.parse({
        expectedVersion: 3,
        decision: 'approve',
        reason: 'Hipotezy zaakceptowane',
      })
    ).not.toThrow();
  });

  it('requires a real stakeholder and evidence focus before proposing Interviews', () => {
    expect(() => ProposeInterviewsSchema.parse({ expectedVersion: 4, stakeholders: [] })).toThrow();
    expect(() =>
      ProposeInterviewsSchema.parse({
        expectedVersion: 4,
        stakeholders: [
          {
            assigneeUserId: 'user-1',
            role: 'Operations Director',
            focus: ['lead time', 'handoffs'],
          },
        ],
      })
    ).not.toThrow();
    expect(() =>
      ReviewInterviewsProposalSchema.parse({
        expectedVersion: 5,
        decision: 'approve',
        reason: 'Stakeholders and questions accepted',
        dueAt: '2026-08-14T12:00:00.000Z',
      })
    ).not.toThrow();
    expect(() =>
      AcceptInterviewResultsSchema.parse({
        expectedVersion: 6,
        insightIds: ['insight-1'],
        decisionReason: 'All interviews and insights reviewed',
      })
    ).not.toThrow();
  });

  it('keeps DRD creation and accepted-output handoff behind separate decisions', () => {
    expect(() =>
      ProposeDrdAssessmentSchema.parse({
        expectedVersion: 4,
        name: 'DRD — transformation baseline',
      })
    ).not.toThrow();
    expect(() =>
      ReviewDrdAssessmentProposalSchema.parse({
        expectedVersion: 5,
        decision: 'approve',
        reason: 'Scope and evidence sources accepted',
      })
    ).not.toThrow();
    expect(() =>
      AcceptDrdResultsSchema.parse({
        expectedVersion: 6,
        decisionReason: 'Immutable DRD output reviewed',
      })
    ).not.toThrow();
  });

  it('keeps synthesis, Candidate creation and Initiative acceptance as separate gates', () => {
    expect(() => ProposeOpportunitySynthesisSchema.parse({ expectedVersion: 7 })).not.toThrow();
    expect(() =>
      ReviewOpportunitySynthesisSchema.parse({
        expectedVersion: 8,
        decision: 'approve',
        reason: 'Cross-source synthesis accepted',
      })
    ).not.toThrow();
    expect(() =>
      AcceptInitiativeResultsSchema.parse({
        expectedVersion: 9,
        decisionReason: 'Candidate and durable Initiative receipt reviewed',
      })
    ).not.toThrow();
  });

  it('keeps Finance/KPI calculation, materialization and approval as separate gates', () => {
    expect(() =>
      ProposeFinanceKpiPackSchema.parse({
        expectedVersion: 10,
        capex: 800000,
        opexAnnual: 120000,
        benefitAnnual: 900000,
        horizonYears: 3,
        waccPct: 12,
        currency: 'PLN',
        kpi: {
          name: 'Approval lead time',
          unit: 'days',
          baselineValue: 8,
          targetValue: 3,
          direction: 'LOWER_IS_BETTER',
        },
      })
    ).not.toThrow();
    expect(() =>
      ReviewFinanceKpiPackSchema.parse({
        expectedVersion: 11,
        decision: 'approve',
        reason: 'Economics and KPI definition reviewed',
      })
    ).not.toThrow();
    expect(() =>
      AcceptFinanceKpiResultsSchema.parse({
        expectedVersion: 12,
        decisionReason: 'Approved analysis and versioned KPI reviewed',
      })
    ).not.toThrow();
  });

  it('keeps portfolio packet, GO/NO-GO decision and Initiative approval separate', () => {
    expect(() =>
      ProposePortfolioDecisionSchema.parse({
        expectedVersion: 13,
        decisionMakerId: 'sponsor-1',
        supportingEvidence: [{ ref: 'finance:1', snapshot: { npv: 10 } }],
        contradictingEvidence: [{ ref: 'risk:1', snapshot: { exposure: 'high' } }],
      })
    ).not.toThrow();
    expect(() =>
      ResolvePortfolioDecisionSchema.parse({
        expectedVersion: 15,
        evidenceDigest: 'a'.repeat(64),
        selectedOption: 'go',
        rationale: 'Evidence reviewed by authorized decision maker',
      })
    ).not.toThrow();
    expect(() =>
      ReviewPortfolioDecisionSchema.parse({
        expectedVersion: 14,
        decision: 'approve',
        reason: 'Decision packet accepted',
      })
    ).not.toThrow();
    expect(() =>
      AcceptPortfolioDecisionResultsSchema.parse({
        expectedVersion: 15,
        decisionReason: 'GO and canonical APPROVED Initiative reviewed',
      })
    ).not.toThrow();
  });

  it('keeps mobilization blueprint materialization and SCHEDULED readiness separate', () => {
    expect(() =>
      ProposeMobilizationBlueprintSchema.parse({
        expectedVersion: 16,
        ownerUserId: 'owner-1',
        startDate: '2026-09-01',
        endDate: '2026-12-15',
      })
    ).not.toThrow();
    expect(() =>
      ReviewMobilizationBlueprintSchema.parse({
        expectedVersion: 17,
        decision: 'approve',
        reason: 'WBS, milestones and resources reviewed',
      })
    ).not.toThrow();
    expect(() =>
      AcceptMobilizationResultsSchema.parse({
        expectedVersion: 18,
        decisionReason: 'Applied blueprint and SCHEDULED Initiative reviewed',
      })
    ).not.toThrow();
  });
  it('separates execution start from completed delivery', () => {
    expect(() =>
      AcceptExecutionStartSchema.parse({
        expectedVersion: 19,
        decisionReason: 'Canonical EXECUTING status reviewed',
      })
    ).not.toThrow();
    expect(() =>
      AcceptExecutionResultsSchema.parse({
        expectedVersion: 20,
        decisionReason: 'DONE status and all work completed',
      })
    ).not.toThrow();
  });
  it('separates delivery, achieved benefits and sustained value', () => {
    expect(() =>
      AcceptDeliveryHandoffSchema.parse({
        expectedVersion: 21,
        effectiveness: 'confirmed',
        decisionReason: 'Owners, KPI actuals and Finance actuals reviewed',
        kpiActuals: [
          {
            kpiId: 'kpi-1',
            value: 3,
            measuredAt: '2026-10-01T12:00:00.000Z',
          },
        ],
      })
    ).not.toThrow();
    expect(
      AcceptDeliveryHandoffSchema.parse({
        expectedVersion: 21,
        effectiveness: 'confirmed',
        decisionReason: 'Existing canonical KPI measurement reviewed',
      }).kpiActuals
    ).toEqual([]);
    expect(() =>
      AcceptBenefitsReviewSchema.parse({
        expectedVersion: 22,
        decisionReason: 'Achieved benefits and verified measurements reviewed',
      })
    ).not.toThrow();
    expect(() =>
      AcceptSustainabilityReviewSchema.parse({
        expectedVersion: 23,
        conclusion: 'sustained',
        decisionReason: 'Outcome persisted across the agreed measurement window',
      })
    ).not.toThrow();
  });
});
