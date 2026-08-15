/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OutputsAggregateTabContent } from '../../../src/components/ReportsAndPresentations/OutputsAggregateTabContent';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_k: string, fallback?: string | { defaultValue?: string }) =>
        typeof fallback === 'string' ? fallback : fallback?.defaultValue || _k,
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      pathname: '/presentations',
      search: '',
      hash: '',
      key: 'test-key',
      state: null,
    }),
  };
});

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/ReportsAndPresentations/useTrustState', () => ({
  useTrustState: (_artifactId?: string, governance?: any) => governance,
}));

vi.mock('../../../src/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    flags: {},
    isEnabled: () => false,
  }),
}));

vi.mock('../../../src/utils/sheetArtifactOpen', () => ({
  downloadSheetArtifactXlsx: vi.fn(),
  resolveTablePlatformWorkspaceIdForTable: vi.fn().mockResolvedValue('workspace-1'),
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  GridView: () => <div data-testid="grid-view" />,
}));

vi.mock('../../../src/components/standard', () => ({
  StandardTable: ({ selectedRowId }: any) => (
    <div data-testid="selected-id">{selectedRowId || 'none'}</div>
  ),
  StandardPreview: ({ children }: any) => <div>{children}</div>,
  standardPreviewShortcuts: () => ({}),
}));

const actions = {
  exportReportPdf: vi.fn(),
  exportDeckPptx: vi.fn(),
  archiveReport: vi.fn().mockResolvedValue(true),
  archiveDeck: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

describe('OutputsAggregateTabContent deep-link selection', () => {
  it('selects matching mixed-kind output row from initialArtifactId', () => {
    render(
      <OutputsAggregateTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        rows={
          [
            {
              kind: 'document',
              originRecordId: 'report-1',
              artifactId: 'art-doc-1',
              title: 'Report One',
              owner: 'Owner A',
              statusKey: 'draft',
              updatedAt: '2026-05-01T00:00:00Z',
              exportFormats: ['pdf'],
              governance: {},
            },
            {
              kind: 'sheet',
              originRecordId: 'table-2',
              artifactId: 'art-sheet-2',
              title: 'Sheet Two',
              owner: 'Owner B',
              statusKey: 'ready',
              updatedAt: '2026-05-02T00:00:00Z',
              exportFormats: ['xlsx'],
              governance: {},
            },
            {
              kind: 'presentation',
              originRecordId: 'deck-3',
              artifactId: 'art-deck-3',
              title: 'Deck Three',
              owner: 'Owner C',
              statusKey: 'ready',
              updatedAt: '2026-05-03T00:00:00Z',
              exportFormats: ['pptx'],
              governance: {},
            },
          ] as any
        }
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
        initialArtifactId="art-sheet-2"
      />
    );

    expect(screen.getByTestId('selected-id').textContent).toBe('sheet:table-2');
  });
});
