/**
 * SheetsTabContent — honest empty state for governed sheet artifacts (Wave 2 surface).
 * No separate storage shell; listing will use the same registry when sheet runtime lands.
 */

import { Table2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const SheetsTabContent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-8">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Table2 size={24} />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('rap.sheets.emptyTitle', 'Sheets in Outputs Library')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(
                'rap.sheets.emptyBody',
                'Workbooks and governed exports will appear here through the same canonical artifact registry as documents and presentations. Sheet runtime wiring is in progress; this tab is reserved so the library taxonomy is truthful today.'
              )}
            </p>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 pt-2">
              {t(
                'rap.sheets.emptyHint',
                'Use Documents or Presentations for live outputs; All / Mine / Needs review already include any sheet rows the registry returns.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
