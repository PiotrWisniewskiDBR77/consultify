/**
 * People-Change Readiness Roll-up — Unit Tests (REAL CODE)
 *
 * Tests server/src/services/peopleChangeReadinessService.ts (M14 / F6, step 6.5).
 * Pure functions, no DB.
 */
import { describe, expect, it } from 'vitest';

import {
  computeReadiness,
  readinessToLaneProblem,
} from '../../../server/src/services/peopleChangeReadinessService.js';

describe('peopleChangeReadinessService (REAL)', () => {
  describe('computeReadiness', () => {
    it('all-high signals → READY with no barriers', () => {
      const r = computeReadiness({
        communicationCoveragePct: 100,
        sentimentTrend: 'improving',
        sentimentAvg: 0.9,
        capabilityGapPct: 0,
        reinforcementFollowups: 5,
      });

      expect(r.awareness).toBe(5);
      expect(r.desire).toBe(5);
      expect(r.knowledge).toBe(5);
      expect(r.ability).toBe(5);
      expect(r.reinforcement).toBe(5);
      expect(r.overall).toBe(5);
      expect(r.barriers).toEqual([]);
      expect(r.unmeasured).toEqual([]);
      expect(r.readiness).toBe('READY');
    });

    it('declining sentiment → low Desire registered as a barrier', () => {
      const r = computeReadiness({
        sentimentTrend: 'declining',
        sentimentAvg: 0.1,
      });

      expect(r.desire).not.toBeNull();
      expect(r.desire as number).toBeLessThan(3);
      expect(r.barriers).toContain('Desire');
    });

    it('large capability gap → low Knowledge & Ability barriers', () => {
      const r = computeReadiness({
        capabilityGapPct: 90,
      });

      expect(r.knowledge as number).toBeLessThan(3);
      expect(r.ability as number).toBeLessThan(3);
      expect(r.barriers).toContain('Knowledge');
      expect(r.barriers).toContain('Ability');
    });

    it('missing signals → dimensions null and listed in unmeasured', () => {
      const r = computeReadiness({
        communicationCoveragePct: 80,
      });

      expect(r.awareness).not.toBeNull();
      expect(r.desire).toBeNull();
      expect(r.knowledge).toBeNull();
      expect(r.ability).toBeNull();
      expect(r.reinforcement).toBeNull();
      expect(r.unmeasured).toEqual(
        expect.arrayContaining(['Desire', 'Knowledge', 'Ability', 'Reinforcement']),
      );
      // overall = mean of measured dims only (just Awareness here)
      expect(r.overall).toBe(r.awareness);
    });

    it('no signals at all → UNKNOWN with null overall', () => {
      const r = computeReadiness({});
      expect(r.overall).toBeNull();
      expect(r.readiness).toBe('UNKNOWN');
      expect(r.unmeasured).toHaveLength(5);
    });
  });

  describe('readinessToLaneProblem', () => {
    it('AT_RISK roll-up → critical declining_adoption problem', () => {
      const r = computeReadiness({
        communicationCoveragePct: 0,
        sentimentTrend: 'declining',
        sentimentAvg: 0,
        capabilityGapPct: 100,
        reinforcementFollowups: 0,
      });
      expect(r.readiness).toBe('AT_RISK');

      const problem = readinessToLaneProblem(r);
      expect(problem).not.toBeNull();
      expect(problem!.problemType).toBe('declining_adoption');
      expect(problem!.severity).toBe('critical');
      expect(typeof problem!.title).toBe('string');
      expect(problem!.title.length).toBeGreaterThan(0);
    });

    it('READY roll-up → null (nothing to surface)', () => {
      const r = computeReadiness({
        communicationCoveragePct: 100,
        sentimentTrend: 'improving',
        sentimentAvg: 0.9,
        capabilityGapPct: 0,
        reinforcementFollowups: 5,
      });
      expect(r.readiness).toBe('READY');
      expect(readinessToLaneProblem(r)).toBeNull();
    });

    it('barrier without AT_RISK → warning problem', () => {
      const r = computeReadiness({
        communicationCoveragePct: 100, // Awareness 5
        sentimentTrend: 'improving',
        sentimentAvg: 0.9, // Desire 5
        capabilityGapPct: 90, // Knowledge/Ability 1 (barriers)
        reinforcementFollowups: 5, // Reinforcement 5
      });
      // measured = [5, 5, 1, 1, 5] → mean 3.4 → DEVELOPING, but K/A are barriers
      expect(r.barriers.length).toBeGreaterThan(0);
      expect(r.readiness).toBe('DEVELOPING');
      expect(r.readiness).not.toBe('AT_RISK');

      const problem = readinessToLaneProblem(r);
      expect(problem).not.toBeNull();
      expect(problem!.severity).toBe('warning');
    });
  });
});
