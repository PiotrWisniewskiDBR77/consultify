import { Brain, Layers3, Plus, RefreshCw, ShieldCheck, Trash2, Weight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Api } from '../../../services/api';

interface KnowledgeAssignment {
  id: string;
  worker_id: string;
  knowledge_source_type: string;
  knowledge_doc_id: string | null;
  knowledge_pill_id: string | null;
  product_slug: string | null;
  priority_weight: number;
  usage_mode: string;
  section_keys: string[];
  hard_required: boolean;
  assigned_at: string;
}

interface KnowledgePill {
  id: string;
  slug: string;
  product_slug: string | null;
  title: string;
  summary: string | null;
  status: string;
  language: string;
  current_version: {
    sections: Array<{
      section_key: string;
      title?: string;
      content: string;
    }>;
  } | null;
}

interface KnowledgeAssignmentPanelProps {
  workerId: string;
}

export const KnowledgeAssignmentPanel: React.FC<KnowledgeAssignmentPanelProps> = ({ workerId }) => {
  const [assignments, setAssignments] = useState<KnowledgeAssignment[]>([]);
  const [pills, setPills] = useState<KnowledgePill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPillId, setSelectedPillId] = useState('');
  const [usageMode, setUsageMode] = useState('full_pill');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [weight, setWeight] = useState('1');
  const [hardRequired, setHardRequired] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const [assignmentsResponse, pillsResponse] = await Promise.all([
        Api.get(`/api/virtual-workers/${workerId}/knowledge`),
        Api.get(`/api/virtual-workers/${workerId}/knowledge/pills?includeUnassigned=true`),
      ]);
      const assignmentsList = assignmentsResponse?.data?.data ?? assignmentsResponse?.data;
      const pillsList = pillsResponse?.data?.data ?? pillsResponse?.data;
      setAssignments(Array.isArray(assignmentsList) ? assignmentsList : []);
      setPills(Array.isArray(pillsList) ? pillsList : []);
    } catch (err) {
      console.error('Failed to fetch knowledge assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [workerId]);

  const handleRemove = async (assignmentId: string) => {
    try {
      await Api.delete(`/api/virtual-workers/${workerId}/knowledge/${assignmentId}`);
      fetchAssignments();
    } catch (err) {
      console.error('Failed to remove assignment:', err);
    }
  };

  const handleBootstrapDefaults = async () => {
    setBootstrapping(true);
    try {
      await Api.post(`/api/virtual-workers/${workerId}/knowledge/bootstrap-defaults`, {});
      fetchAssignments();
      setShowAdd(false);
    } catch (err) {
      console.error('Failed to bootstrap default pills:', err);
    } finally {
      setBootstrapping(false);
    }
  };

  const handleAddSingle = async () => {
    const pill = pills.find((item) => item.id === selectedPillId);
    if (!pill) return;
    try {
      await Api.post(`/api/virtual-workers/${workerId}/knowledge`, {
        knowledge_source_type: 'product_pill',
        knowledge_pill_id: pill.id,
        product_slug: pill.product_slug,
        priority_weight: Number(weight || 1),
        usage_mode: usageMode,
        section_keys: usageMode === 'selected_sections' ? selectedSections : [],
        hard_required: hardRequired,
      });
      setSelectedPillId('');
      setSelectedSections([]);
      setUsageMode('full_pill');
      setWeight('1');
      setHardRequired(false);
      setShowAdd(false);
      fetchAssignments();
    } catch (err) {
      console.error('Failed to add knowledge:', err);
    }
  };

  const handleWeightChange = async (assignmentId: string, newWeight: number) => {
    try {
      await Api.delete(`/api/virtual-workers/${workerId}/knowledge/${assignmentId}`);
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (assignment) {
        await Api.post(`/api/virtual-workers/${workerId}/knowledge`, {
          knowledge_source_type: assignment.knowledge_source_type,
          product_slug: assignment.product_slug,
          knowledge_doc_id: assignment.knowledge_doc_id,
          knowledge_pill_id: assignment.knowledge_pill_id,
          priority_weight: newWeight,
          usage_mode: assignment.usage_mode,
          section_keys: assignment.section_keys,
          hard_required: assignment.hard_required,
        });
      }
      fetchAssignments();
    } catch (err) {
      console.error('Failed to update weight:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const assignedPillIds = new Set(assignments.map((item) => item.knowledge_pill_id).filter(Boolean));
  const availablePills = pills.filter((pill) => !assignedPillIds.has(pill.id));
  const selectedPill = useMemo(
    () => pills.find((pill) => pill.id === selectedPillId) || null,
    [pills, selectedPillId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Knowledge Assignments
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {assignments.length} knowledge assignment{assignments.length !== 1 ? 's' : ''} active.
            Govern whole pills, selected sections, and fallback behavior per worker.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBootstrapDefaults}
            disabled={bootstrapping}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium disabled:opacity-50"
          >
            <Layers3 size={14} />
            {bootstrapping ? 'Bootstrapping...' : 'Bootstrap Default Pills'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-xs font-medium"
          >
            <Plus size={14} />
            Add Single
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Assign Knowledge Pill
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={selectedPillId}
              onChange={(e) => {
                setSelectedPillId(e.target.value);
                setSelectedSections([]);
              }}
              className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
            >
              <option value="">Select pill</option>
              {availablePills.map((pill) => (
                <option key={pill.id} value={pill.id}>
                  {pill.title} {pill.product_slug ? `(${pill.product_slug})` : ''}
                </option>
              ))}
            </select>
            <select
              value={usageMode}
              onChange={(e) => setUsageMode(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
            >
              <option value="full_pill">Full pill</option>
              <option value="selected_sections">Selected sections</option>
              <option value="retrieval_only">Retrieval only</option>
              <option value="fallback_only">Fallback only</option>
            </select>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Weight"
              className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
            />
            <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hardRequired}
                onChange={(e) => setHardRequired(e.target.checked)}
              />
              Hard required
            </label>
          </div>

          {selectedPill?.summary && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{selectedPill.summary}</p>
          )}

          {selectedPill && usageMode === 'selected_sections' && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Select sections
              </p>
              <div className="flex flex-wrap gap-2">
                {(selectedPill.current_version?.sections || []).map((section) => {
                  const checked = selectedSections.includes(section.section_key);
                  return (
                    <label
                      key={section.section_key}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-navy-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSections((prev) => [...prev, section.section_key]);
                          } else {
                            setSelectedSections((prev) =>
                              prev.filter((item) => item !== section.section_key)
                            );
                          }
                        }}
                      />
                      {section.title || section.section_key}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleAddSingle}
            disabled={!selectedPillId || (usageMode === 'selected_sections' && selectedSections.length === 0)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            <Plus size={14} />
            Add Assignment
          </button>
        </div>
      )}

      <div className="space-y-2">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="flex items-center justify-between bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl px-5 py-3"
          >
            <div className="flex items-center gap-3">
              <Brain size={16} className="text-indigo-500" />
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {pills.find((pill) => pill.id === assignment.knowledge_pill_id)?.title ||
                    assignment.product_slug ||
                    assignment.knowledge_doc_id ||
                    'Unknown'}
                </span>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {assignment.usage_mode.replace(/_/g, ' ')}
                  </span>
                  {assignment.product_slug && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {assignment.product_slug}
                    </span>
                  )}
                  {assignment.hard_required && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[11px] font-medium">
                      <ShieldCheck size={11} />
                      required
                    </span>
                  )}
                </div>
                {assignment.section_keys.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Sections: {assignment.section_keys.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Weight size={14} className="text-slate-400" />
                <select
                  value={assignment.priority_weight}
                  onChange={(e) => handleWeightChange(assignment.id, parseFloat(e.target.value))}
                  className="px-2 py-1 border border-slate-300 dark:border-navy-600 rounded bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-xs"
                >
                  {[0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0].map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleRemove(assignment.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {assignments.length === 0 && (
          <div className="text-center py-12">
            <Brain className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No knowledge assigned yet. Bootstrap the default pills or add a specific pill manually.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
