/**
 * BulkActionBar - Action bar for bulk operations on selected items
 * Appears when items are selected in the table
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Calendar, CheckCircle, Flag, MoreHorizontal, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';

import { useDeviceType } from '@/hooks/useDeviceType';

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  actions,
  className = '',
}) => {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const { isMobile, safeAreaInsets } = useDeviceType();

  const mobileBottomOffset = isMobile ? 64 + (safeAreaInsets.bottom || 0) + 12 : null;

  // Split actions into visible and overflow
  const visibleActions = actions.slice(0, 4);
  const overflowActions = actions.slice(4);

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          data-testid="bulk-action-bar"
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2 z-dropdown
            flex items-center gap-3 px-4 py-2.5
            bg-white dark:bg-navy-800
            border border-slate-200 dark:border-navy-600
            rounded-xl shadow-xl
            ${className}
          `}
          style={mobileBottomOffset ? { bottom: `${mobileBottomOffset}px` } : undefined}
        >
          {/* Selection Count */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-navy-600">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-navy-900 text-white text-xs font-medium dark:bg-white dark:text-navy-950">
              {selectedCount}
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">selected</span>
            <button
              onClick={onClearSelection}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title="Clear selection"
            >
              <X size={14} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {visibleActions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-colors
                  ${
                    action.variant === 'danger'
                      ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700'
                  }
                  ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={action.label}
              >
                {action.icon}
                <span className="hidden sm:inline">{action.label}</span>
              </button>
            ))}

            {/* More Actions */}
            {overflowActions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowMoreActions(!showMoreActions)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700"
                >
                  <MoreHorizontal size={16} />
                </button>

                <AnimatePresence>
                  {showMoreActions && (
                    <>
                      <div
                        className="fixed inset-0 z-sticky"
                        onClick={() => setShowMoreActions(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute bottom-full right-0 mb-2 z-dropdown min-w-[160px] bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden"
                      >
                        {overflowActions.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => {
                              action.onClick();
                              setShowMoreActions(false);
                            }}
                            disabled={action.disabled}
                            className={`
                              w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                              ${
                                action.variant === 'danger'
                                  ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700'
                              }
                              ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            {action.icon}
                            {action.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Common bulk actions factory
export const createTaskBulkActions = (handlers: {
  onComplete?: () => void;
  onChangePriority?: () => void;
  onChangeDate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}): BulkAction[] => [
  {
    id: 'complete',
    label: 'Complete',
    icon: <CheckCircle size={16} />,
    onClick: handlers.onComplete || (() => {}),
  },
  {
    id: 'priority',
    label: 'Priority',
    icon: <Flag size={16} />,
    onClick: handlers.onChangePriority || (() => {}),
  },
  {
    id: 'date',
    label: 'Due Date',
    icon: <Calendar size={16} />,
    onClick: handlers.onChangeDate || (() => {}),
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: <Archive size={16} />,
    onClick: handlers.onArchive || (() => {}),
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 size={16} />,
    onClick: handlers.onDelete || (() => {}),
    variant: 'danger',
  },
];

export const createDecisionBulkActions = (handlers: {
  onApprove?: () => void;
  onReject?: () => void;
  onChangePriority?: () => void;
  onDelete?: () => void;
}): BulkAction[] => [
  {
    id: 'approve',
    label: 'Approve',
    icon: <CheckCircle size={16} />,
    onClick: handlers.onApprove || (() => {}),
  },
  {
    id: 'priority',
    label: 'Priority',
    icon: <Flag size={16} />,
    onClick: handlers.onChangePriority || (() => {}),
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 size={16} />,
    onClick: handlers.onDelete || (() => {}),
    variant: 'danger',
  },
];

export const createNotificationBulkActions = (handlers: {
  onMarkRead?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}): BulkAction[] => [
  {
    id: 'markRead',
    label: 'Mark Read',
    icon: <CheckCircle size={16} />,
    onClick: handlers.onMarkRead || (() => {}),
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: <Archive size={16} />,
    onClick: handlers.onArchive || (() => {}),
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 size={16} />,
    onClick: handlers.onDelete || (() => {}),
    variant: 'danger',
  },
];

export default BulkActionBar;
