/**
 * R0 Smoke: V4-INIT-01 — Gate Policy Enforcement
 * Verifies: evaluateGatePolicy() for interview_assignment context
 */

import { evaluateGatePolicy } from '../../../../server/src/services/workflow/gatePolicy.js';

const baseUser = { id: 'u1', organizationId: 'org-1', role: 'consultant' };

describe('V4-INIT-01: Gate Policy Enforcement', () => {
  describe('SUBMIT_INTERVIEW', () => {
    it('allows submit when in_progress with session', () => {
      const result = evaluateGatePolicy({
        action: 'SUBMIT_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'in_progress', session_id: 'sess-1' },
      });
      expect(result.allow).toBe(true);
    });

    it('blocks submit when no session', () => {
      const result = evaluateGatePolicy({
        action: 'SUBMIT_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'in_progress' },
      });
      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.code).toBe('MISSING_DATA');
      }
    });

    it('blocks submit when status is not in_progress', () => {
      const result = evaluateGatePolicy({
        action: 'SUBMIT_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'submitted', session_id: 'sess-1' },
      });
      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.code).toBe('INVALID_STATE');
      }
    });
  });

  describe('SEND_BACK_INTERVIEW', () => {
    it('allows send-back when submitted with session', () => {
      const result = evaluateGatePolicy({
        action: 'SEND_BACK_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'submitted', session_id: 'sess-1' },
      });
      expect(result.allow).toBe(true);
    });

    it('blocks send-back when not submitted', () => {
      const result = evaluateGatePolicy({
        action: 'SEND_BACK_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'in_progress', session_id: 'sess-1' },
      });
      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.code).toBe('INVALID_STATE');
      }
    });
  });

  describe('APPROVE_INTERVIEW', () => {
    it('allows approval when submitted with session', () => {
      const result = evaluateGatePolicy({
        action: 'APPROVE_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'submitted', session_id: 'sess-1' },
      });
      expect(result.allow).toBe(true);
    });

    it('blocks approval without session', () => {
      const result = evaluateGatePolicy({
        action: 'APPROVE_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'submitted' },
      });
      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.code).toBe('MISSING_DATA');
      }
    });

    it('blocks approval when not submitted', () => {
      const result = evaluateGatePolicy({
        action: 'APPROVE_INTERVIEW',
        contextType: 'interview_assignment',
        user: baseUser,
        context: { status: 'in_progress', session_id: 'sess-1' },
      });
      expect(result.allow).toBe(false);
    });
  });
});
