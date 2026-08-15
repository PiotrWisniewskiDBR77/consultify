import { describe, expect, it } from 'vitest';

import { evaluateGatePolicy } from '../../server/src/services/workflow/gatePolicy.js';

describe('Workflow Scenarios (gatePolicy) - REAL_CODE', () => {
  const base = {
    contextType: 'interview_assignment',
    user: { id: 'u-1', organizationId: 'org-1' },
    context: { assignment: { session_id: 's-1', status: 'submitted' } },
  } as const;

  it('allows APPROVE_INTERVIEW when session exists and status is submitted', () => {
    expect(evaluateGatePolicy({ ...base, action: 'APPROVE_INTERVIEW' })).toEqual({ allow: true });
  });

  it('denies APPROVE_INTERVIEW when status is not submitted', () => {
    const decision = evaluateGatePolicy({
      ...base,
      action: 'APPROVE_INTERVIEW',
      context: { assignment: { session_id: 's-1', status: 'in_progress' } },
    });
    expect(decision).toEqual(expect.objectContaining({ allow: false, code: 'INVALID_STATE' }));
  });

  it('denies SEND_BACK_INTERVIEW when missing session_id', () => {
    const decision = evaluateGatePolicy({
      ...base,
      action: 'SEND_BACK_INTERVIEW',
      context: { assignment: { status: 'submitted' } },
    });
    expect(decision).toEqual(expect.objectContaining({ allow: false, code: 'MISSING_DATA' }));
  });

  it('denies SUBMIT_INTERVIEW for non-interview contextType', () => {
    const decision = evaluateGatePolicy({
      action: 'SUBMIT_INTERVIEW',
      contextType: 'assessment',
      user: { id: 'u-1', organizationId: 'org-1' },
      context: {},
    });
    expect(decision).toEqual(expect.objectContaining({ allow: false, code: 'FORBIDDEN' }));
  });

  it('allows idempotent SUBMIT_INTERVIEW replay from submitted state', () => {
    const decision = evaluateGatePolicy({ ...base, action: 'SUBMIT_INTERVIEW' });
    expect(decision).toEqual({ allow: true });
  });
});
