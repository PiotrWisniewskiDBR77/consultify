import React from 'react';

import { ExecutionReportsSurface } from '../../src/components/Execution/ExecutionReportsSurface';
import { ControlLoopReport } from '../../src/components/Execution/reports-intelligence/ControlLoopReport';
import { ResourcesCapacityReport } from '../../src/components/Execution/reports-intelligence/ResourcesCapacityReport';
import { UnifiedExecutionReportGenerator } from '../../src/components/Execution/reports-intelligence/UnifiedExecutionReportGenerator';
import { WorkIntelligenceReport } from '../../src/components/Execution/reports-intelligence/WorkIntelligenceReport';

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const installFixtureTransport = (state: string) => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (state === 'error') return response({ error: 'Controlled dev-render failure' }, 503);
    if (url.includes('/report-definitions/def-weekly'))
      return response({
        definitionId: 'def-weekly',
        currentVersion: 3,
        versions: [
          {
            definitionVersion: 3,
            state: 'PUBLISHED',
            name: 'Weekly Execution Pack',
            ownerId: 'owner-1',
            approverId: 'approver-1',
          },
        ],
      });
    if (url.endsWith('/report-definitions'))
      return response({ items: [{ definitionId: 'def-weekly' }] });
    if (url.endsWith('/report-runs'))
      return response({
        items:
          state === 'empty'
            ? []
            : [
                {
                  reportRunId: 'run-week-35',
                  definitionRef: { definitionId: 'def-weekly', version: 3 },
                  status: 'PUBLISHED',
                  period: { start: '2026-08-18T00:00:00Z', end: '2026-08-24T23:59:59Z' },
                  asOf: '2026-08-25T08:00:00Z',
                  contentHash: 'sha256-day11',
                  version: 5,
                },
              ],
      });
    if (url.includes('/execution-cases/case-1/work'))
      return response({
        tasks:
          state === 'empty'
            ? []
            : [
                {
                  taskId: 'task-overdue',
                  title: 'Close supplier readiness gap',
                  status: 'BLOCKED',
                  assigneeId: 'anna',
                  dueAt: '2026-08-20T12:00:00Z',
                  slaAt: '2026-08-21T12:00:00Z',
                  dependencies: ['decision-1'],
                  evidenceRefs: ['ev-1'],
                  definitionOfDone: 'Acceptance evidence',
                  version: 4,
                },
                {
                  taskId: 'task-undated',
                  title: 'Confirm rollout support',
                  status: 'OPEN',
                  assigneeId: 'marek',
                  dueAt: null,
                  evidenceRefs: [],
                  version: 2,
                },
              ],
        decisions:
          state === 'empty'
            ? []
            : [
                {
                  decisionId: 'decision-1',
                  title: 'Approve additional shift',
                  status: 'PENDING',
                  authorityId: 'board',
                  dueAt: '2026-08-25T12:00:00Z',
                  slaAt: '2026-08-25T12:00:00Z',
                  evidenceRefs: ['ev-2'],
                  version: 3,
                },
              ],
      });
    if (url.includes('/execution-cases/case-1/milestones')) return response({ items: [] });
    if (url.includes('/execution-cases/case-1/allocations'))
      return response({
        items:
          state === 'empty'
            ? []
            : [
                {
                  allocationId: 'alloc-1',
                  assigneeId: 'anna',
                  assigneeName: 'Anna Kowalska',
                  roleName: 'Industrial Engineer',
                  timeBasis: { weekStart: '2026-08-24' },
                  availability: { knowledgeState: 'KNOWN', value: 32 },
                  demand: { knowledgeState: 'KNOWN', value: 38 },
                  load: { low: 1.12, high: 1.25 },
                  confidence: 'MEDIUM',
                  skillMatch: { state: 'MATCH' },
                  assessment: { state: 'OVERALLOCATED' },
                  version: 3,
                },
              ],
      });
    if (url.endsWith('/execution-cases'))
      return response({
        cases:
          state === 'empty'
            ? []
            : [
                {
                  executionCaseId: 'case-1',
                  initiativeId: 'initiative-1',
                  initiativeTitle: 'Factory AI rollout',
                },
              ],
      });
    if (url.endsWith('/management-signals'))
      return response({
        signals:
          state === 'empty'
            ? []
            : [
                {
                  signalId: 'signal-1',
                  title: 'Capacity conflict',
                  status: 'QUALIFIED',
                  severity: 'HIGH',
                  ownerId: 'controller',
                  decisionId: 'decision-1',
                  taskId: 'task-overdue',
                  version: 2,
                },
              ],
      });
    if (url.endsWith('/interventions'))
      return response({
        interventions:
          state === 'empty'
            ? []
            : [
                {
                  interventionId: 'intervention-1',
                  title: 'Rebalance shift',
                  status: 'RESOLVED',
                  severity: 'HIGH',
                  ownerId: 'ops',
                  decisionId: 'decision-1',
                  taskId: 'task-overdue',
                  evidenceRefs: [],
                  version: 3,
                },
              ],
      });
    return response({ items: [], cases: [] });
  }) as typeof fetch;
};

export function ExecutionReportDay11Screen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const report = params.get('report') || 'work';
  const state = params.get('state') || 'ready';
  document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
  installFixtureTransport(state);
  return (
    <div className="min-h-screen bg-c-surface p-4 text-c-text">
      {report === 'work' ? <WorkIntelligenceReport /> : null}
      {report === 'resources' ? <ResourcesCapacityReport /> : null}
      {report === 'control' ? <ControlLoopReport /> : null}
      {report === 'generator' ? <UnifiedExecutionReportGenerator /> : null}
      {report === 'registry' ? <ExecutionReportsSurface activePreset="all" /> : null}
    </div>
  );
}

export default ExecutionReportDay11Screen;
