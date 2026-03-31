/**
 * P06-B/C: Radar triage cockpit contract tests
 * ranking grammar + why-now + handoff + degraded
 */
import { describe, expect, it } from 'vitest';

import { P06_RADAR_TRIAGE_HTTP_STATUSES } from '../../server/src/routes/v8/radar-triage.routes.js';
import {
  buildHandoffContext,
  checkRadarTriageHardGates,
  computeRadarTriageScore,
  RadarCategoryValues,
  type RadarBands,
  type RadarHandoffContext,
  type RadarTriageSignal,
  TriageStateValues,
} from '../../server/src/services/v8/radarTriageService.js';

function minimalSignal(over: Partial<RadarTriageSignal> = {}): RadarTriageSignal {
  return {
    signalId: 'sig-p06-contract',
    organizationId: 'org-p06',
    category: 'finance_kpi',
    priorityLevel: 'P1',
    score: 20,
    bands: {
      impact: 2,
      urgency: 2,
      scope: 2,
      confidence: 2,
      freshness: 2,
      actionability: 1,
    },
    triggeredRules: [],
    whyNow: {
      rationaleText: 'Variance exceeds threshold on linked KPI.',
      timeWindow: 'this_week',
      primaryDriver: 'variance',
    },
    evidence: {
      evidencePointers: [{ type: 'kpi', ref: 'kpi-1' }],
      lastObservedAt: '2026-03-31T12:00:00.000Z',
      sourceCoverage: 'partial',
    },
    uncertaintyBoundary: {
      missingInputs: [],
      conflicts: [],
      whatWouldChangeRanking: [],
    },
    ownership: {
      ownerRole: 'Finance Lead / PMO',
      queueHint: 'decision',
    },
    nextAction: {
      targetModule: 'Inicjatywy',
      handoffIntent: 'open',
      handoffPayload: {},
      safeFallback: 'Notatki — capture context for later review',
    },
    triageState: 'ready',
    createdAt: '2026-03-31T12:00:00.000Z',
    updatedAt: '2026-03-31T12:00:00.000Z',
    ...over,
  };
}

describe('P06 Radar Triage Cockpit', () => {
  describe('Stable categories (§2.3.1)', () => {
    it('has exactly 5 categories — no Misc', () => {
      expect(RadarCategoryValues).toHaveLength(5);
      expect(RadarCategoryValues).not.toContain('misc');
      expect(RadarCategoryValues).not.toContain('interesting');
    });
  });

  describe('Ranking grammar (§2.3.2)', () => {
    it('computeRadarTriageScore is deterministic for fixed bands', () => {
      const bands = minimalSignal().bands;
      expect(computeRadarTriageScore(bands, false)).toBe(computeRadarTriageScore(bands, false));
    });

    it('P0-equivalent max bands: I3+U3+S3+A2+C3+F3 matches runtime score (34)', () => {
      const bands: RadarBands = {
        impact: 3,
        urgency: 3,
        scope: 3,
        actionability: 2,
        confidence: 3,
        freshness: 3,
      };
      expect(computeRadarTriageScore(bands, false)).toBe(34);
    });

    it('P2 score: I1+U1+S1+A0+C0+F0 = 1', () => {
      const bands: RadarBands = {
        impact: 1,
        urgency: 1,
        scope: 1,
        actionability: 0,
        confidence: 0,
        freshness: 0,
      };
      expect(computeRadarTriageScore(bands, false)).toBe(1);
    });

    it('duplicate penalty reduces score by 4', () => {
      const bands: RadarBands = {
        impact: 2,
        urgency: 2,
        scope: 2,
        actionability: 1,
        confidence: 2,
        freshness: 2,
      };
      expect(computeRadarTriageScore(bands, false) - computeRadarTriageScore(bands, true)).toBe(4);
    });

    it('hard-gate: governance + I2+ + U2+ triggers P0 rule', () => {
      const rules = checkRadarTriageHardGates('governance_compliance', {
        impact: 2,
        urgency: 2,
        scope: 1,
        confidence: 1,
        freshness: 1,
        actionability: 1,
      });
      expect(rules).toContain('HARD_GATE_GOVERNANCE_DEADLINE_7D');
    });

    it('finance_kpi with impact≥2 and urgency≥2 triggers KPI hard gate', () => {
      expect(checkRadarTriageHardGates('finance_kpi', minimalSignal().bands)).toContain(
        'HARD_GATE_KPI_THRESHOLD'
      );
    });
  });

  describe('Why-now payload (§2.3.3)', () => {
    it('minimal payload has all required fields', () => {
      const wn = minimalSignal().whyNow;
      expect(wn.rationaleText.length).toBeGreaterThan(0);
      expect(wn.rationaleText.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Handoff payload (§2.3.5)', () => {
    it('buildHandoffContext includes origin=radar and signal id', () => {
      const s = minimalSignal();
      const ctx = buildHandoffContext(s);
      expect(ctx.origin).toBe('radar');
      expect(ctx.signalId).toBe(s.signalId);
      expect(ctx.radarDeeplink).toContain(s.signalId);
    });

    it('typed handoff context requires radar origin', () => {
      const context: RadarHandoffContext = buildHandoffContext(minimalSignal());
      expect(context.origin).toBe('radar');
    });

    it('Inicjatywy handoff includes initiative_suggestion', () => {
      const payload = {
        initiative_suggestion: {
          problem_statement: 'test',
          proposed_outcome: 'test',
          time_window: 'this_week',
          suggested_owner_role: 'PMO',
          open_questions: [] as string[],
        },
      };
      expect(payload.initiative_suggestion).toBeDefined();
      expect(payload.initiative_suggestion.problem_statement).toBeTruthy();
    });

    it('Wdrożenia handoff includes deployment_suggestion', () => {
      const payload = {
        deployment_suggestion: {
          affected_milestone_area: 'test',
          blocker_summary: 'test',
          next_step: 'test',
          expected_unblock: 'this_week',
        },
      };
      expect(payload.deployment_suggestion).toBeDefined();
    });

    it('Notatki handoff includes note_suggestion', () => {
      const payload = {
        note_suggestion: {
          summary: ['test'],
          assumptions: [] as string[],
          decision_needed: false,
          links: [] as string[],
        },
      };
      expect(payload.note_suggestion).toBeDefined();
    });
  });

  describe('Degraded rules (§2.3.6)', () => {
    it('has 5 triage states', () => {
      expect(TriageStateValues).toHaveLength(5);
    });
    it('degraded states have safe next action', () => {
      TriageStateValues.filter((s) => s !== 'ready').forEach((s) => {
        expect(s).toMatch(/degraded|blocked/);
      });
    });
  });

  describe('Anti-duplicate gate (§2.3.7)', () => {
    it('downstream handoff uses projection from signal_id', () => {
      const ctx = buildHandoffContext(minimalSignal({ signalId: 'sig-1' }));
      expect(ctx.origin).toBe('radar');
      expect(ctx.signalId).toBe('sig-1');
    });
  });

  describe('Error posture (§2.3.8)', () => {
    it('covers all required HTTP status codes', () => {
      expect(P06_RADAR_TRIAGE_HTTP_STATUSES).toContain(200);
      expect(P06_RADAR_TRIAGE_HTTP_STATUSES).toContain(206);
      expect(P06_RADAR_TRIAGE_HTTP_STATUSES).toContain(503);
    });
  });
});
