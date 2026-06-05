/**
 * Composed UI Components - Apple HIG Design System
 *
 * Higher-level components built on top of primitives for common use cases.
 *
 * @example
 * import { MetricCard, SearchInput, EmptyState, DataTable } from '@/components/ui/composed';
 */

export {
  type CommandItem,
  CommandPaletteProvider,
  type CommandPaletteProviderProps,
  useCommandPalette,
} from './CommandPalette';
export {
  EmptyState,
  type EmptyStateAction,
  type EmptyStatePreset,
  type EmptyStateProps,
} from './EmptyState';
export { MetricCard, type MetricCardProps, type TrendDirection } from './MetricCard';
export { SearchInput, type SearchInputProps } from './SearchInput';
