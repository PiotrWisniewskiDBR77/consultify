/**
 * ColumnConfigMenu - Show/hide table columns
 * Persists preferences in localStorage
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Columns, Eye, EyeOff } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

export interface ColumnConfig {
  id: string;
  label: string;
  alwaysVisible?: boolean;
}

interface ColumnConfigMenuProps {
  columns: ColumnConfig[];
  hiddenColumns: string[];
  onToggleColumn: (columnId: string) => void;
}

export const ColumnConfigMenu: React.FC<ColumnConfigMenuProps> = ({
  columns,
  hiddenColumns,
  onToggleColumn,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const hiddenSet = new Set(hiddenColumns);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
          ${
            hiddenSet.size > 0
              ? 'bg-c-surface-raised text-c-text border border-c-border-strong'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
          }
        `}
      >
        <Columns size={12} />
        {t('myWork.personalTasks.columns', 'Columns')}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 z-overlay w-52 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('myWork.personalTasks.toggleColumns', 'Toggle columns')}
              </p>
            </div>
            <div className="p-1.5">
              {columns.map((col) => {
                const isHidden = hiddenSet.has(col.id);
                return (
                  <button
                    key={col.id}
                    disabled={col.alwaysVisible}
                    onClick={() => {
                      trackFunnelEvent('column_config_toggled', {
                        column: col.id,
                        hidden: !hiddenSet.has(col.id),
                      });
                      onToggleColumn(col.id);
                    }}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                      ${col.alwaysVisible ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer'}
                      ${isHidden ? 'text-slate-600 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}
                    `}
                  >
                    {isHidden ? (
                      <EyeOff size={14} className="text-slate-600 dark:text-slate-500" />
                    ) : (
                      <Eye size={14} className="text-c-text" />
                    )}
                    <span>{col.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ColumnConfigMenu;
