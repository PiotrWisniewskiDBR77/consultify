import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Target, BarChart3, LineChart } from 'lucide-react';

export const KpiOkrView: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-900">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                            <Target size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-navy-900 dark:text-white">
                                {t('kpiOkr.title', 'KPI/OKR Dashboard')}
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400">
                                {t('kpiOkr.subtitle', 'Analiza projektów w fazie realizacji')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Coming Soon Card */}
                <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    <div className="p-12 text-center">
                        {/* Icon */}
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/20 mb-6">
                            <TrendingUp size={40} className="text-purple-600 dark:text-purple-400" />
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-3">
                            {t('kpiOkr.comingSoon', 'Moduł KPI/OKR w przygotowaniu')}
                        </h2>

                        {/* Description */}
                        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
                            {t(
                                'kpiOkr.description',
                                'Tutaj będziemy analizować projekty po fazie wdrożenia w trakcie realizacji. Moduł umożliwi śledzenie kluczowych wskaźników wydajności (KPI) oraz celów i kluczowych wyników (OKR).'
                            )}
                        </p>

                        {/* Feature Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                            {/* Feature 1 */}
                            <div className="p-6 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 mb-4">
                                    <Target size={24} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="font-semibold text-navy-900 dark:text-white mb-2">
                                    {t('kpiOkr.features.objectives', 'Cele i Wyniki')}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('kpiOkr.features.objectivesDesc', 'Definiowanie i śledzenie OKR')}
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="p-6 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/20 mb-4">
                                    <BarChart3 size={24} className="text-green-600 dark:text-green-400" />
                                </div>
                                <h3 className="font-semibold text-navy-900 dark:text-white mb-2">
                                    {t('kpiOkr.features.kpis', 'Wskaźniki KPI')}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('kpiOkr.features.kpisDesc', 'Monitorowanie kluczowych metryk')}
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="p-6 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/20 mb-4">
                                    <LineChart size={24} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <h3 className="font-semibold text-navy-900 dark:text-white mb-2">
                                    {t('kpiOkr.features.trends', 'Analiza Trendów')}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {t('kpiOkr.features.trendsDesc', 'Wizualizacja postępów w czasie')}
                                </p>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium">
                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                            {t('kpiOkr.status', 'W fazie projektowania')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
