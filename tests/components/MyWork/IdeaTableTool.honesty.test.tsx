/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const refreshMock = vi.fn();
const useTablePersistenceMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/hooks/useV8FeatureFlag', () => ({
  useV8FeatureFlag: () => ({ isEnabled: false }),
}));

vi.mock('@/services/api', () => ({
  Api: {},
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  deleteTable: vi.fn(),
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      currentUser: {
        id: 'user-1',
        firstName: 'Piotr',
        lastName: 'W',
        email: 'piotr@example.com',
      },
      currentOrganization: {
        id: 'org-1',
      },
    }),
}));

vi.mock('../../../src/components/MyWork/table/connectors/useConnectors', () => ({
  useConnectors: () => ({
    refetch: vi.fn(),
    testConnection: vi.fn(),
    autoMap: vi.fn(),
    create: vi.fn(),
    isCreating: false,
    isLoading: false,
    connectors: [],
  }),
}));

vi.mock('../../../src/components/MyWork/table/useTablePlatformIntegration', () => ({
  useTablePlatformIntegration: () => ({
    active: false,
    loading: false,
    saving: false,
    saveStatusLabel: '',
    error: null,
    columns: [],
    setColumns: vi.fn(),
    visibleColumns: [],
    toggleColumn: vi.fn(),
    handleAddColumn: vi.fn(),
    renameColumn: vi.fn(),
    deleteColumn: vi.fn(),
    nodes: [],
    processedRows: [],
    groupedRows: null,
    selectedRowIds: new Set(),
    setSelectedRowIds: vi.fn(),
    toggleRowSelection: vi.fn(),
    handleFieldChange: vi.fn(),
    handleAddRow: vi.fn(),
    handleBulkDelete: vi.fn(),
    viewLayout: 'grid',
    setViewLayout: vi.fn(),
    savedViews: [],
    activeViewId: '',
    setActiveViewId: vi.fn(),
    sort: null,
    setSort: vi.fn(),
    filters: { logic: 'and', rules: [] },
    setFilters: vi.fn(),
    groupBy: null,
    setGroupBy: vi.fn(),
    applyView: vi.fn(),
    saveCurrentView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    handleSave: vi.fn(),
    refresh: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    totalRecords: 0,
    platformFields: [],
    platformViews: [],
    applyPlatformFilters: vi.fn(),
    createPlatformView: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/table/useTableRealtime', () => ({
  useTableRealtime: () => ({
    presence: [],
    connectionState: 'idle',
  }),
}));

vi.mock('../../../src/components/MyWork/table/useTableSchema', () => ({
  useTableSchema: () => ({
    columns: [],
    setColumns: vi.fn(),
    visibleColumns: [],
    toggleColumn: vi.fn(),
    handleAddColumn: vi.fn(),
    renameColumn: vi.fn(),
    updateColumnConfig: vi.fn(),
    deleteColumn: vi.fn(),
    handleResizeStart: vi.fn(),
    handleColDragStart: vi.fn(),
    handleColDragOver: vi.fn(),
    handleColDragEnd: vi.fn(),
    resizingCol: null,
    dragColKey: null,
    mergePersistedColumns: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/table/useTableViews', () => ({
  useTableViews: () => ({
    viewLayout: 'grid',
    setViewLayout: vi.fn(),
    savedViews: [],
    setSavedViews: vi.fn(),
    activeViewId: '',
    setActiveViewId: vi.fn(),
    sort: null,
    setSort: vi.fn(),
    filters: { logic: 'and', rules: [] },
    setFilters: vi.fn(),
    groupBy: null,
    setGroupBy: vi.fn(),
    filterInput: '',
    setFilterInput: vi.fn(),
    applyView: vi.fn(),
    saveCurrentView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    cycleSort: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/table/useUndoRedo', () => ({
  useUndoRedo: () => ({
    set: vi.fn(),
    push: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}));

vi.mock('../../../src/components/MyWork/table/useTableRows', () => ({
  useTableRows: () => ({
    nodes: [],
    processedRows: [],
    groupedRows: null,
    selectedRowIds: new Set(),
    setSelectedRowIds: vi.fn(),
    toggleRowSelection: vi.fn(),
    handleFieldChange: vi.fn(),
    handleAddRow: vi.fn(),
    handleAddRowWithTemplate: vi.fn(),
    handleTemplateSelect: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleReorderNode: vi.fn(),
    handleAddSubItem: vi.fn(),
    showRowTemplatePicker: false,
    setShowRowTemplatePicker: vi.fn(),
    addRowBtnRect: null,
    setAddRowBtnRect: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/table/useRollupComputation', () => ({
  useRollupComputation: (rows: any[]) => rows,
}));

vi.mock('../../../src/components/MyWork/table/useTablePersistence', () => ({
  useTablePersistence: (...args: any[]) => useTablePersistenceMock(...args),
}));

vi.mock('../../../src/components/MyWork/table/useTableQuickActions', () => ({
  useTableQuickActions: vi.fn(),
}));

vi.mock('../../../src/components/MyWork/table/useTableKeyboard', () => ({
  useTableKeyboard: vi.fn(),
}));

vi.mock('../../../src/components/MyWork/table/CollaborationPresence', () => ({
  CellCursor: () => null,
  CollaborationPresence: () => null,
  WorkspaceLockIndicator: () => null,
  WorkspacePresenceIndicator: () => null,
}));

vi.mock('../../../src/components/MyWork/table/PresenceIndicators', () => ({
  PresenceIndicators: () => null,
  TableRealtimeStatusIndicator: () => null,
}));

vi.mock('../../../src/components/MyWork/table/views/ViewRouter', () => ({
  ViewRouter: () => <div data-testid="view-router" />,
}));

vi.mock('../../../src/components/MyWork/table/GridView', () => ({
  GridView: () => <div data-testid="grid-view" />,
}));

import { IdeaTableTool } from '../../../src/components/MyWork/IdeaTableTool';

describe('IdeaTableTool honesty', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    useTablePersistenceMock.mockReturnValue({
      loading: false,
      saving: false,
      saveStatusLabel: 'Saved just now',
      handleSave: vi.fn(),
      loadError: null,
      refresh: refreshMock,
    });
  });

  it('shows a visible retryable load error instead of an empty table shell', () => {
    useTablePersistenceMock.mockReturnValue({
      loading: false,
      saving: false,
      saveStatusLabel: 'Saved just now',
      handleSave: vi.fn(),
      loadError: 'Failed to load map',
      refresh: refreshMock,
    });

    render(<IdeaTableTool open ideaId="idea-1" />);

    expect(screen.getByText('Table view is temporarily unavailable.')).toBeInTheDocument();
    expect(
      screen.getByText('This does not mean the table is empty. Retry loading the data and check again.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ Retry/i }));
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows an explicit read-only banner when the table is locked', () => {
    render(<IdeaTableTool open ideaId="idea-1" locked />);

    expect(screen.getByText('Read-only mode')).toBeInTheDocument();
    expect(
      screen.getByText('You can review the table, but editing and saving are currently disabled.')
    ).toBeInTheDocument();
  });
});
