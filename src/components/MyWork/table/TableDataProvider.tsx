/**
 * TableDataProvider — unified React Context for Table Platform state.
 *
 * Eliminates the platform/legacy dualism by providing a single data source
 * for all table child components. Wraps useTablePlatformIntegration and
 * exposes a stable interface consumed by TableToolbar, views, panels, etc.
 */

import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';

import type {
  FilterGroup as TPFilterGroup,
  TablePlatformBase,
  TablePlatformField,
  TablePlatformTable,
  TablePlatformView,
  ViewConfig,
} from '@/types/tablePlatform';

import type { FormatRule } from './ConditionalFormatting';
import type { ColumnDef, FilterGroup, SavedView, SortConfig, TableNode } from './tableTypes';
import type { UseTablePlatformIntegrationReturn } from './useTablePlatformIntegration';
import type { ViewLayout } from './useTableViews';

// ---------------------------------------------------------------------------
// UI-only state managed by reducer (panels, modals, overlays)
// ---------------------------------------------------------------------------

interface UIState {
  detailRecordId: string | null;
  expandedRecordId: string | null;
  showFieldManager: boolean;
  showFormBuilder: boolean;
  showInterfaceDesigner: boolean;
  showAuditTrail: boolean;
  showActivityFeed: boolean;
  showAddColumn: boolean;
  showFilters: boolean;
  showChatToSchema: boolean;
  showSnapshots: boolean;
  showConnectors: boolean;
  showDistribution: boolean;
  showTemplateGallery: boolean;
  showExportPresentation: boolean;
  contextMenuColumn: string | null;
  editingCellId: string | null;
  editingFieldId: string | null;
  platformTab: 'data' | 'forms' | 'interfaces' | 'models' | 'workflow';
}

type UIAction =
  | { type: 'SET_DETAIL_RECORD'; id: string | null }
  | { type: 'SET_EXPANDED_RECORD'; id: string | null }
  | {
      type: 'TOGGLE_PANEL';
      panel: keyof Omit<
        UIState,
        | 'detailRecordId'
        | 'expandedRecordId'
        | 'contextMenuColumn'
        | 'editingCellId'
        | 'editingFieldId'
        | 'platformTab'
      >;
    }
  | {
      type: 'SET_PANEL';
      panel: keyof Omit<
        UIState,
        | 'detailRecordId'
        | 'expandedRecordId'
        | 'contextMenuColumn'
        | 'editingCellId'
        | 'editingFieldId'
        | 'platformTab'
      >;
      value: boolean;
    }
  | { type: 'SET_CONTEXT_MENU_COLUMN'; key: string | null }
  | { type: 'SET_EDITING_CELL'; id: string | null }
  | { type: 'SET_EDITING_FIELD'; id: string | null }
  | { type: 'SET_PLATFORM_TAB'; tab: UIState['platformTab'] }
  | { type: 'CLOSE_ALL_PANELS' };

const initialUIState: UIState = {
  detailRecordId: null,
  expandedRecordId: null,
  showFieldManager: false,
  showFormBuilder: false,
  showInterfaceDesigner: false,
  showAuditTrail: false,
  showActivityFeed: false,
  showAddColumn: false,
  showFilters: false,
  showChatToSchema: false,
  showSnapshots: false,
  showConnectors: false,
  showDistribution: false,
  showTemplateGallery: false,
  showExportPresentation: false,
  contextMenuColumn: null,
  editingCellId: null,
  editingFieldId: null,
  platformTab: 'data',
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_DETAIL_RECORD':
      return { ...state, detailRecordId: action.id };
    case 'SET_EXPANDED_RECORD':
      return { ...state, expandedRecordId: action.id };
    case 'TOGGLE_PANEL':
      return { ...state, [action.panel]: !state[action.panel] };
    case 'SET_PANEL':
      return { ...state, [action.panel]: action.value };
    case 'SET_CONTEXT_MENU_COLUMN':
      return { ...state, contextMenuColumn: action.key };
    case 'SET_EDITING_CELL':
      return { ...state, editingCellId: action.id };
    case 'SET_EDITING_FIELD':
      return { ...state, editingFieldId: action.id };
    case 'SET_PLATFORM_TAB':
      return { ...state, platformTab: action.tab };
    case 'CLOSE_ALL_PANELS':
      return {
        ...state,
        showFieldManager: false,
        showFormBuilder: false,
        showInterfaceDesigner: false,
        showAuditTrail: false,
        showActivityFeed: false,
        showAddColumn: false,
        showFilters: false,
        showChatToSchema: false,
        showSnapshots: false,
        showConnectors: false,
        showDistribution: false,
        showTemplateGallery: false,
        showExportPresentation: false,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface TableDataContextValue {
  // Platform state
  active: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveStatusLabel: string;

  // Base / Table identity
  base: TablePlatformBase | null;
  table: TablePlatformTable | null;
  tableId: string | null;

  // Schema
  columns: ColumnDef[];
  visibleColumns: ColumnDef[];
  platformFields: TablePlatformField[];
  toggleColumn: (key: string) => void;
  handleAddColumn: (col: ColumnDef) => void;
  renameColumn: (key: string, newName: string) => void;
  deleteColumn: (key: string) => void;

  // Records
  nodes: TableNode[];
  processedRows: TableNode[];
  groupedRows: Record<string, TableNode[]> | null;
  selectedRowIds: Set<string>;
  setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleRowSelection: (id: string) => void;
  handleFieldChange: (nodeId: string, field: string, value: unknown) => void;
  handleAddRow: () => void;
  handleBulkDelete: () => void;

  // Views
  viewLayout: ViewLayout;
  setViewLayout: (layout: ViewLayout) => void;
  savedViews: SavedView[];
  activeViewId: string;
  setActiveViewId: (id: string) => void;
  sort: SortConfig | null;
  setSort: (sort: SortConfig | null) => void;
  filters: FilterGroup;
  setFilters: (filters: FilterGroup) => void;
  groupBy: string | null;
  setGroupBy: (field: string | null) => void;
  applyView: (view: SavedView) => void;
  saveCurrentView: (name: string, columns: ColumnDef[]) => Promise<void>;
  updateSavedView: (viewId: string, patch: Partial<SavedView>) => Promise<void>;
  deleteSavedView: (viewId: string) => Promise<void>;
  platformViews: TablePlatformView[];

  // Persistence
  handleSave: () => Promise<void>;
  refresh: () => Promise<void>;

  // Pagination
  loadMore: () => Promise<void>;
  hasMore: boolean;
  totalRecords: number;

  // Platform-specific
  applyPlatformFilters: (filters: TPFilterGroup) => Promise<void>;
  createPlatformView: (
    name: string,
    viewType?: string,
    config?: Record<string, unknown>
  ) => Promise<TablePlatformView | null>;

  activeViewConfig: ViewConfig;
  removeMissingFieldFromView: (fieldId: string) => Promise<void>;

  // Conditional formatting (R5)
  formatRules: FormatRule[];
  updateConditionalFormatting: (rules: FormatRule[]) => Promise<void>;

  // UI state
  ui: UIState;
  uiDispatch: React.Dispatch<UIAction>;

  // Locked state
  locked: boolean;
}

export const TableDataContext = createContext<TableDataContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TableDataProviderProps {
  children: React.ReactNode;
  integration: UseTablePlatformIntegrationReturn;
  base: TablePlatformBase | null;
  table: TablePlatformTable | null;
  locked: boolean;
}

export function TableDataProvider({
  children,
  integration,
  base,
  table,
  locked,
}: TableDataProviderProps) {
  const [ui, uiDispatch] = useReducer(uiReducer, initialUIState);

  const tableId = table?.id ?? null;

  const value = useMemo<TableDataContextValue>(
    () => ({
      active: integration.active,
      loading: integration.loading,
      saving: integration.saving,
      error: integration.error,
      saveStatusLabel: integration.saveStatusLabel,
      base,
      table,
      tableId,
      columns: integration.columns,
      visibleColumns: integration.visibleColumns,
      platformFields: integration.platformFields,
      toggleColumn: integration.toggleColumn,
      handleAddColumn: integration.handleAddColumn,
      renameColumn: integration.renameColumn,
      deleteColumn: integration.deleteColumn,
      nodes: integration.nodes,
      processedRows: integration.processedRows,
      groupedRows: integration.groupedRows,
      selectedRowIds: integration.selectedRowIds,
      setSelectedRowIds: integration.setSelectedRowIds,
      toggleRowSelection: integration.toggleRowSelection,
      handleFieldChange: integration.handleFieldChange,
      handleAddRow: integration.handleAddRow,
      handleBulkDelete: integration.handleBulkDelete,
      viewLayout: integration.viewLayout,
      setViewLayout: integration.setViewLayout,
      savedViews: integration.savedViews,
      activeViewId: integration.activeViewId,
      setActiveViewId: integration.setActiveViewId,
      sort: integration.sort,
      setSort: integration.setSort,
      filters: integration.filters,
      setFilters: integration.setFilters,
      groupBy: integration.groupBy,
      setGroupBy: integration.setGroupBy,
      applyView: integration.applyView,
      saveCurrentView: integration.saveCurrentView,
      updateSavedView: integration.updateSavedView,
      deleteSavedView: integration.deleteSavedView,
      platformViews: integration.platformViews,
      handleSave: integration.handleSave,
      refresh: integration.refresh,
      loadMore: integration.loadMore,
      hasMore: integration.hasMore,
      totalRecords: integration.totalRecords,
      applyPlatformFilters: integration.applyPlatformFilters,
      createPlatformView: integration.createPlatformView,
      activeViewConfig: integration.activeViewConfig,
      removeMissingFieldFromView: integration.removeMissingFieldFromView,
      formatRules: integration.formatRules,
      updateConditionalFormatting: integration.updateConditionalFormatting,
      ui,
      uiDispatch,
      locked,
    }),
    [integration, base, table, tableId, ui, locked]
  );

  return <TableDataContext.Provider value={value}>{children}</TableDataContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTableData(): TableDataContextValue {
  const ctx = useContext(TableDataContext);
  if (!ctx) {
    throw new Error('useTableData must be used within a TableDataProvider');
  }
  return ctx;
}

// Re-export UI action types for consumers
export type { UIAction, UIState };
