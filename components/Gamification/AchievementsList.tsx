import React, { useEffect, useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { ACHIEVEMENTS, Achievement } from '../../config/achievements';
import { Api } from '../../services/api';

/**
 * AchievementsList — Displays grid of user achievements
 */

export const AchievementsList: React.FC = () => {
    const [unlockedIds, setUnlockedIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchAchievements = async () => {
            try {
                const res = await Api.get('/gamification/me');
                if (res.data.success) {
                    const ids = res.data.data.achievements.map((a: any) => a.achievement_id);
                    setUnlockedIds(ids);
                }
            } catch (err) {
                console.error('Failed to fetch achievements', err);
            }
        };
        fetchAchievements();
    }, []);

    // Group by category
    const categories = Array.from(new Set(ACHIEVEMENTS.map(a => a.category)));

    return (
        <div className="space-y-8">
            {categories.map(category => {
                const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === category);

                return (
                    <div key={category}>
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                            {category}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {categoryAchievements.map(achievement => {
                                const isUnlocked = unlockedIds.includes(achievement.id);
                                const Icon = achievement.icon;

                                return (
                                    <div
                                        key={achievement.id}
                                        className={`
                                            relative p-4 rounded-xl border transition-all
                                            ${isUnlocked
                                                ? 'bg-white dark:bg-navy-800 border-green-200 dark:border-green-900/30 shadow-sm'
                                                : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-slate-800 opacity-60 grayscale'
                                            }
                                        `}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className={`
                                                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                                                    ${isUnlocked ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-slate-200 dark:bg-navy-900 text-slate-400'}
                                                `}
                                            >
                                                {isUnlocked ? <Icon size={20} /> : <Lock size={18} />}
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-bold text-navy-900 dark:text-white mb-1">
                                                    {achievement.title}
                                                </h5>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                                                    {achievement.description}
                                                </p>
                                            </div>
                                        </div>

                                        {isUnlocked && (
                                            <div className="absolute top-2 right-2 text-green-500">
                                                <CheckCircle2 size={12} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AchievementsList;
