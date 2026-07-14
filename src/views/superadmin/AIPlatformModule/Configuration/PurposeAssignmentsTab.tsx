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

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import { LoadingState } from '../../../../components/ui/primitives';

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
  is_active?: number | boolean;
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

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

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

const normalizePurposes = (value: unknown): PurposeRow[] => {
  if (!hasListShape(value, ['purposes', 'items'])) {
    throw new Error('LLM purposes response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['purposes', 'items'])
    .map((row) => ({
      purpose: asText(row.purpose, ''),
      kind: asText(row.kind, 'TEXT_LLM'),
      default_tier:
        row.default_tier === null || row.default_tier === undefined
          ? null
          : asText(row.default_tier, 'STANDARD'),
      requirements: row.requirements,
      description:
        row.description === null || row.description === undefined
          ? null
          : asText(row.description, ''),
      is_active: toBool(row.is_active, true),
    }))
    .filter((row) => row.purpose);
};

const normalizeProviders = (value: unknown): ProviderRow[] => {
  if (!hasListShape(value, ['providers', 'items'])) {
    throw new Error('LLM providers response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['providers', 'items'])
    .map((row) => ({
      id: asText(row.id, ''),
      name: asText(row.name, ''),
      provider: asText(row.provider, ''),
      model_id: asText(row.model_id, ''),
      health_status: asText(row.health_status, ''),
      kind: row.kind === null || row.kind === undefined ? null : asText(row.kind, 'TEXT_LLM'),
      provider_type:
        row.provider_type === null || row.provider_type === undefined
          ? null
          : asText(row.provider_type, ''),
      origin_vendor:
        row.origin_vendor === null || row.origin_vendor === undefined
          ? null
          : asText(row.origin_vendor, ''),
      is_active: toBool(row.is_active, true),
    }))
    .filter((row) => row.id);
};

const normalizeAssignments = (value: unknown): AssignmentRow[] => {
  if (!hasListShape(value, ['assignments', 'items'])) {
    throw new Error('LLM purpose assignments response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['assignments', 'items'])
    .map((row, index) => ({
      id: asText(row.id, `assignment-${index + 1}`),
      organization_id:
        row.organization_id === null || row.organization_id === undefined
          ? null
          : asText(row.organization_id, ''),
      purpose: asText(row.purpose, ''),
      provider_id: asText(row.provider_id, ''),
      model_id:
        row.model_id === null || row.model_id === undefined ? null : asText(row.model_id, ''),
      priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
      is_active: toBool(row.is_active, true),
      provider_name:
        row.provider_name === null || row.provider_name === undefined
          ? null
          : asText(row.provider_name, ''),
      provider:
        row.provider === null || row.provider === undefined ? null : asText(row.provider, ''),
      provider_model_id:
        row.provider_model_id === null || row.provider_model_id === undefined
          ? null
          : asText(row.provider_model_id, ''),
      health_status:
        row.health_status === null || row.health_status === undefined
          ? null
          : asText(row.health_status, ''),
    }))
    .filter((row) => row.purpose && row.provider_id);
};

const assignmentMatches = (
  row: AssignmentRow,
  expected: {
    purpose: string;
    providerId: string;
    organizationId?: string | null;
    modelId?: string | null;
  }
) =>
  row.purpose === expected.purpose &&
  row.provider_id === expected.providerId &&
  String(row.organization_id || '') === String(expected.organizationId || '') &&
  String(row.model_id || '') === String(expected.modelId || '');

export const PurposeAssignmentsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignmentsLoadError, setAssignmentsLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setLoadError(null);
      const [purpJson, provJson] = await Promise.all([Api.getLLMPurposes(), Api.getLLMProviders()]);

      const nextPurposes = normalizePurposes(purpJson);
      const nextProviders = normalizeProviders(provJson);

      setPurposes(nextPurposes);
      setProviders(nextProviders.filter((p) => p.is_active !== false && p.is_active !== 0));

      if (!selectedPurpose && nextPurposes.length > 0) {
        setSelectedPurpose(String(nextPurposes[0]?.purpose || ''));
      }
      return { purposes: nextPurposes, providers: nextProviders };
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Load failed');
      setLoadError(message);
      setPurposes([]);
      setProviders([]);
      setAssignments([]);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    const p = String(selectedPurpose || '').trim();
    if (!p) return;
    try {
      setAssignmentsLoadError(null);
      const json = await Api.getLLMPurposeAssignments(p, orgIdFilter.trim() || undefined);
      const rows = normalizeAssignments(json);
      setAssignments(rows);
      return rows;
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Assignments load failed');
      setAssignmentsLoadError(message);
      toast.error(message);
      setAssignments([]);
      return null;
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
    if (loadError || assignmentsLoadError) {
      toast.error('Purpose assignments are unavailable');
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
    setActionError(null);
    try {
      const expectedAssignments: Array<{
        purpose: string;
        providerId: string;
        organizationId?: string | null;
        modelId?: string | null;
      }> = [];
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
        const expected = {
          purpose,
          providerId: match.id,
          organizationId: scopeOrg,
          modelId: null,
        };
        await Api.addLLMPurposeAssignment(purpose, {
          providerId: match.id,
          priority,
          organizationId: scopeOrg,
          modelId: null,
          is_active: true,
        });
        expectedAssignments.push(expected);
      }

      const refreshed = await loadAssignments();
      if (
        !refreshed ||
        expectedAssignments.some(
          (expected) => !refreshed.some((row) => assignmentMatches(row, expected))
        )
      ) {
        throw new Error('Starter preset was not confirmed by the server');
      }
      toast.success('Starter preset applied');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Preset apply failed');
      setActionError(message);
      toast.error(message);
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
    if (loadError) {
      toast.error('Purpose catalog is unavailable');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await Api.upsertLLMPurpose({
        purpose,
        kind,
        default_tier: newPurpose.default_tier || null,
        requirements: newPurpose.requirements || null,
        description: newPurpose.description || null,
        is_active: true,
      });
      const refreshed = await loadAll();
      if (!refreshed || !refreshed.purposes.some((p) => p.purpose === purpose)) {
        throw new Error('Purpose save was not confirmed by the server');
      }
      toast.success('Purpose saved');
      trackFunnelEvent('model_assignment_changed', { kind, purpose });
      setNewPurpose({ purpose: '', kind: 'TEXT_LLM', default_tier: 'STANDARD', description: '' });
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Save failed');
      setActionError(message);
      toast.error(message);
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
    if (loadError || assignmentsLoadError) {
      toast.error('Purpose assignments are unavailable');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const expected = {
        purpose,
        providerId,
        organizationId: assignmentForm.organizationId?.trim() || null,
        modelId: assignmentForm.modelId?.trim() || null,
      };
      await Api.addLLMPurposeAssignment(purpose, {
        providerId,
        priority: Number(assignmentForm.priority || 0),
        organizationId: assignmentForm.organizationId?.trim() || null,
        modelId: assignmentForm.modelId?.trim() || null,
        is_active: true,
      });
      const refreshed = await loadAssignments();
      if (!refreshed || !refreshed.some((row) => assignmentMatches(row, expected))) {
        throw new Error('Assignment save was not confirmed by the server');
      }
      toast.success('Assignment saved');
      trackFunnelEvent('model_assignment_changed', {
        kind: String(activePurpose?.kind || 'TEXT_LLM'),
        purpose,
      });
      setAssignmentForm({ providerId: '', priority: 0 });
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Assignment failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (row: AssignmentRow) => {
    const purpose = String(row.purpose || selectedPurpose || '').trim();
    if (!purpose) return;
    if (loadError || assignmentsLoadError) {
      toast.error('Purpose assignments are unavailable');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const expected = {
        purpose,
        providerId: row.provider_id,
        organizationId: row.organization_id || null,
        modelId: row.model_id || null,
      };
      await Api.deleteLLMPurposeAssignment(purpose, {
        providerId: row.provider_id,
        organizationId: row.organization_id || null,
        modelId: row.model_id || null,
      });
      const refreshed = await loadAssignments();
      if (!refreshed || refreshed.some((candidate) => assignmentMatches(candidate, expected))) {
        throw new Error('Assignment removal was not confirmed by the server');
      }
      toast.success('Assignment removed');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Delete failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
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
            void loadAll();
            void loadAssignments();
          }}
          disabled={saving}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <DegradedState title="Purpose assignments unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {/* Purpose selector */}
          {actionError ? (
            <div
              role="alert"
              className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
            >
              {actionError}
            </div>
          ) : null}

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
                  onChange={(e) =>
                    setAssignmentForm((p) => ({ ...p, organizationId: e.target.value }))
                  }
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
                  disabled={saving || !!assignmentsLoadError || !selectedPurpose}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2"
                  title={assignmentsLoadError || undefined}
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
                      disabled={saving || !!assignmentsLoadError || !selectedPurpose}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
                      title={assignmentsLoadError || undefined}
                    >
                      TEXT chain
                    </button>
                    <button
                      onClick={() => applyStarterPreset('image')}
                      disabled={saving || !!assignmentsLoadError || !selectedPurpose}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
                      title={assignmentsLoadError || undefined}
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
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Assignments
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {assignments.length} items
              </div>
            </div>
            {assignmentsLoadError ? (
              <div className="p-6">
                <DegradedState
                  title="Purpose assignment list unavailable"
                  description={assignmentsLoadError}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="min-w-full text-sm"
                >
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
                            className="p-2 rounded-lg hover:bg-danger-500/10 text-slate-500 hover:text-danger-400 transition-colors"
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
            )}
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
        </>
      )}
    </div>
  );
};

export default PurposeAssignmentsTab;
