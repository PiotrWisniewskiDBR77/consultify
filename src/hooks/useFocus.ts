import { useCallback, useEffect, useState } from 'react';

import { Api } from '../services/api';

interface FocusTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  completed: boolean;
  order: number;
}

interface FocusBoard {
  id: string;
  date: string;
  tasks: FocusTask[];
  maxTasks: number;
}

interface FocusSuggestions {
  suggestedTasks: string[];
  reasoning: string;
}

interface UseFocusOptions {
  autoLoad?: boolean;
  date?: Date;
}

export const useFocus = (options: UseFocusOptions = {}) => {
  const { autoLoad = true } = options;
  const [board, setBoard] = useState<FocusBoard | null>(null);
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [suggestions, setSuggestions] = useState<FocusSuggestions | null>(null);
  const [date, setDate] = useState<Date>(options.date || new Date());

  const loadFocus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await Api.get('/api/focus/board');
      const data = response as { board: FocusBoard | null; tasks: FocusTask[] };
      setBoard(data.board);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load focus board'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadFocus();
    }
  }, [autoLoad, loadFocus]);

  const addToFocus = useCallback(
    async (taskId: string) => {
      try {
        await Api.post(`/api/focus/tasks/${taskId}`, {});
        await loadFocus();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to add task'));
      }
    },
    [loadFocus]
  );

  const removeFromFocus = useCallback(async (taskId: string) => {
    try {
      await Api.post(`/api/focus/tasks/${taskId}/remove`, {});
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to remove task'));
    }
  }, []);

  const reorderTasks = useCallback(async (taskIds: string[]) => {
    try {
      await Api.post('/api/focus/reorder', { taskIds });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reorder'));
    }
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
    try {
      await Api.post(`/api/focus/tasks/${taskId}/complete`, {});
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to complete task'));
    }
  }, []);

  const requestAISuggestions = useCallback(async () => {
    try {
      const response = await Api.post('/api/focus/suggestions', {});
      setSuggestions(response as FocusSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get suggestions'));
    }
  }, []);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const executionScore = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const canAddMore = totalCount < (board?.maxTasks ?? 5);

  return {
    board,
    tasks,
    loading,
    error,
    suggestions,
    completedCount,
    totalCount,
    executionScore,
    canAddMore,
    loadFocus,
    addToFocus,
    removeFromFocus,
    reorderTasks,
    completeTask,
    requestAISuggestions,
    setDate,
  };
};

export default useFocus;
