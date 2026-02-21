/**
 * TablePresentationToggle — N/C table mode switcher (T099)
 *
 * Allows users to switch between N-table (page-first, quiet luxury)
 * and C-table (action-first, ClickUp-style keyboard UX).
 * Persists preference per context via usePresentationMode.
 */

import { LayoutList, Table2 } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { EntityType, PresentationMode } from '../../hooks/usePresentationMode';
import { usePresentationMode } from '../../hooks/usePresentationMode';
import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface TablePresentationToggleProps {
  entityType: EntityType;
  className?: string;
}

export const TablePresentationToggle: React.FC<TablePresentationToggleProps> = ({
  entityType,
  className,
}) => {
  const { t } = useTranslation();
  const { mode, setMode } = usePresentationMode({ entityType });

  const handleToggle = useCallback(
    (next: PresentationMode) => {
      if (next === mode) return;
      trackFunnelEvent('table_view_mode_changed', {
        context: entityType,
        from: mode,
        to: next,
      });
      setMode(next);
    },
    [entityType, mode, setMode]
  );

  const options: Array<{ key: PresentationMode; icon: React.ReactNode; label: string }> = [
    {
      key: 'n',
      icon: <LayoutList size={14} strokeWidth={1.75} />,
      label: t('ui.tableToggle.nMode', 'Page view'),
    },
    {
      key: 'c',
      icon: <Table2 size={14} strokeWidth={1.75} />,
      label: t('ui.tableToggle.cMode', 'Table view'),
    },
  ];

  return (
    <div
      className={[
        'flex items-center rounded-lg p-0.5 bg-slate-100 dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="radiogroup"
      aria-label={t('ui.tableToggle.label', 'Table presentation mode')}
    >
      {options.map((opt) => {
        const isActive = mode === opt.key;
        return (
          <button
            key={opt.key}
            role="radio"
            aria-checked={isActive}
            onClick={() => handleToggle(opt.key)}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
              isActive
                ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            ].join(' ')}
            title={opt.label}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.key.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TablePresentationToggle;
