/**
 * OrgAIPolicyTab - Configuration > Org AI Policy (enterprise)
 *
 * Minimal editor:
 * - pick organizationId
 * - load policy JSON
 * - edit JSON
 * - save
 */
import { History, RefreshCw, RotateCcw, Save, Send, Shield } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

type SaveMode = 'draft' | 'review' | 'approved' | 'published';

type PolicyFormState = {
  allowedRegions: string;
  allowProviderTypes: string;
  denyProviderTypes: string;
  allowedOriginVendors: string;
  requireLocalForDataClasses: string;
  allowedDataClasses: string;
  operatingMode: string;
};

type PolicyVersion = {
  id: string;
  status: string;
  change_summary?: string | null;
  changed_by?: string | null;
  created_at: string;
};

type OrganizationOption = {
  id: string;
  name?: string | null;
};

const EMPTY_FORM: PolicyFormState = {
  allowedRegions: '',
  allowProviderTypes: '',
  denyProviderTypes: '',
  allowedOriginVendors: '',
  requireLocalForDataClasses: '',
  allowedDataClasses: '',
  operatingMode: 'standard',
};

const toCsv = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item).trim())
        .filter(Boolean)
        .join(', ')
    : '';

const fromCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const SAVE_MODES: SaveMode[] = ['draft', 'review', 'approved', 'published'];

const isSaveMode = (value: string): value is SaveMode => SAVE_MODES.includes(value as SaveMode);

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

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

const normalizeOrganizations = (value: unknown): OrganizationOption[] => {
  if (!hasListShape(value, ['organizations', 'items'])) {
    throw new Error('Organizations response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['organizations', 'items'])
    .map((row) => {
      const displayName =
        asText(row.name, '') ||
        asText(row.organization_name, '') ||
        asText(row.company_name, '') ||
        null;
      return {
        id: asText(row.id, ''),
        name: displayName,
      };
    })
    .filter((row) => row.id);
};

const normalizeHistory = (value: unknown): PolicyVersion[] => {
  if (!hasListShape(value, ['versions', 'items'])) {
    throw new Error('Policy history response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['versions', 'items']).map(
    (version, index) => ({
      id: asText(version.id, `version-${index + 1}`),
      status: asText(version.status, 'unknown'),
      change_summary:
        version.change_summary === null || version.change_summary === undefined
          ? null
          : asText(version.change_summary, 'No summary'),
      changed_by:
        version.changed_by === null || version.changed_by === undefined
          ? null
          : asText(version.changed_by, 'unknown'),
      created_at: asText(version.created_at, ''),
    })
  );
};

const parsePolicyObject = (value: unknown) => {
  if (typeof value !== 'string') return isRecord(value) ? value : {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    throw new Error('Org AI policy response contained invalid policy JSON');
  }
};

const extractPolicySnapshot = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || (!('policy' in payload) && !('latestDraft' in payload))) {
    throw new Error('Org AI policy response was incomplete');
  }
  const policyRecord = isRecord(payload.policy) ? payload.policy : null;
  const latestDraft = isRecord(payload.latestDraft) ? payload.latestDraft : null;
  const policyObj = latestDraft?.policy
    ? parsePolicyObject(latestDraft.policy)
    : parsePolicyObject(policyRecord?.policy ?? payload.policy ?? {});

  return {
    policyObj,
    updatedAt: asText(policyRecord?.updated_at, ''),
    latestDraftStatus: latestDraft ? asText(latestDraft.status, '') : '',
  };
};

const policyConfirmsSaved = (expected: Record<string, unknown>, actual: Record<string, unknown>) =>
  Object.entries(expected).every(([key, expectedValue]) => {
    const actualValue = actual[key];
    if (Array.isArray(expectedValue)) {
      return (
        Array.isArray(actualValue) &&
        expectedValue.every((item) => actualValue.map(String).includes(String(item)))
      );
    }
    return String(actualValue ?? '') === String(expectedValue ?? '');
  });

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
};

export const OrgAIPolicyTab: React.FC = () => {
  const [orgId, setOrgId] = useState('');
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [organizationsLoadError, setOrganizationsLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [policyLoadError, setPolicyLoadError] = useState<string | null>(null);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [hasLoadedPolicy, setHasLoadedPolicy] = useState(false);
  const [form, setForm] = useState<PolicyFormState>(EMPTY_FORM);
  const [raw, setRaw] = useState('{}');
  const [changeSummary, setChangeSummary] = useState('');
  const [history, setHistory] = useState<PolicyVersion[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<'draft' | 'review' | 'approved' | 'published'>('draft');
  const [livePolicyUpdatedAt, setLivePolicyUpdatedAt] = useState<string | null>(null);
  const [latestDraftStatus, setLatestDraftStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resetPolicyState = () => {
    setHasLoadedPolicy(false);
    setPolicyLoadError(null);
    setHistoryLoadError(null);
    setHistory([]);
    setLivePolicyUpdatedAt(null);
    setLatestDraftStatus(null);
    setActionError(null);
    setLastLoadedAt(null);
    setForm(EMPTY_FORM);
    setRaw('{}');
  };

  const selectOrgId = (nextOrgId: string) => {
    setOrgId(nextOrgId);
    resetPolicyState();
  };

  const parsed = useMemo(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [raw]);

  useEffect(() => {
    const loadOrganizations = async () => {
      setLoadingOrganizations(true);
      setOrganizationsLoadError(null);
      try {
        const rows = await Api.getOrganizations();
        const next = normalizeOrganizations(rows);
        setOrganizations(next);
        if (!orgId && next[0]?.id) {
          selectOrgId(next[0].id);
        }
      } catch (error: unknown) {
        const message = normalizeApiErrorMessage(error, 'Organizations unavailable');
        setOrganizationsLoadError(message);
        setOrganizations([]);
        toast.error(message);
      } finally {
        setLoadingOrganizations(false);
      }
    };

    void loadOrganizations();
  }, []);

  const syncFormFromPolicy = (policyObj: any) => {
    setForm({
      allowedRegions: toCsv(policyObj?.allowed_regions),
      allowProviderTypes: toCsv(policyObj?.allow_provider_types),
      denyProviderTypes: toCsv(policyObj?.deny_provider_types),
      allowedOriginVendors: toCsv(policyObj?.allow_origin_vendors),
      requireLocalForDataClasses: toCsv(policyObj?.require_local_for_data_classes),
      allowedDataClasses: toCsv(policyObj?.allowed_data_classes),
      operatingMode: String(policyObj?.operating_mode || 'standard'),
    });
    setRaw(JSON.stringify(policyObj || {}, null, 2));
  };

  const rebuildPolicy = (nextForm: PolicyFormState) => {
    const policyObj = {
      ...(fromCsv(nextForm.allowProviderTypes).length > 0
        ? { allow_provider_types: fromCsv(nextForm.allowProviderTypes) }
        : {}),
      ...(fromCsv(nextForm.denyProviderTypes).length > 0
        ? { deny_provider_types: fromCsv(nextForm.denyProviderTypes) }
        : {}),
      ...(fromCsv(nextForm.allowedRegions).length > 0
        ? { allowed_regions: fromCsv(nextForm.allowedRegions) }
        : {}),
      ...(fromCsv(nextForm.allowedOriginVendors).length > 0
        ? { allow_origin_vendors: fromCsv(nextForm.allowedOriginVendors) }
        : {}),
      ...(fromCsv(nextForm.allowedDataClasses).length > 0
        ? { allowed_data_classes: fromCsv(nextForm.allowedDataClasses) }
        : {}),
      ...(fromCsv(nextForm.requireLocalForDataClasses).length > 0
        ? { require_local_for_data_classes: fromCsv(nextForm.requireLocalForDataClasses) }
        : {}),
      operating_mode: nextForm.operatingMode || 'standard',
    };
    setRaw(JSON.stringify(policyObj, null, 2));
  };

  const updateForm = (patch: Partial<PolicyFormState>) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      rebuildPolicy(next);
      return next;
    });
  };

  const loadPolicy = async () => {
    const id = String(orgId || '').trim();
    if (!id) {
      toast.error('organizationId is required');
      return;
    }
    setLoading(true);
    setPolicyLoadError(null);
    setHistoryLoadError(null);
    setActionError(null);
    try {
      const [policyResult, historyResult] = await Promise.allSettled([
        Api.getOrgLLMPolicy(id),
        Api.getOrgLLMPolicyHistory(id),
      ]);
      if (policyResult.status === 'rejected') {
        throw policyResult.reason;
      }
      const snapshot = extractPolicySnapshot(policyResult.value);
      const policyObj = snapshot.policyObj;
      syncFormFromPolicy(policyObj || {});
      if (historyResult.status === 'fulfilled') {
        try {
          setHistory(normalizeHistory(historyResult.value));
        } catch (historyError: unknown) {
          const message = normalizeApiErrorMessage(historyError, 'Policy history unavailable');
          setHistoryLoadError(message);
          setHistory([]);
          toast.error(message);
        }
      } else {
        const message = normalizeApiErrorMessage(
          historyResult.reason,
          'Policy history unavailable'
        );
        setHistoryLoadError(message);
        setHistory([]);
        toast.error(message);
      }
      setLivePolicyUpdatedAt(snapshot.updatedAt || null);
      setLatestDraftStatus(snapshot.latestDraftStatus || null);
      const latestDraftStatus = snapshot.latestDraftStatus;
      setSaveMode(isSaveMode(latestDraftStatus) ? latestDraftStatus : 'draft');
      setLastLoadedAt(new Date().toISOString());
      setHasLoadedPolicy(true);
      toast.success('Policy loaded');
      return { policyObj };
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Load failed');
      setPolicyLoadError(message);
      setHasLoadedPolicy(false);
      setHistory([]);
      setLivePolicyUpdatedAt(null);
      setLatestDraftStatus(null);
      syncFormFromPolicy({});
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const savePolicy = async (mode: 'draft' | 'review' | 'approved' | 'published') => {
    const id = String(orgId || '').trim();
    if (!id) {
      toast.error('organizationId is required');
      return;
    }
    if (!parsed) {
      toast.error('Invalid JSON');
      return;
    }
    if (!hasLoadedPolicy || policyLoadError) {
      toast.error('Load the current org policy before saving');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await Api.updateOrgLLMPolicy(id, parsed, {
        mode,
        changeSummary: changeSummary || undefined,
      });
      const refreshed = await loadPolicy();
      if (!refreshed || !policyConfirmsSaved(parsed, refreshed.policyObj)) {
        throw new Error('Org AI policy save was not confirmed by the server');
      }
      toast.success(
        mode === 'published'
          ? 'Policy published'
          : mode === 'approved'
            ? 'Policy approved'
            : mode === 'review'
              ? 'Policy sent to review'
              : 'Draft saved'
      );
      setLastLoadedAt(new Date().toISOString());
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Save failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const rollback = async (versionId: string) => {
    const id = String(orgId || '').trim();
    if (!id) return;
    if (policyLoadError || historyLoadError) {
      toast.error('Policy history is unavailable');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await Api.rollbackOrgLLMPolicy(id, versionId);
      const refreshed = await loadPolicy();
      if (!refreshed) {
        throw new Error('Policy rollback was not confirmed by the server');
      }
      toast.success('Policy rolled back');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Rollback failed');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield size={22} className="text-indigo-500" />
            Org AI Policy
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise policy enforcement: regions, provider types, origins, and data classes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/[0.04]">
              Live: {livePolicyUpdatedAt ? 'published' : 'not published'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/[0.04]">
              Working version: {latestDraftStatus || 'draft'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPolicy}
            disabled={loading || saving}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Load
          </button>
          <button
            onClick={() => void savePolicy(saveMode)}
            disabled={loading || saving || !parsed || !hasLoadedPolicy || !!policyLoadError}
            title={
              !hasLoadedPolicy || policyLoadError ? 'Load the current org policy first' : undefined
            }
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
          >
            {saveMode === 'published' ? <Send size={16} /> : <Save size={16} />}
            {saveMode === 'published'
              ? 'Publish'
              : saveMode === 'approved'
                ? 'Approve'
                : saveMode === 'review'
                  ? 'Send to review'
                  : 'Save draft'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Organization
            </label>
            <select
              value={orgId}
              onChange={(e) => selectOrgId(e.target.value)}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
              disabled={loadingOrganizations}
            >
              <option value="">
                {loadingOrganizations ? 'Loading organizations…' : 'Select organization'}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name ? `${org.name} · ${org.id}` : org.id}
                </option>
              ))}
            </select>
            {organizationsLoadError ? (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                Organization list unavailable. Paste an organizationId below to load manually.
              </div>
            ) : null}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              organizationId override
            </label>
            <input
              value={orgId}
              onChange={(e) => selectOrgId(e.target.value)}
              placeholder="org id"
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Save mode
            </label>
            <select
              value={saveMode}
              onChange={(e) => {
                if (isSaveMode(e.target.value)) setSaveMode(e.target.value);
              }}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            >
              <option value="draft">draft</option>
              <option value="review">review</option>
              <option value="approved">approved</option>
              <option value="published">published</option>
            </select>
          </div>
        </div>
        {policyLoadError ? (
          <DegradedState title="Org AI policy unavailable" description={policyLoadError} />
        ) : null}
        {actionError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {actionError}
          </div>
        ) : null}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {lastLoadedAt ? (
            <span>
              Last load/save: {lastLoadedAt}
              {livePolicyUpdatedAt ? ` • Live updated: ${livePolicyUpdatedAt}` : ''}
            </span>
          ) : (
            <span>Not loaded yet.</span>
          )}
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
          Workflow: save draft for edits, send to review, approve, then publish live. Rollback
          always restores the published version.
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Change summary
          </label>
          <input
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changed in this policy revision?"
            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Guided Policy Builder
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Define what providers, regions and data classes are allowed without editing raw JSON
            first.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Allowed regions
            </label>
            <input
              value={form.allowedRegions}
              onChange={(e) => updateForm({ allowedRegions: e.target.value })}
              placeholder="EU, US"
              disabled={!hasLoadedPolicy || !!policyLoadError}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Operating mode
            </label>
            <select
              value={form.operatingMode}
              onChange={(e) => updateForm({ operatingMode: e.target.value })}
              disabled={!hasLoadedPolicy || !!policyLoadError}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            >
              <option value="standard">standard</option>
              <option value="restricted">restricted</option>
              <option value="incident">incident</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Allow provider types
            </label>
            <input
              value={form.allowProviderTypes}
              onChange={(e) => updateForm({ allowProviderTypes: e.target.value })}
              placeholder="direct, customer_managed"
              disabled={!hasLoadedPolicy || !!policyLoadError}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Deny provider types
            </label>
            <input
              value={form.denyProviderTypes}
              onChange={(e) => updateForm({ denyProviderTypes: e.target.value })}
              placeholder="aggregator"
              disabled={!hasLoadedPolicy || !!policyLoadError}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Allowed origin vendors
            </label>
            <input
              value={form.allowedOriginVendors}
              onChange={(e) => updateForm({ allowedOriginVendors: e.target.value })}
              placeholder="openai, anthropic"
              disabled={!hasLoadedPolicy || !!policyLoadError}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Allowed data classes
            </label>
            <input
              value={form.allowedDataClasses}
              onChange={(e) => updateForm({ allowedDataClasses: e.target.value })}
              placeholder="no_pii, pii"
              disabled={!hasLoadedPolicy || !!policyLoadError}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Require local for data classes
            </label>
            <input
              value={form.requireLocalForDataClasses}
              onChange={(e) => updateForm({ requireLocalForDataClasses: e.target.value })}
              placeholder="confidential"
              disabled={!hasLoadedPolicy || !!policyLoadError}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Advanced JSON</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsed ? 'Valid JSON' : 'Invalid JSON'}
          </div>
        </div>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            try {
              const next = JSON.parse(e.target.value);
              syncFormFromPolicy(next);
            } catch {
              /* keep raw for advanced edits */
            }
          }}
          spellCheck={false}
          disabled={!hasLoadedPolicy || !!policyLoadError}
          className="w-full h-[420px] p-4 font-mono text-xs bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 outline-none"
        />
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center gap-2">
          <History size={16} className="text-slate-500" />
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Policy History</div>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-navy-700">
          {historyLoadError ? (
            <div className="p-4">
              <DegradedState title="Policy history unavailable" description={historyLoadError} />
            </div>
          ) : history.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
              No policy revisions yet.
            </div>
          ) : (
            history.map((version) => (
              <div key={version.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {version.status}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {version.change_summary || 'No summary'} • {formatDateTime(version.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => void rollback(version.id)}
                  disabled={saving || !!historyLoadError || !!policyLoadError}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  Rollback
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Tip: to enforce enterprise rules, set backend flags:{' '}
        <span className="font-mono">LLM_ORG_POLICY=1</span>.
      </div>
    </div>
  );
};

export default OrgAIPolicyTab;
