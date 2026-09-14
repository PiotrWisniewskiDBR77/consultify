import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE,
  deriveInterviewAnswerApprovalProgress,
  INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION,
  isInterviewAnswerApprovalEnvironmentEnabled,
  resolveInterviewAnswerApprovalPolicy,
  withInterviewAnswerApprovalMode,
} from '../interviewAnswerApprovalPolicy.js';

describe('Interview answer approval organization policy', () => {
  it('keeps the environment gate off unless it is explicitly true', () => {
    expect(isInterviewAnswerApprovalEnvironmentEnabled({})).toBe(false);
    expect(
      isInterviewAnswerApprovalEnvironmentEnabled({ ENABLE_INTERVIEW_ANSWER_APPROVAL: 'false' })
    ).toBe(false);
    expect(
      isInterviewAnswerApprovalEnvironmentEnabled({ ENABLE_INTERVIEW_ANSWER_APPROVAL: 'true' })
    ).toBe(true);
  });

  it('fails closed for missing, invalid, future-version and unknown organization policy', () => {
    for (const [input, compatibility, configuredVersion] of [
      [undefined, 'default_missing', null],
      [null, 'default_missing', null],
      ['{bad json', 'default_missing', null],
      [{}, 'default_missing', null],
      [{ interview: {} }, 'default_missing', null],
      [{ interview: { answerApproval: { version: '1', mode: 'ai' } } }, 'invalid_version', null],
      [
        { interview: { answerApproval: { version: 2, mode: 'ai' } } },
        'unsupported_future_version',
        2,
      ],
      [{ interview: { answerApproval: { version: 1, mode: 'automatic' } } }, 'invalid_mode', 1],
    ] as const) {
      expect(resolveInterviewAnswerApprovalPolicy(input)).toEqual({
        enabled: false,
        mode: DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE,
        stages: ['manager'],
        source: 'default',
        compatibility,
        configuredVersion,
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
        policy: JSON.stringify({
          interview: {
            answerApproval: {
              version: INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION,
              enabled: true,
              mode,
            },
          },
        }),
      })
    ).toEqual({
      enabled: true,
      mode,
      stages,
      source: 'organization_policy',
      compatibility: 'supported',
      configuredVersion: 1,
    });
  });

  it('preserves sibling policy and refuses to rewrite invalid or future policy versions', () => {
    expect(
      withInterviewAnswerApprovalMode(
        {
          region: 'eu',
          interview: {
            privacy: 'strict',
            answerApproval: { version: 1, note: 'keep me' },
          },
        },
        'two_stage'
      )
    ).toEqual({
      ok: true,
      policy: {
        region: 'eu',
        interview: {
          privacy: 'strict',
          answerApproval: { note: 'keep me', version: 1, enabled: false, mode: 'two_stage' },
        },
      },
    });
    expect(
      withInterviewAnswerApprovalMode(
        { interview: { answerApproval: { version: 2, mode: 'ai', future: 'keep' } } },
        'manager'
      )
    ).toEqual({
      ok: false,
      code: 'INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION_UNSUPPORTED',
      configuredVersion: 2,
    });
    expect(
      withInterviewAnswerApprovalMode(
        { interview: { answerApproval: { version: 'v1', mode: 'ai' } } },
        'manager'
      )
    ).toEqual({
      ok: false,
      code: 'INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION_INVALID',
      configuredVersion: 'v1',
    });
  });

  it('requires AI before manager in two-stage mode and does not treat one stage as final', () => {
    const policy = resolveInterviewAnswerApprovalPolicy({
      interview: { answerApproval: { version: 1, enabled: true, mode: 'two_stage' } },
    });
    expect(deriveInterviewAnswerApprovalProgress(policy, [])).toEqual({
      status: 'pending',
      nextStage: 'ai',
    });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { receiptId: 'receipt-1', ordinal: 1, stage: 'manager', decision: 'approved' },
      ])
    ).toEqual({ status: 'pending', nextStage: 'ai' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { receiptId: 'receipt-1', ordinal: 1, stage: 'manager', decision: 'approved' },
        { receiptId: 'receipt-2', ordinal: 2, stage: 'ai', decision: 'approved' },
      ])
    ).toEqual({ status: 'pending', nextStage: 'manager' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { receiptId: 'receipt-1', ordinal: 1, stage: 'ai', decision: 'approved' },
      ])
    ).toEqual({ status: 'pending', nextStage: 'manager' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { receiptId: 'receipt-2', ordinal: 2, stage: 'manager', decision: 'approved' },
        { receiptId: 'receipt-1', ordinal: 1, stage: 'ai', decision: 'approved' },
      ])
    ).toEqual({ status: 'stages_complete', nextStage: null });
  });

  it('orders receipts by ordinal and receipt ID and keeps send-back explicit until superseded', () => {
    const policy = resolveInterviewAnswerApprovalPolicy({
      interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } },
    });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { receiptId: 'receipt-a', ordinal: 1, stage: 'manager', decision: 'approved' },
        { receiptId: 'receipt-z', ordinal: 2, stage: 'manager', decision: 'sent_back' },
      ])
    ).toEqual({ status: 'sent_back', nextStage: 'manager' });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { receiptId: 'receipt-z', ordinal: 2, stage: 'manager', decision: 'sent_back' },
        { receiptId: 'receipt-b', ordinal: 3, stage: 'manager', decision: 'approved' },
      ])
    ).toEqual({ status: 'stages_complete', nextStage: null });
    expect(
      deriveInterviewAnswerApprovalProgress(policy, [
        { receiptId: 'receipt-z', ordinal: 4, stage: 'manager', decision: 'sent_back' },
        { receiptId: 'receipt-a', ordinal: 4, stage: 'manager', decision: 'approved' },
      ])
    ).toEqual({ status: 'sent_back', nextStage: 'manager' });
  });
});
