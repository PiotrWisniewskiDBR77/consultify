/**
 * StrategicDirectionsTab - Knowledge > Strategic Directions
 * Wrapper for AdminKnowledgeView strategies tab
 */

import { Edit2, Plus, Power, RefreshCw, Target, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';

import { LoadingState } from '../../../../components/ui/primitives';
import { Api } from '../../../../services/api';

interface Strategy {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  priority?: 'low' | 'medium' | 'high';
  target_date?: string;
  progress_percentage?: number;
  success_metrics?: string[];
  related_document_ids?: string[];
  related_idea_ids?: string[];
}

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean'
    ? value
    : value === undefined || value === null
      ? fallback
      : value === 1 || value === '1' || value === 'true';

const normalizeStrategies = (value: unknown): Strategy[] => {
  if (!hasListShape(value, ['strategies', 'items'])) {
    throw new Error('Strategic directions response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['strategies', 'items'])
    .map((strategy) => {
      const priority: Strategy['priority'] =
        strategy.priority === 'low' ||
        strategy.priority === 'medium' ||
        strategy.priority === 'high'
          ? strategy.priority
          : 'medium';

      return {
        id: asText(strategy.id, ''),
        title: asText(strategy.title, 'Untitled strategy'),
        description: asText(strategy.description, ''),
        is_active: toBool(strategy.is_active, false),
        priority,
        target_date:
          strategy.target_date === null || strategy.target_date === undefined
            ? undefined
            : asText(strategy.target_date, ''),
        progress_percentage: Number.isFinite(Number(strategy.progress_percentage))
          ? Number(strategy.progress_percentage)
          : 0,
        success_metrics: Array.isArray(strategy.success_metrics)
          ? strategy.success_metrics.map((item) => asText(item, '')).filter(Boolean)
          : [],
        related_document_ids: Array.isArray(strategy.related_document_ids)
          ? strategy.related_document_ids.map((item) => asText(item, '')).filter(Boolean)
          : [],
        related_idea_ids: Array.isArray(strategy.related_idea_ids)
          ? strategy.related_idea_ids.map((item) => asText(item, '')).filter(Boolean)
          : [],
      };
    })
    .filter((strategy) => strategy.id);
};

const getStrategyId = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) return '';
  return (
    asText(payload.id, '') || (isRecord(payload.strategy) ? asText(payload.strategy.id, '') : '')
  );
};

export const StrategicDirectionsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [strategyForm, setStrategyForm] = useState({
    title: '',
    description: '',
    success_metrics: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high',
    target_date: '',
    progress_percentage: 0,
  });

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading !== false) setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getAllGlobalStrategies();
      const nextStrategies = normalizeStrategies(data);
      setStrategies(nextStrategies);
      return nextStrategies;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load strategies';
      setLoadError(message);
      setStrategies([]);
      toast.error(message);
      return null;
    } finally {
      if (options.showLoading !== false) setLoading(false);
    }
  };

  const handleToggleStrategy = async (id: string, currentStatus: boolean) => {
    try {
      setActionError(null);
      await Api.toggleGlobalStrategy(id, !currentStatus);
      const refreshed = await loadStrategies({ showLoading: false });
      const strategy = refreshed?.find((item) => item.id === id);
      if (!strategy || strategy.is_active !== !currentStatus) {
        throw new Error('Strategy update was not confirmed by the server');
      }
      toast.success('Strategy updated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      setActionError(message);
      toast.error(message);
    }
  };

  const handleAddStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const result = await Api.createGlobalStrategy(strategyForm.title, strategyForm.description, {
        success_metrics: strategyForm.success_metrics,
        priority: strategyForm.priority,
        target_date: strategyForm.target_date || undefined,
        progress_percentage: strategyForm.progress_percentage,
      });
      const createdId = getStrategyId(result);
      const refreshed = await loadStrategies({ showLoading: false });
      const confirmed = refreshed?.some((strategy) =>
        createdId ? strategy.id === createdId : strategy.title === strategyForm.title
      );
      if (!confirmed) {
        throw new Error('Strategy create was not confirmed by the server');
      }
      toast.success('Strategy added');
      setShowModal(false);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add strategy';
      setActionError(message);
      toast.error(message);
    }
  };

  const handleUpdateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStrategy) return;
    try {
      setActionError(null);
      await Api.updateGlobalStrategy(editingStrategy.id, strategyForm);
      const refreshed = await loadStrategies({ showLoading: false });
      const confirmed = refreshed?.some(
        (strategy) =>
          strategy.id === editingStrategy.id &&
          strategy.title === strategyForm.title &&
          strategy.description === strategyForm.description
      );
      if (!confirmed) {
        throw new Error('Strategy update was not confirmed by the server');
      }
      toast.success('Strategy updated');
      setEditingStrategy(null);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update strategy';
      setActionError(message);
      toast.error(message);
    }
  };

  const resetForm = () => {
    setStrategyForm({
      title: '',
      description: '',
      success_metrics: [],
      priority: 'medium',
      target_date: '',
      progress_percentage: 0,
    });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-danger-100 text-danger-700';
      case 'medium':
        return 'bg-amber-100 text-amber-700';
      case 'low':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-navy-900/60 dark:text-slate-300';
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <DegradedState title="Strategic directions unavailable" description={loadError} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target size={24} className="text-indigo-500" />
            Strategic Directions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Define strategic goals that guide AI behavior and recommendations
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          Add Strategic Direction
        </button>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
        >
          {actionError}
        </div>
      ) : null}

      {/* Strategies Grid */}
      {strategies.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
          <Target size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No Strategic Directions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Add strategic directions to guide AI behavior
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            Add First Direction
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {strategies.map((s) => (
            <div
              key={s.id}
              className={`bg-white dark:bg-navy-800 border dark:border-navy-700 rounded-xl p-6 transition-colors ${
                s.is_active
                  ? 'border-indigo-200 ring-1 ring-indigo-200 dark:border-indigo-500/40 dark:ring-indigo-500/30'
                  : 'border-slate-200 dark:border-navy-700'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-navy-900/60">
                  <Target
                    className={s.is_active ? 'text-indigo-500' : 'text-slate-600'}
                    size={24}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingStrategy(s);
                      setStrategyForm({
                        title: s.title,
                        description: s.description || '',
                        success_metrics: s.success_metrics || [],
                        priority: s.priority || 'medium',
                        target_date: s.target_date || '',
                        progress_percentage: s.progress_percentage || 0,
                      });
                    }}
                    className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleStrategy(s.id, !!s.is_active)}
                    className={`p-2 rounded-lg transition-colors ${
                      s.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-danger-100 hover:text-danger-700 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-danger-500/15 dark:hover:text-danger-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-navy-900/60 dark:text-slate-300 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300'
                    }`}
                    title={s.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <Power size={18} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
                  {s.priority && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${getPriorityColor(s.priority)}`}
                    >
                      {s.priority}
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  {s.description}
                </p>
                {s.target_date && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Target: {new Date(s.target_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Progress</span>
                  <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                    {s.progress_percentage || 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-navy-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${s.progress_percentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Success Metrics */}
              {s.success_metrics && s.success_metrics.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Success Metrics:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {s.success_metrics.map((metric, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 rounded"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-navy-700 text-xs text-slate-500 dark:text-slate-400 text-right">
                {s.is_active ? 'Active Direction' : 'Inactive'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showModal || editingStrategy) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingStrategy ? 'Edit Strategic Direction' : 'New Strategic Direction'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingStrategy(null);
                  resetForm();
                }}
                className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={editingStrategy ? handleUpdateStrategy : handleAddStrategy}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Strategy Title
                </label>
                <input
                  required
                  autoFocus
                  value={strategyForm.title}
                  onChange={(e) => setStrategyForm({ ...strategyForm, title: e.target.value })}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g., Digital First"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  required
                  rows={4}
                  value={strategyForm.description}
                  onChange={(e) =>
                    setStrategyForm({ ...strategyForm, description: e.target.value })
                  }
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 outline-none"
                  placeholder="Explain how the AI should behave or what it should prioritize..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={strategyForm.priority}
                    onChange={(e) =>
                      setStrategyForm({
                        ...strategyForm,
                        priority: e.target.value as 'low' | 'medium' | 'high',
                      })
                    }
                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={strategyForm.target_date}
                    onChange={(e) =>
                      setStrategyForm({ ...strategyForm, target_date: e.target.value })
                    }
                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Success Metrics (one per line)
                </label>
                <textarea
                  rows={3}
                  value={strategyForm.success_metrics.join('\n')}
                  onChange={(e) =>
                    setStrategyForm({
                      ...strategyForm,
                      success_metrics: e.target.value.split('\n').filter((m) => m.trim()),
                    })
                  }
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  placeholder="Metric 1&#10;Metric 2&#10;Metric 3"
                />
              </div>
              {editingStrategy && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Progress (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={strategyForm.progress_percentage}
                    onChange={(e) =>
                      setStrategyForm({
                        ...strategyForm,
                        progress_percentage: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingStrategy(null);
                    resetForm();
                  }}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 dark:bg-navy-900 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-navy-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg"
                >
                  {editingStrategy ? 'Update Strategy' : 'Add Strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategicDirectionsTab;
