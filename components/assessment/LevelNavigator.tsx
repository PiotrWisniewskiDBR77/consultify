import React from 'react';
import { Check, Circle } from 'lucide-react';
import { MaturityLevel } from '../../types';
import { useTranslation } from 'react-i18next';
import { getStatusBadgeClasses } from '../../utils/assessmentColors';

interface LevelNavigatorProps {
    levels: Record<string, string>;
    currentLevel: number;
    onSelectLevel: (level: number) => void;
    actualScore?: number;
    targetScore?: number;
}

export const LevelNavigator: React.FC<LevelNavigatorProps> = ({
    levels,
    currentLevel,
    onSelectLevel,
    actualScore,
    targetScore
}) => {
    const { t } = useTranslation();
    const ts = t('assessment.workspace', { returnObjects: true }) as any;

    // Ensure we have levels 1-7
    const levelKeys = ['1', '2', '3', '4', '5', '6', '7'];

    return (
        <div className="w-80 bg-white dark:bg-navy-950 border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-200 dark:border-white/5">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('assessment.workspace.maturityLevels')}</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t('assessment.workspace.levelDetailsHint')}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {levelKeys.map((key) => {
                    const levelNum = parseInt(key, 10);
                    const isActive = currentLevel === levelNum;

                    // BITMASK LOGIC for Independent Checkboxes
                    // actualScore and targetScore are now treated as Bitmasks (integers).
                    // Level 1 = 1, Level 2 = 2, Level 3 = 4, Level 4 = 8, ...
                    // To check if Level N is set: (score & (1 << (N - 1))) !== 0

                    const actualMask = actualScore || 0;
                    const targetMask = targetScore || 0;

                    const isActual = (actualMask & (1 << (levelNum - 1))) !== 0;
                    const isTarget = (targetMask & (1 << (levelNum - 1))) !== 0;

                    // Label helper
                    let statusLabel = null;
                    if (isActual && isTarget) statusLabel = <span className="text-[10px] font-bold text-white bg-gradient-to-r from-blue-500 to-purple-500 px-2 py-0.5 rounded-full">{t('assessment.workspace.actual_target')}</span>;
                    else if (isActual) statusLabel = <span className={getStatusBadgeClasses('actual')}>{t('assessment.workspace.actual_only')}</span>;
                    else if (isTarget) statusLabel = <span className={getStatusBadgeClasses('target')}>{t('assessment.workspace.target_only')}</span>;

                    return (
                        <button
                            key={key}
                            onClick={() => onSelectLevel(levelNum)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all relative group ${isActive
                                ? 'bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/20 shadow-sm dark:shadow-lg'
                                : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-bold flex items-center gap-3 ${isActive ? 'text-navy-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${isActive ? 'border-primary-200 dark:border-white/30 bg-primary-50 dark:bg-white/10 text-primary-700 dark:text-white' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {key}
                                    </span>
                                    {t('common.level')} {key}
                                </span>
                                {statusLabel}
                            </div>
                            {/* Short preview of title if available in levels prop, otherwise generic */}
                            <div className={`text-xs truncate ml-9 ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                                {levels[key] || `Level ${key} Description`}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
