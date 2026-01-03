/**
 * Composed UI Components - Apple HIG Design System
 * 
 * Higher-level components built on top of primitives for common use cases.
 * 
 * @example
 * import { MetricCard, SearchInput, EmptyState, DataTable } from '@/components/ui/composed';
 */

export { MetricCard, type MetricCardProps, type TrendDirection } from './MetricCard';
export { SearchInput, type SearchInputProps } from './SearchInput';
export { EmptyState, type EmptyStateProps, type EmptyStateAction, type EmptyStatePreset } from './EmptyState';
export { DataTable, type DataTableProps, type Column, type SortDirection } from './DataTable';
export { 
  CommandPaletteProvider, 
  useCommandPalette, 
  type CommandItem, 
  type CommandPaletteProviderProps 
} from './CommandPalette';


