/**
 * P06-B/C: Radar triage cockpit contract tests
 * categories, ranking, hard gates, handoff context
 */
import { describe, expect, it } from 'vitest';

import {
  buildHandoffContext,
  checkRadarTriageHardGates,
  computeRadarTriageScore,
  RadarCategoryValues,
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
  describe('Stable categories', () => {
    it('has exactly 5 categories (no Misc)', () => {
      expect(RadarCategoryValues).toHaveLength(5);
      expect(RadarCategoryValues).toContain('external_change');
    });
  });

  describe('Degraded states', () => {
    it('exports 5 triage states including blocked_permission', () => {
      expect(TriageStateValues).toHaveLength(5);
      expect(TriageStateValues).toContain('blocked_permission');
    });
  });

  describe('Ranking grammar', () => {
    it('computeRadarTriageScore is deterministic for fixed bands', () => {
      const bands = minimalSignal().bands;
      const a = computeRadarTriageScore(bands, false);
      const b = computeRadarTriageScore(bands, false);
      expect(a).toBe(b);
    });
    it('duplicate penalty lowers score', () => {
      const bands = minimalSignal().bands;
      expect(computeRadarTriageScore(bands, true)).toBeLessThan(computeRadarTriageScore(bands, false));
    });
  });

  describe('Hard gates', () => {
    it('finance_kpi with impact≥2 and urgency≥2 triggers KPI hard gate', () => {
      const gates = checkRadarTriageHardGates('finance_kpi', minimalSignal().bands);
      expect(gates).toContain('HARD_GATE_KPI_THRESHOLD');
    });
  });

  describe('Handoff payload', () => {
    it('buildHandoffContext preserves signal id and radar origin', () => {
      const s = minimalSignal();
      const ctx = buildHandoffContext(s);
      expect(ctx.origin).toBe('radar');
      expect(ctx.signalId).toBe(s.signalId);
      expect(ctx.radarDeeplink).toContain(s.signalId);
    });
  });
});
