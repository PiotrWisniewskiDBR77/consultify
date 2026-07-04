import { RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { V8AICoreApi } from '../../../services/api/v8/ai-core';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { Button } from '../../ui/primitives/Button';
import { DegradedState } from '../AdminState';

type AICoreEnvironment = {
  healthy?: boolean;
  contract?: string;
  layers?: Record<string, string>;
};

type AICoreTool = {
  toolId?: string;
  name?: string;
  category?: string;
};

type AICoreToolPolicy = {
  tool?: AICoreTool | null;
  effectivePolicy?: {
    state?: string;
    approvalClass?: string;
    policyRef?: string | null;
    blockReason?: string | null;
    allowed?: boolean;
    approvalOverride?: string;
    maxInvocationsPerRun?: number | null;
    projectId?: string | null;
    consumerClass?: string;
  } | null;
};

type AICoreAuditTrail = {
  supportTraces?: Array<{
    id?: string;
    toolName?: string;
    stage?: string;
    status?: string;
  }>;
  provenanceEntries?: Array<{
    id?: string;
    sourceType?: string;
    sourceRef?: string;
    summary?: string;
  }>;
};

type AICoreProvenanceLedger = {
  snapshotId?: string;
  lineage?: Array<{
    id?: string;
    kind?: string;
    label?: string;
  }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toBool = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const normalizeEnvironment = (value: unknown): AICoreEnvironment => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !('healthy' in payload) || !isRecord(payload.layers)) {
    throw new Error('AI core environment response was incomplete');
  }

  return {
    healthy: toBool(payload.healthy, false),
    contract: asText(payload.contract, ''),
    layers: Object.entries(payload.layers).reduce(
      (acc, [layer, status]) => ({ ...acc, [layer]: asText(status, 'unknown') }),
      {} as Record<string, string>
    ),
  };
};

const normalizeTools = (value: unknown): AICoreTool[] => {
  const payload = getObjectPayload(value);
  if (!Array.isArray(payload)) {
    throw new Error('AI core tools response was not a list');
  }

  return payload.map((tool) => {
    if (!isRecord(tool) || !tool.toolId) {
      throw new Error('AI core tool row was incomplete');
    }

    return {
      toolId: asText(tool.toolId, ''),
      name: asText(tool.name, asText(tool.toolId, 'Unknown tool')),
      category: asText(tool.category, ''),
    };
  });
};

const normalizeToolPolicy = (value: unknown): AICoreToolPolicy => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !isRecord(payload.effectivePolicy)) {
    throw new Error('AI core tool policy response was incomplete');
  }
  const tool = isRecord(payload.tool) ? payload.tool : null;
  const effectivePolicy = payload.effectivePolicy;

  return {
    tool: tool
      ? {
          toolId: asText(tool.toolId, ''),
          name: asText(tool.name, ''),
          category: asText(tool.category, ''),
        }
      : null,
    effectivePolicy: {
      state: asText(effectivePolicy.state, ''),
      approvalClass: asText(effectivePolicy.approvalClass, ''),
      policyRef:
        effectivePolicy.policyRef === null || effectivePolicy.policyRef === undefined
          ? null
          : asText(effectivePolicy.policyRef, ''),
      blockReason:
        effectivePolicy.blockReason === null || effectivePolicy.blockReason === undefined
          ? null
          : asText(effectivePolicy.blockReason, ''),
      allowed: toBool(effectivePolicy.allowed, false),
      approvalOverride: asText(effectivePolicy.approvalOverride, ''),
      maxInvocationsPerRun:
        typeof effectivePolicy.maxInvocationsPerRun === 'number'
          ? effectivePolicy.maxInvocationsPerRun
          : null,
      projectId:
        effectivePolicy.projectId === null || effectivePolicy.projectId === undefined
          ? null
          : asText(effectivePolicy.projectId, ''),
      consumerClass: asText(effectivePolicy.consumerClass, ''),
    },
  };
};

const normalizeAuditTrail = (value: unknown): AICoreAuditTrail => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) {
    throw new Error('AI core audit trail response was incomplete');
  }

  return {
    supportTraces: Array.isArray(payload.supportTraces)
      ? payload.supportTraces.filter(isRecord).map((trace) => ({
          id: asText(trace.id, ''),
          toolName: asText(trace.toolName, ''),
          stage: asText(trace.stage, ''),
          status: asText(trace.status, ''),
        }))
      : [],
    provenanceEntries: Array.isArray(payload.provenanceEntries)
      ? payload.provenanceEntries.filter(isRecord).map((entry) => ({
          id: asText(entry.id, ''),
          sourceType: asText(entry.sourceType, ''),
          sourceRef: asText(entry.sourceRef, ''),
          summary: asText(entry.summary, ''),
        }))
      : [],
  };
};

const normalizeProvenanceLedger = (value: unknown): AICoreProvenanceLedger => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) {
    throw new Error('AI core provenance response was incomplete');
  }

  return {
    snapshotId: asText(payload.snapshotId, ''),
    lineage: Array.isArray(payload.lineage)
      ? payload.lineage.filter(isRecord).map((item) => ({
          id: asText(item.id, ''),
          kind: asText(item.kind, ''),
          label: asText(item.label, ''),
        }))
      : [],
  };
};

export const AICoreRuntimePanel: React.FC = () => {
  const { t } = useTranslation();
  const [environment, setEnvironment] = useState<AICoreEnvironment | null>(null);
  const [tools, setTools] = useState<AICoreTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<AICoreToolPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState('');
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustError, setTrustError] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<AICoreAuditTrail | null>(null);
  const [provenanceLedger, setProvenanceLedger] = useState<AICoreProvenanceLedger | null>(null);

  const loadToolPolicy = useCallback(async (toolId: string) => {
    setSelectedToolId(toolId);
    setPolicyLoading(true);
    setPolicyError(null);
    try {
      const data = await V8AICoreApi.getToolPolicy(toolId, 'chat');
      setPolicy(normalizeToolPolicy(data));
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Could not load tool policy');
      setPolicy(null);
      setPolicyError(message);
    } finally {
      setPolicyLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPolicy(null);
    setPolicyError(null);
    try {
      const [environmentData, toolData] = await Promise.all([
        V8AICoreApi.getEnvironment(),
        V8AICoreApi.getTools(),
      ]);
      const nextTools = normalizeTools(toolData);
      setEnvironment(normalizeEnvironment(environmentData));
      setTools(nextTools);
      const firstToolId = nextTools[0]?.toolId ?? null;
      setSelectedToolId(firstToolId);
      if (firstToolId) {
        await loadToolPolicy(firstToolId);
      } else {
        setSelectedToolId(null);
      }
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Could not load AI core runtime');
      setError(message);
      setEnvironment(null);
      setTools([]);
      setSelectedToolId(null);
      setAuditTrail(null);
      setProvenanceLedger(null);
    } finally {
      setLoading(false);
    }
  }, [loadToolPolicy]);

  const loadTrustReadback = useCallback(async () => {
    const nextSnapshotId = snapshotId.trim();
    if (!nextSnapshotId) return;

    setTrustLoading(true);
    setTrustError(null);
    try {
      const [auditData, provenanceData] = await Promise.all([
        V8AICoreApi.getAuditTrail(nextSnapshotId),
        V8AICoreApi.getProvenance(nextSnapshotId),
      ]);
      setAuditTrail(normalizeAuditTrail(auditData));
      setProvenanceLedger(normalizeProvenanceLedger(provenanceData));
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Could not load trust readback');
      setAuditTrail(null);
      setProvenanceLedger(null);
      setTrustError(message);
    } finally {
      setTrustLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const layerEntries = Object.entries(environment?.layers ?? {});

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('superadmin.aiCoreRuntime.title', { defaultValue: 'AI core runtime (V8)' })}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('superadmin.aiCoreRuntime.subtitle', {
              defaultValue:
                'Read-only summary from GET /api/v8/ai-core/environment and GET /api/v8/ai-core/tools',
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2"
          aria-label={t('superadmin.aiCoreRuntime.refresh', { defaultValue: 'Refresh' })}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {t('superadmin.aiCoreRuntime.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-slate-200 dark:border-c-border-subtle bg-white dark:bg-navy-900 p-4 shadow-sm">
          <DegradedState title="AI core runtime unavailable" description={error} />
        </div>
      )}

      {loading && !environment && !error && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('superadmin.aiCoreRuntime.loading', { defaultValue: 'Loading AI core runtime…' })}
        </p>
      )}

      {!error && environment && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-c-border-subtle bg-white dark:bg-navy-900 p-4 shadow-sm">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                {t('superadmin.aiCoreRuntime.fields.healthy', { defaultValue: 'Healthy' })}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {environment.healthy
                  ? t('superadmin.aiCoreRuntime.healthyYes', { defaultValue: 'Yes' })
                  : t('superadmin.aiCoreRuntime.healthyNo', { defaultValue: 'No' })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                {t('superadmin.aiCoreRuntime.fields.contract', { defaultValue: 'Contract' })}
              </dt>
              <dd className="mt-1 font-mono text-sm text-slate-900 dark:text-white">
                {environment.contract || t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                {t('superadmin.aiCoreRuntime.fields.toolCount', { defaultValue: 'Tools' })}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {tools.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                {t('superadmin.aiCoreRuntime.fields.layers', { defaultValue: 'Layers' })}
              </dt>
              <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                {layerEntries.length}
              </dd>
            </div>
          </dl>

          <div className="rounded-xl border border-slate-200 dark:border-c-border-subtle bg-white dark:bg-navy-900 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.aiCoreRuntime.layerSummary', { defaultValue: 'Layer status' })}
            </div>
            <div className="mt-3 space-y-2">
              {layerEntries.length > 0 ? (
                layerEntries.map(([layer, status]) => (
                  <div
                    key={layer}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-c-border-subtle px-3 py-2 text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{layer}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{status}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t('superadmin.aiCoreRuntime.noLayers', {
                    defaultValue: 'No layer summary returned.',
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-c-border-subtle bg-white dark:bg-navy-900 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('superadmin.aiCoreRuntime.toolsTitle', {
                      defaultValue: 'Governed tool catalog',
                    })}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {t('superadmin.aiCoreRuntime.toolsSubtitle', {
                      defaultValue: 'Read-only catalog from the governed V8 AI core tool registry.',
                    })}
                  </p>
                </div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {tools.length}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {tools.length > 0
                  ? tools.map((tool) => {
                      const isSelected = selectedToolId === tool.toolId;
                      return (
                        <button
                          type="button"
                          key={tool.toolId || tool.name}
                          onClick={() => tool.toolId && void loadToolPolicy(tool.toolId)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            isSelected
                              ? 'border-primary-400 bg-primary-50/70 dark:border-primary-500/60 dark:bg-primary-950/30'
                              : 'border-slate-200 hover:border-primary-300 dark:border-c-border-subtle dark:hover:border-primary-500/40'
                          }`}
                        >
                          <div className="font-medium text-slate-900 dark:text-white">
                            {tool.name || tool.toolId || 'Unknown tool'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {tool.toolId ||
                              t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                            {tool.category ? ` · ${tool.category}` : ''}
                          </div>
                        </button>
                      );
                    })
                  : !loading && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('superadmin.aiCoreRuntime.noTools', {
                          defaultValue: 'No governed tools returned.',
                        })}
                      </div>
                    )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-c-border-subtle bg-white dark:bg-navy-900 p-4 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('superadmin.aiCoreRuntime.policyTitle', {
                    defaultValue: 'Tool policy readback',
                  })}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t('superadmin.aiCoreRuntime.policySubtitle', {
                    defaultValue:
                      'Read-only effective policy for the selected tool under consumer class chat.',
                  })}
                </p>
              </div>

              {policyError && (
                <div
                  className="mt-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800 dark:border-danger-900/50 dark:bg-danger-900/40 dark:text-danger-200"
                  role="alert"
                >
                  {t('superadmin.aiCoreRuntime.policyLoadError', {
                    defaultValue: 'Could not load tool policy: {{message}}',
                    message: policyError,
                  })}
                </div>
              )}

              {policyLoading && (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  {t('superadmin.aiCoreRuntime.policyLoading', {
                    defaultValue: 'Loading tool policy…',
                  })}
                </p>
              )}

              {!policyLoading && !policyError && policy?.effectivePolicy && (
                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {t('superadmin.aiCoreRuntime.policyFields.state', { defaultValue: 'State' })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {policy.effectivePolicy.state ||
                        t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {t('superadmin.aiCoreRuntime.policyFields.approvalClass', {
                        defaultValue: 'Approval class',
                      })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {policy.effectivePolicy.approvalClass ||
                        t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {t('superadmin.aiCoreRuntime.policyFields.allowed', {
                        defaultValue: 'Allowed',
                      })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {policy.effectivePolicy.allowed === undefined
                        ? t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })
                        : policy.effectivePolicy.allowed
                          ? t('superadmin.aiCoreRuntime.healthyYes', { defaultValue: 'Yes' })
                          : t('superadmin.aiCoreRuntime.healthyNo', { defaultValue: 'No' })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {t('superadmin.aiCoreRuntime.policyFields.approvalOverride', {
                        defaultValue: 'Approval override',
                      })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {policy.effectivePolicy.approvalOverride ||
                        t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {t('superadmin.aiCoreRuntime.policyFields.maxInvocations', {
                        defaultValue: 'Max invocations per run',
                      })}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {policy.effectivePolicy.maxInvocationsPerRun ??
                        t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {t('superadmin.aiCoreRuntime.policyFields.policyRef', {
                        defaultValue: 'Policy ref',
                      })}
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-slate-900 dark:text-white break-all">
                      {policy.effectivePolicy.policyRef ||
                        t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {t('superadmin.aiCoreRuntime.policyFields.blockReason', {
                        defaultValue: 'Block reason',
                      })}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {policy.effectivePolicy.blockReason ||
                        t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                    </dd>
                  </div>
                </dl>
              )}

              {!policyLoading && !policyError && !policy?.effectivePolicy && (
                <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  {t('superadmin.aiCoreRuntime.noPolicy', {
                    defaultValue: 'Select a governed tool to read its effective policy.',
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-c-border-subtle bg-white dark:bg-navy-900 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('superadmin.aiCoreRuntime.trustTitle', {
                    defaultValue: 'Trust and provenance readback',
                  })}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t('superadmin.aiCoreRuntime.trustSubtitle', {
                    defaultValue:
                      'Read-only audit trail and provenance ledger from the governed V8 trust endpoints for one snapshot/output id.',
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={snapshotId}
                  onChange={(event) => setSnapshotId(event.target.value)}
                  placeholder={t('superadmin.aiCoreRuntime.snapshotPlaceholder', {
                    defaultValue: 'Enter snapshot id',
                  })}
                  className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary-400 dark:border-c-border-subtle dark:bg-navy-950 dark:text-white"
                  aria-label={t('superadmin.aiCoreRuntime.snapshotLabel', {
                    defaultValue: 'Snapshot id',
                  })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadTrustReadback()}
                  disabled={trustLoading || !snapshotId.trim()}
                >
                  {trustLoading
                    ? t('superadmin.aiCoreRuntime.trustLoading', { defaultValue: 'Loading trust…' })
                    : t('superadmin.aiCoreRuntime.loadTrust', { defaultValue: 'Load trust' })}
                </Button>
              </div>
            </div>

            {trustError && (
              <div
                className="mt-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800 dark:border-danger-900/50 dark:bg-danger-900/40 dark:text-danger-200"
                role="alert"
              >
                {t('superadmin.aiCoreRuntime.trustLoadError', {
                  defaultValue: 'Could not load trust readback: {{message}}',
                  message: trustError,
                })}
              </div>
            )}

            {!trustError && !auditTrail && !provenanceLedger && (
              <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                {t('superadmin.aiCoreRuntime.noTrust', {
                  defaultValue: 'Enter a snapshot id to read governed trust and provenance.',
                })}
              </div>
            )}

            {(auditTrail || provenanceLedger) && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
                <div className="rounded-lg border border-slate-200 dark:border-c-border-subtle px-4 py-3">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    {t('superadmin.aiCoreRuntime.auditTrailTitle', { defaultValue: 'Audit trail' })}
                  </div>
                  <div className="mt-3 space-y-2">
                    {(auditTrail?.supportTraces?.length || 0) > 0 ? (
                      (auditTrail?.supportTraces ?? []).map((trace, index) => (
                        <div
                          key={trace.id || `${trace.toolName || 'trace'}-${index}`}
                          className="rounded-lg border border-slate-200 dark:border-c-border-subtle px-3 py-2"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {trace.toolName ||
                              trace.id ||
                              t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {[trace.stage, trace.status].filter(Boolean).join(' · ') ||
                              t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('superadmin.aiCoreRuntime.noAuditTrail', {
                          defaultValue: 'No support traces returned for this snapshot.',
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-c-border-subtle px-4 py-3">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    {t('superadmin.aiCoreRuntime.provenanceTitle', {
                      defaultValue: 'Provenance ledger',
                    })}
                  </div>
                  <div className="mt-3 space-y-2">
                    {(provenanceLedger?.lineage?.length || 0) > 0 ? (
                      (provenanceLedger?.lineage ?? []).map((entry, index) => (
                        <div
                          key={entry.id || `${entry.label || 'lineage'}-${index}`}
                          className="rounded-lg border border-slate-200 dark:border-c-border-subtle px-3 py-2"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {entry.label ||
                              entry.id ||
                              t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {entry.kind ||
                              t('superadmin.aiCoreRuntime.none', { defaultValue: '—' })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('superadmin.aiCoreRuntime.noProvenance', {
                          defaultValue: 'No provenance ledger returned for this snapshot.',
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AICoreRuntimePanel;
