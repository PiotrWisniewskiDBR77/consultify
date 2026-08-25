/**
 * Dev-render host for the REAL `<OutputsAggregateTabContent />` — the
 * Materials common "All" registry (ReportsAndPresentationsHub, Menu 1
 * "All" tab). Renders the REAL production component (StandardTable +
 * StandardPreview), not a mockup — CLAUDE.md #7.
 *
 * Purpose: visual evidence for the materials-registry-fix (2026-08-25).
 * MODULE_ACCEPTANCE.md (G05, 11_MATERIALS) recorded: "the recovered common
 * registry projects only the Presentation row — Document/Sheet registry
 * projection ... remain defective". Root cause (see
 * server/scripts/seed-wave3-materials-owner-review.ts and
 * tests/unit/backend/services/artifactRegistry.materialsRegistryProjection.test.ts):
 * the owner-review fixture seeded Document/Sheet `v8_output_artifacts` rows
 * with is_draft=1 (excluded by the server's default M17 draft filter) while
 * Presentation was seeded is_draft=0. The CLIENT projection/navigation code
 * in OutputsAggregateTabContent/useRapData was already correct — this
 * harness proves that directly: three realistic, mixed-kind rows (matching
 * the seed fixture's real content, POST-fix is_draft=0/ready shape) all
 * render in the same "All" table.
 *
 * `OutputsAggregateTabContent` takes its rows as a prop (no internal fetch
 * on mount unless a row is selected/previewed), so no fetch stub is needed
 * for this screenshot — real component, real props, zero network.
 *
 * URL: /materials-registry.html?theme=dark
 */
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { OutputsAggregateTabContent } from '../../src/components/ReportsAndPresentations/OutputsAggregateTabContent';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import i18n from '../../src/i18n';

const actions = {
  exportReportPdf: async () => {},
  exportDeckPptx: async () => {},
  archiveReport: async () => true,
  archiveDeck: async () => true,
  startArtifactReview: async () => true,
} as any;

// Mirrors the real `GET /api/artifacts` -> mapRegistryItemToUnified rows
// (useRapData.ts), post materials-registry-fix: all three artifacts are
// delivery_state='ready' / is_draft=0, matching the corrected seed script.
const ROWS = [
  {
    kind: 'document' as const,
    originRecordId: 'b1120000-0000-4000-8000-000000000001',
    artifactId: 'art-doc-materials-owner',
    title: 'Plan transformacji operacyjnej',
    statusKey: 'ready',
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-08-23T12:00:00.000Z',
    reportType: 'executive_memo',
    exportFormats: ['docx'],
    fileFormat: 'DOCX',
    governance: {
      visibilityScope: 'organization',
      publishState: 'approved',
      openPath: '/document-studio/b1120000-0000-4000-8000-000000000001',
      originSummary: { sourceType: 'document_studio' },
    },
  },
  {
    kind: 'presentation' as const,
    originRecordId: 'b1160000-0000-4000-8000-000000000001',
    artifactId: 'art-deck-materials-owner',
    title: 'Plan transformacji — 90 dni',
    statusKey: 'ready',
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-08-23T12:15:00.000Z',
    sourceType: 'tool',
    slideCount: 4,
    exportFormats: ['pptx'],
    fileFormat: 'PPTX',
    governance: {
      visibilityScope: 'organization',
      publishState: 'approved',
      openPath: '/presentations/builder/b1160000-0000-4000-8000-000000000001',
      originSummary: { deckType: 'strategy', slideCount: 4 },
    },
  },
  {
    kind: 'sheet' as const,
    originRecordId: 'b1180000-0000-4000-8000-000000000001',
    artifactId: 'art-sheet-materials-owner',
    title: 'Budżet pilotażu',
    statusKey: 'ready',
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-08-23T12:30:00.000Z',
    exportFormats: ['xlsx'],
    fileFormat: 'XLSX',
    sheetOrigin: 'workbook' as const,
    governance: {
      visibilityScope: 'organization',
      publishState: 'approved',
      // Server never sets openPath for originRuntime='sheet' — the client
      // resolves it itself via openGovernedSheetRow -> /excele?artifactId=.
      originSummary: { source: 'workbook_generator', sheetCount: 1 },
    },
  },
];

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);

export default function MaterialsRegistryScreen() {
  return (
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsProvider showDevTools={false}>
        <MemoryRouter initialEntries={['/presentations?tab=all']}>
          <div className="min-h-screen bg-c-bg p-6">
            <div className="mx-auto max-w-[1400px]">
              <div className="mb-4">
                <h1 className="text-lg font-semibold text-c-text">
                  Materiały — Wszystkie (rejestr wspólny)
                </h1>
                <p className="text-sm text-c-text-secondary">
                  /presentations?tab=all — Document · Presentation · Sheet
                </p>
              </div>
              <div className="h-[640px] rounded-2xl border border-c-border-subtle overflow-hidden">
                <OutputsAggregateTabContent
                  viewMode="table"
                  searchQuery=""
                  activeFilters={[]}
                  onFilterChange={() => {}}
                  rows={ROWS as any}
                  loading={false}
                  error={null}
                  onRefresh={() => {}}
                  actions={actions}
                />
              </div>
            </div>
          </div>
        </MemoryRouter>
      </FeatureFlagsProvider>
    </I18nextProvider>
  );
}
