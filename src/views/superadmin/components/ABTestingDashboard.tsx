/**
 * A/B Testing Dashboard Component
 *
 * Admin dashboard for managing AI A/B tests and experiments.
 * Features:
 * - Experiment management (create, start, stop, archive)
 * - Statistical significance display
 * - Variant performance comparison
 * - Winner declaration
 * - Real-time results tracking
 */

import {
  Archive,
  BarChart3,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  FlaskConical,
  Loader2,
  Pause,
  Percent,
  Play,
  Plus,
  RefreshCw,
  Save,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState, StatusChip, type StatusTone } from '@/components/ui/primitives';

import { DegradedState } from '../../../components/Admin/AdminState';
import api from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  promptId?: string;
  modelId?: string;
  traffic: number; // percentage 0-100
  participants: number;
  conversions: number;
  conversionRate: number;
  avgSatisfaction: number;
  avgLatency: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  type: 'PROMPT' | 'MODEL' | 'PARAMETER';
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  variants: ExperimentVariant[];
  targetMetric: string;
  minimumSampleSize: number;
  confidenceLevel: number;
  statisticalSignificance?: number;
  winningVariantId?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  createdBy: string;
}

interface NewExperiment {
  name: string;
  description: string;
  type: 'PROMPT' | 'MODEL' | 'PARAMETER';
  targetMetric: string;
  minimumSampleSize: number;
  confidenceLevel: number;
  variants: Array<{
    name: string;
    description: string;
    traffic: number;
  }>;
}

const EXPERIMENT_TYPES = [
  { id: 'PROMPT', name: 'Prompt Variants', icon: '📝' },
  { id: 'MODEL', name: 'Model Comparison', icon: '🤖' },
  { id: 'PARAMETER', name: 'Parameter Tuning', icon: '⚙️' },
];

const TARGET_METRICS = [
  { id: 'satisfaction', name: 'User Satisfaction' },
  { id: 'conversion', name: 'Conversion Rate' },
  { id: 'latency', name: 'Response Latency' },
  { id: 'quality', name: 'Quality Score' },
  { id: 'engagement', name: 'Engagement Rate' },
];

export function ABTestingDashboard() {
  const { t } = useTranslation();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedExperiments, setExpandedExperiments] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [newExperiment, setNewExperiment] = useState<NewExperiment>({
    name: '',
    description: '',
    type: 'PROMPT',
    targetMetric: 'satisfaction',
    minimumSampleSize: 100,
    confidenceLevel: 95,
    variants: [
      { name: 'Control', description: 'Current production version', traffic: 50 },
      { name: 'Variant A', description: 'New version to test', traffic: 50 },
    ],
  });

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await api.get(`/ai/ab-testing/experiments${params}`);
      const payload = (response as any)?.data ?? response;

      if (payload?.success) {
        // Backend returns { success, data: experiments[] }
        setExperiments(payload.data || payload.experiments || []);
      } else {
        throw new Error(payload?.error || 'Failed to fetch experiments');
      }
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch experiments');
      setError(message);
      setExperiments([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const handleCreateExperiment = async () => {
    if (!newExperiment.name) {
      toast.error('Please enter a name');
      return;
    }
    if (error) {
      toast.error('Experiments are unavailable');
      return;
    }

    const totalTraffic = newExperiment.variants.reduce((sum, v) => sum + v.traffic, 0);
    if (totalTraffic !== 100) {
      toast.error('Traffic allocation must sum to 100%');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/ai/ab-testing/experiments', newExperiment);
      const payload = (response as any)?.data ?? response;

      if (payload?.success) {
        toast.success('Experiment created');
        setShowCreateModal(false);
        setNewExperiment({
          name: '',
          description: '',
          type: 'PROMPT',
          targetMetric: 'satisfaction',
          minimumSampleSize: 100,
          confidenceLevel: 95,
          variants: [
            { name: 'Control', description: '', traffic: 50 },
            { name: 'Variant A', description: '', traffic: 50 },
          ],
        });
        await fetchExperiments();
      } else {
        throw new Error(payload?.error || 'Failed to create experiment');
      }
    } catch (err: unknown) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to create experiment'));
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (
    experimentId: string,
    action: 'start' | 'pause' | 'resume' | 'complete' | 'archive'
  ) => {
    if (error) {
      toast.error('Experiments are unavailable');
      return;
    }
    try {
      const endpointAction = action === 'complete' ? 'stop' : action;
      const response = await api.post(
        `/ai/ab-testing/experiments/${experimentId}/${endpointAction}`,
        {}
      );
      const payload = (response as any)?.data ?? response;

      if (payload?.success) {
        toast.success(`Experiment ${action}ed`);
        await fetchExperiments();
      } else {
        throw new Error(payload?.error || `Failed to ${action} experiment`);
      }
    } catch (err: unknown) {
      toast.error(normalizeApiErrorMessage(err, `Failed to ${action} experiment`));
    }
  };

  const handleDeclareWinner = async (experimentId: string, variantId: string) => {
    if (error) {
      toast.error('Experiments are unavailable');
      return;
    }
    if (!confirm('Are you sure you want to declare this variant as the winner?')) return;

    try {
      const response = await api.post(`/ai/ab-testing/experiments/${experimentId}/declare-winner`, {
        winningVariantId: variantId,
      });
      const payload = (response as any)?.data ?? response;

      if (payload?.success) {
        toast.success('Winner declared!');
        await fetchExperiments();
      } else {
        throw new Error(payload?.error || 'Failed to declare winner');
      }
    } catch (err: unknown) {
      toast.error(normalizeApiErrorMessage(err, 'Failed to declare winner'));
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedExperiments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedExperiments(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const tones: Record<string, StatusTone> = {
      DRAFT: 'neutral',
      RUNNING: 'success',
      PAUSED: 'warning',
      COMPLETED: 'info',
      ARCHIVED: 'neutral',
    };

    return <StatusChip label={status} tone={tones[status] || 'neutral'} />;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const addVariant = () => {
    setNewExperiment((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          name: `Variant ${String.fromCharCode(65 + prev.variants.length - 1)}`,
          description: '',
          traffic: 0,
        },
      ],
    }));
  };

  const removeVariant = (index: number) => {
    if (newExperiment.variants.length <= 2) return;
    setNewExperiment((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (index: number, field: string, value: string | number) => {
    setNewExperiment((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/10 rounded-xl">
              <FlaskConical size={24} className="text-primary-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">A/B Testing</h1>
              <p className="text-slate-500 dark:text-slate-400">
                Manage AI experiments and optimize performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchExperiments}
              disabled={loading || creating}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              title="Refresh experiments"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!!error}
              title={error || undefined}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              New Experiment
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          {['all', 'RUNNING', 'PAUSED', 'COMPLETED', 'DRAFT'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              disabled={!!error}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-c-text text-c-bg'
                  : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-navy-700'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>

        {/* Experiments List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-navy-800 rounded-xl">
              <LoadingState variant="spinner" className="py-20" />
            </div>
          ) : error ? (
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6">
              <DegradedState title="A/B experiments unavailable" description={error} />
            </div>
          ) : experiments.length === 0 ? (
            <div className="bg-white dark:bg-navy-800 rounded-xl">
              <EmptyState
                icon={<FlaskConical />}
                title="No experiments found"
                action={{
                  label: 'Create First Experiment',
                  onClick: () => setShowCreateModal(true),
                }}
              />
            </div>
          ) : (
            experiments.map((experiment) => (
              <div
                key={experiment.id}
                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
              >
                {/* Experiment Header */}
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  onClick={() => toggleExpanded(experiment.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className="text-slate-600 dark:text-slate-500">
                      {expandedExperiments.has(experiment.id) ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {experiment.name}
                        </h3>
                        {getStatusBadge(experiment.status)}
                        {experiment.winningVariantId && (
                          <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                            <Trophy size={14} />
                            Winner declared
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {experiment.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-slate-500 dark:text-slate-400">Variants</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {experiment.variants.length}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-slate-500 dark:text-slate-400">Participants</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {experiment.variants
                          .reduce((sum, v) => sum + v.participants, 0)
                          .toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {experiment.status === 'DRAFT' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(experiment.id, 'start');
                          }}
                          disabled={!!error}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Start"
                        >
                          <Play size={18} />
                        </button>
                      )}
                      {experiment.status === 'RUNNING' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(experiment.id, 'pause');
                          }}
                          disabled={!!error}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                          title="Pause"
                        >
                          <Pause size={18} />
                        </button>
                      )}
                      {experiment.status === 'PAUSED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(experiment.id, 'resume');
                          }}
                          disabled={!!error}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Resume"
                        >
                          <Play size={18} />
                        </button>
                      )}
                      {(experiment.status === 'RUNNING' || experiment.status === 'PAUSED') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(experiment.id, 'complete');
                          }}
                          disabled={!!error}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Complete"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedExperiments.has(experiment.id) && (
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700">
                    {/* Metadata */}
                    <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Type</p>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {EXPERIMENT_TYPES.find((t) => t.id === experiment.type)?.name ||
                            experiment.type}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Target Metric</p>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {TARGET_METRICS.find((m) => m.id === experiment.targetMetric)?.name ||
                            experiment.targetMetric}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Confidence Level</p>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {experiment.confidenceLevel}%
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">
                          Statistical Significance
                        </p>
                        <p
                          className={`font-medium ${
                            (experiment.statisticalSignificance || 0) >= experiment.confidenceLevel
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {experiment.statisticalSignificance?.toFixed(1) || '-'}%
                        </p>
                      </div>
                    </div>

                    {/* Variants Table */}
                    <div className="overflow-x-auto">
                      <table
                        /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full"
                      >
                        <thead className="bg-slate-50 dark:bg-navy-900/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                              Variant
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                              Traffic
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                              Participants
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                              Conversions
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                              Conv. Rate
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                              Avg. Satisfaction
                            </th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                          {experiment.variants.map((variant) => (
                            <tr
                              key={variant.id}
                              className={
                                experiment.winningVariantId === variant.id
                                  ? 'bg-yellow-50 dark:bg-yellow-900/10'
                                  : ''
                              }
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {experiment.winningVariantId === variant.id && (
                                    <Trophy size={16} className="text-yellow-500" />
                                  )}
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    {variant.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                {variant.traffic}%
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                {variant.participants.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                {variant.conversions.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                                {variant.conversionRate.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                {variant.avgSatisfaction.toFixed(2)}/5
                              </td>
                              <td className="px-4 py-3 text-center">
                                {(experiment.status === 'RUNNING' ||
                                  experiment.status === 'COMPLETED') &&
                                  !experiment.winningVariantId && (
                                    <button
                                      onClick={() => handleDeclareWinner(experiment.id, variant.id)}
                                      disabled={!!error}
                                      className="px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                                    >
                                      Declare Winner
                                    </button>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Experiment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                New Experiment
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={newExperiment.name}
                  onChange={(e) => setNewExperiment({ ...newExperiment, name: e.target.value })}
                  placeholder="e.g., Chat Prompt v2 Test"
                  className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newExperiment.description}
                  onChange={(e) =>
                    setNewExperiment({ ...newExperiment, description: e.target.value })
                  }
                  placeholder="Describe what you're testing..."
                  rows={2}
                  className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Type & Metric */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Experiment Type
                  </label>
                  <select
                    value={newExperiment.type}
                    onChange={(e) =>
                      setNewExperiment({ ...newExperiment, type: e.target.value as any })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {EXPERIMENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon} {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Target Metric
                  </label>
                  <select
                    value={newExperiment.targetMetric}
                    onChange={(e) =>
                      setNewExperiment({ ...newExperiment, targetMetric: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {TARGET_METRICS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Size & Confidence */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Min. Sample Size
                  </label>
                  <input
                    type="number"
                    value={newExperiment.minimumSampleSize}
                    onChange={(e) =>
                      setNewExperiment({
                        ...newExperiment,
                        minimumSampleSize: parseInt(e.target.value) || 100,
                      })
                    }
                    min={10}
                    className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Confidence Level
                  </label>
                  <select
                    value={newExperiment.confidenceLevel}
                    onChange={(e) =>
                      setNewExperiment({
                        ...newExperiment,
                        confidenceLevel: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value={90}>90%</option>
                    <option value={95}>95%</option>
                    <option value={99}>99%</option>
                  </select>
                </div>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Variants
                  </label>
                  <button
                    onClick={addVariant}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Add Variant
                  </button>
                </div>
                <div className="space-y-3">
                  {newExperiment.variants.map((variant, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-navy-900 rounded-lg"
                    >
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => updateVariant(index, 'name', e.target.value)}
                          placeholder="Name"
                          className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={variant.description}
                          onChange={(e) => updateVariant(index, 'description', e.target.value)}
                          placeholder="Description"
                          className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={variant.traffic}
                            onChange={(e) =>
                              updateVariant(index, 'traffic', parseInt(e.target.value) || 0)
                            }
                            min={0}
                            max={100}
                            className="w-20 px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
                          />
                          <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
                        </div>
                      </div>
                      {newExperiment.variants.length > 2 && (
                        <button
                          onClick={() => removeVariant(index)}
                          className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Total traffic: {newExperiment.variants.reduce((sum, v) => sum + v.traffic, 0)}%
                  {newExperiment.variants.reduce((sum, v) => sum + v.traffic, 0) !== 100 && (
                    <span className="text-danger-500 ml-2">(must be 100%)</span>
                  )}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExperiment}
                disabled={creating || !!error}
                className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Create Experiment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ABTestingDashboard;
