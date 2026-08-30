import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView, Task, TaskStatus, User } from '../../types';
import { TaskDetailModal } from '../TaskDetailModal';

interface UserTaskListProps {
  onNavigate: (view: AppView) => void;
}

export const UserTaskList: React.FC<UserTaskListProps> = ({ onNavigate }) => {
  // NOTE (React 19 + useSyncExternalStore):
  // Avoid selectors returning new objects/arrays each call (can cause update loops).
  const currentUser = useAppStore((state) => state.currentUser);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSaveTask = async (payload: Partial<Task>) => {
    if (!currentProjectId) {
      setShowModal(false);
      return;
    }

    try {
      const title = payload.title?.trim() || 'Untitled task';
      const stepPhase =
        payload.stepPhase && ['design', 'pilot', 'rollout'].includes(payload.stepPhase)
          ? (payload.stepPhase as 'design' | 'pilot' | 'rollout')
          : undefined;
      await Api.createTask({
        ...payload,
        projectId: currentProjectId,
        title,
        stepPhase,
        assigneeId: currentUser?.id,
      });
      setShowModal(false);
      fetchTasks();
    } catch (error) {
      toast.error('Failed to save task');
      setShowModal(false);
    }
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white">My Action Plan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Complete these steps to keep progress moving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Refresh"
            onClick={fetchTasks}
            className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 text-xs rounded-md bg-navy-900 text-white hover:bg-navy-800"
          >
            Add Task
          </button>
        </div>
      </div>

      {loading && <div className="mt-6 text-sm text-slate-500">Loading tasks...</div>}

      {!loading && tasks.length === 0 && (
        <div className="mt-6 text-sm text-slate-500">No pending tasks. Great job!</div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="mt-6 space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="border border-slate-200 dark:border-navy-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {task.description}
                    </p>
                  )}
                </div>
                {task.status === TaskStatus.DONE ? (
                  <span className="text-xs font-semibold text-green-600">Completed</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(AppView.FULL_STEP5_EXECUTION)}
                    className="px-3 py-1.5 text-xs rounded-md bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200"
                  >
                    Start Task
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-slate-200 dark:border-navy-700 pt-4">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white">How it works</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Focus on your next actionable steps and track progress from one place.
        </p>
      </div>

      {currentUser && (
        <TaskDetailModal
          task={{
            id: 'new-task',
            projectId: currentProjectId || '',
            title: '',
            type: 'task',
            status: 'todo',
            priority: 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          currentUser={currentUser as User}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={(task) => handleSaveTask(task)}
        />
      )}
    </div>
  );
};

export default UserTaskList;
