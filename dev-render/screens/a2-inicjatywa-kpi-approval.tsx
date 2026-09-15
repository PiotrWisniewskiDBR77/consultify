import { TrendingUp } from 'lucide-react';
import React from 'react';

import { InitiativeKpiApprovalCard } from '../../src/components/Initiatives/InitiativeKpiApprovalCard';
import NModeShell from '../../src/components/shared/NModeLayout/NModeShell';
import { AppProviders } from '../../src/providers/AppProviders';

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(raw, window.location.origin).pathname;
  if (path.endsWith('/initiatives/runtime-v1/initiatives/a2-demo/definition-approval')) {
    return new Response(
      JSON.stringify({
        enabled: true,
        actorId: 'portfolio-viewer',
        capabilities: { edit: false, review: false, request: false, decide: false },
        authorities: [],
        participants: [],
        initiativeVersion: 8,
        lifecycleState: 'REGISTERED_DRAFT',
        title: 'Customer onboarding recovery',
        decision: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (path.endsWith('/initiatives/runtime-v1/initiatives/a2-demo/cards')) {
    return new Response(
      JSON.stringify({
        initiativeVersion: 8,
        cards: [
          {
            cardKey: 'kpi',
            cardVersion: 1,
            aggregateVersion: 8,
            applicability: 'REQUIRED',
            completion: 'COMPLETE',
            quality: 'SUFFICIENT',
            freshness: 'CURRENT',
            reviewState: 'REQUESTED',
            content: { kpiRefs: ['cycle-time', 'first-value'] },
            evidenceRefs: ['initiative-kpi:cycle-time', 'initiative-kpi:first-value'],
            waiverDecisionId: null,
            publishedBy: 'initiative-owner',
            publishedAt: '2026-09-15T21:00:00.000Z',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return originalFetch(input, init);
};

const kpis = [
  {
    id: 'cycle-time',
    name: 'Onboarding cycle time',
    unit: 'days',
    baseline: '10',
    current: '9',
    target: '6',
    observationPhase: 'realization' as const,
    trackedInRealization: true,
    trackedPostImplementation: false,
    realizationTarget: '6',
    postImplementationTarget: '',
    cadence: 'WEEKLY',
  },
  {
    id: 'first-value',
    name: 'Time to first value',
    unit: 'days',
    baseline: '21',
    current: '18',
    target: '12',
    observationPhase: 'both' as const,
    trackedInRealization: true,
    trackedPostImplementation: true,
    realizationTarget: '14',
    postImplementationTarget: '12',
    cadence: 'MONTHLY',
  },
];

export default function A2InitiativeKpiApprovalScreen() {
  const [activeSection, setActiveSection] = React.useState('kpi');
  return (
    <AppProviders>
      <div className="h-screen bg-c-background text-c-text">
        <NModeShell
          presentationMode="n"
          onPresentationModeChange={() => undefined}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          header={{
            title: 'Customer onboarding recovery',
            onTitleChange: () => undefined,
            titleReadOnly: true,
            artifactId: 'INIT-A2-DEMO',
            artifactType: 'initiative',
            onSave: () => undefined,
            onClose: () => undefined,
            saveState: 'saved',
            statusLabel: 'KPI review requested',
            statusTone: 'review',
          }}
          properties={[
            { id: 'owner', label: { en: 'Owner', pl: 'Właściciel' }, type: 'text', value: 'Anna Kowalska', onChange: () => undefined, readOnly: true },
            { id: 'stage', label: { en: 'Stage', pl: 'Etap' }, type: 'text', value: 'Portfolio analysis', onChange: () => undefined, readOnly: true },
          ]}
          sections={[
            {
              id: 'kpi',
              icon: TrendingUp,
              label: { en: 'KPI', pl: 'KPI' },
              alwaysShow: true,
              component: (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-4">
                    <h2 className="mb-3 text-lg font-semibold text-c-text">KPIs &amp; Benefits</h2>
                    <div className="space-y-2">
                      {kpis.map((kpi) => (
                        <div key={kpi.id} className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-xl border border-c-border-subtle px-3 py-2 text-sm">
                          <span className="font-medium text-c-text">{kpi.name}</span>
                          <span className="text-c-text-muted">{kpi.baseline} → {kpi.realizationTarget} {kpi.unit}</span>
                          <span className="text-c-text-muted">{kpi.cadence}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <InitiativeKpiApprovalCard initiativeId="a2-demo" kpis={kpis} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </AppProviders>
  );
}
