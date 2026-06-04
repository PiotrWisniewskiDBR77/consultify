import {
  Brain,
  CheckCircle2,
  Edit3,
  FileText,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Weight,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { LoadingState } from '../../../components/ui/primitives';
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

interface KnowledgePillSection {
  section_key: string;
  title?: string;
  content: string;
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
    sections: KnowledgePillSection[];
  } | null;
}

interface PillDraft {
  id?: string;
  slug: string;
  product_slug: string;
  title: string;
  summary: string;
  status: string;
  language: string;
  change_notes: string;
  sections: KnowledgePillSection[];
}

interface KnowledgeAssignmentPanelProps {
  workerId: string;
}

function emptyPillDraft(): PillDraft {
  return {
    slug: '',
    product_slug: '',
    title: '',
    summary: '',
    status: 'active',
    language: 'en',
    change_notes: '',
    sections: [
      {
        section_key: 'overview',
        title: 'Overview',
        content: '',
      },
    ],
  };
}

export const KnowledgeAssignmentPanel: React.FC<KnowledgeAssignmentPanelProps> = ({ workerId }) => {
  const [assignments, setAssignments] = useState<KnowledgeAssignment[]>([]);
  const [pills, setPills] = useState<KnowledgePill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [selectedPillId, setSelectedPillId] = useState('');
  const [usageMode, setUsageMode] = useState('full_pill');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [weight, setWeight] = useState('1');
  const [hardRequired, setHardRequired] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPill, setSavingPill] = useState(false);
  const [draft, setDraft] = useState<PillDraft>(emptyPillDraft());
  const [editingPillId, setEditingPillId] = useState<string | null>(null);

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
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
      setError('Failed to load worker knowledge governance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [workerId]);

  const assignedPillIds = useMemo(
    () => new Set(assignments.map((item) => item.knowledge_pill_id).filter(Boolean)),
    [assignments]
  );
  const availablePills = useMemo(
    () => pills.filter((pill) => !assignedPillIds.has(pill.id)),
    [pills, assignedPillIds]
  );
  const selectedPill = useMemo(
    () => pills.find((pill) => pill.id === selectedPillId) || null,
    [pills, selectedPillId]
  );
  const coverage = useMemo(() => {
    const allProducts = Array.from(
      new Set(
        pills
          .map((pill) => pill.product_slug)
          .filter(Boolean)
          .map((value) => String(value))
      )
    ).sort();
    return allProducts.map((product) => ({
      product,
      assigned: assignments.some((assignment) => assignment.product_slug === product),
      pillCount: pills.filter((pill) => pill.product_slug === product).length,
    }));
  }, [assignments, pills]);

  const resetDraft = () => {
    setDraft(emptyPillDraft());
    setEditingPillId(null);
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      setError(null);
      await Api.delete(`/api/virtual-workers/${workerId}/knowledge/${assignmentId}`);
      fetchAssignments();
    } catch (err) {
      console.error('Failed to remove assignment:', err);
      setError('Failed to remove knowledge assignment.');
    }
  };

  const handleBootstrapDefaults = async () => {
    setBootstrapping(true);
    setError(null);
    try {
      await Api.post(`/api/virtual-workers/${workerId}/knowledge/bootstrap-defaults`, {});
      fetchAssignments();
      setShowAddAssignment(false);
    } catch (err) {
      console.error('Failed to bootstrap default pills:', err);
      setError('Failed to bootstrap default knowledge pills.');
    } finally {
      setBootstrapping(false);
    }
  };

  const handleAddSingle = async () => {
    const pill = pills.find((item) => item.id === selectedPillId);
    if (!pill) return;
    try {
      setError(null);
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
      setShowAddAssignment(false);
      fetchAssignments();
    } catch (err) {
      console.error('Failed to add knowledge:', err);
      setError('Failed to assign knowledge pill.');
    }
  };

  const handleWeightChange = async (assignmentId: string, newWeight: number) => {
    try {
      setError(null);
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
      setError('Failed to update assignment weight.');
    }
  };

  const handleEditPill = (pill: KnowledgePill) => {
    setEditingPillId(pill.id);
    setDraft({
      id: pill.id,
      slug: pill.slug,
      product_slug: pill.product_slug || '',
      title: pill.title,
      summary: pill.summary || '',
      status: pill.status,
      language: pill.language,
      change_notes: '',
      sections:
        pill.current_version?.sections?.map((section) => ({
          section_key: section.section_key,
          title: section.title || '',
          content: section.content,
        })) || [],
    });
  };

  const handleSectionChange = (index: number, field: keyof KnowledgePillSection, value: string) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, idx) =>
        idx === index ? { ...section, [field]: value } : section
      ),
    }));
  };

  const handleAddSection = () => {
    setDraft((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          section_key: `section_${current.sections.length + 1}`,
          title: '',
          content: '',
        },
      ],
    }));
  };

  const handleRemoveSection = (index: number) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.filter((_, idx) => idx !== index),
    }));
  };

  const handleSavePill = async () => {
    if (!draft.slug.trim() || !draft.title.trim()) return;
    setSavingPill(true);
    setError(null);
    try {
      const payload = {
        slug: draft.slug.trim(),
        product_slug: draft.product_slug.trim() || null,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        language: draft.language.trim() || 'en',
        status: draft.status,
        change_notes: draft.change_notes.trim() || null,
        sections: draft.sections
          .filter((section) => section.section_key.trim() && section.content.trim())
          .map((section, index) => ({
            section_key: section.section_key.trim(),
            title: section.title?.trim() || section.section_key.trim(),
            content: section.content.trim(),
            sort_order: index,
          })),
      };

      if (editingPillId) {
        await Api.put(`/api/virtual-workers/${workerId}/knowledge/pills/${editingPillId}`, payload);
      } else {
        await Api.post(`/api/virtual-workers/${workerId}/knowledge/pills`, payload);
      }

      resetDraft();
      fetchAssignments();
    } catch (err) {
      console.error('Failed to save knowledge pill:', err);
      setError('Failed to save knowledge pill.');
    } finally {
      setSavingPill(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Knowledge Governance
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Assign pills to the worker, edit pill content and sections, and monitor product
            coverage.
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
            onClick={() => setShowAddAssignment((value) => !value)}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-xs font-medium"
          >
            <Plus size={14} />
            Assign Pill
          </button>
          <button
            onClick={resetDraft}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-xs font-medium"
          >
            <FileText size={14} />
            New Pill
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Coverage Map</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Shows whether the worker has at least one assigned pill for each available product
              family.
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {assignments.length} active assignment{assignments.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {coverage.map((item) => (
            <div
              key={item.product}
              className="rounded-xl border border-slate-200 dark:border-navy-700 px-4 py-3 bg-slate-50 dark:bg-navy-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.product}</p>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    item.assigned
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}
                >
                  <CheckCircle2 size={11} />
                  {item.assigned ? 'covered' : 'missing'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {item.pillCount} pill{item.pillCount !== 1 ? 's' : ''} in library
              </p>
            </div>
          ))}
          {coverage.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No product coverage data yet.
            </p>
          )}
        </div>
      </section>

      {showAddAssignment && (
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
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
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {selectedPill.summary}
            </p>
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
            disabled={
              !selectedPillId ||
              (usageMode === 'selected_sections' && selectedSections.length === 0)
            }
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            <Plus size={14} />
            Add Assignment
          </button>
        </section>
      )}

      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              Active Assignments
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Govern whole pills, selected sections, and fallback behavior per worker.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl px-5 py-3"
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
                  <Weight size={14} className="text-slate-600" />
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
                  className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {assignments.length === 0 && (
            <div className="text-center py-12">
              <Brain className="w-10 h-10 mx-auto text-slate-600 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No knowledge assigned yet. Bootstrap the default pills or add a specific pill
                manually.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Knowledge Pill Editor
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Create or update the worker’s governed product pills, including section-level
                content.
              </p>
            </div>
            {editingPillId && (
              <button
                onClick={resetDraft}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-navy-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <X size={13} />
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
              placeholder="Pill title"
              className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={draft.slug}
              onChange={(e) => setDraft((current) => ({ ...current, slug: e.target.value }))}
              placeholder="pill-slug"
              className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={draft.product_slug}
              onChange={(e) =>
                setDraft((current) => ({ ...current, product_slug: e.target.value.toLowerCase() }))
              }
              placeholder="product slug"
              className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={draft.language}
                onChange={(e) => setDraft((current) => ({ ...current, language: e.target.value }))}
                placeholder="language"
                className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
              />
              <select
                value={draft.status}
                onChange={(e) => setDraft((current) => ({ ...current, status: e.target.value }))}
                className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <textarea
            value={draft.summary}
            onChange={(e) => setDraft((current) => ({ ...current, summary: e.target.value }))}
            rows={3}
            placeholder="Short operator summary"
            className="mt-3 w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white resize-y"
          />

          <textarea
            value={draft.change_notes}
            onChange={(e) => setDraft((current) => ({ ...current, change_notes: e.target.value }))}
            rows={2}
            placeholder="Change notes for this version"
            className="mt-3 w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white resize-y"
          />

          <div className="mt-5 space-y-4">
            {draft.sections.map((section, index) => (
              <div
                key={`${section.section_key}-${index}`}
                className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-[0.35fr_0.65fr_auto] gap-3">
                  <input
                    type="text"
                    value={section.section_key}
                    onChange={(e) => handleSectionChange(index, 'section_key', e.target.value)}
                    placeholder="section_key"
                    className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={section.title || ''}
                    onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                    placeholder="Section title"
                    className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => handleRemoveSection(index)}
                    disabled={draft.sections.length === 1}
                    className="inline-flex items-center justify-center px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={section.content}
                  onChange={(e) => handleSectionChange(index, 'content', e.target.value)}
                  rows={5}
                  placeholder="Section content"
                  className="mt-3 w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white resize-y"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleAddSection}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-navy-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
            >
              <Plus size={13} />
              Add section
            </button>
            <button
              onClick={handleSavePill}
              disabled={savingPill || !draft.slug.trim() || !draft.title.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {savingPill ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {savingPill ? 'Saving...' : editingPillId ? 'Save new version' : 'Create pill'}
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Pill Library</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Review which pills exist, which products they cover, and whether they are assigned.
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {pills.length} pill{pills.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3 max-h-[920px] overflow-auto pr-1">
            {pills.map((pill) => {
              const isAssigned = assignedPillIds.has(pill.id);
              const assignmentCount = assignments.filter(
                (assignment) => assignment.knowledge_pill_id === pill.id
              ).length;
              return (
                <div
                  key={pill.id}
                  className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {pill.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {pill.slug}
                        {pill.product_slug ? ` · ${pill.product_slug}` : ''}
                        {` · ${pill.language}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleEditPill(pill)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-navy-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700"
                    >
                      <Edit3 size={13} />
                      Edit
                    </button>
                  </div>

                  {pill.summary && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                      {pill.summary}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        isAssigned
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isAssigned ? 'assigned' : 'unassigned'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {pill.status}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {assignmentCount} active assignment{assignmentCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {(pill.current_version?.sections || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(pill.current_version?.sections || []).map((section) => (
                        <span
                          key={section.section_key}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-[11px] text-slate-600 dark:text-slate-300"
                        >
                          {section.title || section.section_key}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {pills.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 mx-auto text-slate-600 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No knowledge pills yet. Create a pill or bootstrap the default product set.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
