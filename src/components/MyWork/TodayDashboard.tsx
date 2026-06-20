import { AlertCircle, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { usePMOStore } from '../../store/usePMOStore';
import { PMOStatusBanner } from '../PMO/PMOStatusBanner';
import { PersonalExecutionBar } from './PersonalExecutionBar';

interface TodayDashboardProps {
  onEditTask: (id: string) => void;
  onCreateTask: () => void;
  refreshTrigger: number;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  onEditTask,
  onCreateTask,
  refreshTrigger,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const { blockingIssues, currentPhase } = usePMOStore();

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
    return <LoadingState variant="spinner" className="p-12" />;
  }

  return (
    <div className="space-y-6">
      {/* PMO Status Banner - Phase awareness */}
      {currentPhase && <PMOStatusBanner />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">Overdue</div>
            <div className="text-2xl font-bold text-rose-600">{data?.overdueCount || 0}</div>
          </div>
          <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">Due This Week</div>
            <div className="text-2xl font-bold text-navy-900 dark:text-white">
              {data?.dueThisWeekCount || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">Blocked</div>
            <div className="text-2xl font-bold text-amber-600">{data?.blockedCount || 0}</div>
          </div>
          {/* PMO Blocking Count - New card */}
          <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <AlertCircle size={12} />
              {t('pmo.blockingProgress', 'Blocking Progress')}
            </div>
            <div
              className={`text-2xl font-bold ${blockingIssues.length > 0 ? 'text-rose-600' : 'text-green-600'}`}
            >
              {blockingIssues.length}
            </div>
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
                  className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700 hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-navy-900 dark:text-white">
                        {task.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {task.projectName || 'No Project'}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                        task.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : task.priority === 'high'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-navy-800 p-8 rounded-xl text-center border border-dashed border-slate-300 dark:border-navy-700">
              <div className="text-slate-600 dark:text-slate-500 mb-2">
                No tasks prioritized for today
              </div>
              <button
                onClick={onCreateTask}
                className="text-blue-600 text-sm font-medium hover:underline"
              >
                Create a task to get started
              </button>
            </div>
          )}
        </div>

        {/* Side Panel (Quick Actions / Blocked) */}
        <div className="space-y-6">
          {data && (
            <PersonalExecutionBar
              stats={{
                total: data.totalCount || 0,
                completed: data.completedCount || 0,
                overdue: data.overdueCount || 0,
                blocked: data.blockedCount || 0,
              }}
            />
          )}

          {/* PMO Blocking Issues Alert */}
          {blockingIssues.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/20">
              <h3 className="font-semibold text-rose-900 dark:text-rose-100 mb-2 flex items-center gap-2">
                <AlertCircle size={16} />
                {t('pmo.blockingIssues', 'Blocking Phase Progress')}
              </h3>
              <ul className="text-sm text-rose-700 dark:text-rose-300 space-y-1">
                {blockingIssues.slice(0, 3).map((issue, idx) => (
                  <li key={idx} className="truncate">
                    • {issue.title}
                  </li>
                ))}
                {blockingIssues.length > 3 && (
                  <li className="text-xs opacity-70">+{blockingIssues.length - 3} more...</li>
                )}
              </ul>
            </div>
          )}

          {/* Phase tip */}
          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {currentPhase ? `${currentPhase} Phase Tip` : 'Pro Tip'}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {currentPhase === 'Execution'
                ? 'Ensure all tasks have owners and deadlines. Focus on unblocking stalled items.'
                : 'Focus on your top 3 tasks daily. Move everything else to the backlog.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
