/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReportsTabContent } from '../../../src/components/ReportsAndPresentations/ReportsTabContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback || _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/ReportsAndPresentations/useTrustState', () => ({
  useTrustState: (_artifactId?: string, governance?: any) => governance,
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
  archiveReport: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

const reports = [
  {
    id: 'report-1',
    artifactId: 'art-r1',
    title: 'Report One',
    reportType: 'R1',
    owner: 'User 1',
    status: 'draft',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    governance: {},
  },
  {
    id: 'report-2',
    artifactId: 'art-r2',
    title: 'Report Two',
    reportType: 'R2',
    owner: 'User 2',
    status: 'ready',
    createdAt: '2026-05-02T00:00:00Z',
    updatedAt: '2026-05-02T00:00:00Z',
    governance: {},
  },
] as any;

describe('ReportsTabContent deep-link selection', () => {
  it('selects matching report id from initialArtifactId deep link', () => {
    render(
      <ReportsTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        reports={reports}
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
        initialArtifactId="art-r2"
      />
    );

    expect(screen.getByTestId('selected-id').textContent).toBe('report-2');
  });
});
