import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Link2,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import type { HealthStatus, ModelKind, Purpose, PurposeAssignment, PurposeCategory } from './types';
import { HEALTH_STYLES, KIND_BADGE_STYLES, PURPOSE_CATEGORIES, PURPOSE_KIND_MAP } from './types';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

interface PurposeAssignmentsEditorProps {
  kind: ModelKind;
}

interface ProviderOption {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  healthStatus: HealthStatus;
}

function HealthIcon({ status }: { status?: HealthStatus }) {
  const s = status || 'unknown';
  switch (s) {
    case 'healthy':
      return <CheckCircle size={14} className="text-emerald-400" />;
    case 'degraded':
      return <AlertTriangle size={14} className="text-amber-400" />;
    case 'unhealthy':
      return <XCircle size={14} className="text-red-400" />;
    default:
      return <Server size={14} className="text-slate-400" />;
  }
}

export const PurposeAssignmentsEditor: React.FC<PurposeAssignmentsEditorProps> = ({ kind }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState<Purpose | null>(null);
  const [assignments, setAssignments] = useState<PurposeAssignment[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const filteredCategories = useMemo(() => {
    return PURPOSE_CATEGORIES.map((cat) => ({
      ...cat,
      purposes: cat.purposes.filter((p) => PURPOSE_KIND_MAP[p] === kind),
    })).filter((cat) => cat.purposes.length > 0);
  }, [kind]);

  useEffect(() => {
    const allLabels = new Set(filteredCategories.map((c) => c.label));
    setExpandedCategories(allLabels);
  }, [filteredCategories]);

  useEffect(() => {
    if (filteredCategories.length > 0 && !selectedPurpose) {
      setSelectedPurpose(filteredCategories[0].purposes[0]);
    }
  }, [filteredCategories, selectedPurpose]);

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (selectedPurpose) {
      loadAssignments(selectedPurpose);
    }
  }, [selectedPurpose]);

  const loadProviders = async () => {
    try {
      const res = await fetch('/api/llm/providers', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : [];
        setProviders(
          list
            .filter((p) => p.is_active === 1 || p.is_active === true)
            .map((p) => ({
              id: String(p.id || ''),
              name: String(p.name || p.model_id || ''),
              provider: String(p.provider || ''),
              modelId: String(p.model_id || ''),
              healthStatus: (p.health_status as HealthStatus) || 'unknown',
            }))
        );
      }
    } catch {
      // providers loaded from demo
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async (purpose: Purpose) => {
    try {
      const res = await fetch(`/api/llm/purposes/${encodeURIComponent(purpose)}/assignments`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const rows: any[] = Array.isArray(json?.assignments) ? json.assignments : [];
        setAssignments(
          rows.map((r) => ({
            id: String(r.id || `${r.provider_id}-${r.purpose}`),
            purpose: r.purpose || purpose,
            kind,
            modelId: String(r.provider_id || ''),
            modelName: String(r.provider_name || r.provider || ''),
            tier: r.tier || undefined,
            priority: Number(r.priority || 0),
            isActive: r.is_active !== false && r.is_active !== 0,
            fallbackModelId: r.fallback_model_id || undefined,
            healthStatus: (r.health_status as HealthStatus) || 'unknown',
          }))
        );
      } else {
        setAssignments([]);
      }
    } catch {
      setAssignments([]);
    }
  };

  const handleAddModel = async (providerId: string) => {
    if (!selectedPurpose) return;
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    const newPriority = assignments.length;
    const newAssignment: PurposeAssignment = {
      id: `${providerId}-${selectedPurpose}`,
      purpose: selectedPurpose,
      kind,
      modelId: providerId,
      modelName: provider.name,
      priority: newPriority,
      isActive: true,
      healthStatus: provider.healthStatus,
    };

    setAssignments((prev) => [...prev, newAssignment]);

    try {
      const res = await fetch(
        `/api/llm/purposes/${encodeURIComponent(selectedPurpose)}/assignments`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            providerId,
            priority: newPriority,
            is_active: true,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed');
      toast.success(`Added ${provider.name} to ${selectedPurpose}`);
      trackFunnelEvent('model_assignment_changed', { kind, purpose: selectedPurpose });
    } catch {
      setAssignments((prev) => prev.filter((a) => a.modelId !== providerId));
      toast.error('Failed to add assignment');
    }
  };

  const handleRemove = async (assignment: PurposeAssignment) => {
    if (!selectedPurpose) return;

    setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));

    try {
      const res = await fetch(
        `/api/llm/purposes/${encodeURIComponent(selectedPurpose)}/assignments`,
        {
          method: 'DELETE',
          headers: authHeaders(),
          body: JSON.stringify({ providerId: assignment.modelId }),
        }
      );
      if (!res.ok) throw new Error('Failed');
      toast.success(`Removed ${assignment.modelName}`);
    } catch {
      setAssignments((prev) => [...prev, assignment]);
      toast.error('Failed to remove assignment');
    }
  };

  const handleReorder = async (newOrder: PurposeAssignment[]) => {
    const updated = newOrder.map((item, idx) => ({ ...item, priority: idx }));
    setAssignments(updated);

    try {
      for (let i = 0; i < updated.length; i++) {
        await fetch('/api/llm/tiers/priority', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            providerId: updated[i].modelId,
            tier: selectedPurpose,
            priority: i,
          }),
        });
      }
    } catch {
      toast.error('Failed to update priorities');
    }
  };

  const handleSetFallback = (assignment: PurposeAssignment, fallbackId: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignment.id ? { ...a, fallbackModelId: fallbackId || undefined } : a
      )
    );
    toast.success('Fallback updated');
  };

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const unassignedProviders = useMemo(() => {
    const assignedIds = new Set(assignments.map((a) => a.modelId));
    return providers.filter((p) => !assignedIds.has(p.id));
  }, [providers, assignments]);

  const kindStyle = KIND_BADGE_STYLES[kind];

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
            <Shield size={24} className="text-indigo-500" />
            {t('modelRegistry.assignments.title', { kind, defaultValue: `${kind} Assignments` })}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'modelRegistry.assignments.description',
              'Assign models to purposes with priority ordering and fallbacks'
            )}
          </p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${kindStyle.bg} ${kindStyle.text}`}
        >
          {kind}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Purpose list */}
        <div className="col-span-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-navy-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Purposes</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select a purpose to manage its model assignments
            </p>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filteredCategories.map((cat) => (
              <div key={cat.label}>
                <button
                  onClick={() => toggleCategory(cat.label)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-navy-700"
                >
                  {cat.label}
                  {expandedCategories.has(cat.label) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {expandedCategories.has(cat.label) && (
                  <div>
                    {cat.purposes.map((purpose) => {
                      const isSelected = purpose === selectedPurpose;
                      return (
                        <button
                          key={purpose}
                          onClick={() => setSelectedPurpose(purpose)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-l-2 border-indigo-500'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 border-l-2 border-transparent'
                          }`}
                        >
                          <span className="font-mono text-xs">{purpose}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Assignment editor */}
        <div className="col-span-8 space-y-4">
          {selectedPurpose ? (
            <>
              {/* Purpose header */}
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white font-mono">
                      {selectedPurpose}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {assignments.length} model{assignments.length !== 1 ? 's' : ''} assigned —
                      drag to reorder priority
                    </p>
                  </div>
                  <button
                    onClick={() => selectedPurpose && loadAssignments(selectedPurpose)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Assigned models */}
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                {assignments.length > 0 ? (
                  <Reorder.Group
                    axis="y"
                    values={assignments}
                    onReorder={handleReorder}
                    className="space-y-2"
                  >
                    <AnimatePresence>
                      {assignments.map((assignment, index) => (
                        <Reorder.Item
                          key={assignment.id}
                          value={assignment}
                          className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical size={16} className="text-slate-400 shrink-0" />
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-6 shrink-0">
                            #{index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-white text-sm truncate">
                                {assignment.modelName}
                              </span>
                              <HealthIcon status={assignment.healthStatus} />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {assignment.modelId}
                            </span>
                          </div>

                          {/* Fallback selector */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Link2 size={12} className="text-slate-400" />
                            <select
                              value={assignment.fallbackModelId || ''}
                              onChange={(e) => handleSetFallback(assignment, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 px-2 text-xs bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded text-slate-700 dark:text-slate-300"
                            >
                              <option value="">No fallback</option>
                              {providers
                                .filter((p) => p.id !== assignment.modelId)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(assignment);
                            }}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Reorder.Item>
                      ))}
                    </AnimatePresence>
                  </Reorder.Group>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Server size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No models assigned to this purpose</p>
                    <p className="text-xs mt-1">Add a model from the dropdown below</p>
                  </div>
                )}
              </div>

              {/* Add model */}
              {unassignedProviders.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleAddModel(e.target.value);
                  }}
                  className="w-full h-10 px-4 bg-white dark:bg-navy-800 border border-dashed border-slate-300 dark:border-navy-600 rounded-xl text-slate-500 dark:text-slate-400 text-sm cursor-pointer hover:border-indigo-400 transition-colors"
                >
                  <option value="">+ Add model to {selectedPurpose}</option>
                  {unassignedProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.provider} — {p.modelId})
                    </option>
                  ))}
                </select>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-12 text-center text-slate-500 dark:text-slate-400">
              <p>Select a purpose from the list to manage its assignments</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurposeAssignmentsEditor;
