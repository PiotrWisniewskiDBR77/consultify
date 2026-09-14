/** DEC-497 P2: full InitiativesHub shell for EN/PL, light/dark and empty/full evidence. */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
useAppStore.setState({ isDemoMode: false });
try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // The harness can still render when storage is unavailable.
}

const query = new URLSearchParams(window.location.search);
const empty = query.get('state') === 'empty';
const ORG_ID = 'org-dbr77-demo';
const initiatives = empty
  ? []
  : [
      { id: 'foundation', organizationId: ORG_ID, name: 'Data foundation', title: 'Data foundation', summary: 'Create the governed operating dataset.', status: 'IN_EXECUTION', lifecycle: 'IN_EXECUTION', archived: false, onHold: false, priority: 'HIGH', createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-09-14T09:00:00.000Z' },
      { id: 'rollout', organizationId: ORG_ID, name: 'Operating rollout', title: 'Operating rollout', summary: 'Deploy the new operating process.', status: 'APPROVED', lifecycle: 'APPROVED', archived: false, onHold: false, priority: 'HIGH', createdAt: '2026-08-05T09:00:00.000Z', updatedAt: '2026-09-14T09:10:00.000Z' },
      { id: 'training', organizationId: ORG_ID, name: 'Team training', title: 'Team training', summary: 'Prepare the production cohort.', status: 'APPROVED', lifecycle: 'APPROVED', archived: false, onHold: false, priority: 'MEDIUM', createdAt: '2026-08-06T09:00:00.000Z', updatedAt: '2026-09-14T09:20:00.000Z' },
    ];
const periods = Array.from({ length: 12 }, (_, index) => ({
  periodId: `W${index + 1}`,
  start: new Date(Date.UTC(2026, 8, 14 + index * 7)).toISOString(),
  end: new Date(Date.UTC(2026, 8, 21 + index * 7)).toISOString(),
}));
const windows = initiatives.map((initiative, index) => ({
  initiativeId: initiative.id,
  initiativeVersion: 1,
  earliest: periods[Math.min(index * 2, 10)]?.start ?? periods[0].start,
  target: periods[Math.min(index * 2, 10)]?.start ?? periods[0].start,
  latest: periods[Math.min(index * 2 + 2, 11)]?.end ?? periods.at(-1)!.end,
  confidence: index === 2 ? 'MEDIUM' : 'HIGH',
  rationale: 'PLAN_REASON:{"code":"DEPENDENCIES_PRECEDE"}',
  dependencySnapshot: index === 0 ? [] : [initiatives[index - 1].id],
  constraintSnapshot: [],
}));
const scenario = {
  scenarioId: 'plan-us-launch', name: 'US launch transformation plan', scenarioVersion: 4, status: 'DRAFT',
  portfolioScenarioId: 'portfolio-us', portfolioScenarioVersion: 3, windowUnit: 'WEEK', timezone: 'America/Chicago', periods, windows,
  assumptions: [], createdBy: 'Piotr Wisniewski', updatedBy: 'Piotr Wisniewski', publishedBy: null, publishedAt: null,
};
const proposal = {
  proposalId: 'proposal-us-launch', inputAggregateVersion: 4, inputScenarioVersion: 4, status: 'PENDING_REVIEW',
  assumptions: [], rationale: 'AI dependency analysis', conflicts: [], changes: [], analysisSource: 'AI', analysisModel: 'consultify-plan-premium',
  dependencyObservations: empty ? [] : [
    { observationId: 'obs-1', predecessorId: 'foundation', successorId: 'rollout', kind: 'ABSOLUTE', condition: null, rationale: 'The rollout consumes the governed dataset produced by Data foundation.', evidenceRefs: ['deliverables', 'scopeIn'], confidence: 'HIGH' },
    { observationId: 'obs-2', predecessorId: 'rollout', successorId: 'training', kind: 'CONDITIONAL', condition: 'When training uses the production cohort.', rationale: 'The production cohort depends on a stable rollout; sandbox training may start earlier.', evidenceRefs: ['summary', 'plannedStartDate'], confidence: 'MEDIUM' },
  ],
  criticalPaths: empty ? [] : [
    { pathId: 'absolute', kind: 'ABSOLUTE', initiativeIds: ['foundation', 'rollout'], condition: null, rationale: 'Hard delivery gate.' },
    { pathId: 'conditional', kind: 'CONDITIONAL', initiativeIds: ['rollout', 'training'], condition: 'When training uses the production cohort.', rationale: 'Conditional adoption path.' },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.includes('/api/organizations/') && url.includes('/members')) return json({ members: [] });
  if (url.includes('/api/v8/planning/pending-decisions')) return json([]);
  if (url.includes('/api/users')) return json([]);
  if (url.includes('/api/organizations/current')) return json({ id: ORG_ID, name: 'DBR77' });
  if (url.includes('/api/v8/admin/flags')) return json({ flags: {} });
  if (url.includes('/api/initiatives/runtime-v1/plan-scenarios/plan-us-launch/analysis-proposals')) return json({ items: [proposal] });
  if (url.includes('/api/initiatives/runtime-v1/plan-scenarios/plan-us-launch')) return json({ version: 4, scenario });
  if (url.includes('/api/initiatives/runtime-v1/plan-scenarios')) return json({ scenarios: empty ? [] : [{ id: scenario.scenarioId, name: scenario.name, state: scenario.status, version: scenario.scenarioVersion, portfolioRef: { scenarioId: scenario.portfolioScenarioId, scenarioVersion: scenario.portfolioScenarioVersion, name: 'US launch portfolio' }, window: { earliest: windows[0]?.earliest ?? null, latest: windows.at(-1)?.latest ?? null }, updatedAt: '2026-09-14T10:00:00.000Z', timeBasis: { windowUnit: 'WEEK', timezone: scenario.timezone, periods, knowledgeState: 'KNOWN' }, initiativeCount: windows.length, conflicts: 0, author: 'Piotr Wisniewski' }] });
  if (url.includes('/api/initiatives/runtime-v1/planning/')) return json({ initiatives: [] });
  if (url.includes('/api/initiatives/runtime-v1/capacity-scenarios')) return json({ scenarios: [] });
  if (url.includes('/api/initiatives/lifecycle-transition-proposals')) return json({ proposals: [] });
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) return json({ initiatives: [], nextCursor: null });
  if (url.includes('/my-work/definition-approvals')) return json({ enabled: false, items: [] });
  if (url.includes('/capabilities')) return json({ canUpdate: true, canReview: true, canSelfApprove: true });
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) return json(initiatives);
  return originalFetch(input, init);
};

export default function Z3xInicjatywyPlanScreen(): React.ReactElement {
  return <AppProviders><div className="h-screen" data-testid="z3x-inicjatywy-plan"><InitiativesHub /></div></AppProviders>;
}
