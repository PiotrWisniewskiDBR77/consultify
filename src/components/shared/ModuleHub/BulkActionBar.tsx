/**
 * BulkActionBar — shared selected-count + bulk-action strip for FilterableTable
 * adopters (canon §3.5 / §4.2 "h-8 bulk"). Surfaces only when a selection exists;
 * the select-all / per-row checkboxes live inside FilterableTable's header/body.
 *
 * Each action's `onRun` receives the live TableSelectionApi so it can call
 * `runBulk(op)` over the module's existing single-item mutation. Destructive
 * actions should confirm before running (caller's responsibility, via
 * useConfirmDialog).
 */

import type { LucideIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TableSelectionApi } from './useTableSelection';

export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Danger tone (red) for destructive actions like delete. */
  variant?: 'default' | 'danger';
  /** Called on click; receives the selection API for runBulk. */
  onRun: (selection: TableSelectionApi) => void | Promise<void>;
  disabled?: boolean;
}

interface BulkActionBarProps {
  selection: TableSelectionApi;
  actions: BulkAction[];
  className?: string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selection,
  actions,
  className = 'px-4 pt-2',
}) => {
  const { t } = useTranslation();
  if (selection.count === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-c-text-muted select-none">
        {t('common.bulk.selectedCount', '{{count}} selected', { count: selection.count })}
      </span>
      {actions.length > 0 && <span className="text-xs text-c-text-muted select-none">·</span>}
      {actions.map((action) => {
        const Icon = action.icon;
        const danger = action.variant === 'danger';
        return (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            onClick={() => void action.onRun(selection)}
            className={[
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              danger
                ? 'border-c-danger/30 text-c-danger hover:bg-c-danger/10'
                : 'border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised',
            ].join(' ')}
          >
            {Icon && <Icon size={14} />}
            {action.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={selection.clear}
        className="ml-auto text-xs font-medium text-c-text-muted hover:text-c-text-secondary transition-colors"
      >
        {t('common.clear', 'Clear')}
      </button>
    </div>
  );
};

export default BulkActionBar;
