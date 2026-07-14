import {
  ArrowRight,
  Building2,
  ChevronRight,
  Circle,
  Edit,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Card } from '../components/shared/Card';
import { InfoButton } from '../../../components/shared/InfoButton';
import { LoadingState } from '../../../components/ui/primitives';
import Api from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

interface LifecycleStage {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  color: string;
  is_active: boolean;
  organization_count?: number;
}

interface LifecycleTransition {
  id: string;
  organization_id: string;
  organization_name?: string;
  from_stage_id?: string;
  from_stage_name?: string;
  to_stage_id: string;
  to_stage_name?: string;
  transitioned_at: string;
  transitioned_by_email?: string;
  notes?: string;
}

interface LifecycleStats {
  stageStats: { stage_id: string; stage_name: string; color: string; count: number }[];
  totalTransitions: number;
}

const STAGE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#F43F5E', // Red
  '#6366F1', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Cyan
  '#6B7280', // Gray
];

type LifecycleData = {
  stages: LifecycleStage[];
  transitions: LifecycleTransition[];
  stats: LifecycleStats;
};

const DEFAULT_STATS: LifecycleStats = {
  stageStats: [],
  totalTransitions: 0,
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: unknown) => value === true || value === 'true' || value === 1;

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

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const normalizeStage = (stage: LifecycleStage): LifecycleStage => ({
  ...stage,
  is_active: toBool(stage.is_active),
  order_index: safeNumber(stage.order_index),
  organization_count: safeNumber(stage.organization_count),
});

const normalizeStats = (value: unknown): LifecycleStats => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) return DEFAULT_STATS;
  const rawStageStats = Array.isArray(payload.stageStats) ? payload.stageStats : [];
  return {
    stageStats: rawStageStats.filter(isRecord).map((stage) => ({
      stage_id: String(stage.stage_id || ''),
      stage_name: String(stage.stage_name || ''),
      color: String(stage.color || STAGE_COLORS[0]),
      count: safeNumber(stage.count),
    })),
    totalTransitions: safeNumber(payload.totalTransitions),
  };
};

const getCreatedStageId = (value: unknown) => {
  if (!isRecord(value)) return '';
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const stage = isRecord(value.stage) ? value.stage : null;
  return String(
    value.id ||
      stage?.id ||
      data?.id ||
      (isRecord(data?.stage) ? data.stage.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.stage) ? nestedData.stage.id : '') ||
      ''
  );
};

const CustomerLifecycleView: React.FC = () => {
  const [stages, setStages] = useState<LifecycleStage[]>([]);
  const [transitions, setTransitions] = useState<LifecycleTransition[]>([]);
  const [stats, setStats] = useState<LifecycleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [editingStage, setEditingStage] = useState<LifecycleStage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newStage, setNewStage] = useState({
    name: '',
    description: '',
    orderIndex: 0,
    color: STAGE_COLORS[0],
  });

  const [newTransition, setNewTransition] = useState({
    organizationId: '',
    fromStageId: '',
    toStageId: '',
    notes: '',
  });

  const fetchData = useCallback(async (): Promise<LifecycleData | null> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [stagesData, transitionsData, statsData] = await Promise.all([
        Api.getLifecycleStages(),
        Api.getLifecycleTransitions(),
        Api.getLifecycleStats(),
      ]);
      if (
        !hasListShape(stagesData, ['stages', 'items']) ||
        !hasListShape(transitionsData, ['transitions', 'items'])
      ) {
        throw new Error('Lifecycle response was missing list data');
      }
      const nextStages = getListPayload<LifecycleStage>(stagesData, ['stages', 'items']).map(
        normalizeStage
      );
      const nextTransitions = getListPayload<LifecycleTransition>(transitionsData, [
        'transitions',
        'items',
      ]);
      const nextStats = normalizeStats(statsData);
      setStages(nextStages);
      setTransitions(nextTransitions);
      setStats(nextStats);
      return { stages: nextStages, transitions: nextTransitions, stats: nextStats };
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch lifecycle data');
      setStages([]);
      setTransitions([]);
      setStats(null);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreateStage = async () => {
    if (!newStage.name.trim()) {
      toast.error('Stage name is required');
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      const expectedName = newStage.name.trim();
      const result = await Api.createLifecycleStage({
        ...newStage,
        name: expectedName,
        orderIndex: stages.length,
      });
      const createdId = getCreatedStageId(result);
      const refreshed = await fetchData();
      if (
        !refreshed?.stages.some(
          (stage) => (createdId && stage.id === createdId) || stage.name === expectedName
        )
      ) {
        throw new Error('Lifecycle stage creation was not confirmed by the server');
      }
      toast.success('Lifecycle stage created');
      setShowCreateModal(false);
      setNewStage({ name: '', description: '', orderIndex: 0, color: STAGE_COLORS[0] });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to create stage');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!editingStage) return;
    if (!editingStage.name.trim()) {
      toast.error('Stage name is required');
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      const expectedName = editingStage.name.trim();
      await Api.updateLifecycleStage(editingStage.id, {
        name: expectedName,
        description: editingStage.description,
        orderIndex: editingStage.order_index,
        color: editingStage.color,
        isActive: editingStage.is_active,
      });
      const refreshed = await fetchData();
      if (
        !refreshed?.stages.some(
          (stage) => stage.id === editingStage.id && stage.name === expectedName
        )
      ) {
        throw new Error('Lifecycle stage update was not confirmed by the server');
      }
      toast.success('Lifecycle stage updated');
      setEditingStage(null);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to update stage');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;

    try {
      setIsSaving(true);
      setActionError(null);
      await Api.deleteLifecycleStage(stageId);
      const refreshed = await fetchData();
      if (!refreshed || refreshed.stages.some((stage) => stage.id === stageId)) {
        throw new Error('Lifecycle stage deletion was not confirmed by the server');
      }
      toast.success('Lifecycle stage deleted');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete stage');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransition = async () => {
    if (!newTransition.organizationId.trim() || !newTransition.toStageId) {
      toast.error('Organization and target stage are required');
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      const expectedOrgId = newTransition.organizationId.trim();
      const expectedStageId = newTransition.toStageId;
      await Api.transitionOrganizationLifecycle({
        ...newTransition,
        organizationId: expectedOrgId,
      });
      const refreshed = await fetchData();
      if (
        !refreshed?.transitions.some(
          (transition) =>
            transition.organization_id === expectedOrgId &&
            transition.to_stage_id === expectedStageId
        )
      ) {
        throw new Error('Organization lifecycle transition was not confirmed by the server');
      }
      toast.success('Organization transitioned');
      setShowTransitionModal(false);
      setNewTransition({ organizationId: '', fromStageId: '', toStageId: '', notes: '' });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to transition organization');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
  };

  if (isLoading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Customer Lifecycle
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Track and manage customer journey stages
            </p>
          </div>
          <InfoButton cardId="superadmin-lifecycle" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTransitionModal(true)}
            disabled={Boolean(loadError)}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-c-text px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            Transition Customer
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={Boolean(loadError)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Stage
          </button>
        </div>
      </div>

      {loadError && (
        <DegradedState title="Customer lifecycle unavailable" description={loadError} />
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {loadError ? null : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Circle className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stages.length}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Lifecycle Stages
                  </span>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Building2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats?.stageStats?.reduce((sum, s) => sum + safeNumber(s.count), 0) || 0}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Total Organizations
                  </span>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/20 rounded-lg">
                  <ArrowRight className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats?.totalTransitions || 0}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Total Transitions
                  </span>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {transitions.length}
                  </p>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Recent Transitions
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Lifecycle Pipeline */}
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Lifecycle Pipeline
            </h3>
            {stages.length === 0 ? (
              <div className="text-center py-12">
                <Circle className="w-16 h-16 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  No lifecycle stages defined
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Create your first stage
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-4">
                {stages
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((stage, index) => {
                    const stageStats = stats?.stageStats?.find((s) => s.stage_id === stage.id);
                    return (
                      <React.Fragment key={stage.id}>
                        <div
                          className="flex-shrink-0 w-48 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-4 relative group"
                          style={{ borderTop: `3px solid ${stage.color}` }}
                        >
                          {/* Stage Header */}
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-slate-900 dark:text-white font-medium truncate">
                              {stage.name}
                            </h4>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingStage(stage)}
                                aria-label={`Edit lifecycle stage ${stage.id}`}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded"
                              >
                                <Edit className="w-3 h-3 text-slate-500 dark:text-slate-300" />
                              </button>
                              <button
                                onClick={() => handleDeleteStage(stage.id)}
                                aria-label={`Delete lifecycle stage ${stage.id}`}
                                className="p-1 hover:bg-danger-600/20 rounded"
                              >
                                <Trash2 className="w-3 h-3 text-danger-400" />
                              </button>
                            </div>
                          </div>

                          {/* Stage Stats */}
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                              {stageStats?.count || 0}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            organizations
                          </p>

                          {/* Color indicator */}
                          <div
                            className="absolute bottom-2 right-2 w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                        </div>

                        {/* Arrow between stages */}
                        {index < stages.length - 1 && (
                          <ChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>
            )}
          </Card>

          {/* Recent Transitions */}
          <Card padding="sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Recent Transitions
            </h3>
            {transitions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                No transitions recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {transitions.slice(0, 10).map((transition) => (
                  <div
                    key={transition.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Building2 className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-slate-900 dark:text-white font-medium">
                          {transition.organization_name || 'Unknown Organization'}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <span>{transition.from_stage_name || 'New'}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="text-blue-400">{transition.to_stage_name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {formatDate(transition.transitioned_at)}
                      </p>
                      {transition.transitioned_by_email && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          by {transition.transitioned_by_email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Create Stage Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-navy-700">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Create Lifecycle Stage
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Stage Name
                    </label>
                    <input
                      type="text"
                      value={newStage.name}
                      onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                      placeholder="e.g., Trial, Onboarding, Active"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newStage.description}
                      onChange={(e) => setNewStage({ ...newStage, description: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Color
                    </label>
                    <div className="flex gap-2">
                      {STAGE_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewStage({ ...newStage, color })}
                          className={`w-8 h-8 rounded-lg transition-transform ${
                            newStage.color === color ? 'ring-2 ring-white scale-110' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateStage}
                    disabled={!newStage.name.trim() || isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Creating...' : 'Create Stage'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Stage Modal */}
          {editingStage && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-navy-700">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Edit Stage
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Stage Name
                    </label>
                    <input
                      type="text"
                      value={editingStage.name}
                      onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editingStage.description || ''}
                      onChange={(e) =>
                        setEditingStage({ ...editingStage, description: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-c-text"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Color</label>
                    <div className="flex gap-2">
                      {STAGE_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditingStage({ ...editingStage, color })}
                          className={`w-8 h-8 rounded-lg transition-transform ${
                            editingStage.color === color ? 'ring-2 ring-white scale-110' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="stage-active"
                      checked={editingStage.is_active}
                      onChange={(e) =>
                        setEditingStage({ ...editingStage, is_active: e.target.checked })
                      }
                      className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                    />
                    <label htmlFor="stage-active" className="text-sm text-gray-600">
                      Active
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEditingStage(null)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-c-text rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateStage}
                    disabled={isSaving || !editingStage.name.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transition Modal */}
          {showTransitionModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold text-c-text mb-4">Transition Customer</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Organization ID
                    </label>
                    <input
                      type="text"
                      value={newTransition.organizationId}
                      onChange={(e) =>
                        setNewTransition({ ...newTransition, organizationId: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-c-text"
                      placeholder="Organization ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      From Stage (optional)
                    </label>
                    <select
                      value={newTransition.fromStageId}
                      onChange={(e) =>
                        setNewTransition({ ...newTransition, fromStageId: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-c-text"
                    >
                      <option value="">-- Current Stage --</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">To Stage</label>
                    <select
                      value={newTransition.toStageId}
                      onChange={(e) =>
                        setNewTransition({ ...newTransition, toStageId: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-c-text"
                    >
                      <option value="">-- Select Stage --</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
                    <textarea
                      value={newTransition.notes}
                      onChange={(e) =>
                        setNewTransition({ ...newTransition, notes: e.target.value })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-c-text"
                      rows={2}
                      placeholder="Optional notes about this transition"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowTransitionModal(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-c-text rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransition}
                    disabled={
                      !newTransition.organizationId.trim() || !newTransition.toStageId || isSaving
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Transitioning...' : 'Transition'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerLifecycleView;
