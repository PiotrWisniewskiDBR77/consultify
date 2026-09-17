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

// TESTY-ZASTANE (06.09.2026): TemplatesTabContent przeszedł na Triada
// standard (StandardTable + StandardPreview z '../standard'), już NIE
// importuje TableWithPreviewLayout — mock tego modułu był martwy (komponent
// go nie wywołuje), więc 'selected-id' nigdy się nie renderował i realny
// StandardTable renderował się bez mocka. Retarget na StandardTable, ten sam
// kontrakt selectedRowId co poprzednio selectedId.
vi.mock('../../../src/components/standard', () => ({
  StandardTable: ({ columns, data, selectedRowId, onRowClick }: any) => (
    <div data-testid="table-layout">
      <div data-testid="selected-id">{selectedRowId || 'none'}</div>
      <div data-testid="column-ids">{columns.map((column: any) => column.id).join(',')}</div>
      {data.map((row: any) => (
        <button key={row.id} onClick={() => onRowClick(row)} data-testid={`row-${row.id}`}>
          {row.title}
        </button>
      ))}
    </div>
  ),
  StandardPreview: ({ title, onOpenFull, openLabel, openDisabledReason, actions }: any) => {
    const useAction = actions?.informational?.find((action: any) => action.id === 'use');
    return (
      <div data-testid="standard-preview">
        {title}
        <button
          data-testid="preview-header-use"
          disabled={!onOpenFull}
          title={openDisabledReason}
          onClick={onOpenFull}
        >
          {openLabel}
        </button>
        <button data-testid="preview-footer-use" disabled={useAction?.disabled}>
          {useAction?.label}
        </button>
        {useAction?.note ? <p data-testid="preview-use-note">{useAction.note}</p> : null}
      </div>
    );
  },
  standardPreviewShortcuts: () => ({}),
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

  it('keeps the 912px preview lane readable and explains disabled SHEET Use in the header', () => {
    const sheet = {
      ...templates[0],
      id: 'sheet-base',
      artifactIndexId: 'artifact-sheet-base',
      canonicalTemplateId: '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1',
      title: 'Supplier scorecard workbook',
      type: 'sheet',
      scope: 'system',
      status: 'approved',
      originRuntime: 'sheet_template',
      orphaned: false,
    } as any;

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    render(
      <TemplatesTabContent
        viewMode="table"
        searchQuery=""
        activeFilters={[]}
        templates={[sheet]}
        loading={false}
        initialArtifactId="artifact-sheet-base"
      />
    );

    expect(screen.getByTestId('column-ids')).toHaveTextContent('title,type,scope,status');
    expect(screen.getByTestId('column-ids')).not.toHaveTextContent('category');
    expect(screen.getByTestId('column-ids')).not.toHaveTextContent('updatedAt');
    expect(screen.getByTestId('preview-header-use')).toBeDisabled();
    expect(screen.getByTestId('preview-header-use')).toHaveAttribute(
      'title',
      'Use Duplicate to create an editable scorecard workbook.'
    );
    expect(screen.getByTestId('preview-footer-use')).toBeDisabled();
  });
});
