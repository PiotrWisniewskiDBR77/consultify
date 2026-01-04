/**
 * PersonalAnalyticsModule - Personal Analytics & Reports
 *
 * Features:
 * - Personal productivity analytics
 * - Time tracking reports
 * - Task completion statistics
 * - Activity heatmap
 * - Custom reports builder
 */

import {
    ArrowDown,
    ArrowUp,
    BarChart3,
    Calendar,
    CheckCircle,
    Clock,
    Download,
    Filter,
    Loader2,
    Target,
    TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

interface PersonalAnalyticsModuleProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface ProductivityStats {
    tasksCompleted: number;
    tasksCompletedChange: number;
    hoursLogged: number;
    hoursLoggedChange: number;
    productivityScore: number;
    productivityChange: number;
    focusTime: number;
    focusTimeChange: number;
}

interface DailyActivity {
    date: string;
    tasks: number;
    hours: number;
    score: number;
}

export const PersonalAnalyticsModule: React.FC<PersonalAnalyticsModuleProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('week');
    const [stats, setStats] = useState<ProductivityStats | null>(null);
    const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);

    useEffect(() => {
        loadData();
    }, [currentUser.id, timeRange]);

    const loadData = async () => {
        try {
            setLoading(true);
            // Mock data
            setStats({
                tasksCompleted: 45,
                tasksCompletedChange: 12,
                hoursLogged: 38.5,
                hoursLoggedChange: -5,
                productivityScore: 87,
                productivityChange: 8,
                focusTime: 24,
                focusTimeChange: 15,
            });

            // Generate mock activity data
            const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : timeRange === 'quarter' ? 90 : 365;
            const activity: DailyActivity[] = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                activity.push({
                    date: date.toISOString(),
                    tasks: Math.floor(Math.random() * 10),
                    hours: Math.random() * 8,
                    score: Math.floor(Math.random() * 40) + 60,
                });
            }
            setDailyActivity(activity.reverse());
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard: React.FC<{
        label: string;
        value: string | number;
        change: number;
        icon: React.ElementType;
        color: string;
    }> = ({ label, value, change, icon: Icon, color }) => (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon size={24} className="text-white" />
                </div>
                <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    {Math.abs(change)}%
                </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
        </div>
    );

    const ActivityHeatmap: React.FC<{ data: DailyActivity[] }> = ({ data }) => {
        const weeks: DailyActivity[][] = [];
        let currentWeek: DailyActivity[] = [];

        data.forEach((day, i) => {
            currentWeek.push(day);
            if (currentWeek.length === 7 || i === data.length - 1) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });

        const getColor = (score: number) => {
            if (score >= 90) return 'bg-emerald-500';
            if (score >= 80) return 'bg-emerald-400';
            if (score >= 70) return 'bg-emerald-300';
            if (score >= 60) return 'bg-emerald-200';
            return 'bg-slate-100 dark:bg-slate-700';
        };

        return (
            <div className="flex gap-1">
                {weeks.slice(-12).map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                        {week.map((day, di) => (
                            <div
                                key={di}
                                className={`w-4 h-4 rounded-sm ${getColor(day.score)}`}
                                title={`${new Date(day.date).toLocaleDateString()}: ${day.tasks} tasks, Score: ${day.score}`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-personal-analytics" position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BarChart3 size={28} className="text-blue-500" />
                        Personal Analytics
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Track your productivity and performance
                    </p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                    >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="quarter">This Quarter</option>
                        <option value="year">This Year</option>
                    </select>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                        <Download size={16} />
                        Export
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Tasks Completed"
                        value={stats.tasksCompleted}
                        change={stats.tasksCompletedChange}
                        icon={CheckCircle}
                        color="bg-emerald-500"
                    />
                    <StatCard
                        label="Hours Logged"
                        value={`${stats.hoursLogged}h`}
                        change={stats.hoursLoggedChange}
                        icon={Clock}
                        color="bg-blue-500"
                    />
                    <StatCard
                        label="Productivity Score"
                        value={`${stats.productivityScore}%`}
                        change={stats.productivityChange}
                        icon={TrendingUp}
                        color="bg-purple-500"
                    />
                    <StatCard
                        label="Focus Time"
                        value={`${stats.focusTime}h`}
                        change={stats.focusTimeChange}
                        icon={Target}
                        color="bg-amber-500"
                    />
                </div>
            )}

            {/* Activity Heatmap */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-emerald-500" />
                    Activity Heatmap
                </h3>
                <div className="overflow-x-auto">
                    <ActivityHeatmap data={dailyActivity} />
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                    <span>Less</span>
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-700" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-200" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-300" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                    </div>
                    <span>More</span>
                </div>
            </div>

            {/* Weekly Breakdown */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Daily Breakdown</h3>
                <div className="space-y-3">
                    {dailyActivity.slice(-7).map((day, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <span className="text-sm text-slate-500 w-24">
                                {new Date(day.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </span>
                            <div className="flex-1 h-4 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${(day.hours / 8) * 100}%` }}
                                />
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400 w-16 text-right">
                                {day.hours.toFixed(1)}h
                            </span>
                            <span className="text-sm text-slate-600 dark:text-slate-400 w-16 text-right">
                                {day.tasks} tasks
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Goals Progress */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target size={20} className="text-amber-500" />
                    Weekly Goals
                </h3>
                <div className="space-y-4">
                    {[
                        { label: 'Complete 50 tasks', current: 45, target: 50 },
                        { label: 'Log 40 hours', current: 38.5, target: 40 },
                        { label: 'Maintain 85% productivity', current: 87, target: 85 },
                    ].map((goal, i) => (
                        <div key={i}>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-600 dark:text-slate-400">{goal.label}</span>
                                <span
                                    className={
                                        goal.current >= goal.target
                                            ? 'text-green-600'
                                            : 'text-slate-900 dark:text-white'
                                    }
                                >
                                    {goal.current} / {goal.target}
                                </span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${
                                        goal.current >= goal.target ? 'bg-green-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min((goal.current / goal.target) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PersonalAnalyticsModule;
