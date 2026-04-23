/**
 * Breadcrumb Trail Component
 * Shows current navigation path in Assessment Module
 */

import { ChevronRight, Home } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface BreadcrumbItem {
  label: string;
  viewId?: AppView;
}

export const Breadcrumb: React.FC = () => {
  const { t } = useTranslation();
  const { currentView, setCurrentView } = useAppStore();
  const hubLabel = t('licensedTools.hubTitle', 'Licensed Tools Hub');

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const crumbs: BreadcrumbItem[] = [{ label: 'Home', viewId: AppView.MY_WORK }];

    // Licensed Tools Module breadcrumbs
    if (
      currentView === AppView.ASSESSMENT_SUMMARY ||
      currentView === AppView.ASSESSMENT_DRD ||
      currentView === AppView.ASSESSMENT_AUDITS
    ) {
      crumbs.push({ label: hubLabel, viewId: AppView.ASSESSMENT_SUMMARY });

      if (currentView === AppView.ASSESSMENT_DRD) {
        crumbs.push({ label: 'DRD Assessment' });
      } else if (currentView === AppView.ASSESSMENT_AUDITS) {
        crumbs.push({ label: 'Additional Assessments' });
      }
    }

    // RapidLean
    if (currentView.toString().includes('RAPIDLEAN')) {
      crumbs.push({ label: hubLabel, viewId: AppView.ASSESSMENT_SUMMARY });
      crumbs.push({ label: 'RapidLean' });
    }

    // External Digital
    if (currentView.toString().includes('EXTERNAL')) {
      crumbs.push({ label: hubLabel, viewId: AppView.ASSESSMENT_SUMMARY });
      crumbs.push({ label: 'External Digital (SIRI/ADMA)' });
    }

    // Generic Reports
    if (currentView.toString().includes('GENERIC_REPORTS')) {
      crumbs.push({ label: hubLabel, viewId: AppView.ASSESSMENT_SUMMARY });
      crumbs.push({ label: 'Generic Reports' });
    }

    // Gap Analysis
    if (currentView.toString().includes('GAP_ANALYSIS')) {
      crumbs.push({ label: hubLabel, viewId: AppView.ASSESSMENT_SUMMARY });
      crumbs.push({ label: 'Gap Analysis' });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumb for dashboard
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300 mb-4">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight
              className="w-4 h-4 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
          )}
          {crumb.viewId ? (
            <button
              onClick={() => setCurrentView(crumb.viewId!)}
              className="text-slate-700 hover:text-primary-700 dark:text-slate-300 dark:hover:text-primary-400 transition-colors flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
            >
              {index === 0 && <Home className="w-4 h-4" />}
              {crumb.label}
            </button>
          ) : (
            <span className="text-slate-900 dark:text-white font-semibold">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
