/**
 * MyProjects - Under construction placeholder
 * Will show user's associated projects in the future
 */

import { Construction, FolderKanban, Hammer, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const MyProjects: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-900">
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FolderKanban className="text-emerald-500" size={20} />
                    <h2 className="font-semibold text-slate-800 dark:text-white">
                        {t('myWork.sections.projects', 'My Projects')}
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">
                        Coming Soon
                    </span>
                </div>
            </div>

            {/* Under Construction Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="relative mb-6">
                    {/* Background decoration */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-200 to-orange-200 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full blur-2xl opacity-50" />

                    {/* Icon */}
                    <div className="relative w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 rounded-2xl flex items-center justify-center">
                        <Construction size={48} className="text-amber-500 dark:text-amber-400" />
                    </div>

                    {/* Hammer animation */}
                    <div className="absolute -top-2 -right-2 w-10 h-10 bg-white dark:bg-navy-800 rounded-full shadow-lg flex items-center justify-center animate-bounce">
                        <Hammer size={20} className="text-orange-500" />
                    </div>
                </div>

                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">
                    {t('myWork.projects.underConstruction', 'Under Construction')}
                </h3>

                <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-6">
                    {t(
                        'myWork.projects.description',
                        "We're building something amazing! Soon you'll be able to see all your projects, track progress, and manage your portfolio from here.",
                    )}
                </p>

                {/* Feature Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg w-full">
                    {[
                        {
                            icon: FolderKanban,
                            title: t('myWork.projects.feature1', 'Project Overview'),
                            desc: t('myWork.projects.feature1Desc', 'All your projects in one place'),
                        },
                        {
                            icon: Sparkles,
                            title: t('myWork.projects.feature2', 'Progress Tracking'),
                            desc: t('myWork.projects.feature2Desc', 'Visual progress indicators'),
                        },
                        {
                            icon: Construction,
                            title: t('myWork.projects.feature3', 'Quick Actions'),
                            desc: t('myWork.projects.feature3Desc', 'Fast access to project tools'),
                        },
                    ].map((feature, index) => (
                        <div
                            key={index}
                            className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 text-center"
                        >
                            <div className="w-10 h-10 mx-auto mb-2 bg-white dark:bg-navy-800 rounded-lg flex items-center justify-center shadow-sm">
                                <feature.icon size={20} className="text-slate-400" />
                            </div>
                            <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                                {feature.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Status indicator */}
                <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    {t('myWork.projects.inProgress', 'In Development')}
                </div>
            </div>
        </div>
    );
};

export default MyProjects;

