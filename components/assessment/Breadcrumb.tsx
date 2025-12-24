/**
 * Breadcrumb Trail Component
 * Shows current navigation path in Assessment Module
 */

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface BreadcrumbItem {
    label: string;
    viewId?: AppView;
}

export const Breadcrumb: React.FC = () => {
    const { currentView, setCurrentView } = useAppStore();

    const getBreadcrumbs = (): BreadcrumbItem[] => {
        const crumbs: BreadcrumbItem[] = [
            { label: 'Home', viewId: AppView.DASHBOARD_OVERVIEW }
        ];

        // Assessment Module breadcrumbs
        if (currentView === AppView.ASSESSMENT_SUMMARY ||
            currentView === AppView.ASSESSMENT_DRD ||
            currentView === AppView.ASSESSMENT_AUDITS) {
            crumbs.push({ label: 'Assessment Hub', viewId: AppView.ASSESSMENT_SUMMARY });

            if (currentView === AppView.ASSESSMENT_DRD) {
                crumbs.push({ label: 'DRD Assessment' });
            } else if (currentView === AppView.ASSESSMENT_AUDITS) {
                crumbs.push({ label: 'Additional Assessments' });
            }
        }

        // RapidLean
        if (currentView.toString().includes('RAPIDLEAN')) {
            crumbs.push({ label: 'Assessment Hub', viewId: AppView.ASSESSMENT_SUMMARY });
            crumbs.push({ label: 'RapidLean' });
        }

        // External Digital
        if (currentView.toString().includes('EXTERNAL')) {
            crumbs.push({ label: 'Assessment Hub', viewId: AppView.ASSESSMENT_SUMMARY });
            crumbs.push({ label: 'External Digital (SIRI/ADMA)' });
        }

        // Generic Reports
        if (currentView.toString().includes('GENERIC_REPORTS')) {
            crumbs.push({ label: 'Assessment Hub', viewId: AppView.ASSESSMENT_SUMMARY });
            crumbs.push({ label: 'Generic Reports' });
        }

        // Gap Analysis
        if (currentView.toString().includes('GAP_ANALYSIS')) {
            crumbs.push({ label: 'Assessment Hub', viewId: AppView.ASSESSMENT_SUMMARY });
            crumbs.push({ label: 'Gap Analysis' });
        }

        return crumbs;
    };

    const breadcrumbs = getBreadcrumbs();

    if (breadcrumbs.length <= 1) {
        return null; // Don't show breadcrumb for dashboard
    }

    return (
        <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                    {index > 0 && (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    {crumb.viewId ? (
                        <button
                            onClick={() => setCurrentView(crumb.viewId!)}
                            className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
                        >
                            {index === 0 && <Home className="w-4 h-4" />}
                            {crumb.label}
                        </button>
                    ) : (
                        <span className="text-gray-900 dark:text-white font-medium">
                            {crumb.label}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};
