/**
 * PurposeAssignmentsTab - Configuration > Purposes & Assignments (enterprise LLM routing)
 *
 * Minimal, safe UI to manage:
 * - ai_purposes registry
 * - ai_purpose_assignments (global + org overrides)
 */
import { Plus, RefreshCw, Save, Settings, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { Api } from '@/services/api';

type PurposeRow = {
  purpose: string;
  kind: string;
  default_tier?: string | null;
  requirements?: any;
  description?: string | null;
  is_active?: number | boolean;
};

type ProviderRow = {
  id: string;
  name?: string;
  provider?: string;
  model_id?: string;
  health_status?: string;
  kind?: string | null;
  provider_type?: string | null;
  origin_vendor?: string | null;
};

type AssignmentRow = {
  id: string;
  organization_id?: string | null;
  purpose: string;
  provider_id: string;
  model_id?: string | null;
  priority: number;
  is_active?: number | boolean;
  provider_name?: string | null;
  provider?: string | null;
  provider_model_id?: string | null;
  health_status?: string | null;
};

export const PurposeAssignmentsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [purposes, setPurposes] = useState<PurposeRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);

  const [selectedPurpose, setSelectedPurpose] = useState<string>('');
  const [orgIdFilter, setOrgIdFilter] = useState<string>('');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [providerKindFilter, setProviderKindFilter] = useState<
    'AUTO' | 'ALL' | 'TEXT_LLM' | 'IMAGE_MODEL'
  >('AUTO');
  const [showMismatchedProviders, setShowMismatchedProviders] = useState(false);

  // Create/Upsert purpose form
  const [newPurpose, setNewPurpose] = useState<Partial<PurposeRow>>({
    purpose: '',
    kind: 'TEXT_LLM',
    default_tier: 'STANDARD',
    description: '',
  });

  // Add assignment form
  const [assignmentForm, setAssignmentForm] = useState<{
    providerId: string;
    priority: number;
    organizationId?: string;
    modelId?: string;
  }>({ providerId: '', priority: 0 });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [purpJson, provJson] = await Promise.all([Api.getLLMPurposes(), Api.getLLMProviders()]);

      const nextPurposes: PurposeRow[] = Array.isArray(purpJson?.purposes) ? purpJson.purposes : [];
      const nextProviders: ProviderRow[] = Array.isArray(provJson) ? provJson : [];

      setPurposes(nextPurposes);
      setProviders(
        nextProviders.filter((p) => (p as any)?.is_active !== false && (p as any)?.is_active !== 0)
      );

      if (!selectedPurpose && nextPurposes.length > 0) {
        setSelectedPurpose(String(nextPurposes[0]?.purpose || ''));
      }
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    const p = String(selectedPurpose || '').trim();
    if (!p) return;
    try {
      const json = await Api.getLLMPurposeAssignments(p, orgIdFilter.trim() || undefined);
      const rows: AssignmentRow[] = Array.isArray(json?.assignments) ? json.assignments : [];
      setAssignments(rows);
    } catch (e: any) {
      toast.error(e?.message || 'Assignments load failed');
      setAssignments([]);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPurpose, orgIdFilter]);

  const activePurpose = useMemo(
    () => purposes.find((p) => String(p.purpose) === String(selectedPurpose)),
    [purposes, selectedPurpose]
  );

  const effectiveProviderKind = useMemo(() => {
    const k = String(activePurpose?.kind || '').toUpperCase();
    if (providerKindFilter === 'ALL') return 'ALL';
    if (providerKindFilter === 'TEXT_LLM' || providerKindFilter === 'IMAGE_MODEL')
      return providerKindFilter;
    if (providerKindFilter === 'AUTO') {
      if (k === 'IMAGE_MODEL') return 'IMAGE_MODEL';
      return 'TEXT_LLM';
    }
    return 'ALL';
  }, [activePurpose?.kind, providerKindFilter]);

  const filteredProviders = useMemo(() => {
    const k = effectiveProviderKind;
    if (k === 'ALL') return providers;
    return providers.filter((p) => {
      const pk = String(p.kind || 'TEXT_LLM').toUpperCase();
      if (showMismatchedProviders) return true;
      return pk === k;
    });
  }, [providers, effectiveProviderKind, showMismatchedProviders]);

  const applyStarterPreset = async (preset: 'text' | 'image') => {
    const purpose = String(selectedPurpose || '').trim();
    if (!purpose) {
      toast.error('Select purpose first');
      return;
    }
    const scopeOrg = orgIdFilter.trim() || null;

    const wantedProviders =
      preset === 'image'
        ? ['replicate', 'openai']
        : ['openai', 'anthropic', 'google', 'gemini', 'openrouter', 'deepseek', 'zai', 'z_ai'];

    const candidates = providers
      .filter((p) => wantedProviders.includes(String(p.provider || '').toLowerCase()))
      // prefer matching kind
      .filter((p) => {
        const pk = String(p.kind || 'TEXT_LLM').toUpperCase();
        return preset === 'image' ? pk === 'IMAGE_MODEL' || pk === 'TEXT_LLM' : pk === 'TEXT_LLM';
      });

    if (candidates.length === 0) {
      toast.error('No matching providers configured for this preset');
      return;
    }

    const priorityOrder =
      preset === 'image'
        ? ['replicate', 'openai']
        : ['openai', 'anthropic', 'google', 'openrouter', 'deepseek', 'zai'];

    setSaving(true);
    try {
      for (const providerKey of priorityOrder) {
        const match =
          candidates.find((p) => String(p.provider || '').toLowerCase() === providerKey) ||
          candidates.find((p) =>
            providerKey === 'google'
              ? ['google', 'gemini'].includes(String(p.provider || '').toLowerCase())
              : providerKey === 'zai'
                ? ['zai', 'z_ai'].includes(String(p.provider || '').toLowerCase())
                : false
          ) ||
          null;
        if (!match) continue;

        // Priority: higher is better in backend ordering
        const priority = 100 - priorityOrder.indexOf(providerKey) * 10;
        await Api.addLLMPurposeAssignment(purpose, {
          providerId: match.id,
          priority,
          organizationId: scopeOrg,
          modelId: null,
          is_active: true,
        });
      }

      toast.success('Starter preset applied');
      await loadAssignments();
    } catch (e: any) {
      toast.error(e?.message || 'Preset apply failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUpsertPurpose = async () => {
    const purpose = String(newPurpose.purpose || '').trim();
    const kind = String(newPurpose.kind || '').trim();
    if (!purpose || !kind) {
      toast.error('Purpose and kind are required');
      return;
    }
    setSaving(true);
    try {
      await Api.upsertLLMPurpose({
        purpose,
        kind,
        default_tier: newPurpose.default_tier || null,
        requirements: newPurpose.requirements || null,
        description: newPurpose.description || null,
        is_active: true,
      });
      toast.success('Purpose saved');
      trackFunnelEvent('model_assignment_changed', { kind, purpose });
      setNewPurpose({ purpose: '', kind: 'TEXT_LLM', default_tier: 'STANDARD', description: '' });
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAssignment = async () => {
    const purpose = String(selectedPurpose || '').trim();
    const providerId = String(assignmentForm.providerId || '').trim();
    if (!purpose || !providerId) {
      toast.error('Select purpose and provider');
      return;
    }
    setSaving(true);
    try {
      await Api.addLLMPurposeAssignment(purpose, {
        providerId,
        priority: Number(assignmentForm.priority || 0),
        organizationId: assignmentForm.organizationId?.trim() || null,
        modelId: assignmentForm.modelId?.trim() || null,
        is_active: true,
      });
      toast.success('Assignment saved');
      trackFunnelEvent('model_assignment_changed', {
        kind: String(activePurpose?.kind || 'TEXT_LLM'),
        purpose,
      });
      setAssignmentForm({ providerId: '', priority: 0 });
      await loadAssignments();
    } catch (e: any) {
      toast.error(e?.message || 'Assignment failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (row: AssignmentRow) => {
    const purpose = String(row.purpose || selectedPurpose || '').trim();
    if (!purpose) return;
    setSaving(true);
    try {
      await Api.deleteLLMPurposeAssignment(purpose, {
        providerId: row.provider_id,
        organizationId: row.organization_id || null,
        modelId: row.model_id || null,
      });
      toast.success('Assignment removed');
      await loadAssignments();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings size={22} className="text-indigo-500" />
            Purposes & Assignments
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise routing: choose models by purpose (global + org overrides).
          </p>
        </div>
        <button
          onClick={() => {
            loadAll();
            loadAssignments();
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Purpose selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Purpose
          </div>
          <select
            value={selectedPurpose}
            onChange={(e) => setSelectedPurpose(e.target.value)}
            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
          >
            {purposes.map((p) => (
              <option key={p.purpose} value={p.purpose}>
                {p.purpose}
              </option>
            ))}
          </select>
          {activePurpose?.description ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {activePurpose.description}
            </div>
          ) : null}
        </div>

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Org override (optional)
          </div>
          <input
            value={orgIdFilter}
            onChange={(e) => setOrgIdFilter(e.target.value)}
            placeholder="organizationId (blank = global only)"
            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            When set, shows org-specific assignments first (plus global fallbacks).
          </div>
        </div>

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Add assignment
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between gap-3">
              <select
                value={providerKindFilter}
                onChange={(e) => setProviderKindFilter(e.target.value as any)}
                className="flex-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none text-sm"
              >
                <option value="AUTO">Providers: auto (by purpose kind)</option>
                <option value="TEXT_LLM">Providers: TEXT_LLM</option>
                <option value="IMAGE_MODEL">Providers: IMAGE_MODEL</option>
                <option value="ALL">Providers: all</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showMismatchedProviders}
                  onChange={(e) => setShowMismatchedProviders(e.target.checked)}
                />
                show all
              </label>
            </div>

            <select
              value={assignmentForm.providerId}
              onChange={(e) => setAssignmentForm((p) => ({ ...p, providerId: e.target.value }))}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            >
              <option value="">Select provider…</option>
              {filteredProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.provider} ({String(p.kind || 'TEXT_LLM')} • {p.provider} •{' '}
                  {p.model_id})
                </option>
              ))}
            </select>
            <input
              value={assignmentForm.organizationId || ''}
              onChange={(e) => setAssignmentForm((p) => ({ ...p, organizationId: e.target.value }))}
              placeholder="organizationId override (optional)"
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
            <input
              value={String(assignmentForm.priority ?? 0)}
              onChange={(e) =>
                setAssignmentForm((p) => ({ ...p, priority: Number(e.target.value || 0) }))
              }
              type="number"
              placeholder="priority (0 = best)"
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
            <button
              onClick={handleAddAssignment}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add
            </button>

            <div className="pt-2 border-t border-slate-200 dark:border-navy-700">
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Starter presets
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => applyStarterPreset('text')}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
                >
                  TEXT chain
                </button>
                <button
                  onClick={() => applyStarterPreset('image')}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
                >
                  IMAGE chain
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Applies assignments for current purpose (global unless Org override is set).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments table */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Assignments</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {assignments.length} items
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-navy-900/60">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-200"
                >
                  <td className="px-4 py-3 font-mono text-xs">{a.priority}</td>
                  <td className="px-4 py-3">
                    {a.organization_id ? (
                      <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-xs">
                        org
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-slate-500/10 text-slate-500 text-xs">
                        global
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.provider_name || a.provider_id}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {a.provider || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {a.model_id || a.provider_model_id || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {a.health_status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemoveAssignment(a)}
                      disabled={saving}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    colSpan={6}
                  >
                    No assignments. Add one above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create purpose */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Create / Upsert purpose
          </div>
          <button
            onClick={handleUpsertPurpose}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            Save
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={String(newPurpose.purpose || '')}
            onChange={(e) => setNewPurpose((p) => ({ ...p, purpose: e.target.value }))}
            placeholder="purpose (e.g. report_section)"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
          />
          <select
            value={String(newPurpose.kind || 'TEXT_LLM')}
            onChange={(e) => setNewPurpose((p) => ({ ...p, kind: e.target.value }))}
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
          >
            <option value="TEXT_LLM">TEXT_LLM</option>
            <option value="IMAGE_MODEL">IMAGE_MODEL</option>
            <option value="BUSINESS_MODEL">BUSINESS_MODEL</option>
          </select>
          <select
            value={String(newPurpose.default_tier || 'STANDARD')}
            onChange={(e) => setNewPurpose((p) => ({ ...p, default_tier: e.target.value }))}
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
          >
            <option value="BUDGET">BUDGET</option>
            <option value="STANDARD">STANDARD</option>
            <option value="PREMIUM">PREMIUM</option>
            <option value="REASONING">REASONING</option>
            <option value="VISION">VISION</option>
          </select>
          <input
            value={String(newPurpose.description || '')}
            onChange={(e) => setNewPurpose((p) => ({ ...p, description: e.target.value }))}
            placeholder="description"
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Requirements JSON editing will be added after we stabilize the purpose catalog.
        </div>
      </div>
    </div>
  );
};

export default PurposeAssignmentsTab;
