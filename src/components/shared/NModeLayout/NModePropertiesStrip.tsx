/**
 * NModePropertiesStrip
 *
 * Full-width property fields row displayed below the header.
 * Renders a responsive grid of form fields (select, date, text, custom).
 * Supports alert border highlighting (e.g. overdue deadline).
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.4
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
    <div className="mb-3 px-4 py-2.5 rounded-2xl bg-slate-50/90 dark:bg-navy-900/50 backdrop-blur-xl">
      <div className={gridClass}>
        {fields.map((field) => {
          // Tailwind needs static class names — map colSpan to known utilities
          const spanClass =
            field.colSpan === 2 ? ' col-span-2' : field.colSpan === 3 ? ' col-span-3' : '';
          // Read-only text/date/select render as a clean label + value
          // (dashboard strip), not a disabled input box. Fixes the "10 okien
          // niesymetrycznie" look (#27) across every NModeShell consumer while
          // leaving editable fields fully interactive.
          const isReadOnlyValue =
            field.readOnly &&
            (field.type === 'text' || field.type === 'date' || field.type === 'select');
          const readOnlyDisplay = (() => {
            if (field.type === 'select') {
              const opt = (field.options || []).find((o) => o.value === field.value);
              return opt ? (isPolish ? opt.label.pl : opt.label.en) : field.value;
            }
            return field.value;
          })();

          return (
            <div key={field.id} className={`space-y-1${spanClass}`}>
              <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {isPolish ? field.label.pl : field.label.en}
              </label>

              {/* Custom render */}
              {field.type === 'custom' && field.render ? (
                field.render()
              ) : isReadOnlyValue ? (
                <div className="flex h-7 items-center text-sm font-medium text-slate-800 dark:text-slate-200">
                  <span className="truncate">{readOnlyDisplay || '—'}</span>
                </div>
              ) : /* Select field */
              field.type === 'select' ? (
                <select
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={field.readOnly}
                  className={`w-full h-8 px-2.5 rounded-lg text-xs font-medium bg-white dark:bg-navy-800 border ${
                    field.alertBorderClass || 'border-slate-300/60 dark:border-navy-600/40'
                  } text-c-text focus:outline-none focus:border-c-focus-solid transition-colors disabled:opacity-60`}
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
                  className={`w-full h-8 px-2.5 rounded-lg text-xs bg-white dark:bg-navy-800 border ${
                    field.alertBorderClass || 'border-slate-300/60 dark:border-navy-600/40'
                  } text-c-text focus:outline-none focus:border-c-focus-solid transition-colors`}
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
                  className={`w-full h-8 px-2.5 rounded-lg text-xs bg-white dark:bg-navy-800 border ${
                    field.alertBorderClass || 'border-slate-300/60 dark:border-navy-600/40'
                  } text-c-text focus:outline-none focus:border-c-focus-solid transition-colors`}
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
