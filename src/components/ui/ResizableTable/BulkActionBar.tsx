/**
 * BulkActionBar - Action bar for bulk operations on selected items
 * Appears when items are selected in the table
 *
 * ── R02-B ───────────────────────────────────────────────────────────────────
 *
 * Ten plik jest odtąd CIENKĄ FASADĄ: zachowuje własne API (`selectedCount`,
 * `onClearSelection`, `actions`, `className`), własne UMIEJSCOWIENIE (pływający
 * pill na dole, `data-testid="bulk-action-bar"`) i własne przesunięcie nad
 * mobilną nawigację — a zawartość klastra renderuje przez wspólny, kanoniczny
 * `BulkSelectionCluster`.
 *
 * Co zniknęło razem z lokalnym markupem:
 *   · własny Clear jako goła ikona X bez etykiety — §4 Formuła 2 wymaga X ORAZ
 *     etykiety, i to była jedna z dwóch niezgodnych implementacji Clear w repo;
 *   · lokalne menu „More" dla akcji powyżej czterech — trzeci równoległy popover
 *     w kodzie. Kanon zabrania chowania realnych akcji, a klaster zawija je
 *     bez clippingu. Jedyna żywa ścieżka (`createNotificationBulkActions`)
 *     deklaruje trzy akcje, więc overflow i tak nigdy się nie uruchamiał.
 *
 * Fabryki `create*BulkActions` są NIETKNIĘTE — to API biznesowe konsumentów
 * (`MyWork/NotificationsContent`, `MyWork/MyTasksListContent`).
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Calendar, CheckCircle, Flag, Trash2 } from 'lucide-react';
import React from 'react';

import { BulkSelectionCluster } from '@/components/shared/BulkSelectionCluster';
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
  const { isMobile, safeAreaInsets } = useDeviceType();

  const mobileBottomOffset = isMobile ? 64 + (safeAreaInsets.bottom || 0) + 12 : null;

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
          <BulkSelectionCluster
            tone="floating"
            count={selectedCount}
            onClear={onClearSelection}
            actions={actions.map((action) => ({
              id: action.id,
              label: action.label,
              icon: action.icon,
              disabled: action.disabled,
              variant: action.variant === 'danger' ? ('danger' as const) : ('neutral' as const),
              onClick: action.onClick,
            }))}
          />
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
