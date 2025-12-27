/**
 * Workstream Board Component
 * 
 * PMO Standards Compliant Work Package Grouping
 * 
 * Standards:
 * - ISO 21500:2021 - Work Breakdown Structure (Clause 4.4.3)
 * - PMI PMBOK 7th Edition - Work Package Grouping
 * - PRINCE2 - Work Package Cluster
 * 
 * Features:
 * - Visual workstream management
 * - Drag-and-drop initiative assignment
 * - Progress tracking
 * - Owner assignment
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Folder,
  MoreVertical,
  Edit2,
  Trash2,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Target
} from 'lucide-react';
import { Workstream, WorkstreamStatus } from '../../types';
import { api } from '../../services/api';

interface WorkstreamBoardProps {
  projectId: string;
  canManage?: boolean;
  onWorkstreamChange?: () => void;
}

const STATUS_COLORS: Record<WorkstreamStatus, string> = {
  ACTIVE: 'bg-green-500',
  ON_HOLD: 'bg-yellow-500',
  COMPLETED: 'bg-blue-500',
  CANCELLED: 'bg-gray-500'
};

const STATUS_LABELS: Record<WorkstreamStatus, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const WorkstreamBoard: React.FC<WorkstreamBoardProps> = ({
  projectId,
  canManage = false,
  onWorkstreamChange
}) => {
  const { t } = useTranslation();
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkstreams, setExpandedWorkstreams] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkstream, setEditingWorkstream] = useState<Workstream | null>(null);

  useEffect(() => {
    loadWorkstreams();
  }, [projectId]);

  const loadWorkstreams = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${projectId}/workstreams`);
      setWorkstreams(response.data.workstreams || []);
      setUnassignedCount(response.data.unassignedInitiatives || 0);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load workstreams');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (workstreamId: string) => {
    if (!confirm(t('pmo.confirmDeleteWorkstream', 'Are you sure you want to delete this workstream?'))) {
      return;
    }

    try {
      await api.delete(`/workstreams/${workstreamId}`);
      await loadWorkstreams();
      onWorkstreamChange?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete workstream');
    }
  };

  const handleStatusChange = async (workstreamId: string, newStatus: WorkstreamStatus) => {
    try {
      await api.patch(`/workstreams/${workstreamId}`, { status: newStatus });
      await loadWorkstreams();
      onWorkstreamChange?.();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const toggleExpanded = (workstreamId: string) => {
    setExpandedWorkstreams(prev => {
      const next = new Set(prev);
      if (next.has(workstreamId)) {
        next.delete(workstreamId);
      } else {
        next.add(workstreamId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Folder className="w-5 h-5" />
            {t('pmo.workstreams', 'Workstreams')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {workstreams.length} {t('pmo.workstreams', 'workstreams')} • ISO 21500 (4.4.3)
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('pmo.addWorkstream', 'Add Workstream')}
          </button>
        )}
      </div>

      {/* Unassigned warning */}
      {unassignedCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {unassignedCount} {t('pmo.unassignedInitiatives', 'initiatives are not assigned to any workstream')}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Workstream Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workstreams.map(workstream => (
          <WorkstreamCard
            key={workstream.id}
            workstream={workstream}
            expanded={expandedWorkstreams.has(workstream.id)}
            onToggle={() => toggleExpanded(workstream.id)}
            onEdit={() => setEditingWorkstream(workstream)}
            onDelete={() => handleDelete(workstream.id)}
            onStatusChange={(status) => handleStatusChange(workstream.id, status)}
            canManage={canManage}
          />
        ))}

        {workstreams.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Folder className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('pmo.noWorkstreams', 'No workstreams yet')}
            </p>
            {canManage && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('pmo.createFirstWorkstream', 'Create the first workstream')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingWorkstream) && (
        <WorkstreamModal
          projectId={projectId}
          workstream={editingWorkstream}
          onClose={() => {
            setShowCreateModal(false);
            setEditingWorkstream(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingWorkstream(null);
            loadWorkstreams();
            onWorkstreamChange?.();
          }}
        />
      )}
    </div>
  );
};

interface WorkstreamCardProps {
  workstream: Workstream;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: WorkstreamStatus) => void;
  canManage: boolean;
}

const WorkstreamCard: React.FC<WorkstreamCardProps> = ({
  workstream,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onStatusChange,
  canManage
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const progress = workstream.progress || 0;

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 overflow-hidden"
      style={{ borderLeftColor: workstream.color || '#3B82F6' }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {workstream.name}
              </h4>
            </div>

            {workstream.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">
                {workstream.description}
              </p>
            )}
          </div>

          {canManage && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="mt-3 ml-6">
          <div className="relative inline-block">
            <button
              onClick={() => canManage && setShowStatusMenu(!showStatusMenu)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[workstream.status]} text-white`}
              disabled={!canManage}
            >
              {STATUS_LABELS[workstream.status]}
              {canManage && <ChevronDown className="w-3 h-3" />}
            </button>

            {showStatusMenu && canManage && (
              <div className="absolute left-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() => {
                      setShowStatusMenu(false);
                      onStatusChange(status as WorkstreamStatus);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-4 text-center ml-6">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {workstream.initiativeCount || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Initiatives</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {workstream.completedCount || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {progress}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Progress</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 ml-6">
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: workstream.color || '#3B82F6'
              }}
            />
          </div>
        </div>

        {/* Owner */}
        {workstream.ownerName && (
          <div className="mt-3 ml-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <User className="w-3.5 h-3.5" />
            {workstream.ownerName}
          </div>
        )}
      </div>

      {/* Expanded content - initiatives list */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
          <WorkstreamInitiatives workstreamId={workstream.id} />
        </div>
      )}
    </div>
  );
};

interface WorkstreamInitiativesProps {
  workstreamId: string;
}

const WorkstreamInitiatives: React.FC<WorkstreamInitiativesProps> = ({ workstreamId }) => {
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [workstreamId]);

  const loadProgress = async () => {
    try {
      const response = await api.get(`/workstreams/${workstreamId}/progress`);
      setProgress(response.data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>;
  }

  if (!progress?.initiatives?.items?.length) {
    return (
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
        No initiatives in this workstream
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {progress.initiatives.items.slice(0, 5).map((initiative: any) => (
        <div
          key={initiative.id}
          className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {initiative.title}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${
            initiative.status === 'DONE' || initiative.status === 'COMPLETED'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : initiative.status === 'IN_PROGRESS'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {initiative.progress || 0}%
          </span>
        </div>
      ))}
      {progress.initiatives.items.length > 5 && (
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-2">
          +{progress.initiatives.items.length - 5} more
        </div>
      )}
    </div>
  );
};

interface WorkstreamModalProps {
  projectId: string;
  workstream?: Workstream | null;
  onClose: () => void;
  onSaved: () => void;
}

const WorkstreamModal: React.FC<WorkstreamModalProps> = ({
  projectId,
  workstream,
  onClose,
  onSaved
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(workstream?.name || '');
  const [description, setDescription] = useState(workstream?.description || '');
  const [color, setColor] = useState(workstream?.color || '#3B82F6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (workstream) {
        await api.patch(`/workstreams/${workstream.id}`, {
          name,
          description,
          color
        });
      } else {
        await api.post(`/projects/${projectId}/workstreams`, {
          name,
          description,
          color
        });
      }

      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save workstream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          {workstream ? t('pmo.editWorkstream', 'Edit Workstream') : t('pmo.createWorkstream', 'Create Workstream')}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pmo.name', 'Name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Digital Transformation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pmo.description', 'Description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('pmo.color', 'Color')}
            </label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkstreamBoard;



