/**
 * DenseListView — Dense, information-rich list view (C-style)
 *
 * Layout: Compact table-like rows grouped by sections, with inline
 * status/priority badges, mini avatars, and maximum data density.
 *
 * Reusable across Tasks, Decisions, Notifications, Initiatives, Interview.
 */

import { ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { Avatar, PriorityDot, StatusBadge } from './StatusBadge';
import type { ClickUpViewProps, GenericListItem, ListColumn } from './types';

/* ─────────────── Default columns ─────────────── */

const DEFAULT_COLUMNS: ListColumn[] = [
  { key: 'title', label: 'Name', width: 'flex-1 min-w-0' },
  { key: 'status', label: 'Status', width: 'w-28' },
  { key: 'priority', label: 'Priority', width: 'w-24' },
  { key: 'assignee', label: 'Assignee', width: 'w-32' },
  { key: 'dueDate', label: 'Due', width: 'w-28' },
];

/* ─────────────── Cell Renderer ─────────────── */

const CellContent: React.FC<{ item: GenericListItem; column: ListColumn }> = ({ item, column }) => {
  // Custom renderer takes priority
  if (column.render) return <>{column.render(item)}</>;

  switch (column.key) {
    case 'title':
      return (
        <div className="flex items-center gap-2 min-w-0">
          {item.isHighlighted && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          {item.icon && <span className="flex-shrink-0 text-slate-400">{item.icon}</span>}
          <span className="text-sm text-slate-900 dark:text-white truncate font-medium">
            {item.title}
          </span>
          {item.secondaryLabel && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[100px] hidden xl:inline">
              {item.secondaryLabel}
            </span>
          )}
        </div>
      );
    case 'status':
      return <StatusBadge label={item.status} variant={item.statusVariant} compact />;
    case 'priority':
      return <PriorityDot label={item.priority} variant={item.priorityVariant} />;
    case 'assignee':
      return item.assignee ? (
        <span className="flex items-center gap-1.5">
          <Avatar name={item.assignee} url={item.assigneeAvatar} size="sm" />
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {item.assignee}
          </span>
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      );
    case 'dueDate':
      return item.dueDate ? (
        <span
          className={`text-xs font-medium ${
            item.isOverdue ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {item.dueDate}
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      );
    case 'indicator':
      return item.indicator !== undefined && item.indicator > 0 ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-semibold">
          {item.indicatorLabel || item.indicator}
        </span>
      ) : null;
    case 'secondaryLabel':
      return item.secondaryLabel ? (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {item.secondaryLabel}
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      );
    case 'tertiaryLabel':
      return item.tertiaryLabel ? (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {item.tertiaryLabel}
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      );
    default:
      return null;
  }
};

/* ─────────────── Section Group ─────────────── */

const SectionGroup: React.FC<{
  section: {
    id: string;
    label: string;
    icon?: React.ReactNode;
    accentColor?: string;
    items: GenericListItem[];
  };
  columns: ListColumn[];
  onItemClick?: (item: GenericListItem) => void;
  defaultExpanded?: boolean;
}> = ({ section, columns, onItemClick, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-1">
      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors rounded-md group"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
        )}
        {section.icon && (
          <span className={`flex-shrink-0 ${section.accentColor || 'text-slate-400'}`}>
            {section.icon}
          </span>
        )}
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {section.label}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          {section.items.length}
        </span>
      </button>

      {/* Rows */}
      {expanded && (
        <div className="ml-0">
          {section.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick?.(item)}
              className={`w-full flex items-center gap-0 px-3 py-1.5 text-left border-b border-slate-100 dark:border-navy-800 transition-colors hover:bg-slate-50 dark:hover:bg-navy-800/40 ${
                item.isHighlighted ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''
              }`}
            >
              {columns.map((col) => (
                <div key={col.key} className={`${col.width || 'flex-1'} px-2 truncate`}>
                  <CellContent item={item} column={col} />
                </div>
              ))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────── Main Component ─────────────── */

export const ClickUpListView: React.FC<ClickUpViewProps> = ({
  sections,
  columns,
  onItemClick,
  emptyMessage = 'No items',
  className = '',
  showSectionHeaders = true,
}) => {
  const cols = columns || DEFAULT_COLUMNS;

  const totalItems = useMemo(
    () => sections.reduce((sum, s) => sum + s.items.length, 0),
    [sections]
  );

  if (totalItems === 0) {
    return (
      <div
        className={`flex items-center justify-center py-16 text-slate-400 dark:text-slate-500 ${className}`}
      >
        <Inbox size={20} className="mr-2 opacity-50" />
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden ${className}`}
    >
      {/* Column headers */}
      <div className="flex items-center gap-0 px-3 py-2 bg-slate-50 dark:bg-navy-900/80 border-b border-slate-200 dark:border-navy-700">
        {cols.map((col) => (
          <div
            key={col.key}
            className={`${col.width || 'flex-1'} px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider`}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="divide-y divide-slate-100 dark:divide-navy-800">
        {showSectionHeaders
          ? sections.map((section) => (
              <SectionGroup
                key={section.id}
                section={section}
                columns={cols}
                onItemClick={onItemClick}
              />
            ))
          : sections.flatMap((section) =>
              section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className={`w-full flex items-center gap-0 px-3 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-navy-800/40 ${
                    item.isHighlighted ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''
                  }`}
                >
                  {cols.map((col) => (
                    <div key={col.key} className={`${col.width || 'flex-1'} px-2 truncate`}>
                      <CellContent item={item} column={col} />
                    </div>
                  ))}
                </button>
              ))
            )}
      </div>
    </div>
  );
};

export default ClickUpListView;
