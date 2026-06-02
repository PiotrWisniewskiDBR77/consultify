/**
 * Smoke tests for the Wave 1 digital-tool step flows.
 * These guarantee the curated SHIP digital tools expose dedicated domain steps
 * (context -> 3 domain sections -> summary) rather than the generic fill flow.
 */
import { describe, expect, it } from 'vitest';

import { AI_DISCOVERY_STEPS, PAIN_EXPLORER_STEPS, RPA_SCANNER_STEPS } from '@/store/useToolStore';

describe('digital tool step flows', () => {
  it('ai-discovery: context -> use-cases -> prerequisites -> pilot-plan -> summary', () => {
    expect(AI_DISCOVERY_STEPS.map((s) => s.id)).toEqual([
      'context',
      'use-cases',
      'prerequisites',
      'pilot-plan',
      'summary',
    ]);
  });

  it('pain-explorer: context -> problems -> hypotheses -> evidence-gaps -> summary', () => {
    expect(PAIN_EXPLORER_STEPS.map((s) => s.id)).toEqual([
      'context',
      'problems',
      'hypotheses',
      'evidence-gaps',
      'summary',
    ]);
  });

  it('rpa-scanner: context -> candidates -> sizing -> backlog -> summary', () => {
    expect(RPA_SCANNER_STEPS.map((s) => s.id)).toEqual([
      'context',
      'candidates',
      'sizing',
      'backlog',
      'summary',
    ]);
  });

  it('every digital step carries EN + PL labels', () => {
    for (const steps of [AI_DISCOVERY_STEPS, PAIN_EXPLORER_STEPS, RPA_SCANNER_STEPS]) {
      for (const step of steps) {
        expect(step.name.length).toBeGreaterThan(0);
        expect(step.namePl.length).toBeGreaterThan(0);
      }
    }
  });
});
