/** @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OutputsAggregateTabContent } from '../../../src/components/ReportsAndPresentations/OutputsAggregateTabContent';
import { ReportsTabContent } from '../../../src/components/ReportsAndPresentations/ReportsTabContent';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string | { defaultValue?: string }) =>
        typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key,
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/presentations', search: '', hash: '', state: null }),
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => vi.fn() }));
vi.mock('../../../src/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));
vi.mock('../../../src/utils/sheetArtifactOpen', () => ({
  downloadSheetArtifactXlsx: vi.fn(),
  resolveTablePlatformWorkspaceIdForTable: vi.fn(),
}));
vi.mock('../../../src/components/ReportsAndPresentations/useTrustState', () => ({
  useTrustState: (_artifactId?: string, governance?: unknown) => governance,
}));

const actions = {
  exportReportPdf: vi.fn(),
  exportDeckPptx: vi.fn(),
  archiveReport: vi.fn().mockResolvedValue(true),
  archiveDeck: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

describe('Materials Format columns', () => {
  it('T44 All renders a separate Format column and filters it deterministically', () => {
    render(
      <OutputsAggregateTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[{ column: 'fileFormat', value: 'PDF', label: 'PDF' }]}
        onFilterChange={() => {}}
        rows={[
          { kind: 'document', originRecordId: 'd1', title: 'PDF report', statusKey: 'ready', owner: 'A', updatedAt: '2026-01-01', exportFormats: [], fileFormat: 'PDF' },
          { kind: 'sheet', originRecordId: 's1', title: 'Model', statusKey: 'ready', owner: 'B', updatedAt: '2026-01-01', exportFormats: [], fileFormat: 'XLSX' },
        ] as any}
        loading={false}
        onRefresh={() => {}}
        actions={actions as any}
      />
    );

    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('PDF report')).toBeTruthy();
    expect(screen.queryByText('Model')).toBeNull();
  });

  it('T45 Documents searches by Format and keeps Type and Exports columns', () => {
    render(
      <ReportsTabContent
        viewMode="table"
        searchQuery="docx"
        activeFilters={[]}
        onFilterChange={() => {}}
        reports={[
          { id: 'd1', title: 'Board pack', reportType: 'custom', status: 'ready', owner: 'A', createdAt: '2026-01-01', updatedAt: '2026-01-01', exportFormats: [], fileFormat: 'DOCX' },
          { id: 'd2', title: 'Annual statement', reportType: 'custom', status: 'ready', owner: 'B', createdAt: '2026-01-01', updatedAt: '2026-01-01', exportFormats: ['pdf'], fileFormat: 'PDF' },
        ] as any}
        loading={false}
        onRefresh={() => {}}
        actions={actions as any}
      />
    );

    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('Typ')).toBeTruthy();
    expect(screen.getByText('Eksporty')).toBeTruthy();
    expect(screen.getByText('Board pack')).toBeTruthy();
    expect(screen.queryByText('Annual statement')).toBeNull();
  });
});
