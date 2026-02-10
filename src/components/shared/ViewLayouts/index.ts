/**
 * ViewLayouts — Shared view layout components
 *
 * Provides NotionListView and ClickUpListView for consistent multi-view
 * support across all modules (Tasks, Decisions, Notifications, etc.)
 *
 * Usage:
 *   import { NotionListView, ClickUpListView } from '@/components/shared/ViewLayouts';
 *   import type { GenericListItem, ListSection } from '@/components/shared/ViewLayouts';
 */

export { ClickUpListView } from './ClickUpListView';
export { NotionListView } from './NotionListView';
export { Avatar, PriorityDot, StatusBadge } from './StatusBadge';
export type {
  ClickUpViewProps,
  GenericListItem,
  ListColumn,
  ListSection,
  NotionViewProps,
  SharedViewProps,
} from './types';
