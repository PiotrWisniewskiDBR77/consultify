/**
 * @vitest-environment jsdom
 *
 * OP-1 D-73 v2 — Outputs list badges stay readable when the preview pane is open.
 * CTO measured the live defect with preview open: the TYPE cell compressed below
 * the real badge width. The current aggregate table has TYPE and FORMAT badges;
 * W240 names TYPE/VERSION, and FORMAT is the second version/format badge present
 * on this screen. The DOM contract is the same: no probed badge may have
 * offsetWidth < scrollWidth while StandardPreview is present.
 */
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tableProps = vi.hoisted(() => ({ current: null as any }));
const previewProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      typeof options?.defaultValue === 'string'
        ? options.defaultValue
        : typeof options === 'string'
          ? options
          : key,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/presentations' }),
}));

vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(() => 'toast-1'), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('@/components/shared/states', () => ({ LoadingState: () => null }));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
}));

vi.mock('@/components/ui/primitives', () => ({
  Button: ({ children }: any) => <button>{children}</button>,
  ErrorState: () => null,
}));

vi.mock('@/components/ui/primitives/chips', () => ({
  EntityStatusChip: () => null,
  statusChipTone: () => 'neutral',
}));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('@/utils/sheetArtifactOpen', () => ({
  downloadSheetArtifactXlsx: vi.fn(),
  resolveTablePlatformWorkspaceIdForTable: vi.fn(async () => null),
}));

vi.mock('../../../services/api', () => ({ API_URL: 'http://test', getHeaders: () => ({}) }));

vi.mock('../../shared/ModuleHub', () => ({ GridView: () => null }));

const neededWidthByColumn: Record<string, number> = {
  outputKind: 176,
  fileFormat: 72,
};

function parseWidth(value: unknown): number {
  const parsed = Number(String(value ?? '').replace('px', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

vi.mock('../../standard', () => ({
  StandardTable: (props: any) => {
    tableProps.current = props;
    return (
      <div data-testid="op1-table-lane">
        {props.data.map((row: any) => (
          <button key={row.id} type="button" onClick={() => props.onRowClick(row)}>
            {row.title}
          </button>
        ))}
        <div data-testid="op1-badge-probe-row">
            {['outputKind', 'fileFormat'].map((columnId) => {
              const row = props.data[0];
              const column = props.columns.find((item: any) => item.id === columnId);
              const width = parseWidth(column?.width);
              const required = neededWidthByColumn[columnId];
              return (
                <span
                  key={columnId}
                  data-testid={`op1-badge-${columnId}`}
                  ref={(node) => {
                    if (!node) return;
                    Object.defineProperty(node, 'clientWidth', { configurable: true, value: width });
                    Object.defineProperty(node, 'offsetWidth', { configurable: true, value: width });
                    Object.defineProperty(node, 'scrollWidth', { configurable: true, value: required });
                  }}
                >
                  {column?.render?.(row)}
                </span>
              );
            })}
        </div>
      </div>
    );
  },
  StandardPreview: (props: any) => {
    previewProps.current = props;
    return <aside data-testid="std-preview" />;
  },
  standardPreviewShortcuts: () => ({}),
}));

vi.mock('../../documents/DocumentViewer', () => ({ DocumentViewer: () => null }));
vi.mock('../duplicateArtifactToDraft', () => ({ duplicateArtifactToCanvasDraft: vi.fn() }));
vi.mock('../SaveAsTemplateModal', () => ({ SaveAsTemplateModal: () => null }));
vi.mock('../TrustStatePreviewSection', () => ({ TrustStatePreviewSection: () => null }));
vi.mock('../useTrustState', () => ({ useTrustState: () => null }));

import { OutputsAggregateTabContent } from '../OutputsAggregateTabContent';
import type { UnifiedOutputRow } from '../types';

const tableExportRow: UnifiedOutputRow = {
  kind: 'sheet',
  originRecordId: 'sheet-table-export-1',
  artifactId: 'artifact-sheet-1',
  title: 'Northwind operational table export',
  statusKey: 'ready',
  owner: 'Owner Name',
  updatedAt: '2026-09-15T10:00:00.000Z',
  exportFormats: ['xlsx'],
  fileFormat: 'XLSX',
  sheetOrigin: 'table_export',
};

function renderTab(rows: UnifiedOutputRow[] = [tableExportRow]) {
  return render(
    <OutputsAggregateTabContent
      viewMode="table"
      searchQuery=""
      activeFilters={[]}
      onFilterChange={vi.fn()}
      rows={rows}
      loading={false}
      onRefresh={vi.fn()}
      actions={{} as any}
    />
  );
}

describe('OP-1 D-73 v2 — Outputs badges with preview open', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableProps.current = null;
    previewProps.current = null;
    window.localStorage.clear();
  });

  it('keeps TYPE and FORMAT badges untruncated after the preview panel opens', () => {
    renderTab();
    act(() => tableProps.current.onRowClick({ ...tableExportRow, id: 'sheet:sheet-table-export-1' }));
    expect(screen.getByTestId('std-preview')).toBeTruthy();

    for (const testId of ['op1-badge-outputKind', 'op1-badge-fileFormat']) {
      const badge = screen.getByTestId(testId);
      expect(badge.offsetWidth, testId).toBeGreaterThanOrEqual(badge.scrollWidth);
    }
  });
});
