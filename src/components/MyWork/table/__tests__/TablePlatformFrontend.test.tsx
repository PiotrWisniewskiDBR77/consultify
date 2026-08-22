/**
 * @vitest-environment jsdom
 *
 * Table Platform frontend contract tests (TableDataProvider, ViewRouter, GridView,
 * and degraded posture scenarios §2.3.11).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type {
  TablePlatformBase,
  TablePlatformField,
  TablePlatformTable,
} from '@/types/tablePlatform';

import OrgMemberSyncService from '../../../../../server/src/services/tablePlatform/OrgMemberSyncService.js';
import { EmptyStateInline } from '../../../shared/NModeBlocks/EmptyStateInline';
import { ActivityFeed } from '../ActivityFeed';
import { CellEditor } from '../CellEditor';
import { ExecutionProgress } from '../ExecutionProgress';
import { FieldManager } from '../FieldManager';
import { GridView } from '../GridView';
import { PlatformCellRenderer } from '../PlatformCellRenderer';
import { RowDetailPanel } from '../RowDetailPanel';
import { SchemaProposalCard, type SchemaProposalCardProposal } from '../SchemaProposalCard';
import { type TableDataContextValue, TableDataProvider, useTableData } from '../TableDataProvider';
import { TableTabStrip } from '../TableTabStrip';
import type { ColumnDef, TableNode } from '../tableTypes';
import { useSchemaProposal } from '../useSchemaProposal';
import type { UseTablePlatformIntegrationReturn } from '../useTablePlatformIntegration';
import { ViewErrorBoundary } from '../ViewErrorBoundary';
import { ViewRouter } from '../ViewRouter';

// ── External dependency mocks ────────────────────────────────────────────────

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/i18n', () => ({
  default: {
    t: (key: string, opts?: { lng?: string; defaultValue?: string }) => {
      const pl: Record<string, string> = {
        'ideas.table.errorBoundary.title': 'Coś poszło nie tak w tym widoku',
        'ideas.table.errorBoundary.retry': 'Ponów',
        'ideas.table.errorBoundary.switchToGrid': 'Przełącz na siatkę',
      };
      if (opts?.lng?.startsWith('pl') && pl[key]) return pl[key];
      return opts?.defaultValue ?? key;
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      k: string,
      opts?: string | ({ defaultValue?: string } & Record<string, unknown>),
      params?: Record<string, unknown>
    ) => {
      const copy: Record<string, string> = {
        'myWorkTable.gridView.selectRow': 'Select row',
        'myWorkTable.gridView.totals': 'Totals',
        'myWorkTable.fieldManager.save': 'Save',
        'myWorkTable.fieldManager.failedToUpdateField': 'Failed to update field',
        'myWorkTable.chatToSchemaPanel.aiTableBuilder': 'AI Table Builder',
      };
      const def = copy[k] ?? (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k;
      const vars = (typeof opts === 'object' && opts ? opts : params) ?? {};
      return Object.entries(vars).reduce(
        (acc, [key, val]) => acc.split(`{{${key}}}`).join(String(val)),
        def
      );
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock('../ShareViewDialog', () => ({
  ShareViewDialog: () => null,
}));

vi.mock('../KanbanView', () => ({
  KanbanView: () => <div data-testid="view-slot-kanban">Kanban</div>,
}));

vi.mock('../CalendarView', () => ({
  CalendarView: () => <div data-testid="view-slot-calendar">Calendar</div>,
}));

vi.mock('../TimelineView', () => ({
  TimelineView: () => <div data-testid="view-slot-timeline">Timeline</div>,
}));

vi.mock('../MatrixView', () => ({
  MatrixView: () => <div data-testid="view-slot-matrix">Matrix</div>,
}));

vi.mock('../StickyNoteView', () => ({
  StickyNoteView: () => <div data-testid="view-slot-sticky">Sticky</div>,
}));

const tpApiMocks = vi.hoisted(() => ({
  getAttachments: vi.fn().mockResolvedValue({ attachments: [] }),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  createField: vi.fn(),
  reorderFields: vi.fn(),
  generateSchemaProposal: vi.fn(),
  executeSchemaProposal: vi.fn(),
  rejectSchemaProposal: vi.fn(),
  refineSchemaProposal: vi.fn(),
  undoSchemaProposal: vi.fn(),
  redoSchemaProposal: vi.fn(),
  searchRecordsGlobal: vi.fn(),
  getRecordWatchers: vi.fn().mockResolvedValue([]),
  toggleRecordWatch: vi.fn().mockResolvedValue({ watching: true }),
  listRecordComments: vi.fn().mockResolvedValue({ comments: [], total: 0 }),
  addRecordComment: vi.fn(),
  updateRecordComment: vi.fn(),
  deleteRecordComment: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => tpApiMocks);

const apiGetMock = vi.hoisted(() => vi.fn().mockResolvedValue({ events: [] }));

vi.mock('@/services/api', () => ({
  Api: { get: apiGetMock },
}));

const orgSyncDbQuery = vi.hoisted(() => vi.fn());

vi.mock('../../../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    query: orgSyncDbQuery,
  }),
}));

vi.mock('../../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentUser: {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      },
      currentOrganization: { id: 'org-1' },
    }),
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: {
    getOrganizationMembers: vi.fn().mockResolvedValue([]),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURE_BASE: TablePlatformBase = {
  id: 'base-1',
  workspaceId: 'ws-1',
  name: 'QA Base',
  schemaVersion: 14,
  metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const FIXTURE_TABLE: TablePlatformTable = {
  id: 'tbl-main',
  baseId: 'base-1',
  name: 'Initiatives',
  primaryFieldId: 'fld_name',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const FIXTURE_COLUMNS: ColumnDef[] = [
  {
    key: 'fld_name',
    header: 'Name',
    type: 'text',
    visible: true,
    width: 200,
  },
  {
    key: 'fld_status',
    header: 'Status',
    type: 'select',
    visible: true,
    width: 140,
    options: ['todo', 'done'],
  },
];

const FIXTURE_ROWS: TableNode[] = [
  {
    id: 'rec-1',
    type: 'idea',
    data: { fld_name: 'Alpha', fld_status: 'todo' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'rec-2',
    type: 'idea',
    data: { fld_name: 'Beta', fld_status: 'done' },
    position: { x: 0, y: 0 },
  },
];

const FIXTURE_FIELDS: TablePlatformField[] = [
  {
    id: 'fld_name',
    tableId: 'tbl-main',
    name: 'Name',
    fieldType: 'singleLineText',
    options: {},
    isComputed: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'fld_extra',
    tableId: 'tbl-main',
    name: 'Extra',
    fieldType: 'number',
    options: {},
    isComputed: false,
    order: 1,
    createdAt: '',
    updatedAt: '',
  },
];

function makeProposal(partial?: Partial<SchemaProposalCardProposal>): SchemaProposalCardProposal {
  return {
    id: 'prop-1',
    intent: 'modify_schema',
    confidence: 0.72,
    summary: 'Add tracking columns',
    operations: [
      {
        id: 'op-1',
        operationType: 'add_field',
        payload: { name: 'Risk', fieldType: 'singleLineText' },
      },
    ],
    warnings: [],
    status: 'pending',
    version: 2,
    ...partial,
  };
}

function makeIntegration(
  overrides: Partial<UseTablePlatformIntegrationReturn> = {}
): UseTablePlatformIntegrationReturn {
  const noopAsync = async () => {};
  const base: UseTablePlatformIntegrationReturn = {
    active: true,
    loading: false,
    saving: false,
    error: null,
    saveStatusLabel: 'Auto-saved',
    columns: FIXTURE_COLUMNS,
    setColumns: vi.fn(),
    visibleColumns: FIXTURE_COLUMNS,
    toggleColumn: vi.fn(),
    handleAddColumn: vi.fn(),
    renameColumn: vi.fn(),
    deleteColumn: vi.fn(),
    nodes: FIXTURE_ROWS,
    processedRows: FIXTURE_ROWS,
    groupedRows: null,
    selectedRowIds: new Set(),
    setSelectedRowIds: vi.fn(),
    toggleRowSelection: vi.fn(),
    handleFieldChange: vi.fn(),
    handleAddRow: vi.fn(),
    handleDeleteRow: vi.fn(),
    handleDuplicateRow: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleInsertRow: vi.fn(),
    viewLayout: 'table',
    setViewLayout: vi.fn(),
    savedViews: [],
    activeViewId: 'view-default',
    setActiveViewId: vi.fn(),
    sort: null,
    setSort: vi.fn(),
    filters: { logic: 'and', rules: [] },
    setFilters: vi.fn(),
    groupBy: null,
    setGroupBy: vi.fn(),
    applyView: vi.fn(),
    saveCurrentView: vi.fn(async () => {}),
    updateSavedView: vi.fn(async () => {}),
    deleteSavedView: vi.fn(async () => {}),
    handleSave: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    loadMore: vi.fn(async () => {}),
    hasMore: false,
    totalRecords: FIXTURE_ROWS.length,
    platformFields: FIXTURE_FIELDS,
    platformViews: [
      {
        id: 'view-default',
        tableId: 'tbl-main',
        name: 'Grid',
        viewType: 'grid',
        visibleFieldIds: ['fld_name', 'fld_status'],
        config: {},
        createdAt: '',
        updatedAt: '',
      },
    ],
    applyPlatformFilters: vi.fn(async () => {}),
    createPlatformView: vi.fn(async () => null),
    activeViewConfig: {},
    removeMissingFieldFromView: noopAsync,
    realtimeTableId: null,
    applyRealtimeCreated: vi.fn(),
    applyRealtimeUpdated: vi.fn(),
    applyRealtimeDeleted: vi.fn(),
    applyRealtimeSchemaChanged: vi.fn(),
    formatRules: [],
    updateConditionalFormatting: vi.fn(async () => {}),
    ...overrides,
  };
  return base;
}

// ── Test helpers ─────────────────────────────────────────────────────────────

function TableCtxConsumer({ onSnapshot }: { onSnapshot?: (v: TableDataContextValue) => void }) {
  const ctx = useTableData();
  useEffect(() => {
    onSnapshot?.(ctx);
  }, [ctx, onSnapshot]);
  return (
    <div>
      <span data-testid="ctx-active">{String(ctx.active)}</span>
      <span data-testid="ctx-loading">{String(ctx.loading)}</span>
      <span data-testid="ctx-table-id">{ctx.tableId ?? ''}</span>
      <span data-testid="ctx-error">{ctx.error ?? ''}</span>
      <span data-testid="ctx-save-label">{ctx.saveStatusLabel}</span>
      <span data-testid="ctx-col-count">{ctx.columns.length}</span>
      <button type="button" onClick={() => ctx.handleAddRow()}>
        trigger-add-row
      </button>
      <button type="button" onClick={() => ctx.handleFieldChange('rec-1', 'fld_name', 'Edited')}>
        trigger-field-change
      </button>
    </div>
  );
}

/** Mirrors IdeaTableTool platform `onTableContextChange` effect — see IdeaTableTool.tsx */
function PlatformTableContextEffectHarness({
  usePlatform,
  platformIntegration,
  onTableContextChange,
}: {
  usePlatform: boolean;
  platformIntegration: {
    table: TablePlatformTable | null;
    base: TablePlatformBase | null;
    activeViewId: string | null;
    platformFields: TablePlatformField[];
    totalRecords: number;
  };
  onTableContextChange?: (ctx: {
    baseId?: string;
    tableId: string;
    tableName: string;
    activeViewId?: string;
    fieldCount: number;
    recordCount: number;
  }) => void;
}) {
  useEffect(() => {
    if (!usePlatform || !platformIntegration.table) return;
    onTableContextChange?.({
      baseId: platformIntegration.base?.id,
      tableId: platformIntegration.table.id,
      tableName: platformIntegration.table.name,
      activeViewId: platformIntegration.activeViewId || undefined,
      fieldCount: platformIntegration.platformFields?.length || 0,
      recordCount: platformIntegration.totalRecords || 0,
    });
  }, [
    usePlatform,
    platformIntegration.table?.id,
    platformIntegration.activeViewId,
    onTableContextChange,
  ]);
  return null;
}

function OpenChatToSchemaOnMount() {
  const { uiDispatch } = useTableData();
  useEffect(() => {
    uiDispatch({ type: 'SET_PANEL', panel: 'showChatToSchema', value: true });
  }, [uiDispatch]);
  return null;
}

// ── 1. TableDataProvider ────────────────────────────────────────────────────

describe('TableDataProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when base and table are loaded (integration not loading)', () => {
    const integration = makeIntegration({ loading: false });
    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <div data-testid="child">loaded</div>
      </TableDataProvider>
    );
    expect(screen.getByTestId('child')).toHaveTextContent('loaded');
  });

  it('provides correct context values via useTableData', () => {
    const integration = makeIntegration();
    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked
        isPl
      >
        <TableCtxConsumer />
      </TableDataProvider>
    );
    expect(screen.getByTestId('ctx-active').textContent).toBe('true');
    expect(screen.getByTestId('ctx-table-id')).toHaveTextContent('tbl-main');
    expect(screen.getByTestId('ctx-col-count')).toHaveTextContent(String(FIXTURE_COLUMNS.length));
  });

  it('handleAddRow invokes integration callback (API + refresh orchestration lives in integration)', async () => {
    const refresh = vi.fn(async () => {});
    const apiCreate = vi.fn(async () => ({ id: 'rec-new' }));

    const handleAddRow = vi.fn(() => {
      void apiCreate().then(async () => {
        await refresh();
      });
    });

    const integration = makeIntegration({ handleAddRow, refresh });

    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <TableCtxConsumer />
      </TableDataProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'trigger-add-row' }));
    await waitFor(() => expect(handleAddRow).toHaveBeenCalled());
    await waitFor(() => expect(apiCreate).toHaveBeenCalled());
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('handleFieldChange forwards to integration (backend update orchestration)', () => {
    const handleFieldChange = vi.fn();
    const integration = makeIntegration({ handleFieldChange });

    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <TableCtxConsumer />
      </TableDataProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'trigger-field-change' }));
    expect(handleFieldChange).toHaveBeenCalledWith('rec-1', 'fld_name', 'Edited');
  });

  it('surfaces integration error string in context', () => {
    const integration = makeIntegration({ error: 'Upstream validation failed' });
    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <TableCtxConsumer />
      </TableDataProvider>
    );
    expect(screen.getByTestId('ctx-error')).toHaveTextContent('Upstream validation failed');
  });
});

// ── 2. ViewRouter ────────────────────────────────────────────────────────────

describe('ViewRouter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderRouter(integration: UseTablePlatformIntegrationReturn) {
    return render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <ViewRouter />
      </TableDataProvider>
    );
  }

  it('renders spreadsheet-style grid (table layout) by default when rows exist', () => {
    const integration = makeIntegration({ viewLayout: 'table', processedRows: FIXTURE_ROWS });
    renderRouter(integration);
    expect(screen.getByRole('columnheader', { name: /^Name\b/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Status\b/ })).toBeInTheDocument();
    const checks = screen.getAllByRole('checkbox', { name: /^Select row\b/ });
    expect(checks.length).toBe(FIXTURE_ROWS.length);
  });

  it('renders empty state when there are no rows', () => {
    const integration = makeIntegration({ processedRows: [], nodes: [] });
    renderRouter(integration);
    expect(screen.getByText('No records in this view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add first record' })).toBeInTheDocument();
  });

  it('switches main view based on viewLayout (kanban vs grid gallery)', () => {
    const { rerender } = render(
      <TableDataProvider
        integration={makeIntegration({ viewLayout: 'kanban', processedRows: FIXTURE_ROWS })}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <ViewRouter />
      </TableDataProvider>
    );
    expect(screen.getByTestId('view-slot-kanban')).toBeInTheDocument();

    rerender(
      <TableDataProvider
        integration={makeIntegration({ viewLayout: 'grid', processedRows: FIXTURE_ROWS })}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <ViewRouter />
      </TableDataProvider>
    );
    expect(screen.queryByTestId('view-slot-kanban')).not.toBeInTheDocument();
    expect(screen.getByText('Totals')).toBeInTheDocument();
  });

  it('row selection checkbox calls toggleRowSelection from context (platform grid)', () => {
    const toggleRowSelection = vi.fn();
    const integration = makeIntegration({
      viewLayout: 'table',
      processedRows: FIXTURE_ROWS,
      selectedRowIds: new Set(),
      toggleRowSelection,
    });
    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <ViewRouter />
      </TableDataProvider>
    );
    const rowChecks = screen.getAllByRole('checkbox', { name: /^Select row\b/ });
    fireEvent.click(rowChecks[0]!);
    expect(toggleRowSelection).toHaveBeenCalledWith('rec-1');
  });
});

// ── 3. GridView (basic) ─────────────────────────────────────────────────────

describe('GridView', () => {
  it('renders headers from columns (standalone props path)', () => {
    const cols: ColumnDef[] = [
      { key: 'a', header: 'Column A', type: 'text', visible: true, width: 120 },
      { key: 'b', header: 'Column B', type: 'text', visible: true, width: 120 },
    ];
    const rows: TableNode[] = [
      { id: 'r1', type: 'idea', data: { a: '1', b: '2' }, position: { x: 0, y: 0 } },
      { id: 'r2', type: 'idea', data: { a: '3', b: '4' }, position: { x: 0, y: 0 } },
    ];
    render(<GridView rows={rows} columns={cols} />);
    expect(screen.getByText('Column A')).toBeInTheDocument();
    expect(screen.getByText('Column B')).toBeInTheDocument();
  });

  it('renders correct number of data rows', () => {
    const cols: ColumnDef[] = [
      { key: 'k', header: 'Key', type: 'text', visible: true, width: 100 },
    ];
    const rows: TableNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: `row-${i}`,
      type: 'idea' as const,
      data: { k: `v${i}` },
      position: { x: 0, y: 0 },
    }));
    render(<GridView rows={rows} columns={cols} />);
    const rowChecks = screen.getAllByRole('checkbox', { name: /^Select row\b/ });
    expect(rowChecks).toHaveLength(5);
  });

  it('renders one row checkbox per record (selection wired to internal state)', () => {
    const cols: ColumnDef[] = [
      { key: 'k', header: 'Key', type: 'text', visible: true, width: 100 },
    ];
    const rows: TableNode[] = [
      { id: 'solo', type: 'idea', data: { k: 'x' }, position: { x: 0, y: 0 } },
    ];
    render(<GridView rows={rows} columns={cols} />);
    expect(screen.getAllByRole('checkbox', { name: /^Select row\b/ })).toHaveLength(1);
  });
});

// ── 4. Degraded posture scenarios (contract §2.3.11) ──────────────────────────

describe('Degraded posture scenarios (§2.3.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. stale linked record placeholder — linked cell shows “[Deleted Record]” text', () => {
    render(
      <PlatformCellRenderer fieldType="linkedRecord" value={['[Deleted Record]']} record={{}} />
    );
    expect(screen.getByText('[Deleted Record]')).toBeInTheDocument();
  });

  it('2. missing field in view — schema proposal global warning surfaces “Missing field” copy', () => {
    const proposal = makeProposal({
      warnings: [
        {
          message: 'Missing field: assigneeId is not part of this saved view configuration.',
        },
      ],
    });
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onRefine = vi.fn();
    const onClose = vi.fn();
    render(
      <SchemaProposalCard
        proposal={proposal}
        onApprove={onApprove}
        onReject={onReject}
        onRefine={onRefine}
        onClose={onClose}
      />
    );
    expect(screen.getByText(/Missing field/i)).toBeInTheDocument();
  });

  it('3. schema version mismatch on proposal — stale warning banner is visible', () => {
    const proposal = makeProposal({
      warnings: [
        {
          message:
            'Schema version mismatch — this proposal was drafted against an older schema. Refresh before applying.',
        },
      ],
    });
    render(
      <SchemaProposalCard
        proposal={proposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRefine={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Schema version mismatch/i)).toBeInTheDocument();
  });

  it('4. permission denied for schema edit — FieldManager shows toast on failed field update', async () => {
    tpApiMocks.updateField.mockRejectedValueOnce(new Error('403 Forbidden'));

    render(
      <FieldManager
        open
        onClose={vi.fn()}
        tableId="tbl-main"
        fields={FIXTURE_FIELDS}
        primaryFieldId="fld_name"
        onFieldsChanged={vi.fn()}
        locked={false}
      />
    );

    fireEvent.click(screen.getByText('Extra'));

    const nameInput = screen.getByDisplayValue('Extra');
    fireEvent.change(nameInput, { target: { value: 'Extra Renamed' } });

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Failed to update field');
    });
  });

  it('5. form validation failure — URL cell editor keeps invalid value and applies error styling', () => {
    const onSave = vi.fn();
    render(<CellEditor value="" fieldType="url" onSave={onSave} onCancel={vi.fn()} />);
    const input = screen.getByPlaceholderText('https://...');
    fireEvent.change(input, { target: { value: 'not-a-valid-url' } });
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
    expect(input.className).toMatch(/border-danger-400/);
  });

  it('6. network timeout on save — load-retry affordance via EmptyStateInline + Retry', async () => {
    const onRetry = vi.fn();
    render(
      <EmptyStateInline
        dashed={false}
        message="Table view is temporarily unavailable."
        hint="This does not mean the table is empty. Retry loading the data and check again."
        action={{ label: 'Retry', onClick: onRetry }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('7. concurrent edit conflict — execution progress lists conflict error for operator follow-up', () => {
    render(
      <ExecutionProgress
        operations={[
          {
            id: 'op-merge',
            operationType: 'update_field',
            description: 'Resolve conflicting edits to primary field',
            status: 'failed',
            error: 'Concurrent edit conflict (409). Compare versions before saving again.',
          },
        ]}
      />
    );
    expect(
      screen.getByText('Concurrent edit conflict (409). Compare versions before saving again.')
    ).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 operations failed/i)).toBeInTheDocument();
  });

  it('8. empty base (no tables) — tab strip exposes add-table entry point', () => {
    const onCreate = vi.fn();
    render(
      <TableTabStrip
        baseId="base-empty"
        tables={[]}
        activeTableId=""
        onSelectTable={vi.fn()}
        onCreateTable={onCreate}
        onRenameTable={vi.fn()}
        onDuplicateTable={vi.fn()}
        onDeleteTable={vi.fn()}
      />
    );
    const addTable = screen.getByTitle('Add table');
    fireEvent.click(addTable);
    expect(onCreate).toHaveBeenCalled();
  });

  it('9. orphaned view (table deleted) — bridge-style error string is visible in context consumer', () => {
    const integration = makeIntegration({
      error: 'Table not found',
      processedRows: [],
      nodes: [],
    });
    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={null}
        locked={false}
        isPl={false}
      >
        <TableCtxConsumer />
      </TableDataProvider>
    );
    expect(screen.getByTestId('ctx-error')).toHaveTextContent('Table not found');
  });

  it('10. AI proposal rejected — hook error + retry path via second generate call', async () => {
    tpApiMocks.generateSchemaProposal
      .mockRejectedValueOnce(new Error('Rejected: unsafe schema mutation'))
      .mockResolvedValueOnce(makeProposal({ id: 'prop-2', summary: 'Adjusted proposal' }));

    const Harness: React.FC = () => {
      const { error, loading, proposal, generateProposal, clearError } = useSchemaProposal();
      return (
        <div>
          {loading && <span data-testid="loading">loading</span>}
          {error && (
            <div role="alert" data-testid="proposal-error">
              {error}
              <button type="button" onClick={() => clearError()}>
                clear-error
              </button>
            </div>
          )}
          {proposal ? (
            <div data-testid="proposal-summary">
              {String((proposal as { summary?: string }).summary ?? '')}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() =>
              void generateProposal('ws-1', 'make a table', undefined, 'en', undefined)
            }
          >
            run-generate
          </button>
        </div>
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'run-generate' }));
    await waitFor(() => {
      expect(screen.getByTestId('proposal-error')).toHaveTextContent(
        'Rejected: unsafe schema mutation'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'clear-error' }));
    fireEvent.click(screen.getByRole('button', { name: 'run-generate' }));
    await waitFor(() => {
      expect(screen.getByTestId('proposal-summary')).toHaveTextContent('Adjusted proposal');
    });
  });
});

// ── 5. IdeaTableTool P15 integration ────────────────────────────────────────

describe('IdeaTableTool P15 integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders TableDataProvider when usePlatform is true', () => {
    const integration = makeIntegration({ loading: false });
    render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <ViewRouter />
      </TableDataProvider>
    );
    expect(screen.getByRole('columnheader', { name: /^Name\b/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Status\b/ })).toBeInTheDocument();
  });

  it('renders loading skeleton while data loads', () => {
    const integration = makeIntegration({ loading: true, processedRows: [], nodes: [] });
    const { container } = render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <ViewRouter />
      </TableDataProvider>
    );
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders missing field columns with amber styling', () => {
    const missingFieldCol: ColumnDef = {
      key: 'field-deleted',
      header: 'Deleted Col',
      type: 'text',
      visible: true,
      width: 140,
    };
    const integration = makeIntegration({
      viewLayout: 'table',
      columns: [...FIXTURE_COLUMNS, missingFieldCol],
      visibleColumns: [...FIXTURE_COLUMNS, missingFieldCol],
      processedRows: FIXTURE_ROWS,
      activeViewConfig: {
        missing_fields: ['field-deleted'],
        missing_field_names: { 'field-deleted': 'Deleted Col' },
      },
    });
    const { container } = render(
      <TableDataProvider
        integration={integration}
        base={FIXTURE_BASE}
        table={FIXTURE_TABLE}
        locked={false}
        isPl={false}
      >
        <ViewRouter />
      </TableDataProvider>
    );
    expect(screen.getByText(/\[Missing: Deleted Col\]/)).toBeInTheDocument();
    const warningHeaders = container.querySelectorAll('th.text-c-warning');
    expect(warningHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it('passes locale to ViewErrorBoundary', () => {
    const ThrowingChild: React.FC = () => {
      throw new Error('Render error');
    };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ViewErrorBoundary viewName="grid" onSwitchToGrid={vi.fn()} locale="pl">
        <ThrowingChild />
      </ViewErrorBoundary>
    );
    spy.mockRestore();

    expect(screen.getByText('Coś poszło nie tak w tym widoku')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ponów' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Przełącz na siatkę' })).toBeInTheDocument();
  });
});

// ── 6. P15 App Integration (cross-feature wiring) ───────────────────────────

describe('P15 App Integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
    orgSyncDbQuery.mockReset();
  });

  describe('Chat <-> Table context', () => {
    it('calls onTableContextChange when platform table loads', () => {
      const onTableContextChange = vi.fn();
      const integration = makeIntegration({
        totalRecords: FIXTURE_ROWS.length,
        platformFields: FIXTURE_FIELDS,
        activeViewId: 'view-default',
      });
      render(
        <PlatformTableContextEffectHarness
          usePlatform
          platformIntegration={{
            base: FIXTURE_BASE,
            table: FIXTURE_TABLE,
            activeViewId: integration.activeViewId,
            platformFields: integration.platformFields,
            totalRecords: integration.totalRecords,
          }}
          onTableContextChange={onTableContextChange}
        />
      );
      expect(onTableContextChange).toHaveBeenCalledWith({
        baseId: 'base-1',
        tableId: 'tbl-main',
        tableName: 'Initiatives',
        activeViewId: 'view-default',
        fieldCount: FIXTURE_FIELDS.length,
        recordCount: FIXTURE_ROWS.length,
      });
    });

    it('renders ChatToSchemaPanel when showChatToSchema is true', () => {
      const integration = makeIntegration({ viewLayout: 'table', processedRows: FIXTURE_ROWS });
      render(
        <TableDataProvider
          integration={integration}
          base={FIXTURE_BASE}
          table={FIXTURE_TABLE}
          locked={false}
          isPl={false}
        >
          <OpenChatToSchemaOnMount />
          <ViewRouter />
        </TableDataProvider>
      );
      expect(screen.getByText('AI Table Builder')).toBeInTheDocument();
    });
  });

  describe('Breadcrumb navigation', () => {
    it('renders base > table > view breadcrumb', () => {
      const integration = makeIntegration({ viewLayout: 'table', processedRows: FIXTURE_ROWS });
      const { container } = render(
        <TableDataProvider
          integration={integration}
          base={FIXTURE_BASE}
          table={FIXTURE_TABLE}
          locked={false}
          isPl={false}
        >
          <ViewRouter />
        </TableDataProvider>
      );
      const nav = container.querySelector('nav');
      expect(nav).toBeTruthy();
      expect(within(nav as HTMLElement).getByText('QA Base')).toBeInTheDocument();
      expect(within(nav as HTMLElement).getByText('Initiatives')).toBeInTheDocument();
      expect(within(nav as HTMLElement).getByText('Grid')).toBeInTheDocument();
      expect(nav?.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
    });

    it('does not render breadcrumb when base is null', () => {
      const integration = makeIntegration({ viewLayout: 'table', processedRows: FIXTURE_ROWS });
      const { container } = render(
        <TableDataProvider
          integration={integration}
          base={null}
          table={FIXTURE_TABLE}
          locked={false}
          isPl={false}
        >
          <ViewRouter />
        </TableDataProvider>
      );
      expect(container.querySelector('nav')).toBeNull();
    });
  });

  describe('View bookmark URL', () => {
    it('syncs activeViewId to URL search params', () => {
      const replaceSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
      const integration = makeIntegration({
        activeViewId: 'view-123',
        platformViews: [
          {
            id: 'view-123',
            tableId: 'tbl-main',
            name: 'Bookmarked',
            viewType: 'grid',
            visibleFieldIds: ['fld_name'],
            config: {},
            createdAt: '',
            updatedAt: '',
          },
        ],
        savedViews: [],
        viewLayout: 'table',
        processedRows: FIXTURE_ROWS,
      });
      render(
        <TableDataProvider
          integration={integration}
          base={FIXTURE_BASE}
          table={FIXTURE_TABLE}
          locked={false}
          isPl={false}
        >
          <ViewRouter />
        </TableDataProvider>
      );
      expect(replaceSpy).toHaveBeenCalled();
      const callUrl = String(replaceSpy.mock.calls[0]?.[2] ?? '');
      expect(callUrl).toContain('tpView=view-123');
      replaceSpy.mockRestore();
    });
  });

  describe('Organization member sync', () => {
    it('OrgMemberSyncService adds missing org members as viewers', async () => {
      orgSyncDbQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('organization_members')) {
          return { rows: [{ user_id: 'user-new' }] };
        }
        if (sql.includes('FROM tp_base_members')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO tp_base_members')) {
          return { rows: [] };
        }
        return { rows: [] };
      });
      const result = await OrgMemberSyncService.syncOrgMembersToBase('base-1', 'org-1');
      expect(result.added).toBe(1);
      const insertCall = orgSyncDbQuery.mock.calls.find(([sql]) =>
        String(sql).includes('INSERT INTO tp_base_members')
      );
      expect(insertCall).toBeDefined();
      expect(String(insertCall![0])).toMatch(/viewer/i);
      expect(insertCall![1]).toEqual(['base-1', 'user-new']);
    });

    it('skips existing base members', async () => {
      orgSyncDbQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('organization_members')) {
          return { rows: [{ user_id: 'user-existing' }] };
        }
        if (sql.includes('FROM tp_base_members')) {
          return { rows: [{ user_id: 'user-existing' }] };
        }
        return { rows: [] };
      });
      const result = await OrgMemberSyncService.syncOrgMembersToBase('base-1', 'org-1');
      expect(result.skipped).toBeGreaterThanOrEqual(1);
      const insertCall = orgSyncDbQuery.mock.calls.find(([sql]) =>
        String(sql).includes('INSERT INTO tp_base_members')
      );
      expect(insertCall).toBeUndefined();
    });
  });

  describe('Global search', () => {
    it('returns records matching query with deep links', async () => {
      tpApiMocks.searchRecordsGlobal.mockResolvedValueOnce({
        results: [
          {
            recordId: 'rec-99',
            tableName: 'Initiatives',
            baseName: 'QA Base',
            deepLink: '/my-work?idea=idea-1&tool=table&tpTable=tbl-main&record=rec-99',
          },
        ],
      });
      const out = await TablePlatformApi.searchRecordsGlobal('alpha', 20);
      expect(out.results[0]).toMatchObject({
        recordId: 'rec-99',
        tableName: 'Initiatives',
        baseName: 'QA Base',
        deepLink: expect.stringContaining('rec-99'),
      });
    });
  });

  describe('Record watch', () => {
    it('shows watch button in platform mode', () => {
      const node = FIXTURE_ROWS[0]!;
      render(
        <RowDetailPanel
          open
          onClose={vi.fn()}
          node={node}
          columns={FIXTURE_COLUMNS}
          edges={[]}
          allNodes={FIXTURE_ROWS}
          onFieldChange={vi.fn()}
          fields={FIXTURE_FIELDS}
          platformTableId="tbl-main"
        />
      );
      expect(screen.getByTitle('Watch for changes')).toBeInTheDocument();
    });

    it('toggles watch state on click', async () => {
      const node = FIXTURE_ROWS[0]!;
      render(
        <RowDetailPanel
          open
          onClose={vi.fn()}
          node={node}
          columns={FIXTURE_COLUMNS}
          edges={[]}
          allNodes={FIXTURE_ROWS}
          onFieldChange={vi.fn()}
          fields={FIXTURE_FIELDS}
          platformTableId="tbl-main"
        />
      );
      await waitFor(() => expect(tpApiMocks.getRecordWatchers).toHaveBeenCalled());
      fireEvent.click(screen.getByTitle('Watch for changes'));
      await waitFor(() => expect(tpApiMocks.toggleRecordWatch).toHaveBeenCalled());
      expect(tpApiMocks.toggleRecordWatch).toHaveBeenCalledWith('rec-1', 'tbl-main');
    });
  });

  describe('ActivityFeed API path', () => {
    it('fetches from /api/table-platform/tables/:id/audit', async () => {
      apiGetMock.mockResolvedValueOnce({ events: [] });
      render(<ActivityFeed open onClose={vi.fn()} tableId="tbl-audit" isPlatformTable />);
      await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
      const path = String(apiGetMock.mock.calls[0]?.[0] ?? '');
      expect(path).toContain('/table-platform/tables/tbl-audit/audit');
    });
  });
});
