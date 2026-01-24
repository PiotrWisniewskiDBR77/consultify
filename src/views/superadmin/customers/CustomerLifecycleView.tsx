import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Edit,
  Loader2,
  Move,
  Plus,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/shared/InfoButton';
import Api from '../../../services/api';

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
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6B7280', // Gray
];

const CustomerLifecycleView: React.FC = () => {
  const [stages, setStages] = useState<LifecycleStage[]>([]);
  const [transitions, setTransitions] = useState<LifecycleTransition[]>([]);
  const [stats, setStats] = useState<LifecycleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [editingStage, setEditingStage] = useState<LifecycleStage | null>(null);

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stagesData, transitionsData, statsData] = await Promise.all([
        Api.getLifecycleStages(),
        Api.getLifecycleTransitions(),
        Api.getLifecycleStats(),
      ]);
      setStages(stagesData || []);
      setTransitions(transitionsData || []);
      setStats(statsData as any);
    } catch (error) {
      console.error('Failed to fetch lifecycle data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStage = async () => {
    if (!newStage.name) return;

    try {
      await Api.createLifecycleStage({
        ...newStage,
        orderIndex: stages.length,
      });
      setShowCreateModal(false);
      setNewStage({ name: '', description: '', orderIndex: 0, color: STAGE_COLORS[0] });
      fetchData();
    } catch (error) {
      console.error('Failed to create stage:', error);
    }
  };

  const handleUpdateStage = async () => {
    if (!editingStage) return;

    try {
      await Api.updateLifecycleStage(editingStage.id, {
        name: editingStage.name,
        description: editingStage.description,
        orderIndex: editingStage.order_index,
        color: editingStage.color,
        isActive: editingStage.is_active,
      });
      setEditingStage(null);
      fetchData();
    } catch (error) {
      console.error('Failed to update stage:', error);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;

    try {
      await Api.deleteLifecycleStage(stageId);
      fetchData();
    } catch (error) {
      console.error('Failed to delete stage:', error);
    }
  };

  const handleTransition = async () => {
    if (!newTransition.organizationId || !newTransition.toStageId) return;

    try {
      await Api.transitionOrganizationLifecycle(newTransition);
      setShowTransitionModal(false);
      setNewTransition({ organizationId: '', fromStageId: '', toStageId: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Failed to create transition:', error);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Customer Lifecycle</h2>
            <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
              Track and manage customer journey stages
            </p>
          </div>
          <InfoButton cardId="superadmin-lifecycle" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTransitionModal(true)}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            Transition Customer
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Stage
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Circle className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stages.length}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Lifecycle Stages
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {stats?.stageStats?.reduce((sum, s) => sum + s.count, 0) || 0}
              </p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Total Organizations
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ArrowRight className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.totalTransitions || 0}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Total Transitions
              </span>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{transitions.length}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Recent Transitions
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Lifecycle Pipeline */}
      <Card className="bg-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Lifecycle Pipeline</h3>
        {stages.length === 0 ? (
          <div className="text-center py-12">
            <Circle className="w-16 h-16 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-4">
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
                      className="flex-shrink-0 w-48 bg-gray-700/50 rounded-lg p-4 relative group"
                      style={{ borderTop: `3px solid ${stage.color}` }}
                    >
                      {/* Stage Header */}
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-medium truncate">{stage.name}</h4>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingStage(stage)}
                            className="p-1 hover:bg-gray-600 rounded"
                          >
                            <Edit className="w-3 h-3 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteStage(stage.id)}
                            className="p-1 hover:bg-red-600/20 rounded"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </div>

                      {/* Stage Stats */}
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                        <span className="text-2xl font-bold text-white">
                          {stageStats?.count || 0}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
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
      <Card className="bg-gray-800 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Transitions</h3>
        {transitions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
            No transitions recorded yet
          </p>
        ) : (
          <div className="space-y-3">
            {transitions.slice(0, 10).map((transition) => (
              <div
                key={transition.id}
                className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white font-medium">
                      {transition.organization_name || 'Unknown Organization'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">
                      <span>{transition.from_stage_name || 'New'}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="text-blue-400">{transition.to_stage_name}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                    {formatDate(transition.transitioned_at)}
                  </p>
                  {transition.transitioned_by_email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Create Lifecycle Stage</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Stage Name</label>
                <input
                  type="text"
                  value={newStage.name}
                  onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., Trial, Onboarding, Active"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={newStage.description}
                  onChange={(e) => setNewStage({ ...newStage, description: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Color</label>
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
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStage}
                disabled={!newStage.name}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Create Stage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stage Modal */}
      {editingStage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Edit Stage</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Stage Name</label>
                <input
                  type="text"
                  value={editingStage.name}
                  onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={editingStage.description || ''}
                  onChange={(e) =>
                    setEditingStage({ ...editingStage, description: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Color</label>
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
                <label htmlFor="stage-active" className="text-sm text-gray-300">
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingStage(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Transition Customer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Organization ID
                </label>
                <input
                  type="text"
                  value={newTransition.organizationId}
                  onChange={(e) =>
                    setNewTransition({ ...newTransition, organizationId: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Organization ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  From Stage (optional)
                </label>
                <select
                  value={newTransition.fromStageId}
                  onChange={(e) =>
                    setNewTransition({ ...newTransition, fromStageId: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
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
                <label className="block text-sm font-medium text-gray-300 mb-1">To Stage</label>
                <select
                  value={newTransition.toStageId}
                  onChange={(e) =>
                    setNewTransition({ ...newTransition, toStageId: e.target.value })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
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
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <textarea
                  value={newTransition.notes}
                  onChange={(e) => setNewTransition({ ...newTransition, notes: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  rows={2}
                  placeholder="Optional notes about this transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTransitionModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransition}
                disabled={!newTransition.organizationId || !newTransition.toStageId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Transition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerLifecycleView;
