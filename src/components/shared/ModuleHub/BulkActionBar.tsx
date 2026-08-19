/**
 * BulkActionBar — shared selected-count + bulk-action strip for FilterableTable
 * adopters (canon §3.5 / §4.2 "h-8 bulk"). Surfaces only when a selection exists;
 * the select-all / per-row checkboxes live inside FilterableTable's header/body.
 *
 * Each action's `onRun` receives the live TableSelectionApi so it can call
 * `runBulk(op)` over the module's existing single-item mutation. Destructive
 * actions should confirm before running (caller's responsibility, via
 * useConfirmDialog).
 *
 * ── R02-B ───────────────────────────────────────────────────────────────────
 *
 * Ten plik jest odtąd CIENKIM ADAPTEREM na `BulkSelectionCluster` — jedyny
 * kanoniczny renderer klastra selection. Publiczne API (`selection`, `actions`
 * z `onRun`, `className`) jest nietknięte, bo `BulkActionBar` jest eksportowany
 * z barrela `ModuleHub/index.ts`.
 *
 * Co zniknęło razem z własnym markupem: tekstowy Clear dosunięty `ml-auto` do
 * prawej krawędzi, BEZ ikony X, oraz separator `·`. Był to drugi, niezgodny
 * wariant Clear w repo — dokładnie ten, który `REPAIR_WORK_PACKAGES.csv` (R02)
 * każe usunąć. Clear jest teraz w lewym klastrze, z ikoną X, jak wymaga §4.
 *
 * Zmiana jest bezpieczna wizualnie: ten komponent nie ma ANI JEDNEGO
 * konsumenta JSX w repo (sprawdzone `grep -rn "<BulkActionBar"`), więc żaden
 * ekran nie zmienia wyglądu. Zostaje wyłącznie jako publiczne API barrela.
 */

import type { LucideIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BulkSelectionCluster } from '../BulkSelectionCluster';
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

  return (
    <BulkSelectionCluster
      count={selection.count}
      selectedLabel={t('common.bulk.selectedCount', '{{count}} selected', {
        count: selection.count,
      })}
      onClear={selection.clear}
      clearLabel={t('common.clear', 'Clear')}
      className={className}
      actions={actions.map((action) => {
        const Icon = action.icon;
        return {
          id: action.id,
          label: action.label,
          icon: Icon ? <Icon size={14} /> : undefined,
          disabled: action.disabled,
          variant: action.variant === 'danger' ? ('danger' as const) : ('neutral' as const),
          onClick: () => action.onRun(selection),
        };
      })}
    />
  );
};

export default BulkActionBar;
