/**
 * @vitest-environment jsdom
 *
 * M14-wire (2026-07-15) — Change Signals panel: renders capacity signals,
 * ADKAR readiness roll-up, and champions coalition from injected fetchers.
 * Fails soft per-section (one erroring fetcher never blocks the other two).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ExecutionChangeSignalsPanel from '../../src/components/Execution/ExecutionChangeSignalsPanel';

describe('ExecutionChangeSignalsPanel', () => {
  it('renders capacity signals with portfolio balance', async () => {
    render(
      <ExecutionChangeSignalsPanel
        fetchers={{
          capacityAlerts: () =>
            Promise.resolve([
              {
                userId: 'u1',
                name: 'Ala',
                capacityHours: 40,
                allocatedHours: 80,
                overloadHours: 40,
                severity: 'critical',
                suggestion: 'Redistribute',
              },
            ]),
          capacitySignals: () =>
            Promise.resolve({
              signals: [
                {
                  id: 'capacity-overload-u1',
                  type: 'CAPACITY_OVERLOAD',
                  severity: 'CRITICAL',
                  resourceId: 'u1',
                  utilizationPct: 200,
                  title: 'Zasób u1 przeciążony — wykorzystanie 200%',
                },
              ],
              portfolio: {
                overloadedCount: 1,
                underutilizedCount: 0,
                worstUtilizationPct: 200,
                balance: 'critical',
              },
            }),
          pulseSummary: () => Promise.resolve(null),
          capabilityMatch: () => Promise.resolve([]),
          readinessAnalyze: () =>
            Promise.resolve({
              readiness: {
                awareness: null,
                desire: null,
                knowledge: null,
                ability: null,
                reinforcement: null,
                overall: null,
                barriers: [],
                unmeasured: ['Awareness', 'Desire', 'Knowledge', 'Ability', 'Reinforcement'],
                readiness: 'UNKNOWN',
              },
              laneProblem: null,
            }),
          champions: () => Promise.resolve([]),
          championsCoverage: () =>
            Promise.resolve({ championCount: 0, affectedPopulation: 0, coveragePct: 0, adequate: false }),
        }}
      />
    );

    await waitFor(() => expect(screen.getByTestId('capacity-signals-list')).toBeTruthy());
    expect(screen.getByTestId('capacity-balance').textContent).toContain('critical');
    expect(screen.getByText('Zasób u1 przeciążony — wykorzystanie 200%')).toBeTruthy();
  });

  it('renders ADKAR readiness dimensions and lane problem', async () => {
    render(
      <ExecutionChangeSignalsPanel
        fetchers={{
          capacityAlerts: () => Promise.resolve([]),
          capacitySignals: () =>
            Promise.resolve({
              signals: [],
              portfolio: { overloadedCount: 0, underutilizedCount: 0, worstUtilizationPct: 0, balance: 'healthy' },
            }),
          pulseSummary: () => Promise.resolve({ avgRating: 1.5, totalResponses: 4, trend: 'declining' }),
          capabilityMatch: () => Promise.resolve([]),
          readinessAnalyze: () =>
            Promise.resolve({
              readiness: {
                awareness: 2,
                desire: 1,
                knowledge: null,
                ability: null,
                reinforcement: null,
                overall: 1.5,
                barriers: ['Awareness', 'Desire'],
                unmeasured: ['Knowledge', 'Ability', 'Reinforcement'],
                readiness: 'AT_RISK',
              },
              laneProblem: {
                problemType: 'declining_adoption',
                severity: 'critical',
                title: 'People-change adoption at risk (Awareness, Desire)',
              },
            }),
          champions: () => Promise.resolve([]),
          championsCoverage: () =>
            Promise.resolve({ championCount: 0, affectedPopulation: 0, coveragePct: 0, adequate: false }),
        }}
      />
    );

    await waitFor(() => expect(screen.getByTestId('readiness-dims')).toBeTruthy());
    expect(screen.getByTestId('readiness-level').textContent).toContain('AT_RISK');
    expect(screen.getByTestId('readiness-lane-problem').textContent).toContain(
      'People-change adoption at risk'
    );
  });

  it('renders champions coalition coverage', async () => {
    render(
      <ExecutionChangeSignalsPanel
        fetchers={{
          capacityAlerts: () => Promise.resolve([]),
          capacitySignals: () =>
            Promise.resolve({
              signals: [],
              portfolio: { overloadedCount: 0, underutilizedCount: 0, worstUtilizationPct: 0, balance: 'healthy' },
            }),
          pulseSummary: () => Promise.resolve(null),
          capabilityMatch: () => Promise.resolve([]),
          readinessAnalyze: () =>
            Promise.resolve({
              readiness: {
                awareness: null,
                desire: null,
                knowledge: null,
                ability: null,
                reinforcement: null,
                overall: null,
                barriers: [],
                unmeasured: [],
                readiness: 'UNKNOWN',
              },
              laneProblem: null,
            }),
          champions: () =>
            Promise.resolve([
              { id: 'c1', role: 'sponsor', status: 'active' },
              { id: 'c2', role: 'ambassador', status: 'active' },
            ]),
          championsCoverage: () =>
            Promise.resolve({ championCount: 2, affectedPopulation: 20, coveragePct: 10, adequate: false }),
        }}
      />
    );

    await waitFor(() => expect(screen.getByTestId('champions-list')).toBeTruthy());
    expect(screen.getByTestId('champions-coverage').textContent).toContain('10%');
    expect(screen.getByText('sponsor')).toBeTruthy();
  });

  it('fails soft: one section erroring does not block the others', async () => {
    render(
      <ExecutionChangeSignalsPanel
        fetchers={{
          capacityAlerts: () => Promise.reject(new Error('boom')),
          capacitySignals: () => Promise.reject(new Error('boom')),
          pulseSummary: () => Promise.resolve(null),
          capabilityMatch: () => Promise.resolve([]),
          readinessAnalyze: () =>
            Promise.resolve({
              readiness: {
                awareness: null,
                desire: null,
                knowledge: null,
                ability: null,
                reinforcement: null,
                overall: null,
                barriers: [],
                unmeasured: [],
                readiness: 'UNKNOWN',
              },
              laneProblem: null,
            }),
          champions: () => Promise.resolve([]),
          championsCoverage: () =>
            Promise.resolve({ championCount: 0, affectedPopulation: 0, coveragePct: 0, adequate: false }),
        }}
      />
    );

    await waitFor(() => expect(screen.getByTestId('capacity-failed')).toBeTruthy());
    // Readiness + champions cards still render their (successful) empty states.
    expect(screen.getByTestId('readiness-empty')).toBeTruthy();
    expect(screen.getByTestId('champions-empty')).toBeTruthy();
  });

  it('shows honest empty states with no fabricated numbers when there is no data', async () => {
    render(
      <ExecutionChangeSignalsPanel
        fetchers={{
          capacityAlerts: () => Promise.resolve([]),
          capacitySignals: () =>
            Promise.resolve({
              signals: [],
              portfolio: { overloadedCount: 0, underutilizedCount: 0, worstUtilizationPct: 0, balance: 'healthy' },
            }),
          pulseSummary: () => Promise.resolve(null),
          capabilityMatch: () => Promise.resolve([]),
          readinessAnalyze: () =>
            Promise.resolve({
              readiness: {
                awareness: null,
                desire: null,
                knowledge: null,
                ability: null,
                reinforcement: null,
                overall: null,
                barriers: [],
                unmeasured: [],
                readiness: 'UNKNOWN',
              },
              laneProblem: null,
            }),
          champions: () => Promise.resolve([]),
          championsCoverage: () =>
            Promise.resolve({ championCount: 0, affectedPopulation: 0, coveragePct: 0, adequate: false }),
        }}
      />
    );

    await waitFor(() => expect(screen.getByTestId('capacity-empty')).toBeTruthy());
    expect(screen.getByTestId('readiness-empty')).toBeTruthy();
    expect(screen.getByTestId('champions-empty')).toBeTruthy();
  });
});
