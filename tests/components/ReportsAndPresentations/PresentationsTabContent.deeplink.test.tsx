/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PresentationsTabContent } from '../../../src/components/ReportsAndPresentations/PresentationsTabContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback || _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/ReportsAndPresentations/useTrustState', () => ({
  useTrustState: (_artifactId?: string, governance?: any) => governance,
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

const actions = {
  exportDeckPptx: vi.fn(),
  archiveDeck: vi.fn().mockResolvedValue(true),
  startArtifactReview: vi.fn().mockResolvedValue(true),
};

const presentations = [
  {
    id: 'deck-1',
    artifactId: 'art-1',
    title: 'Deck One',
    sourceType: 'tool',
    owner: 'User 1',
    status: 'draft',
    presentationMode: 'briefing',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    slideCount: 10,
    governance: {},
  },
  {
    id: 'deck-2',
    artifactId: 'art-2',
    title: 'Deck Two',
    sourceType: 'assessment',
    owner: 'User 2',
    status: 'ready',
    presentationMode: 'show',
    createdAt: '2026-05-02T00:00:00Z',
    updatedAt: '2026-05-02T00:00:00Z',
    slideCount: 15,
    governance: {},
  },
] as any;

describe('PresentationsTabContent deep-link selection', () => {
  it('selects matching deck id from initialArtifactId deep link', () => {
    render(
      <PresentationsTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        presentations={presentations}
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
        initialArtifactId="art-2"
      />
    );

    expect(screen.getByTestId('selected-id').textContent).toBe('deck-2');
  });

  it('also selects by deck id for legacy deck query compatibility', () => {
    render(
      <PresentationsTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        onFilterChange={() => {}}
        presentations={presentations}
        loading={false}
        error={null}
        onRefresh={() => {}}
        actions={actions as any}
        initialArtifactId="deck-2"
      />
    );

    expect(screen.getByTestId('selected-id').textContent).toBe('deck-2');
  });
});
