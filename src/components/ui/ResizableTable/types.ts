/**
 * ResizableTable Types
 * Unified table system for My Work module
 */

export interface ColumnDef {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  maxWidth?: number;
  resizable: boolean;
  filterable: boolean;
  filterType?: 'select' | 'multiselect' | 'daterange';
  filterOptions?: FilterOption[];
  align?: 'left' | 'center' | 'right';
  sticky?: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

export interface TableFilters {
  [columnId: string]: string[] | DateRange | undefined;
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface ColumnWidths {
  [columnId: string]: number;
}

export interface ResizableTableProps {
  columns: ColumnDef[];
  children: React.ReactNode;
  onColumnWidthChange?: (columnId: string, width: number) => void;
  onFilterChange?: (filters: TableFilters) => void;
  filters?: TableFilters;
  selectedIds?: Set<string>;
  onSelectAll?: (selected: boolean) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  showSelectColumn?: boolean;
  className?: string;
}

export interface TableHeaderProps {
  columns: ColumnDef[];
  columnWidths: ColumnWidths;
  onColumnResize: (columnId: string, width: number) => void;
  filters: TableFilters;
  onFilterChange: (columnId: string, value: string[] | DateRange) => void;
  showSelectColumn?: boolean;
  onSelectAll?: (selected: boolean) => void;
  allSelected?: boolean;
  someSelected?: boolean;
}

export interface ColumnResizerProps {
  columnId: string;
  onResize: (columnId: string, delta: number) => void;
  minWidth: number;
  maxWidth?: number;
}

export interface FilterDropdownProps {
  column: ColumnDef;
  value: string[] | DateRange | undefined;
  onChange: (value: string[] | DateRange) => void;
  onClose: () => void;
}
