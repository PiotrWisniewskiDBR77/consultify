import { describe, expect, it } from 'vitest';

import { evaluateGatePolicy } from '../../server/src/services/workflow/gatePolicy.js';

describe('MyWork Workflow (gatePolicy) - REAL_CODE', () => {
  const base = {
    contextType: 'interview_assignment',
    user: { id: 'u-1', organizationId: 'org-1' },
    context: { assignment: { session_id: 's-1', status: 'in_progress' } },
  } as const;

  it('denies SUBMIT_INTERVIEW when assignment has no session', () => {
    const decision = evaluateGatePolicy({
      ...base,
      action: 'SUBMIT_INTERVIEW',
      context: { assignment: { status: 'in_progress' } },
    });
    expect(decision).toEqual(
      expect.objectContaining({ allow: false, code: 'MISSING_DATA', error: expect.any(String) })
    );
  });

  it('denies SUBMIT_INTERVIEW from a terminal/invalid state', () => {
    // The gate intentionally allows in_progress / submitted / sent_back (idempotent
    // re-submit); a terminal state like 'approved' must still be rejected.
    const decision = evaluateGatePolicy({
      ...base,
      action: 'SUBMIT_INTERVIEW',
      context: { assignment: { session_id: 's-1', status: 'approved' } },
    });
    expect(decision).toEqual(
      expect.objectContaining({ allow: false, code: 'INVALID_STATE', error: expect.any(String) })
    );
  });

  it('allows SUBMIT_INTERVIEW when session exists and status is in_progress', () => {
    const decision = evaluateGatePolicy({ ...base, action: 'SUBMIT_INTERVIEW' });
    expect(decision).toEqual({ allow: true });
  });

  it('allows SEND_BACK_INTERVIEW only from submitted state', () => {
    const ok = evaluateGatePolicy({
      ...base,
      action: 'SEND_BACK_INTERVIEW',
      context: { assignment: { session_id: 's-1', status: 'submitted' } },
    });
    expect(ok).toEqual({ allow: true });

    const bad = evaluateGatePolicy({ ...base, action: 'SEND_BACK_INTERVIEW' });
    expect(bad).toEqual(expect.objectContaining({ allow: false }));
  });

  it('defaults to FORBIDDEN for unknown context/action', () => {
    const decision = evaluateGatePolicy({
      action: 'SUBMIT_INTERVIEW',
      contextType: 'task',
      user: { id: 'u-1', organizationId: 'org-1' },
      context: {},
    });
    expect(decision).toEqual(
      expect.objectContaining({ allow: false, code: 'FORBIDDEN', error: expect.any(String) })
    );
  });
});
