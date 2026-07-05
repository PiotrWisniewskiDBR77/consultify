/**
 * M14/F5 — cross-register stage-boundary gate.
 */
import { describe, expect, it } from 'vitest';

import { evaluateStageGate } from '../../../server/src/services/rolloutGateService.js';

describe('evaluateStageGate', () => {
  it('GO when all criteria met', () => {
    const r = evaluateStageGate({
      gateMetrics: [{ name: 'Adoption', met: true }],
      gateBlockers: [{ name: 'Vendor', open: false }],
      signOffs: [{ name: 'Sponsor', done: true }],
    });
    expect(r.decision).toBe('GO');
  });

  it('CONDITIONAL_GO when only sign-offs pending', () => {
    const r = evaluateStageGate({
      gateMetrics: [{ name: 'Adoption', met: true }],
      gateBlockers: [],
      signOffs: [{ name: 'Sponsor', done: false }],
    });
    expect(r.decision).toBe('CONDITIONAL_GO');
    expect(r.pendingSignOffs).toEqual(['Sponsor']);
  });

  it('HOLD when a gate-blocking risk is open', () => {
    const r = evaluateStageGate({
      gateMetrics: [{ name: 'Adoption', met: true }],
      gateBlockers: [{ name: 'Security', open: true }],
    });
    expect(r.decision).toBe('HOLD');
    expect(r.openBlockers).toEqual(['Security']);
  });

  it('HOLD when a gate KPI is unmet', () => {
    const r = evaluateStageGate({ gateMetrics: [{ name: 'NPS', met: false }, { name: 'Adoption', met: true }] });
    expect(r.decision).toBe('HOLD');
    expect(r.unmetMetrics).toEqual(['NPS']);
  });

  it('KILL when all KPIs failed and blockers open', () => {
    const r = evaluateStageGate({
      gateMetrics: [{ name: 'NPS', met: false }, { name: 'Adoption', met: false }],
      gateBlockers: [{ name: 'Budget', open: true }],
    });
    expect(r.decision).toBe('KILL');
  });

  it('GO on an empty gate (no criteria defined)', () => {
    expect(evaluateStageGate({}).decision).toBe('GO');
  });
});
