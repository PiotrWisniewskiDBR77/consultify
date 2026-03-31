/**
 * P09 Survey Collection Lane — Canon contract tests
 *
 * Tests the frozen vocabulary, status grammar, branching posture,
 * handoff payload, anti-duplicate rules, degraded posture, and
 * acceptance checklist from surveyCollectionCanon.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  P09_COLLECTION_LANE_CONTRACT,
  P09_SUBMISSION_STATUSES,
  P09_SUBMISSION_NEXT_ACTIONS,
  P09_STATUS_TRANSITIONS,
  P09_SURVEY_LIFECYCLE,
  P09_BRANCHING_POSTURE,
  P09_HANDOFF_TO_P10,
  P09_ANTI_DUPLICATE_RULES,
  P09_DEGRADED_SCENARIOS,
  P09_ACCEPTANCE_CHECKLIST,
  P09_NON_GOALS,
  isValidP09StatusTransition,
  buildP09HandoffPayloadSkeleton,
} from '../../../services/v8/surveyCollectionCanon.js';

describe('P09 Survey Collection Lane Canon', () => {
  // ── Contract identity ──────────────────────────────────────────
  it('has a stable contract identifier', () => {
    expect(P09_COLLECTION_LANE_CONTRACT).toBe('survey_collection_lane_v1');
  });

  // ── §2.3.1 Submission statuses ─────────────────────────────────
  describe('Submission status grammar (§2.3.1)', () => {
    it('has exactly 6 canonical submission statuses', () => {
      expect(P09_SUBMISSION_STATUSES).toHaveLength(6);
    });

    it('includes the required statuses per contract', () => {
      expect(P09_SUBMISSION_STATUSES).toContain('draft');
      expect(P09_SUBMISSION_STATUSES).toContain('submitted');
      expect(P09_SUBMISSION_STATUSES).toContain('under_review');
      expect(P09_SUBMISSION_STATUSES).toContain('accepted');
      expect(P09_SUBMISSION_STATUSES).toContain('rejected');
      expect(P09_SUBMISSION_STATUSES).toContain('locked');
    });

    it('every status has a defined operator next action', () => {
      for (const status of P09_SUBMISSION_STATUSES) {
        const action = P09_SUBMISSION_NEXT_ACTIONS[status];
        expect(action).toBeDefined();
        expect(action.operatorAction.length).toBeGreaterThan(0);
        expect(action.notes.length).toBeGreaterThan(0);
      }
    });

    it('locked status has no operator action (read-only)', () => {
      const locked = P09_SUBMISSION_NEXT_ACTIONS.locked;
      expect(locked.operatorAction).toContain('none');
    });

    it('rejected status must carry a rejection reason', () => {
      const rejected = P09_SUBMISSION_NEXT_ACTIONS.rejected;
      expect(rejected.operatorAction).toContain('rejection reason');
    });
  });

  // ── Status transitions ─────────────────────────────────────────
  describe('Status transitions', () => {
    it('locked and rejected are terminal states (no outgoing transitions)', () => {
      expect(P09_STATUS_TRANSITIONS.locked).toHaveLength(0);
      expect(P09_STATUS_TRANSITIONS.rejected).toHaveLength(0);
    });

    it('draft can only transition to submitted', () => {
      expect(P09_STATUS_TRANSITIONS.draft).toEqual(['submitted']);
    });

    it('isValidP09StatusTransition accepts valid transitions', () => {
      expect(isValidP09StatusTransition('draft', 'submitted')).toBe(true);
      expect(isValidP09StatusTransition('submitted', 'under_review')).toBe(true);
      expect(isValidP09StatusTransition('under_review', 'accepted')).toBe(true);
      expect(isValidP09StatusTransition('accepted', 'locked')).toBe(true);
    });

    it('isValidP09StatusTransition rejects invalid transitions', () => {
      expect(isValidP09StatusTransition('draft', 'locked')).toBe(false);
      expect(isValidP09StatusTransition('locked', 'draft')).toBe(false);
      expect(isValidP09StatusTransition('rejected', 'accepted')).toBe(false);
    });
  });

  // ── §2.3.2 Survey lifecycle ────────────────────────────────────
  describe('Survey lifecycle (§2.3.2)', () => {
    it('has 6 lifecycle states', () => {
      expect(P09_SURVEY_LIFECYCLE).toHaveLength(6);
    });

    it('starts with draft and ends with archived', () => {
      expect(P09_SURVEY_LIFECYCLE[0]).toBe('draft');
      expect(P09_SURVEY_LIFECYCLE[P09_SURVEY_LIFECYCLE.length - 1]).toBe('archived');
    });
  });

  // ── §2.3.3 Branching posture ───────────────────────────────────
  describe('Branching posture (§2.3.3)', () => {
    it('supports skip_logic and conditional_display', () => {
      expect(P09_BRANCHING_POSTURE.supported).toContain('skip_logic');
      expect(P09_BRANCHING_POSTURE.supported).toContain('conditional_display');
    });

    it('explicitly lists non-goals including complex_scripting', () => {
      expect(P09_BRANCHING_POSTURE.non_goal).toContain('complex_scripting');
      expect(P09_BRANCHING_POSTURE.non_goal.length).toBeGreaterThanOrEqual(3);
    });

    it('has validation expectation for dead-end detection', () => {
      expect(P09_BRANCHING_POSTURE.validation_expectation).toContain('dead-end');
    });

    it('has preview requirement for operator', () => {
      expect(P09_BRANCHING_POSTURE.preview_requirement).toContain('preview');
    });
  });

  // ── §2.3.4 Handoff payload ─────────────────────────────────────
  describe('Handoff payload to P10 (§2.3.4)', () => {
    it('has required fields covering identity + governance + content + provenance + idempotency', () => {
      const required = P09_HANDOFF_TO_P10.required_fields;
      expect(required).toContain('surveyId');
      expect(required).toContain('submissionId');
      expect(required).toContain('governance.submissionStatus');
      expect(required).toContain('content.normalizedAnswers');
      expect(required).toContain('idempotencyKey');
    });

    it('delivery semantics enforce idempotency', () => {
      expect(P09_HANDOFF_TO_P10.delivery_semantics).toContain('idempotent');
    });

    it('buildP09HandoffPayloadSkeleton produces valid structure', () => {
      const payload = buildP09HandoffPayloadSkeleton({
        surveyId: 'survey-1',
        submissionId: 'sub-1',
        submissionStatus: 'accepted',
        validationSummary: 'All fields valid',
        surveyVersion: 'v2.1',
        startedAt: '2026-03-01T10:00:00Z',
        submittedAt: '2026-03-01T10:30:00Z',
      });

      expect(payload.surveyId).toBe('survey-1');
      expect(payload.submissionId).toBe('sub-1');
      expect(payload.idempotencyKey).toBe('sub-1');
      expect(payload.governance.submissionStatus).toBe('accepted');
      expect(payload.timestamps.started).toBeTruthy();
      expect(payload.timestamps.submitted).toBeTruthy();
      expect(payload.provenance.surveyVersionAtSubmission).toBe('v2.1');
      expect(Array.isArray(payload.content.normalizedAnswers)).toBe(true);
    });
  });

  // ── §2.3.5 Anti-duplicate ──────────────────────────────────────
  describe('Anti-duplicate rules (§2.3.5)', () => {
    it('has at-least-once delivery assumption', () => {
      expect(P09_ANTI_DUPLICATE_RULES.at_least_once_delivery).toContain('at-least-once');
    });

    it('requires idempotency key', () => {
      expect(P09_ANTI_DUPLICATE_RULES.idempotency_key).toContain('idempotency key');
    });

    it('forbids double counting', () => {
      expect(P09_ANTI_DUPLICATE_RULES.no_double_counting).toContain('no double-counting');
    });

    it('explicitly states survey is not an insight engine', () => {
      expect(P09_ANTI_DUPLICATE_RULES.no_collection_engine).toContain('collection lane');
    });
  });

  // ── §2.3.6 Degraded posture ────────────────────────────────────
  describe('Degraded posture (§2.3.6)', () => {
    it('has at least 8 degraded scenarios', () => {
      expect(P09_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(8);
    });

    it('every scenario has id, scenario, degradedReason, userVisibleState, and nextAction', () => {
      for (const s of P09_DEGRADED_SCENARIOS) {
        expect(s.id).toBeGreaterThan(0);
        expect(s.scenario.length).toBeGreaterThan(0);
        expect(s.degradedReason.length).toBeGreaterThan(0);
        expect(s.userVisibleState.length).toBeGreaterThan(0);
        expect(s.nextAction.length).toBeGreaterThan(0);
      }
    });

    it('includes handoff failure scenario', () => {
      const handoff = P09_DEGRADED_SCENARIOS.find((s) => s.degradedReason === 'handoff_failure');
      expect(handoff).toBeDefined();
    });

    it('includes duplicate detection scenario', () => {
      const dup = P09_DEGRADED_SCENARIOS.find((s) => s.degradedReason === 'duplicate_detected');
      expect(dup).toBeDefined();
    });
  });

  // ── §2.3.7 Acceptance checklist ────────────────────────────────
  describe('Acceptance checklist (§2.3.7)', () => {
    it('has at least 5 acceptance items', () => {
      expect(P09_ACCEPTANCE_CHECKLIST.length).toBeGreaterThanOrEqual(5);
    });

    it('first item confirms collection lane framing', () => {
      expect(P09_ACCEPTANCE_CHECKLIST[0].requirement).toContain('collection lane');
    });

    it('every item has id, requirement, and section reference', () => {
      for (const item of P09_ACCEPTANCE_CHECKLIST) {
        expect(item.id).toBeGreaterThan(0);
        expect(item.requirement.length).toBeGreaterThan(0);
        expect(item.section.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Non-goals ──────────────────────────────────────────────────
  describe('Non-goals', () => {
    it('explicitly lists insight computation as non-goal', () => {
      const hasInsightNonGoal = P09_NON_GOALS.some((ng) =>
        ng.toLowerCase().includes('insight')
      );
      expect(hasInsightNonGoal).toBe(true);
    });

    it('has at least 4 non-goals', () => {
      expect(P09_NON_GOALS.length).toBeGreaterThanOrEqual(4);
    });
  });
});
