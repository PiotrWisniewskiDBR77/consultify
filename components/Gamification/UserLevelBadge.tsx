import React, { useEffect, useState } from 'react';
import { Trophy, Star, ChevronRight } from 'lucide-react';
import { Api } from '../../services/api';

/**
 * UserLevelBadge — Displays user level and points progress
 * 
 * Used in Sidebar or Profile.
 */

interface GamificationStats {
    points: number;
    level: {
        level: number;
        name: string;
        minPoints: number;
    };
    nextLevel?: {
        level: number;
        name: string;
        minPoints: number;
    };
    progress: number;
}

export const UserLevelBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const [stats, setStats] = useState<GamificationStats | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await Api.get('/gamification/me');
                if (res.data.success) {
                    setStats(res.data.data);
                }
            } catch (err) {
                console.error('Failed to fetch gamification stats', err);
            }
        };
        fetchStats();
    }, []);

    if (!stats) return null;

    if (compact) {
        return (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold text-xs" title={`Level ${stats.level.level}: ${stats.level.name}`}>
                {stats.level.level}
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-900/30">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-navy-900 shadow-sm flex items-center justify-center text-amber-500">
                        <Trophy size={16} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-wider">
                            {stats.level.name}
                        </div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Lvl {stats.level.level} • {stats.points} pkt
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-1.5 bg-white dark:bg-navy-900 rounded-full overflow-hidden mb-1">
                <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000"
                    style={{ width: `${stats.progress}%` }}
                />
            </div>

            {stats.nextLevel && (
                <div className="flex justify-between text-[9px] text-slate-400">
                    <span>{stats.level.minPoints}</span>
                    <span>{stats.nextLevel.minPoints}</span>
                </div>
            )}
        </div>
    );
};

export default UserLevelBadge;
