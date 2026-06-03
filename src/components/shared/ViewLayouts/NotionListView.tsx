/**
 * SectionNavListView — N-style layout for any list module
 *
 * Layout:
 * ┌──────────────┬──────────────────────────────────────┐
 * │  Left Nav    │  Content area                        │
 * │  (sections)  │  Shows items from selected section   │
 * │              │  as clean cards with key metadata     │
 * │              │                                      │
 * └──────────────┴──────────────────────────────────────┘
 *
 * Reusable across Tasks, Decisions, Notifications, Initiatives, Interview.
 */

import { ChevronRight, Inbox } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Avatar, PriorityDot, StatusBadge } from './StatusBadge';
import type { GenericListItem, NotionViewProps } from './types';

/* ─────────────── Item Card ─────────────── */

const NotionItemCard: React.FC<{
  item: GenericListItem;
  onClick?: (item: GenericListItem) => void;
}> = ({ item, onClick }) => {
  return (
    <button
      onClick={() => onClick?.(item)}
      className={`w-full text-left group px-4 py-3 rounded-lg border transition-all duration-150 hover:shadow-sm ${
        item.isHighlighted
          ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40'
          : 'bg-white dark:bg-navy-800/60 border-slate-200 dark:border-navy-700 hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      {/* Row 1: Title + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {item.icon && <span className="flex-shrink-0 text-slate-600">{item.icon}</span>}
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {item.title}
          </span>
          {item.isHighlighted && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
        <StatusBadge label={item.status} variant={item.statusVariant} />
      </div>

      {/* Row 2: Subtitle (if any) */}
      {item.subtitle && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pl-0">
          {item.subtitle}
        </p>
      )}

      {/* Row 3: Metadata chips */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <PriorityDot label={item.priority} variant={item.priorityVariant} />
        {item.dueDate && (
          <span
            className={`text-[11px] font-medium ${
              item.isOverdue ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.dueDate}
          </span>
        )}
        {item.assignee && (
          <span className="flex items-center gap-1.5">
            <Avatar name={item.assignee} url={item.assigneeAvatar} size="sm" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.assignee}</span>
          </span>
        )}
        {item.secondaryLabel && (
          <span className="text-[11px] text-slate-600 dark:text-slate-500 truncate max-w-[140px]">
            {item.secondaryLabel}
          </span>
        )}
        {item.indicator !== undefined && item.indicator > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium">
            {item.indicatorLabel || item.indicator}
          </span>
        )}
      </div>
    </button>
  );
};

/* ─────────────── Main Component ─────────────── */

export const NotionListView: React.FC<NotionViewProps> = ({
  sections,
  onItemClick,
  emptyMessage = 'No items',
  className = '',
  defaultSectionId,
}) => {
  // Find first non-empty section or use default
  const initialSection = useMemo(() => {
    if (defaultSectionId) return defaultSectionId;
    const firstWithItems = sections.find((s) => s.items.length > 0);
    return firstWithItems?.id || sections[0]?.id || '';
  }, [sections, defaultSectionId]);

  const [activeSectionId, setActiveSectionId] = useState(initialSection);

  const activeSection = useMemo(
    () => sections.find((s) => s.id === activeSectionId) || sections[0],
    [sections, activeSectionId]
  );

  const totalItems = useMemo(
    () => sections.reduce((sum, s) => sum + s.items.length, 0),
    [sections]
  );

  if (totalItems === 0) {
    return (
      <div
        className={`flex items-center justify-center py-16 text-slate-600 dark:text-slate-500 ${className}`}
      >
        <Inbox size={20} className="mr-2 opacity-50" />
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden min-h-[400px] ${className}`}
    >
      {/* ── Left Navigation ── */}
      <nav className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/80 py-2 overflow-y-auto">
        {sections.map((section) => {
          const isActive = section.id === activeSectionId;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSectionId(section.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-blue-400 font-medium shadow-sm border-r-2 border-blue-500'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-navy-800/40 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {section.icon && (
                <span className={`flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-600'}`}>
                  {section.icon}
                </span>
              )}
              <span className="flex-1 truncate">{section.label}</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {section.items.length}
              </span>
              {isActive && <ChevronRight size={14} className="flex-shrink-0 text-blue-400" />}
            </button>
          );
        })}
      </nav>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-navy-700">
          {activeSection?.icon && (
            <span className={activeSection.accentColor || 'text-blue-500'}>
              {activeSection.icon}
            </span>
          )}
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {activeSection?.label}
          </h3>
          <span className="text-xs text-slate-600 dark:text-slate-500 ml-1">
            ({activeSection?.items.length || 0})
          </span>
        </div>

        {/* Items */}
        {activeSection && activeSection.items.length > 0 ? (
          <div className="space-y-2">
            {activeSection.items.map((item) => (
              <NotionItemCard key={item.id} item={item} onClick={onItemClick} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-slate-600">
            No items in this section
          </div>
        )}
      </div>
    </div>
  );
};

export default NotionListView;
