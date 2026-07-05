/**
 * MappingDriftPanel — Field mapping preview, validation, and drift review.
 *
 * Two modes:
 *  - Overview mode (no integrationId): shows all integrations' mapping summaries
 *  - Detail mode (integrationId provided): shows field mappings, entity maps, drift, sync states
 */

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Code,
  FileWarning,
  GitMerge,
  Loader2,
  RefreshCw,
  Save,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';
import { EmptyState } from '@/components/ui/composed';
import { LoadingState } from '@/components/ui/primitives';

import { v8Get } from '../../../services/api/v8/client';
import { V8SyncApi, V8SyncMappingData } from '../../../services/api/v8/sync';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';

interface MappingOverviewItem {
  integrationId: string;
  name: string;
  connectorId: string;
  status: string;
  lastSyncAt: string | null;
  fieldMappingCount: number;
  entityMappingCount: number;
  openDriftCount: number;
}

interface MappingDriftPanelProps {
  integrationId?: string;
  onBack?: () => void;
}

type SubTab = 'fields' | 'entities' | 'drift' | 'sync';

const normalizeJson = (value: unknown) => JSON.stringify(value ?? []);

const formatTimestamp = (timestamp: string | null | undefined) => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const MappingDriftPanel: React.FC<MappingDriftPanelProps> = ({
  integrationId: initialId,
  onBack,
}) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialId && initialId !== '__all__' ? initialId : null
  );
  const [overview, setOverview] = useState<MappingOverviewItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<V8SyncMappingData | null>(null);
  const [fieldMappingsJson, setFieldMappingsJson] = useState('[]');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SubTab>('fields');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      setLoadError(null);
      const resp = await v8Get<{ integrations: MappingOverviewItem[] }>('/sync/mappings/overview');
      const d = (resp as { data?: { integrations: MappingOverviewItem[] } }).data ?? resp;
      setOverview(d.integrations || []);
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load mapping overview'));
      setOverview([]);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        setLoadError(null);
        const resp = await V8SyncApi.getMappings(id);
        const d = ((resp as { data?: V8SyncMappingData }).data ?? resp) as V8SyncMappingData;
        setData(d);
        setFieldMappingsJson(JSON.stringify(d.fieldMappings ?? [], null, 2));
        return d as V8SyncMappingData;
      } catch (error: unknown) {
        const message = normalizeApiErrorMessage(
          error,
          t('integrations.mappings.loadError', 'Failed to load mapping data')
        );
        setLoadError(message);
        toast.error(message);
        setData(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      loadOverview();
    }
  }, [selectedId, loadDetail, loadOverview]);

  const handleJsonChange = (value: string) => {
    setFieldMappingsJson(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleSave = async () => {
    if (jsonError || !selectedId) return;
    setSaving(true);
    try {
      setActionError(null);
      const parsed = JSON.parse(fieldMappingsJson);
      await V8SyncApi.saveMappings(selectedId, parsed);
      const refreshed = await loadDetail(selectedId);
      if (!refreshed || normalizeJson(refreshed.fieldMappings) !== normalizeJson(parsed)) {
        throw new Error('Field mappings save was not confirmed by the server');
      }
      toast.success(t('integrations.mappings.saved', 'Mappings saved'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('integrations.mappings.saveError', 'Failed to save mappings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      synced: {
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      conflict: {
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        icon: <AlertTriangle className="w-3 h-3" />,
      },
      error: {
        color: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
        icon: <XCircle className="w-3 h-3" />,
      },
      stale: {
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        icon: <AlertTriangle className="w-3 h-3" />,
      },
      pending: {
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        icon: <Loader2 className="w-3 h-3" />,
      },
      active: {
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: <CheckCircle className="w-3 h-3" />,
      },
    };
    const m = map[status] || {
      color: 'bg-c-surface-raised text-c-text-secondary',
      icon: null,
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.color}`}
      >
        {m.icon} {status}
      </span>
    );
  };

  // ─── Overview mode ─────────────────────────────────────────────────────────
  if (!selectedId) {
    if (overviewLoading) {
      return <LoadingState variant="spinner" />;
    }

    if (loadError) {
      return <DegradedState title="Mapping overview unavailable" description={loadError} />;
    }

    if (overview.length === 0) {
      return (
        <EmptyState
          icon={<GitMerge />}
          title={t('integrations.mappings.noIntegrations', 'No integrations with mappings found.')}
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
              <GitMerge size={20} />
              {t('integrations.mappings.overviewTitle', 'Mapping Overview')}
            </h3>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'integrations.mappings.overviewDesc',
                'Select an integration to view and manage its field mappings.'
              )}
            </p>
          </div>
          <button
            onClick={loadOverview}
            className="p-2 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {overview.map((item) => (
            <button
              key={item.integrationId}
              onClick={() => setSelectedId(item.integrationId)}
              className="w-full text-left p-4 rounded-xl border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised hover:border-brand/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-c-text">
                      {item.name || item.connectorId}
                    </span>
                    {statusBadge(item.status)}
                  </div>
                  <div className="flex gap-4 mt-1.5 text-xs text-c-text-muted">
                    <span>
                      {item.fieldMappingCount}{' '}
                      {t('integrations.mappings.fieldMappings', 'field mappings')}
                    </span>
                    <span>
                      {item.entityMappingCount}{' '}
                      {t('integrations.mappings.entityMaps', 'entity maps')}
                    </span>
                    {item.openDriftCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {item.openDriftCount} {t('integrations.mappings.openDrift', 'open drift')}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-c-text-secondary" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Detail mode ───────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setSelectedId(null);
            onBack?.();
          }}
          className="flex items-center gap-1 text-sm text-brand hover:underline"
        >
          <ArrowLeft size={14} /> {t('common.back', 'Back')}
        </button>
        {loadError ? (
          <DegradedState title="Mapping data unavailable" description={loadError} />
        ) : (
          <EmptyState
            preset="noData"
            title={t(
              'integrations.mappings.noData',
              'No mapping data available for this integration.'
            )}
          />
        )}
      </div>
    );
  }

  const tabs: { id: SubTab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'fields',
      label: t('integrations.mappings.tabs.fields', 'Field Mappings'),
      icon: <Code className="w-4 h-4" />,
    },
    {
      id: 'entities',
      label: t('integrations.mappings.tabs.entities', 'Entity Maps'),
      icon: <GitMerge className="w-4 h-4" />,
      count: data.entityMappings.length,
    },
    {
      id: 'drift',
      label: t('integrations.mappings.tabs.drift', 'Schema Drift'),
      icon: <FileWarning className="w-4 h-4" />,
      count: data.driftEvents.filter((d) => !d.resolvedAt).length,
    },
    {
      id: 'sync',
      label: t('integrations.mappings.tabs.sync', 'Sync States'),
      icon: <RefreshCw className="w-4 h-4" />,
      count: data.syncStates.length,
    },
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={() => {
          setSelectedId(null);
          onBack?.();
        }}
        className="flex items-center gap-1 text-sm text-brand hover:underline"
      >
        <ArrowLeft size={14} /> {t('common.back', 'Back to overview')}
      </button>

      {actionError && <Banner variant="danger" title={actionError} />}

      <div className="bg-c-surface-raised rounded-xl border border-c-border-subtle dark:border-navy-700">
        <div className="flex border-b border-c-border-subtle dark:border-navy-700 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-c-text-muted hover:text-c-text-secondary'
              }`}
            >
              {tab.icon}
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-c-surface-raised rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'fields' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-c-text-secondary">
                  {t('integrations.mappings.fieldEditor', 'Field Mapping Configuration')}
                </h3>
                <button
                  onClick={handleSave}
                  disabled={saving || !!jsonError}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white dark:text-navy-950 bg-navy-900 dark:bg-[#F4F7FB] rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {t('common.save', 'Save')}
                </button>
              </div>
              <textarea
                value={fieldMappingsJson}
                onChange={(e) => handleJsonChange(e.target.value)}
                className={`w-full h-64 p-3 text-xs font-mono rounded-lg border ${
                  jsonError
                    ? 'border-danger-400 bg-danger-50 dark:bg-danger-900/20'
                    : 'border-c-border-subtle dark:border-navy-700 bg-c-surface-raised'
                } text-c-text`}
                spellCheck={false}
              />
              {jsonError && <p className="text-xs text-danger-500">{jsonError}</p>}
            </div>
          )}

          {activeTab === 'entities' && (
            <div className="overflow-x-auto">
              <table /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */  className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-c-text-muted uppercase tracking-wider border-b border-c-border-subtle dark:border-navy-700">
                    <th className="pb-2 pr-4">
                      {t('integrations.mappings.localType', 'Local Type')}
                    </th>
                    <th className="pb-2 pr-4">{t('integrations.mappings.localId', 'Local ID')}</th>
                    <th className="pb-2 pr-4">
                      {t('integrations.mappings.externalType', 'External Type')}
                    </th>
                    <th className="pb-2 pr-4">
                      {t('integrations.mappings.externalId', 'External ID')}
                    </th>
                    <th className="pb-2 pr-4">{t('common.status', 'Status')}</th>
                    <th className="pb-2">{t('integrations.mappings.lastSync', 'Last Sync')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entityMappings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-c-text-secondary"
                      >
                        {t('common.noData', 'No data')}
                      </td>
                    </tr>
                  ) : (
                    data.entityMappings.map((m) => (
                      <tr key={m.id} className="border-b border-c-border-subtle dark:border-navy-700/50">
                        <td className="py-2 pr-4 font-mono text-xs">{m.localType}</td>
                        <td className="py-2 pr-4 font-mono text-xs truncate max-w-[120px]">
                          {m.localId}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{m.externalType}</td>
                        <td className="py-2 pr-4 font-mono text-xs truncate max-w-[120px]">
                          {m.externalId}
                        </td>
                        <td className="py-2 pr-4">{statusBadge(m.syncStatus)}</td>
                        <td className="py-2 text-xs text-c-text-muted">
                          {formatTimestamp(m.lastSyncedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'drift' && (
            <div className="space-y-3">
              {data.driftEvents.length === 0 ? (
                <div className="text-center py-8 text-c-text-secondary">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  <p className="text-sm">
                    {t('integrations.mappings.noDrift', 'No schema drift detected')}
                  </p>
                </div>
              ) : (
                data.driftEvents.map((d) => (
                  <div
                    key={d.driftId}
                    className={`p-3 rounded-lg border ${
                      d.resolvedAt
                        ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900/30'
                        : 'border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-c-text">
                        {d.driftType}
                      </span>
                      {d.resolvedAt ? (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {t('common.resolved', 'Resolved')}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                          {t('common.open', 'Open')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-c-text-muted mt-1">
                      {t('integrations.mappings.detected', 'Detected')}:{' '}
                      {formatTimestamp(d.detectedAt)}
                    </p>
                    {d.affectedFields && (
                      <p className="text-xs font-mono text-c-text-secondary mt-1">
                        {d.affectedFields}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-c-text-muted uppercase tracking-wider border-b border-c-border-subtle dark:border-navy-700">
                    <th className="pb-2 pr-4">
                      {t('integrations.mappings.objectType', 'Object Type')}
                    </th>
                    <th className="pb-2 pr-4">
                      {t('integrations.mappings.objectId', 'Object ID')}
                    </th>
                    <th className="pb-2 pr-4">{t('common.status', 'Status')}</th>
                    <th className="pb-2 pr-4">
                      {t('integrations.mappings.errorClass', 'Error Class')}
                    </th>
                    <th className="pb-2">{t('integrations.mappings.lastSync', 'Last Sync')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.syncStates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-c-text-secondary"
                      >
                        {t('common.noData', 'No data')}
                      </td>
                    </tr>
                  ) : (
                    data.syncStates.map((s) => (
                      <tr key={s.id} className="border-b border-c-border-subtle dark:border-navy-700/50">
                        <td className="py-2 pr-4 text-xs">{s.objectType}</td>
                        <td className="py-2 pr-4 font-mono text-xs truncate max-w-[120px]">
                          {s.objectId}
                        </td>
                        <td className="py-2 pr-4">{statusBadge(s.syncStatus)}</td>
                        <td className="py-2 pr-4 text-xs text-c-text-muted">
                          {s.errorClass || '—'}
                        </td>
                        <td className="py-2 text-xs text-c-text-muted">
                          {formatTimestamp(s.lastSyncedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default MappingDriftPanel;
