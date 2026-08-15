/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SheetsTabContent } from '../../../src/components/ReportsAndPresentations/SheetsTabContent';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_k: string, fallback?: string) => fallback || _k,
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('../../../src/components/ReportsAndPresentations/OutputsAggregateTabContent', () => ({
  OutputsAggregateTabContent: ({ initialArtifactId }: any) => (
    <div data-testid="outputs-aggregate-initial">{initialArtifactId || 'none'}</div>
  ),
}));

const actions = {
  exportReportPdf: vi.fn(),
  exportDeckPptx: vi.fn(),
  archiveReport: vi.fn().mockResolvedValue(true),
  archiveDeck: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

describe('SheetsTabContent deep-link wiring', () => {
  it('passes initialArtifactId through to OutputsAggregateTabContent', () => {
    render(
      <SheetsTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        rows={[
          {
            id: 'sheet:table-1',
            kind: 'sheet',
            originRecordId: 'table-1',
            artifactId: 'art-sheet-1',
            title: 'Sheet 1',
          } as any,
        ]}
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
        initialArtifactId="art-sheet-1"
      />
    );

    expect(screen.getByTestId('outputs-aggregate-initial').textContent).toBe('art-sheet-1');
  });

  it('keeps aggregate view mounted for deep links even when rows are empty', () => {
    render(
      <SheetsTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        rows={[]}
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
        initialArtifactId="art-sheet-empty"
      />
    );

    expect(screen.getByTestId('outputs-aggregate-initial').textContent).toBe('art-sheet-empty');
  });
});
