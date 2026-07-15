/**
 * Mock host for <ExecutionChangeSignalsPanel> (M14-wire, 2026-07-15) — behind
 * `changeSignals` flag (default OFF). Reuses the REAL, presentational panel
 * (no re-implementation), fed via injected fetchers shaped exactly like the
 * JSON the wired backend endpoints return:
 *   - POST /api/execution-analytics/capacity/signals  (capacitySignalService)
 *   - POST /api/execution-analytics/readiness/analyze (peopleChangeReadinessService)
 *   - GET  /api/raid-governance/champions[/coverage]  (changeChampionsService)
 *
 * Numbers below mirror a realistic DBR77-scale-up portfolio: one overloaded
 * consultant, one under-utilized, ADKAR readiness DEVELOPING with an Awareness
 * barrier, and a guiding coalition below Kotter's ~15% target.
 */
import React from 'react';

import ExecutionChangeSignalsPanel from '../../src/components/Execution/ExecutionChangeSignalsPanel';

export function ExecutionChangeSignalsScreen(): React.ReactElement {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <ExecutionChangeSignalsPanel
        fetchers={{
          capacityAlerts: () =>
            Promise.resolve([
              {
                userId: 'u-marta',
                name: 'Marta K.',
                capacityHours: 40,
                allocatedHours: 68,
                overloadHours: 28,
                severity: 'critical',
                suggestion: 'Przenieś część zadań na Piotra R.',
              },
              {
                userId: 'u-piotr',
                name: 'Piotr R.',
                capacityHours: 40,
                allocatedHours: 12,
                overloadHours: 0,
                severity: 'warning',
                suggestion: 'Dostępna wolna wydolność',
              },
            ]),
          capacitySignals: () =>
            Promise.resolve({
              signals: [
                {
                  id: 'capacity-overload-u-marta',
                  type: 'CAPACITY_OVERLOAD',
                  severity: 'CRITICAL',
                  resourceId: 'u-marta',
                  utilizationPct: 170,
                  title: 'Zasób u-marta przeciążony — wykorzystanie 170%',
                },
                {
                  id: 'capacity-underutilized-u-piotr',
                  type: 'CAPACITY_UNDERUTILIZED',
                  severity: 'LOW',
                  resourceId: 'u-piotr',
                  utilizationPct: 30,
                  title: 'Zasób u-piotr niedociążony — wykorzystanie 30%',
                },
              ],
              portfolio: {
                overloadedCount: 1,
                underutilizedCount: 1,
                worstUtilizationPct: 170,
                balance: 'critical',
              },
            }),
          pulseSummary: () =>
            Promise.resolve({ avgRating: 3.4, totalResponses: 18, trend: 'stable' }),
          capabilityMatch: () =>
            Promise.resolve([{ matchScore: 62 }, { matchScore: 71 }, { matchScore: 55 }]),
          readinessAnalyze: () =>
            Promise.resolve({
              readiness: {
                awareness: 2,
                desire: 3,
                knowledge: 3,
                ability: 3,
                reinforcement: null,
                overall: 2.8,
                barriers: ['Awareness'],
                unmeasured: ['Reinforcement'],
                readiness: 'DEVELOPING',
              },
              laneProblem: {
                problemType: 'declining_adoption',
                severity: 'warning',
                title: 'Adoption barriers detected (Awareness)',
              },
            }),
          champions: () =>
            Promise.resolve([
              { id: 'c1', role: 'sponsor', status: 'active' },
              { id: 'c2', role: 'ambassador', status: 'active' },
              { id: 'c3', role: 'ambassador', status: 'inactive' },
            ]),
          championsCoverage: () =>
            Promise.resolve({
              championCount: 2,
              affectedPopulation: 34,
              coveragePct: 5.9,
              adequate: false,
            }),
        }}
      />
    </div>
  );
}

export default ExecutionChangeSignalsScreen;
