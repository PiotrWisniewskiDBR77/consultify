/**
 * ReportsEntryRouter (V3-A04 / V3-J01)
 * Smart entry for /reports — quick selector between Builder (deliverable) and Management (PMO)
 * Prevents confusion when user clicks "Reports" in sidebar.
 */

import { FileOutput, FileText } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export const ReportsEntryRouter: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBuilder = () => {
    trackFunnelEvent('reports_entry_opened', { entry: 'builder' });
    navigate(ROUTES.REPORTS.BUILDER);
  };

  const handleManagement = () => {
    trackFunnelEvent('reports_entry_opened', { entry: 'management' });
    navigate(ROUTES.REPORTS.MANAGEMENT);
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
          {t('reports.entry.title', 'Reports')}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t('reports.entry.subtitle', 'Choose how you want to work with reports')}
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row sm:gap-6">
        {/* Primary: Report Builder */}
        <button
          type="button"
          onClick={handleBuilder}
          className="group flex flex-1 flex-col items-start rounded-xl border-2 border-purple-200 bg-purple-50/50 p-6 text-left transition-all hover:border-purple-400 hover:bg-purple-100/50 dark:border-purple-800/50 dark:bg-purple-900/20 dark:hover:border-purple-600 dark:hover:bg-purple-900/30"
        >
          <div className="mb-3 rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/40">
            <FileText size={24} className="text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
            {t('reports.entry.builderTitle', 'Report Builder')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {t('reports.entry.builderDesc', 'Create deliverable reports for clients')}
          </p>
          <span className="mt-4 text-sm font-medium text-purple-600 dark:text-purple-400 group-hover:underline">
            {t('reports.entry.openBuilder', 'Open Report Builder')} →
          </span>
        </button>

        {/* Secondary: Management Reports */}
        <button
          type="button"
          onClick={handleManagement}
          className="group flex flex-1 flex-col items-start rounded-xl border border-slate-200 bg-slate-50/50 p-5 text-left transition-all hover:border-slate-300 hover:bg-slate-100/50 dark:border-navy-700 dark:bg-navy-800/30 dark:hover:border-navy-600 dark:hover:bg-navy-800/50"
        >
          <div className="mb-2.5 rounded-lg bg-slate-200/80 p-2 dark:bg-navy-700/80">
            <FileOutput size={20} className="text-slate-600 dark:text-slate-400" />
          </div>
          <h2 className="text-base font-semibold text-navy-900 dark:text-white">
            {t('reports.entry.managementTitle', 'Management Reports')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('reports.entry.managementDesc', 'Internal PMO reporting')}
          </p>
          <span className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:underline">
            {t('reports.entry.openManagement', 'Open Management Reports')} →
          </span>
        </button>
      </div>
    </div>
  );
};
