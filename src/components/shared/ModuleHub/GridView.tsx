/**
 * GridView — Golden Standard (v3)
 * Card-based grid view as alternative to table.
 *
 * SSOT: docs/ui-standards/03-modules/view-modes-standard.md (Cards/Grid)
 * Goals:
 * - readable at-a-glance (title + brief + signals)
 * - artifact identity via subtle accent (border-left), not gradients
 * - consistent actions: kebab (⋮), no giant hover CTAs
 * - i18n-ready (PL/EN)
 */

import { Copy, Edit, MoreVertical, Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface GridItem {
  id: string;
  name: string;
  type: string;
  typeColor: string;
  status: string;
  progress: number;
  updatedAt: Date | string;
  [key: string]: any;
}

interface GridViewProps {
  items: GridItem[];
  /** Optional: highlight a selected card (for Cards+Preview layouts). */
  selectedItemId?: string | null;
  onItemClick?: (item: GridItem) => void;
  onItemAction?: (action: string, item: GridItem) => void;
  onNewItem?: () => void;
  newItemLabel?: string;
  emptyMessage?: string;
  /** Optional extra action buttons rendered per card (e.g. Export, Open Source) */
  extraCardActions?: (item: GridItem) => React.ReactNode;
}

// Status config — supports all status families (assessment, report, initiative)
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // Initiative / shared statuses
  DRAFT: { bg: 'bg-slate-500/10', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Draft' },
  PENDING_REVIEW: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'Pending Review',
  },
  REVIEW: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'In Review',
  },
  PROMOTED: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    label: 'Promoted',
  },
  PLANNING: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    dot: 'bg-indigo-400',
    label: 'Planning',
  },
  APPROVED: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    label: 'Approved',
  },
  SCHEDULED: {
    bg: 'bg-primary-500/10',
    text: 'text-primary-400',
    dot: 'bg-primary-400',
    label: 'Scheduled',
  },
  EXECUTING: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    label: 'Executing',
  },
  BLOCKED: { bg: 'bg-danger-500/10', text: 'text-danger-400', dot: 'bg-danger-400', label: 'Blocked' },
  DONE: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400', label: 'Done' },
  TRACKING: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    label: 'Tracking',
  },
  CANCELLED: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    label: 'Cancelled',
  },
  ARCHIVED: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-600',
    dot: 'bg-slate-500',
    label: 'Archived',
  },
  // Assessment-specific statuses
  IN_REVIEW: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'In Review',
  },
  AWAITING_APPROVAL: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'Awaiting Approval',
  },
  REJECTED: {
    bg: 'bg-danger-500/10',
    text: 'text-danger-400',
    dot: 'bg-danger-400',
    label: 'Rejected',
  },
  // Report-specific statuses
  GENERATING: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    label: 'Generating',
  },
  FINAL: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    dot: 'bg-indigo-400',
    label: 'Final',
  },
  PENDING_APPROVAL: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'Pending Approval',
  },
  UTILIZED: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    label: 'Utilized',
  },
};

// Accent map (identity) — border-left + type pill (subtle)
const TYPE_ACCENTS: Record<string, { borderLeft: string; pill: string; text: string }> = {
  // Assessment frameworks
  DRD: {
    borderLeft: 'border-l-primary-500 dark:border-l-primary-400',
    pill: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300',
    text: 'text-primary-600 dark:text-primary-300',
  },
  SIRI: {
    borderLeft: 'border-l-blue-500 dark:border-l-blue-400',
    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    text: 'text-blue-600 dark:text-blue-300',
  },
  ADMA: {
    borderLeft: 'border-l-blue-500 dark:border-l-blue-400',
    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    text: 'text-blue-600 dark:text-blue-300',
  },
  CMMI: {
    borderLeft: 'border-l-amber-500 dark:border-l-amber-400',
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-300',
  },
  LEAN: {
    borderLeft: 'border-l-emerald-500 dark:border-l-emerald-400',
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    text: 'text-emerald-600 dark:text-emerald-300',
  },
  // Tool categories
  strategic: {
    borderLeft: 'border-l-emerald-500 dark:border-l-emerald-400',
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    text: 'text-emerald-600 dark:text-emerald-300',
  },
  operational: {
    borderLeft: 'border-l-blue-500 dark:border-l-blue-400',
    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    text: 'text-blue-600 dark:text-blue-300',
  },
  digital: {
    borderLeft: 'border-l-primary-500 dark:border-l-primary-400',
    pill: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300',
    text: 'text-primary-600 dark:text-primary-300',
  },
  automation: {
    borderLeft: 'border-l-amber-500 dark:border-l-amber-400',
    pill: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
  },
};

// Format relative time
const formatRelativeTime = (date: Date | string, isPolish: boolean) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return isPolish ? 'Przed chwilą' : 'Just now';
  if (hours < 24) return isPolish ? `${hours} h temu` : `${hours}h ago`;
  if (days < 7) return isPolish ? `${days} dni temu` : `${days}d ago`;
  return d.toLocaleDateString();
};

export const GridView: React.FC<GridViewProps> = ({
  items,
  selectedItemId,
  onItemClick,
  onItemAction,
  onNewItem,
  newItemLabel = 'New Item',
  emptyMessage = 'No items found',
  extraCardActions,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [menuItemId, setMenuItemId] = useState<string | null>(null);

  const labels = useMemo(
    () => ({
      open: isPolish ? 'Otwórz' : 'Open',
      duplicate: isPolish ? 'Duplikuj' : 'Duplicate',
      edit: isPolish ? 'Edytuj' : 'Edit',
      delete: isPolish ? 'Usuń' : 'Delete',
      newItem: newItemLabel || (isPolish ? 'Nowy element' : 'New item'),
      empty: emptyMessage || (isPolish ? 'Brak elementów' : 'No items found'),
    }),
    [isPolish, newItemLabel, emptyMessage]
  );

  if (items.length === 0 && !onNewItem) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {/* Item Cards */}
      {items.map((item) => {
        const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.DRAFT;
        const accent = TYPE_ACCENTS[item.type] ||
          TYPE_ACCENTS[item.typeColor] || {
            borderLeft: 'border-l-slate-400 dark:border-l-slate-500',
            pill: 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200',
            text: 'text-slate-600 dark:text-slate-300',
          };

        const title = String(item.name ?? '');
        const rawBrief = String(item.brief ?? item.summary ?? item.description ?? '').trim();
        const firstLine =
          rawBrief
            .split('\n')
            .find((l) => l.trim().length > 0)
            ?.trim() || '';
        const brief = firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
        const isSelected = Boolean(selectedItemId && item.id === selectedItemId);

        return (
          <div
            key={item.id}
            onClick={() => onItemClick?.(item)}
            className={[
              'group relative cursor-pointer rounded-xl overflow-hidden',
              'border-l-[3px] border border-slate-200/60 dark:border-white/[0.06]',
              accent.borderLeft,
              'bg-slate-50/80 dark:bg-navy-800/60',
              'hover:bg-white dark:hover:bg-navy-800/80',
              isSelected ? 'ring-2 ring-slate-400/40 dark:ring-c-border bg-white dark:bg-navy-800/80' : '',
              'transition-colors duration-150',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 p-3 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${accent.pill}`}
                  title={String(item.type)}
                >
                  {String(item.type)}
                </span>
                <div className={`flex items-center gap-1.5 ${statusConfig.text}`}>
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                  <span className="text-[10px] font-medium">{statusConfig.label}</span>
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuItemId(menuItemId === item.id ? null : item.id);
                  }}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 transition-all"
                  aria-label={t('common.actions', 'Actions')}
                  title={t('common.actions', 'Actions')}
                >
                  <MoreVertical size={16} />
                </button>

                {/* Menu */}
                {menuItemId === item.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuItemId(null);
                      }}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-navy-900 border border-slate-200/70 dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('open', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      >
                        <Edit size={14} />
                        {labels.open}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('duplicate', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      >
                        <Copy size={14} />
                        {labels.duplicate}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('rename', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      >
                        <Edit size={14} />
                        {labels.edit}
                      </button>
                      <div className="border-t border-slate-200/70 dark:border-white/[0.08]" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('delete', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      >
                        <Trash2 size={14} />
                        {labels.delete}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="px-3 pb-2">
              <h3 className="text-slate-900 dark:text-white font-medium leading-snug line-clamp-2">
                {title}
              </h3>
              {brief ? (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {brief}
                </p>
              ) : null}
            </div>

            {/* Signals (optional progress) */}
            {typeof item.progress === 'number' ? (
              <div className="px-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-200/80 dark:bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-500/70 dark:bg-white/[0.18]"
                      style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {Math.round(item.progress)}%
                  </span>
                </div>
              </div>
            ) : null}

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-200/70 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">{extraCardActions?.(item)}</div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatRelativeTime(item.updatedAt, isPolish)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Add New Card */}
      {onNewItem && (
        <button
          onClick={onNewItem}
          className="
            flex flex-col items-center justify-center gap-2
            min-h-[180px] rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600
            text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-white/[0.18]
            transition-all
          "
        >
          <Plus size={24} />
          <span className="text-sm font-medium">{labels.newItem}</span>
        </button>
      )}
    </div>
  );
};

export default GridView;
