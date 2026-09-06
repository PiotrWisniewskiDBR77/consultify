/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TemplatesTabContent } from '../../../src/components/ReportsAndPresentations/TemplatesTabContent';

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

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  FilterableTable: ({ data, selectedRowId, onRowClick }: any) => (
    <div data-testid="filterable-table">
      {data.map((row: any) => (
        <button key={row.id} onClick={() => onRowClick(row)} data-testid={`row-${row.id}`}>
          {row.title}
        </button>
      ))}
      <div data-testid="selected-row">{selectedRowId || 'none'}</div>
    </div>
  ),
  GridView: () => <div data-testid="grid-view" />,
}));

vi.mock('../../../src/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children, selectedId }: any) => (
    <div data-testid="table-layout">
      <div data-testid="selected-id">{selectedId || 'none'}</div>
      {children}
    </div>
  ),
}));

const templates = [
  {
    id: 'tpl-1',
    artifactId: 'art-tpl-1',
    title: 'Template One',
    type: 'report',
    category: 'R1',
    scope: 'organization',
    status: 'active',
    updatedAt: '2026-05-01T00:00:00Z',
    createdBy: 'u-1',
  },
  {
    id: 'tpl-2',
    artifactId: 'art-tpl-2',
    title: 'Template Two',
    type: 'presentation',
    category: 'R2',
    scope: 'organization',
    status: 'active',
    updatedAt: '2026-05-02T00:00:00Z',
    createdBy: 'u-2',
  },
] as any;

describe('TemplatesTabContent deep-link selection', () => {
  it('selects matching template id from initialArtifactId deep link', () => {
    render(
      <TemplatesTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        templates={templates}
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={{ startArtifactReview: vi.fn().mockResolvedValue(true) }}
        initialArtifactId="art-tpl-2"
      />
    );

    expect(screen.getByTestId('selected-id').textContent).toBe('tpl-2');
  });
});
