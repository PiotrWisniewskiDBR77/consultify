/**
 * NModePropertiesStrip
 *
 * Full-width property fields row displayed below the header.
 * Renders a responsive grid of form fields (select, date, text, custom).
 * Supports alert border highlighting (e.g. overdue deadline).
 *
 * @see docs/ui-standards/detail-view-presentation-modes.md §2.5.4
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import type { NModePropertyField } from './types';

interface NModePropertiesStripProps {
  /** Property field definitions */
  fields: NModePropertyField[];
  /** Max columns at lg breakpoint (default: 6) */
  maxColumns?: number;
}

// Static class map so Tailwind JIT can detect all variants at build time
const LG_GRID_MAP: Record<number, string> = {
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  7: 'lg:grid-cols-7',
  8: 'lg:grid-cols-8',
  9: 'lg:grid-cols-9',
  10: 'lg:grid-cols-10',
};

export const NModePropertiesStrip: React.FC<NModePropertiesStripProps> = ({
  fields,
  maxColumns = 6,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const lgCols = LG_GRID_MAP[maxColumns] || 'lg:grid-cols-6';
  const gridClass = `grid grid-cols-2 sm:grid-cols-3 ${lgCols} gap-3`;

  return (
    <div className="mb-4 p-4 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60">
      <div className={gridClass}>
        {fields.map((field) => {
          // Tailwind needs static class names — map colSpan to known utilities
          const spanClass =
            field.colSpan === 2 ? ' col-span-2' : field.colSpan === 3 ? ' col-span-3' : '';
          return (
            <div key={field.id} className={`space-y-1${spanClass}`}>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {isPolish ? field.label.pl : field.label.en}
              </label>

              {/* Custom render */}
              {field.type === 'custom' && field.render ? (
                field.render()
              ) : /* Select field */
              field.type === 'select' ? (
                <select
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={field.readOnly}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-navy-800 border ${
                    field.alertBorderClass || 'border-slate-200/60 dark:border-navy-600/60'
                  } text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors disabled:opacity-60`}
                >
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {isPolish ? opt.label.pl : opt.label.en}
                    </option>
                  ))}
                </select>
              ) : /* Date field */
              field.type === 'date' ? (
                <input
                  type="date"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  readOnly={field.readOnly}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border ${
                    field.alertBorderClass || 'border-slate-200/60 dark:border-navy-600/60'
                  } text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors`}
                />
              ) : (
                /* Text field */
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  readOnly={field.readOnly}
                  placeholder={
                    field.placeholder
                      ? isPolish
                        ? field.placeholder.pl
                        : field.placeholder.en
                      : undefined
                  }
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border ${
                    field.alertBorderClass || 'border-slate-200/60 dark:border-navy-600/60'
                  } text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NModePropertiesStrip;
