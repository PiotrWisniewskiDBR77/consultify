/**
 * StrategicDirectionsTab - Knowledge > Strategic Directions
 * Wrapper for AdminKnowledgeView strategies tab
 */

import {
  Edit2,
  FileText,
  Lightbulb,
  Plus,
  Power,
  RefreshCw,
  Target,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

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

export const StrategicDirectionsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
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

  const loadStrategies = async () => {
    setLoading(true);
    try {
      const data = await Api.getAllGlobalStrategies();
      setStrategies(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStrategy = async (id: string, currentStatus: boolean) => {
    try {
      await Api.toggleGlobalStrategy(id, !currentStatus);
      toast.success('Strategy updated');
      loadStrategies();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleAddStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Api.createGlobalStrategy(strategyForm.title, strategyForm.description, {
        success_metrics: strategyForm.success_metrics,
        priority: strategyForm.priority,
        target_date: strategyForm.target_date || undefined,
        progress_percentage: strategyForm.progress_percentage,
      });
      toast.success('Strategy added');
      setShowModal(false);
      resetForm();
      loadStrategies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add strategy');
    }
  };

  const handleUpdateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStrategy) return;
    try {
      await Api.updateGlobalStrategy(editingStrategy.id, strategyForm);
      toast.success('Strategy updated');
      setEditingStrategy(null);
      resetForm();
      loadStrategies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update strategy');
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
        return 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'low':
        return 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
      default:
        return 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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

      {/* Strategies Grid */}
      {strategies.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
          <Target size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
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
              className={`bg-white dark:bg-navy-800 border rounded-xl p-6 transition-all ${
                s.is_active
                  ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'border-slate-200 dark:border-navy-700 opacity-75'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-navy-900">
                  <Target
                    className={s.is_active ? 'text-indigo-500' : 'text-slate-400'}
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
                    className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/20 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleStrategy(s.id, !!s.is_active)}
                    className={`p-2 rounded-lg transition-colors ${
                      s.is_active
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-500'
                        : 'bg-slate-100 dark:bg-navy-700 text-slate-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-500'
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
                    <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${getPriorityColor(s.priority)}`}>
                      {s.priority}
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
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
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Success Metrics:</p>
                  <div className="flex flex-wrap gap-1">
                    {s.success_metrics.map((metric, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded"
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
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
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
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
                  onChange={(e) => setStrategyForm({ ...strategyForm, description: e.target.value })}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  placeholder="Explain how the AI should behave or what it should prioritize..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
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
                    onChange={(e) => setStrategyForm({ ...strategyForm, target_date: e.target.value })}
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
                  className="flex-1 py-2 bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-navy-600"
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
