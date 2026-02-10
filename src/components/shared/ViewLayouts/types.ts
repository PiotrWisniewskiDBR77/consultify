/**
 * ViewLayouts/types.ts — Shared types for Notion-like and ClickUp-like views
 *
 * These types define a generic data contract so that any module (Tasks, Decisions,
 * Notifications, Initiatives, Interview) can feed its items into the shared
 * NotionListView and ClickUpListView components without coupling.
 *
 * To add a new module:
 *   1. Map your module's items to GenericListItem[]
 *   2. Define your ListSection[] (grouping logic)
 *   3. Pass them to <NotionListView> or <ClickUpListView>
 */

import type { ReactNode } from 'react';

/* ─────────────── Generic Item ─────────────── */

export interface GenericListItem {
  /** Unique identifier */
  id: string;
  /** Primary display text */
  title: string;
  /** Optional subtitle / description (truncated in dense views) */
  subtitle?: string;
  /** Status label (e.g. "In Progress", "PENDING") */
  status?: string;
  /** Status color variant for consistent badge rendering */
  statusVariant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
  /** Priority label */
  priority?: string;
  /** Priority color variant */
  priorityVariant?: 'critical' | 'high' | 'medium' | 'low';
  /** Due date as ISO string or display string */
  dueDate?: string;
  /** Whether the item is overdue */
  isOverdue?: boolean;
  /** Assignee / owner display name */
  assignee?: string;
  /** Assignee avatar URL */
  assigneeAvatar?: string;
  /** Secondary label (e.g. project name, related object, source) */
  secondaryLabel?: string;
  /** Tertiary label (e.g. notification source, initiative name) */
  tertiaryLabel?: string;
  /** Icon to show before the title (ReactNode for flexibility) */
  icon?: ReactNode;
  /** Whether the item is unread / highlighted */
  isHighlighted?: boolean;
  /** Numeric indicator (e.g. days waiting, blocked count) */
  indicator?: number;
  /** Indicator label */
  indicatorLabel?: string;
  /** Raw data reference — pass-through for click handlers */
  _raw?: unknown;
}

/* ─────────────── Sections / Groups ─────────────── */

export interface ListSection {
  /** Unique section key */
  id: string;
  /** Display label */
  label: string;
  /** Icon (ReactNode) */
  icon?: ReactNode;
  /** Items in this section */
  items: GenericListItem[];
  /** Optional accent color class (e.g. "text-cyan-400") */
  accentColor?: string;
}

/* ─────────────── Column definition for ClickUp dense view ─────────────── */

export interface ListColumn {
  /** Column key (maps to GenericListItem field or custom renderer) */
  key: string;
  /** Header label */
  label: string;
  /** Width class (Tailwind) */
  width?: string;
  /** Custom cell renderer — receives the item */
  render?: (item: GenericListItem) => ReactNode;
  /** Whether column is sortable */
  sortable?: boolean;
}

/* ─────────────── Shared view props ─────────────── */

export interface SharedViewProps {
  /** Grouped sections of items */
  sections: ListSection[];
  /** Called when an item is clicked */
  onItemClick?: (item: GenericListItem) => void;
  /** Optional empty state message */
  emptyMessage?: string;
  /** Optional class name for the root container */
  className?: string;
}

export interface NotionViewProps extends SharedViewProps {
  /** Optional: override which section is initially selected */
  defaultSectionId?: string;
}

export interface ClickUpViewProps extends SharedViewProps {
  /** Column definitions for the dense table */
  columns?: ListColumn[];
  /** Whether to show section headers inline */
  showSectionHeaders?: boolean;
}
