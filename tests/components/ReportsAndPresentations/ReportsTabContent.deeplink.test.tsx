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

// D-34b: ReportsTabContent's table view is the Triada standard — the REAL
// StandardTable (which pulls FilterableTable from the DIRECT submodule path
// '../shared/ModuleHub/FilterableTable', NOT this barrel) + a REAL StandardPreview
// in a plain flex split. The former mocks here were dead:
//   • barrel `FilterableTable` — never hit (StandardTable bypasses the barrel);
//   • `TableWithPreviewLayout` — no longer used (ReportsTabContent.tsx:504-507:
//     "plain flex split, NOT TableWithPreviewLayout").
// Only `GridView` stays stubbed (imported from the barrel, unused in table view).
// Deep-link selection is asserted on the LIVE row `aria-selected`.
vi.mock('../../../src/components/shared/ModuleHub', () => ({
  GridView: () => <div data-testid="grid-view" />,
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

    // Live surface: initialArtifactId 'art-r2' → selectedId 'report-2' →
    // StandardTable selectedRowId → FilterableTable marks that row aria-selected
    // (FilterableTable.tsx:2403). The non-matching sibling stays false.
    expect(screen.getByRole('row', { name: /Report Two/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('row', { name: /Report One/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });
});
