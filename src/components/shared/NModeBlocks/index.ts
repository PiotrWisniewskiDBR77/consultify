/**
 * NModeBlocks — Reusable UI building blocks for N-mode detail views
 *
 * These are GENERIC blocks used WITHIN section canvases and across artifacts.
 * Not full sections — just building blocks (callouts, tables, checklists, etc.).
 *
 * Usage:
 * ```tsx
 * import { Callout, ToggleBlock, ChecklistBlock, InlineTable, EmbeddedView, EmptyStateInline } from '@/components/shared/NModeBlocks';
 * ```
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

// ── Building blocks ─────────────────────────────────────────────────────────

export type { CalloutProps, CalloutVariant } from './Callout';
export { Callout } from './Callout';
export type { ChecklistBlockProps, ChecklistItem } from './ChecklistBlock';
export { ChecklistBlock } from './ChecklistBlock';
export type { EmbeddedViewMode, EmbeddedViewProps } from './EmbeddedView';
export { EmbeddedView } from './EmbeddedView';
export type { EmptyStateInlineProps } from './EmptyStateInline';
export { EmptyStateInline } from './EmptyStateInline';
export type { InlineTableColumn, InlineTableProps } from './InlineTable';
export { InlineTable } from './InlineTable';
export type { ToggleBlockProps } from './ToggleBlock';
export { ToggleBlock } from './ToggleBlock';
