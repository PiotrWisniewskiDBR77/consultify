/**
 * GridView
 * Card-based grid view as alternative to table
 */

import { Copy, Edit, Eye, Maximize2, MoreVertical, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

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
  onItemClick?: (item: GridItem) => void;
  onItemAction?: (action: string, item: GridItem) => void;
  onNewItem?: () => void;
  newItemLabel?: string;
  emptyMessage?: string;
}

// Status config — supports all status families (assessment, report, initiative)
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // Initiative / shared statuses
  DRAFT: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400', label: 'Draft' },
  PENDING_REVIEW: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
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
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    dot: 'bg-purple-400',
    label: 'Scheduled',
  },
  EXECUTING: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
    label: 'Executing',
  },
  BLOCKED: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Blocked' },
  DONE: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400', label: 'Done' },
  TRACKING: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    dot: 'bg-teal-400',
    label: 'Tracking',
  },
  CANCELLED: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    dot: 'bg-gray-400',
    label: 'Cancelled',
  },
  ARCHIVED: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
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
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
    label: 'Awaiting Approval',
  },
  REJECTED: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    dot: 'bg-red-400',
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
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
    label: 'Pending Approval',
  },
  UTILIZED: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    dot: 'bg-teal-400',
    label: 'Utilized',
  },
};

// Type colors map
const TYPE_COLORS: Record<string, string> = {
  // Assessment frameworks
  DRD: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  SIRI: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  ADMA: 'from-teal-500/20 to-teal-600/10 border-teal-500/30',
  CMMI: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  LEAN: 'from-green-500/20 to-green-600/10 border-green-500/30',
  // Tool categories
  strategic: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  operational: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  digital: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  automation: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
};

// Format relative time
const formatRelativeTime = (date: Date | string) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

export const GridView: React.FC<GridViewProps> = ({
  items,
  onItemClick,
  onItemAction,
  onNewItem,
  newItemLabel = 'New Item',
  emptyMessage = 'No items found',
}) => {
  const [menuItemId, setMenuItemId] = useState<string | null>(null);

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
        const typeColor =
          TYPE_COLORS[item.type] ||
          TYPE_COLORS[item.typeColor] ||
          'from-slate-500/20 to-slate-600/10 border-slate-500/30';

        return (
          <div
            key={item.id}
            onClick={() => onItemClick?.(item)}
            className={`
              group relative bg-gradient-to-br ${typeColor}
              border rounded-xl overflow-hidden cursor-pointer
              hover:shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/30
              transition-all duration-200
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 pb-2">
              <span className="font-mono text-xs font-bold text-slate-400 uppercase">
                {item.type}
              </span>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuItemId(menuItemId === item.id ? null : item.id);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-navy-700/50 text-slate-400 hover:text-white transition-all"
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
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-navy-800 border border-navy-600 rounded-lg shadow-xl overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('edit', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700"
                      >
                        <Maximize2 size={14} />
                        Open
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('duplicate', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700"
                      >
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('rename', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700"
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <div className="border-t border-navy-600" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemAction?.('delete', item);
                          setMenuItemId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-navy-700"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-2">
              <h3 className="text-white font-medium leading-tight line-clamp-2">{item.name}</h3>
            </div>

            {/* Progress */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-navy-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.progress === 100
                        ? 'bg-emerald-500'
                        : item.progress >= 75
                          ? 'bg-blue-500'
                          : item.progress >= 50
                            ? 'bg-amber-500'
                            : 'bg-slate-500'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{item.progress}%</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-navy-700/50">
              <div className={`flex items-center gap-1.5 ${statusConfig.text}`}>
                <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                <span className="text-xs font-medium">{statusConfig.label}</span>
              </div>
              <span className="text-xs text-slate-500">{formatRelativeTime(item.updatedAt)}</span>
            </div>

            {/* Quick Preview Button (on hover) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onItemAction?.('preview', item);
              }}
              className="
                absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                p-3 rounded-full bg-primary-500 text-white
                opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
                shadow-lg shadow-primary-500/25
                transition-all duration-200
              "
              title="Quick Preview"
            >
              <Eye size={20} />
            </button>
          </div>
        );
      })}

      {/* Add New Card */}
      {onNewItem && (
        <button
          onClick={onNewItem}
          className="
            flex flex-col items-center justify-center gap-2
            min-h-[180px] rounded-xl border-2 border-dashed border-navy-600
            text-slate-500 hover:text-primary-400 hover:border-primary-500/50
            transition-all
          "
        >
          <Plus size={24} />
          <span className="text-sm font-medium">{newItemLabel}</span>
        </button>
      )}
    </div>
  );
};

export default GridView;
