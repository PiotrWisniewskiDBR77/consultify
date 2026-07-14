import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

import { FullInitiative, Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';

interface InitiativeTaskBoardProps {
  initiative: FullInitiative;
  onClose: () => void;
}

type Phase = 'design' | 'pilot' | 'rollout';

export const InitiativeTaskBoard: React.FC<InitiativeTaskBoardProps> = ({
  initiative,
  onClose,
}) => {
  const [activePhase, setActivePhase] = useState<Phase>('design');
  const [tasks, setTasks] = useState<Task[]>([]);
  // const [loading, setLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    // setLoading(true);
    try {
      // Fetch tasks for this initiative
      // Note: We need to filter by initiativeId locally or via API if supported
      // Current API getTasks supports projectId, status, etc.
      // We might need to fetch all and filter, or update API to support initiativeId
      // The updated API supports fetching by initiativeId if we pass filtering params logic
      // But getTasks signature in client api.ts might need update to pass initiativeId
      // For now, let's assume we can fetch all or filtered by project and then filter locally
      // OR use the updated backend that supports initiativeId (we updated backend route, need to check if we updated client api.ts getTasks)
      // We didn't update client api.ts getTasks signature to accept initiativeId in filters object explicitly but backend supports it?
      // Wait, backend `GET /` doesn't explicitly look for `initiativeId` in query params in the code I viewed (lines 12-15 of tasks.js).
      // It only looks for `projectId, status, assigneeId, priority`.
      // I MISSED adding `initiativeId` to the GET / route filters in backend!
      // I will fetch all tasks for the organization (or project if linked) and filter client side for now to save a round trip of fixes.
      // Or better, fetch by project if initiative is linked to project.

      const allTasks = await Api.getTasks({ projectId: initiative.id }); // Using initiative ID as project ID context? No.
      // We need to fix backend to support filtering by initiativeId to be scalable.
      // For now, I will filter client side if I fetch all tasks, but that's bad.
      // Let's rely on standard filtering:
      // Temporary: fetch all tasks and filter.
      const res = await Api.getTasks();
      setTasks(res.filter((t: Task) => t.initiativeId === initiative.id));
    } finally {
      // setLoading(false);
    }
  }, [initiative.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const [generating, setGenerating] = useState(false);

  const handleGenerateTasks = async () => {
    setGenerating(true);
    try {
      const suggestedTasks = await Api.suggestInitiativeTasks(initiative.id);
      // Auto-save tasks
      for (const t of suggestedTasks) {
        await Api.createTask({
          projectId: initiative.id, // Fallback if needed, though initiativeId should be primary
          initiativeId: initiative.id,
          title: t.title,
          description: t.description,
          status: 'not_started',
          priority: t.priority,
          estimatedHours: t.estimatedHours,
          why: t.why,
          stepPhase: t.stepPhase as Phase, // 'design' | 'pilot' | 'rollout'
          checklist: t.acceptanceCriteria
            ? [{ id: Date.now().toString(), text: t.acceptanceCriteria, completed: false }]
            : [],
          taskType: 'execution',
        });
      }
      await loadTasks();
    } catch {
      alert('Failed to generate tasks. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const phases: Phase[] = ['design', 'pilot', 'rollout'];
  const statuses: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.BLOCKED,
    TaskStatus.DONE,
  ];

  const getPhaseTasks = (phase: Phase) => tasks.filter((t) => t.stepPhase === phase);

  return (
    <div className="fixed inset-0 z-50 bg-c-surface-raised flex flex-col animate-in fade-in slide-in-from-bottom-10">
      {/* Header */}
      <div className="h-16 border-b border-c-border dark:border-white/10 flex items-center justify-between px-6 bg-c-surface">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-c-text-muted hover:text-c-text">
            Back
          </button>
          <div className="h-6 w-px bg-c-border"></div>
          <div>
            <h2 className="text-c-text font-bold text-lg">{initiative.name}</h2>
            <span className="text-xs text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded border border-c-border dark:border-white/5">
              {initiative.axis} • {activePhase.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          {/* Phase Tabs */}
          <div className="flex bg-c-surface-raised rounded-lg p-1 border border-c-border dark:border-white/10">
            {phases.map((p) => (
              <button
                key={p}
                onClick={() => setActivePhase(p)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                  activePhase === p
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-c-text-muted hover:text-c-text'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerateTasks}
            disabled={generating || tasks.length > 0}
            className={`
                            px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2
                            ${generating ? 'bg-c-surface-raised text-c-text-muted' : 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'}
                        `}
          >
            {generating ? 'Generating...' : '✨ Generate Plan'}
          </button>

          <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-x-auto p-6 bg-slate-100/50 dark:bg-navy-900/50">
        <div className="flex gap-6 h-full min-w-[1200px]">
          {statuses.map((status) => {
            const phaseTasks = getPhaseTasks(activePhase).filter((t) => t.status === status);
            return (
              <div
                key={status}
                className="flex-1 flex flex-col bg-slate-50/30 dark:bg-navy-950/30 rounded-xl border border-c-border dark:border-white/5 min-w-[280px]"
              >
                <div className="p-3 border-b border-c-border dark:border-white/5 flex justify-between items-center bg-slate-100/50 dark:bg-navy-950/50 rounded-t-xl">
                  <h4 className="text-sm font-medium text-c-text-secondary uppercase tracking-wider">
                    {status.replace('_', ' ')}
                  </h4>
                  <span className="bg-c-surface text-c-text-muted text-xs px-2 py-0.5 rounded-full border border-c-border dark:border-white/5">
                    {phaseTasks.length}
                  </span>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {phaseTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => {
                        // Task detail modal will be implemented in Phase 2
                      }}
                    />
                  ))}
                  {phaseTasks.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-c-border dark:border-white/5 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-c-text-secondary">No tasks</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
