/**
 * Day 267 — owner-verdict evidence harness for the REAL Materials hub.
 *
 * Query: &tab=outputs_all|outputs_documents|presentations|outputs_sheets|templates
 *        &state=ready|empty|loading|error
 * The fixture uses the canonical server registry field names consumed by
 * useRapData; it does not replace or copy any production UI.
 */
import React from 'react';

import { ReportsAndPresentationsHub } from '../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

type HarnessState = 'ready' | 'empty' | 'loading' | 'error';

const params = new URLSearchParams(window.location.search);
const state = (params.get('state') || 'ready') as HarnessState;
const originalFetch = window.fetch.bind(window);

const outputRows = [
  {
    artifactId: 'day267-document-index',
    artifactFamily: 'document',
    outputType: 'report',
    originRuntime: 'native_artifact',
    originRecordId: 'day267-document',
    resolvedTitle: 'Plan transformacji operacyjnej',
    originStatus: 'ready',
    deliveryState: 'ready',
    ownerName: 'Piotr Wisniewski',
    createdAt: '2026-08-21T08:00:00.000Z',
    lastTransitionAt: '2026-08-23T12:00:00.000Z',
    publishState: 'approved',
    validationState: 'validated',
    visibilityScope: 'organization',
    exportFormat: 'docx',
    reportType: 'executive_memo',
    openPath: '/document-studio/day267-document',
    authority: 'document_studio',
  },
  {
    artifactId: 'day267-presentation-index',
    artifactFamily: 'presentation',
    outputType: 'presentation',
    originRuntime: 'presentation',
    originRecordId: 'day267-presentation',
    resolvedTitle: 'Transformacja operacyjna — decyzja 90 dni',
    originStatus: 'ready',
    deliveryState: 'ready',
    ownerName: 'Piotr Wisniewski',
    createdAt: '2026-08-21T08:00:00.000Z',
    lastTransitionAt: '2026-08-23T12:15:00.000Z',
    publishState: 'approved',
    validationState: 'validated',
    visibilityScope: 'organization',
    exportFormat: 'pptx',
    originSummary: { deckType: 'tool', slideCount: 4 },
    openPath: '/presentation-builder/day267-presentation',
    authority: 'presentation_builder',
  },
  {
    artifactId: 'day267-sheet-index',
    artifactFamily: 'workbook',
    outputType: 'sheet',
    originRuntime: 'sheet',
    originRecordId: 'day267-workbook',
    resolvedTitle: 'Model korzyści transformacji',
    originStatus: 'ready',
    deliveryState: 'ready',
    ownerName: 'Piotr Wisniewski',
    createdAt: '2026-08-21T08:00:00.000Z',
    lastTransitionAt: '2026-08-23T12:30:00.000Z',
    publishState: 'approved',
    validationState: 'validated',
    visibilityScope: 'organization',
    exportFormat: 'xlsx',
    originSummary: { source: 'workbook_generator', sheetCount: 1 },
    openPath: '/workbook/day267-workbook',
    authority: 'workbook',
  },
];

const templateRows = ['report', 'presentation', 'sheet'].map((outputType, index) => ({
  artifactId: `day267-template-index-${index + 1}`,
  artifactFamily: 'template',
  outputType,
  originRuntime: 'template_library',
  originRecordId: `day267-template-${index + 1}`,
  resolvedTitle: ['Raport zarządczy', 'Przegląd inicjatyw', 'Model korzyści'][index],
  createdAt: '2026-08-20T08:00:00.000Z',
  lastTransitionAt: '2026-08-24T08:00:00.000Z',
  originSummary: {
    template: {
      canonicalTemplateId: `canonical-day267-${index + 1}`,
      originRuntime: 'template_library',
      source: 'canonical',
      description: 'Zatwierdzony wzorzec organizacji',
      scope: 'organization',
      status: 'approved',
      metadata: { createdBy: 'Zespół transformacji', updatedAt: '2026-08-24T08:00:00.000Z' },
      structureBlueprint: outputType === 'presentation'
        ? { outline: [{ title: 'Decyzja' }, { title: 'Plan' }] }
        : { sections: [{ title: 'Podsumowanie' }, { title: 'Rekomendacje' }] },
    },
  },
}));

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (!url.includes('/api/artifacts')) return originalFetch(input, init);
  if (state === 'loading') return new Promise<Response>(() => undefined);
  if (state === 'error') return new Response(JSON.stringify({ error: 'day267_harness_error' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

  const query = new URL(url, window.location.origin).searchParams;
  let data: unknown[] = [];
  if (state === 'ready') {
    data = query.get('artifactFamily') === 'template'
      ? templateRows.filter((row) => row.outputType === query.get('outputType'))
      : outputRows.filter((row) => !query.get('outputType') || row.outputType === query.get('outputType'));
  }
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export default function Day267MaterialyHubZrzutyScreen(): React.ReactElement {
  return (
    <FeatureFlagsProvider>
      <AppProviders>
        <div className="h-screen min-h-0 bg-c-canvas text-c-text" data-testid={`day267-state-${state}`}>
          <ReportsAndPresentationsHub />
        </div>
      </AppProviders>
    </FeatureFlagsProvider>
  );
}
