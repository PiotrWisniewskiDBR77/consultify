import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus } from 'lucide-react';
import { Api } from '../../services/api';

interface TodayDashboardProps {
    onEditTask: (id: string) => void;
    onCreateTask: () => void;
    refreshTrigger: number;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({ onEditTask, onCreateTask, refreshTrigger }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await Api.get('/my-work/dashboard');
            setData(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats Cards */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-white/5">
                    <div className="text-sm text-slate-500">Overdue</div>
                    <div className="text-2xl font-bold text-red-600">{data?.overdueCount || 0}</div>
                </div>
                <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-white/5">
                    <div className="text-sm text-slate-500">Due This Week</div>
                    <div className="text-2xl font-bold text-navy-900 dark:text-white">{data?.dueThisWeekCount || 0}</div>
                </div>
                <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-white/5">
                    <div className="text-sm text-slate-500">Blocked</div>
                    <div className="text-2xl font-bold text-amber-600">{data?.blockedCount || 0}</div>
                </div>
            </div>

            {/* Today's Focus */}
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-navy-900 dark:text-white">Today's Focus</h2>
                </div>

                {data?.todayFocus?.length > 0 ? (
                    <div className="space-y-3">
                        {data.todayFocus.map((task: any) => (
                            <div
                                key={task.id}
                                onClick={() => onEditTask(task.id)}
                                className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-white/5 hover:border-blue-500 cursor-pointer transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold text-navy-900 dark:text-white">{task.title}</div>
                                        <div className="text-xs text-slate-500 mt-1">{task.projectName || 'No Project'}</div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                        task.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {task.priority}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-navy-800 p-8 rounded-xl text-center border border-dashed border-slate-300 dark:border-white/10">
                        <div className="text-slate-400 mb-2">No tasks prioritized for today</div>
                        <button onClick={onCreateTask} className="text-blue-600 text-sm font-medium hover:underline">
                            Create a task to get started
                        </button>
                    </div>
                )}
            </div>

            {/* Side Panel (Quick Actions / Blocked) */}
            <div className="space-y-6">
                {/* Placeholder for future widgets */}
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Pro Tip</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        Focus on your top 3 tasks daily. Move everything else to the backlog.
                    </p>
                </div>
            </div>
        </div>
    );
};
