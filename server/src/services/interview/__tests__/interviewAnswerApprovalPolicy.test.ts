import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE,
  deriveInterviewAnswerApprovalProgress,
  resolveInterviewAnswerApprovalPolicy,
  withInterviewAnswerApprovalMode,
} from '../interviewAnswerApprovalPolicy.js';

describe('Interview answer approval organization policy', () => {
  it('defaults missing, malformed and unknown policy to manager approval', () => {
    for (const input of [
      undefined,
      null,
      '{bad json',
      {},
      { interview: {} },
      {
        interview: { answerApproval: { mode: 'automatic' } },
      },
    ]) {
      expect(resolveInterviewAnswerApprovalPolicy(input)).toEqual({
        mode: DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE,
        stages: ['manager'],
        source: 'default',
      });
    }
  });

  it.each([
    ['ai', ['ai']],
    ['manager', ['manager']],
    ['two_stage', ['ai', 'manager']],
  ] as const)('resolves %s into its exact ordered stages', (mode, stages) => {
    expect(
      resolveInterviewAnswerApprovalPolicy({
        policy: JSON.stringify({ interview: { answerApproval: { mode } } }),
      })
    ).toEqual({ mode, stages, source: 'organization_policy' });
  });

  it('updates only the Interview answer policy key and preserves sibling policy', () => {
    expect(
      withInterviewAnswerApprovalMode(
        {
          region: 'eu',
          interview: { privacy: 'strict', answerApproval: { note: 'keep me' } },
        },
        'two_stage'
      )
    ).toEqual({
      region: 'eu',
      interview: {
        privacy: 'strict',
        answerApproval: { note: 'keep me', version: 1, mode: 'two_stage' },
      },
    });
  });

  it('requires AI before manager in two-stage mode and does not treat one stage as final', () => {
    const policy = resolveInterviewAnswerApprovalPolicy({
      interview: { answerApproval: { mode: 'two_stage' } },
    });
    expect(deriveInterviewAnswerApprovalProgress(policy, [])).toEqual({
      status: 'pending',
      nextStage: 'ai',
    });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [{ stage: 'manager', decision: 'approved' }])
    ).toEqual({ status: 'pending', nextStage: 'ai' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { stage: 'manager', decision: 'approved' },
        { stage: 'ai', decision: 'approved' },
      ])
    ).toEqual({ status: 'pending', nextStage: 'manager' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [{ stage: 'ai', decision: 'approved' }])
    ).toEqual({ status: 'pending', nextStage: 'manager' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { stage: 'ai', decision: 'approved' },
        { stage: 'manager', decision: 'approved' },
      ])
    ).toEqual({ status: 'stages_complete', nextStage: null });
  });

  it('keeps a stage rejection explicit until a newer decision for that stage exists', () => {
    const policy = resolveInterviewAnswerApprovalPolicy({
      interview: { answerApproval: { mode: 'manager' } },
    });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { stage: 'manager', decision: 'approved' },
        { stage: 'manager', decision: 'rejected' },
      ])
    ).toEqual({ status: 'rejected', nextStage: 'manager' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { stage: 'manager', decision: 'rejected' },
        { stage: 'manager', decision: 'approved' },
      ])
    ).toEqual({ status: 'stages_complete', nextStage: null });
  });
});
