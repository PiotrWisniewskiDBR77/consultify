import { FileText } from 'lucide-react';
import React from 'react';
import { DefinitionCardContent } from '../../src/components/Initiatives/DefinitionCardContent';
import NModeShell from '../../src/components/shared/NModeLayout/NModeShell';
import { AppProviders } from '../../src/providers/AppProviders';

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(raw, window.location.origin).pathname;
  if (path.endsWith('/initiatives/runtime-v1/initiatives/a3-demo/cards')) {
    return new Response(
      JSON.stringify({
        initiativeVersion: 7,
        cards: [
          {
            cardKey: 'strategic-fit',
            cardVersion: 3,
            aggregateVersion: 7,
            applicability: 'REQUIRED',
            completion: 'COMPLETE',
            quality: 'SUFFICIENT',
            freshness: 'CURRENT',
            reviewState: 'REQUESTED',
            content: {
              objectives: ['Reduce setup loss', 'Shorten the first-value cycle'],
              rationale: 'A single handoff standard removes the measured delay.',
            },
            evidenceRefs: ['Interview synthesis · September 2026'],
            waiverDecisionId: null,
            estimate: {
              value: '40–60 h',
              basis: 'Four workshops, process synthesis, and one validation round.',
            },
            estimatedBy: 'Anna Kowalska',
            estimatedAt: '2026-09-15T16:00:00.000Z',
            publishedBy: 'initiative-owner',
            publishedAt: '2026-09-15T16:00:00.000Z',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return originalFetch(input, init);
};

export default function A3InitiativeCardEstimateScreen() {
  const [activeSection, setActiveSection] = React.useState('definition');
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
            artifactId: 'INIT-A3-DEMO',
            artifactType: 'initiative',
            onSave: () => undefined,
            onClose: () => undefined,
            saveState: 'saved',
            statusLabel: 'Awaiting review',
            statusTone: 'review',
          }}
          properties={[
            { id: 'owner', label: { en: 'Owner', pl: 'Właściciel' }, type: 'text', value: 'Anna Kowalska', onChange: () => undefined, readOnly: true },
            { id: 'stage', label: { en: 'Stage', pl: 'Etap' }, type: 'text', value: 'Definition', onChange: () => undefined, readOnly: true },
          ]}
          sections={[
            {
              id: 'definition',
              icon: FileText,
              label: { en: 'Definition', pl: 'Definicja' },
              alwaysShow: true,
              component: (
                <DefinitionCardContent
                  initiativeId="a3-demo"
                  actorId="portfolio-viewer"
                  participants={[]}
                  canEdit={false}
                  canReview={false}
                  selectedCardKey="strategic-fit"
                  onChanged={async () => undefined}
                />
              ),
            },
          ]}
        />
      </div>
    </AppProviders>
  );
}
