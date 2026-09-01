import {
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  List,
  Plug,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';

type Wave7Connector = {
  connectorId: string;
  provider: string;
  displayName: string;
  status: string;
  authState?: string;
  accessState?: string;
  scopes?: string[];
  projectIds?: string[];
  freshnessAgeMinutes?: number | null;
  freshnessTtlMinutes?: number;
  tokenExpiresAt?: string | null;
  tokenExpired?: boolean;
  reconnectRequired?: boolean;
  accessRevokedAt?: string | null;
  revokedReason?: string | null;
  failureState?: string | null;
  tenantPolicy?: { externalConnectorId?: string | null };
};

const CONNECTOR_STATUS_TONE: Record<string, string> = {
  connected: 'text-emerald-600 dark:text-emerald-400',
  stale: 'text-amber-600 dark:text-amber-400',
  disconnected: 'text-c-danger',
  failed: 'text-c-danger',
};

/**
 * 171-pojedyncze (uwaga właściciela, odbiór 2026-09-01): "Dodaj tutaj także
 * wersję w liście. Bo jak będzie dużo pozycji do dołączenia, to może być
 * trudniej zarządzać, czyli zmiany widoków." — StandardTable (twarda reguła
 * projektu, zero bespoke tabel), filtrowalna kolumna Status dla skali.
 * Reszta panelu (rejestracja/test narzędzia/OAuth) zostaje nietknięta —
 * poza zakresem tej pojedynczej uwagi.
 */
const ConnectorsListView: React.FC<{
  connectors: Wave7Connector[];
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ connectors, t }) => {
  const rows = React.useMemo<TableRow[]>(
    () =>
      connectors.map((connector) => ({
        id: connector.connectorId,
        connector,
      })),
    [connectors]
  );

  const columns = React.useMemo<TableColumn[]>(
    () => [
      {
        id: 'connector',
        label: t('aios.wave7ConnectorAdminPanel.columns.connector'),
        render: (row) => (
          <span className="font-medium text-c-text">
            {(row.connector as Wave7Connector).displayName}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('aios.wave7ConnectorAdminPanel.columns.status'),
        filterable: true,
        filterOptions: ['connected', 'stale', 'disconnected', 'failed'].map((value) => ({
          value,
          label: t(`aios.wave7ConnectorAdminPanel.${value}`),
        })),
        render: (row) => {
          const connector = row.connector as Wave7Connector;
          return (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                CONNECTOR_STATUS_TONE[connector.status] || 'text-c-text-secondary'
              }`}
            >
              {connector.status === 'connected' ? (
                <CheckCircle2 size={13} />
              ) : (
                <AlertTriangle size={13} />
              )}
              {t(`aios.wave7ConnectorAdminPanel.${connector.status}`)}
            </span>
          );
        },
      },
      {
        id: 'freshness',
        label: t('aios.wave7ConnectorAdminPanel.columns.freshness'),
        render: (row) => {
          const connector = row.connector as Wave7Connector;
          return (
            <span className="text-xs text-c-text-secondary">
              {connector.freshnessAgeMinutes ?? t('aios.wave7ConnectorAdminPanel.unknown')} /{' '}
              {connector.freshnessTtlMinutes ?? t('aios.unknown')} min
            </span>
          );
        },
      },
      {
        id: 'oauth',
        label: t('aios.wave7ConnectorAdminPanel.columns.oauth'),
        render: (row) => {
          const connector = row.connector as Wave7Connector;
          return (
            <span className="text-xs text-c-text-secondary">
              {connector.accessState || connector.authState || t('aios.unknown')}
            </span>
          );
        },
      },
      {
        id: 'acl',
        label: t('aios.wave7ConnectorAdminPanel.columns.acl'),
        render: (row) => {
          const connector = row.connector as Wave7Connector;
          return (
            <span className="text-xs text-c-text-secondary">
              {(connector.projectIds || []).length ? connector.projectIds?.join(', ') : 'tenant'}
            </span>
          );
        },
      },
      {
        id: 'sourceBinding',
        label: t('aios.wave7ConnectorAdminPanel.columns.sourceBinding'),
        render: (row) => {
          const connector = row.connector as Wave7Connector;
          return (
            <span className="text-xs text-c-text-secondary">
              {connector.tenantPolicy?.externalConnectorId ||
                t('aios.wave7ConnectorAdminPanel.registryOnly')}
            </span>
          );
        },
      },
      {
        id: 'issue',
        label: t('aios.wave7ConnectorAdminPanel.columns.issue'),
        render: (row) => {
          const connector = row.connector as Wave7Connector;
          const issue = connector.failureState
            ? t('aios.wave7ConnectorAdminPanel.failure') + ': ' + connector.failureState
            : connector.accessRevokedAt
              ? connector.revokedReason
                ? t('aios.wave7ConnectorAdminPanel.accessRevokedWithReason', {
                    reason: connector.revokedReason,
                  })
                : t('aios.wave7ConnectorAdminPanel.accessRevoked')
              : connector.reconnectRequired || connector.tokenExpired
                ? t('aios.wave7ConnectorAdminPanel.reconnectRequired')
                : null;
          return issue ? (
            <span className="text-xs font-medium text-c-danger">{issue}</span>
          ) : (
            <span className="text-xs text-c-text-muted">
              {t('aios.wave7ConnectorAdminPanel.noIssue')}
            </span>
          );
        },
      },
    ],
    [t]
  );

  return (
    <StandardTable
      columns={columns}
      data={rows}
      empty={{
        title: t('aios.wave7ConnectorAdminPanel.noWave7ConnectorsYet'),
      }}
      persistKey="aios.wave7Connectors"
    />
  );
};

export const Wave7ConnectorAdminPanel: React.FC = () => {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [catalog, setCatalog] = React.useState<any[]>([]);
  const [connectors, setConnectors] = React.useState<Wave7Connector[]>([]);
  const [health, setHealth] = React.useState<any | null>(null);
  const [runs, setRuns] = React.useState<any[]>([]);
  const [provider, setProvider] = React.useState('google_drive');
  const [status, setStatus] = React.useState<'connected' | 'disconnected' | 'stale' | 'failed'>(
    'connected'
  );
  const [projectIds, setProjectIds] = React.useState('');
  const [externalConnectorId, setExternalConnectorId] = React.useState('');
  const [selectedConnectorId, setSelectedConnectorId] = React.useState('');
  const [toolKind, setToolKind] = React.useState<'read' | 'search' | 'write' | 'destructive'>(
    'search'
  );
  const [query, setQuery] = React.useState('meeting follow-up');
  const [aiRunId, setAiRunId] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  // 171-pojedyncze (uwaga właściciela): "Dodaj tutaj także wersję w liście.
  // Bo jak będzie dużo pozycji do dołączenia, to może być trudniej
  // zarządzać" — kafle zostają domyślne (mało konektorów = wygodne), lista
  // (StandardTable — twarda reguła projektu, zero bespoke) jest alternatywą
  // dla organizacji z wieloma podłączonymi źródłami.
  const [connectorsView, setConnectorsView] = React.useState<'tiles' | 'list'>('tiles');

  const load = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [catalogRes, connectorsRes, healthRes, runsRes] = await Promise.all([
        Api.getWave7ConnectorCatalog(),
        Api.listWave7Connectors(),
        Api.getWave7ConnectorHealth(),
        Api.listWave7ConnectorRuns(),
      ]);
      setCatalog(Array.isArray(catalogRes?.catalog) ? catalogRes.catalog : []);
      const nextConnectors = Array.isArray(connectorsRes?.connectors)
        ? connectorsRes.connectors
        : [];
      setConnectors(nextConnectors);
      setHealth(healthRes?.health || null);
      setRuns(Array.isArray(runsRes?.runs) ? runsRes.runs : []);
      if (!selectedConnectorId && nextConnectors.length > 0) {
        setSelectedConnectorId(nextConnectors[0].connectorId);
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  }, [selectedConnectorId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const register = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.registerWave7Connector({
        provider,
        status,
        scopes: ['read', 'search'],
        projectIds: projectIds
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        tenantPolicy: { acl: projectIds.trim() ? 'project' : 'tenant' },
        freshnessTtlMinutes: 240,
      });
      if (res?.connector?.connectorId) setSelectedConnectorId(res.connector.connectorId);
      setMessage('Connector registered with ACL and freshness policy.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to register connector');
    } finally {
      setLoading(false);
    }
  };

  const executeTool = async () => {
    if (!selectedConnectorId) {
      setMessage('Select connector first.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.executeWave7ConnectorTool({
        connectorId: selectedConnectorId,
        toolName: toolKind === 'search' ? 'connector_search' : 'connector_tool',
        toolKind,
        query,
        aiRunId: aiRunId || null,
      });
      setMessage(
        res?.allowed
          ? 'Connector tool executed with source trace.'
          : `Connector tool blocked: ${res?.run?.error || 'policy'}`
      );
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Connector execution failed');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const linkConnector = async () => {
    if (!selectedConnectorId || !externalConnectorId.trim()) {
      setMessage('Select Wave 7 connector and provide tp_connectors id.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await Api.linkWave7Connector(selectedConnectorId, externalConnectorId.trim());
      setMessage('Connector linked to real dataCollection source.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Connector link failed');
    } finally {
      setLoading(false);
    }
  };

  const disconnectConnector = async () => {
    if (!selectedConnectorId) return;
    setLoading(true);
    setMessage(null);
    try {
      await Api.disconnectWave7Connector(selectedConnectorId);
      setMessage('Connector disconnected.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Disconnect failed');
    } finally {
      setLoading(false);
    }
  };

  const reconnectConnector = async () => {
    if (!selectedConnectorId) return;
    setLoading(true);
    setMessage(null);
    try {
      await Api.updateWave7Connector(selectedConnectorId, {
        status: 'connected',
        reconnectRequired: false,
        accessRevokedAt: null,
        revokedReason: null,
        failureState: null,
      } as any);
      setMessage('Connector marked reconnected; OAuth session state cleared.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Reconnect failed');
    } finally {
      setLoading(false);
    }
  };

  const revokeConnector = async () => {
    if (!selectedConnectorId) return;
    setLoading(true);
    setMessage(null);
    try {
      await Api.updateWave7Connector(selectedConnectorId, {
        status: 'disconnected',
        reconnectRequired: true,
        accessRevokedAt: new Date().toISOString(),
        revokedReason: 'oauth_access_revoked',
        failureState: 'revoked_access',
      } as any);
      setMessage('Connector access marked revoked and blocked until reconnect.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Revoke failed');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const reindexConnector = async () => {
    if (!selectedConnectorId) return;
    setLoading(true);
    setMessage(null);
    try {
      await Api.reindexWave7Connector(selectedConnectorId);
      setMessage('Connector reindex accepted and audited.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Reindex failed');
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-900 dark:text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('aios.wave7ConnectorAdminPanel.wave7ConnectorAdmin')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('aios.wave7ConnectorAdminPanel.permissionAwareConnectorRegistryOauthSes')}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50 dark:border-navy-700"
        >
          <RefreshCw size={16} /> {t('aios.wave7ConnectorAdminPanel.refresh')}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
          <h2 className="flex items-center gap-2 font-semibold">
            <Plug size={18} /> {t('aios.wave7ConnectorAdminPanel.registerConnector')}
          </h2>
          <div className="mt-4 space-y-3">
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              {(catalog.length
                ? catalog
                : [{ provider: 'google_drive', displayName: 'Google Drive' }]
              ).map((item: any) => (
                <option key={item.provider} value={item.provider}>
                  {item.displayName || item.provider}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="connected">{t('aios.wave7ConnectorAdminPanel.connected')}</option>
              <option value="stale">{t('aios.wave7ConnectorAdminPanel.stale')}</option>
              <option value="disconnected">
                {t('aios.wave7ConnectorAdminPanel.disconnected')}
              </option>
              <option value="failed">{t('aios.wave7ConnectorAdminPanel.failed')}</option>
            </select>
            <input
              value={projectIds}
              onChange={(event) => setProjectIds(event.target.value)}
              placeholder={t('aios.wave7ConnectorAdminPanel.optionalProjectAclIdsCommaSeparated')}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <button
              type="button"
              onClick={register}
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
            >
              {t('aios.wave7ConnectorAdminPanel.registerConnector2')}
            </button>
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-semibold">
            <ShieldAlert size={18} /> {t('aios.wave7ConnectorAdminPanel.toolExecutionTest')}
          </h2>
          <div className="mt-4 space-y-3">
            <select
              value={selectedConnectorId}
              onChange={(event) => setSelectedConnectorId(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="">{t('aios.wave7ConnectorAdminPanel.selectConnector')}</option>
              {connectors.map((connector) => (
                <option key={connector.connectorId} value={connector.connectorId}>
                  {connector.displayName} ({connector.status})
                </option>
              ))}
            </select>
            <select
              value={toolKind}
              onChange={(event) => setToolKind(event.target.value as typeof toolKind)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="read">{t('aios.wave7ConnectorAdminPanel.read')}</option>
              <option value="search">{t('aios.wave7ConnectorAdminPanel.search')}</option>
              <option value="write">{t('aios.wave7ConnectorAdminPanel.writeRequiresAirun')}</option>
              <option value="destructive">
                {t('aios.wave7ConnectorAdminPanel.destructiveRequiresAirun')}
              </option>
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('aios.wave7ConnectorAdminPanel.connectorQuery')}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <input
              value={aiRunId}
              onChange={(event) => setAiRunId(event.target.value)}
              placeholder={t('aios.wave7ConnectorAdminPanel.airunIdForWriteDestructiveTools')}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <button
              type="button"
              onClick={executeTool}
              disabled={loading || !selectedConnectorId}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('aios.wave7ConnectorAdminPanel.executeGovernedTool')}
            </button>
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-semibold">
            <Plug size={18} /> {t('aios.wave7ConnectorAdminPanel.realSourceBinding')}
          </h2>
          <div className="mt-4 space-y-3">
            <input
              value={externalConnectorId}
              onChange={(event) => setExternalConnectorId(event.target.value)}
              placeholder={t('aios.wave7ConnectorAdminPanel.existingTpConnectorsId')}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={linkConnector}
                disabled={loading || !selectedConnectorId}
                className="rounded-md border px-2 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
              >
                {t('aios.wave7ConnectorAdminPanel.link')}
              </button>
              <button
                type="button"
                onClick={reindexConnector}
                disabled={loading || !selectedConnectorId}
                className="rounded-md border px-2 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
              >
                {t('aios.wave7ConnectorAdminPanel.reindex')}
              </button>
              <button
                type="button"
                onClick={disconnectConnector}
                disabled={loading || !selectedConnectorId}
                className="rounded-md border border-danger-200 px-2 py-2 text-xs font-medium text-danger-700 disabled:opacity-50 dark:border-danger-900 dark:text-danger-200"
              >
                {t('aios.wave7ConnectorAdminPanel.disconnect')}
              </button>
            </div>
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-semibold">
            <ShieldAlert size={18} /> {t('aios.wave7ConnectorAdminPanel.oauthSessionLifecycle')}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={reconnectConnector}
              disabled={loading || !selectedConnectorId}
              className="rounded-md border px-2 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
            >
              {t('aios.wave7ConnectorAdminPanel.markReconnected')}
            </button>
            <button
              type="button"
              onClick={revokeConnector}
              disabled={loading || !selectedConnectorId}
              className="rounded-md border border-danger-200 px-2 py-2 text-xs font-medium text-danger-700 disabled:opacity-50 dark:border-danger-900 dark:text-danger-200"
            >
              {t('aios.wave7ConnectorAdminPanel.markAccessRevoked')}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">
                {t('aios.wave7ConnectorAdminPanel.connectorHealth')}
              </h2>
              <div
                role="group"
                aria-label={t('aios.wave7ConnectorAdminPanel.connectorsListAriaLabel')}
                className="inline-flex items-center rounded-md border p-0.5 text-xs dark:border-navy-700"
              >
                <button
                  type="button"
                  onClick={() => setConnectorsView('tiles')}
                  aria-pressed={connectorsView === 'tiles'}
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors ${
                    connectorsView === 'tiles'
                      ? 'bg-slate-900 text-white dark:bg-sky-600'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800'
                  }`}
                >
                  <LayoutGrid size={13} /> {t('aios.wave7ConnectorAdminPanel.viewTiles')}
                </button>
                <button
                  type="button"
                  onClick={() => setConnectorsView('list')}
                  aria-pressed={connectorsView === 'list'}
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors ${
                    connectorsView === 'list'
                      ? 'bg-slate-900 text-white dark:bg-sky-600'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800'
                  }`}
                >
                  <List size={13} /> {t('aios.wave7ConnectorAdminPanel.viewList')}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
              {[
                [t('aios.wave7ConnectorAdminPanel.total'), health?.total ?? connectors.length],
                [t('aios.wave7ConnectorAdminPanel.connected2'), health?.connected ?? 0],
                [t('aios.wave7ConnectorAdminPanel.stale2'), health?.stale ?? 0],
                [t('aios.wave7ConnectorAdminPanel.failed2'), health?.failed ?? 0],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border bg-slate-50 p-2 dark:border-navy-700 dark:bg-navy-950"
                >
                  <div className="text-slate-500">{label}</div>
                  <div className="mt-1 text-lg font-semibold">{value}</div>
                </div>
              ))}
            </div>
            {health && (
              <div className="mt-2 text-xs text-slate-500">
                Health API source: `/api/ai-connectors/health`; organization {health.organizationId}
              </div>
            )}
            {connectorsView === 'tiles' ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {connectors.map((connector) => (
                  <div
                    key={connector.connectorId}
                    className="rounded-lg border p-3 text-sm dark:border-navy-700"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{connector.displayName}</div>
                      {connector.status === 'connected' ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-500" />
                      )}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {t('aios.wave7ConnectorAdminPanel.status')}: {connector.status};{' '}
                      {t('aios.wave7ConnectorAdminPanel.freshnessAge')}:{' '}
                      {connector.freshnessAgeMinutes ?? t('aios.wave7ConnectorAdminPanel.unknown')}{' '}
                      min; TTL: {connector.freshnessTtlMinutes ?? t('aios.unknown')} min
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('aios.wave7ConnectorAdminPanel.oauthAccess')}:{' '}
                      {connector.accessState || connector.authState || t('aios.unknown')};{' '}
                      {t('aios.wave7ConnectorAdminPanel.tokenExpiry')}:{' '}
                      {connector.tokenExpiresAt || t('aios.wave7ConnectorAdminPanel.notRecorded')}
                    </div>
                    {(connector.reconnectRequired ||
                      connector.tokenExpired ||
                      connector.accessRevokedAt) && (
                      <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        {t('aios.wave7ConnectorAdminPanel.reconnectRequired')}
                        {connector.accessRevokedAt
                          ? connector.revokedReason
                            ? t('aios.wave7ConnectorAdminPanel.accessRevokedWithReason', {
                                reason: connector.revokedReason,
                              })
                            : t('aios.wave7ConnectorAdminPanel.accessRevoked')
                          : connector.tokenExpired
                            ? t('aios.wave7ConnectorAdminPanel.tokenExpired')
                            : ''}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-slate-500">
                      ACL:{' '}
                      {(connector.projectIds || []).length
                        ? connector.projectIds?.join(', ')
                        : 'tenant'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('aios.wave7ConnectorAdminPanel.sourceBinding')}:{' '}
                      {connector.tenantPolicy?.externalConnectorId ||
                        t('aios.wave7ConnectorAdminPanel.registryOnly')}
                    </div>
                    {connector.failureState && (
                      <div className="mt-2 rounded bg-danger-50 p-2 text-xs text-danger-700 dark:bg-danger-900/30 dark:text-danger-200">
                        {t('aios.wave7ConnectorAdminPanel.failure')}: {connector.failureState}
                      </div>
                    )}
                  </div>
                ))}
                {connectors.length === 0 && (
                  <div className="text-sm text-slate-500">
                    {t('aios.wave7ConnectorAdminPanel.noWave7ConnectorsYet')}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <ConnectorsListView connectors={connectors} t={t} />
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">
              {t('aios.wave7ConnectorAdminPanel.connectorrunAudit')}
            </h2>
            <div className="mt-3 space-y-2">
              {runs.map((run) => (
                <div key={run.runId} className="rounded-lg border p-3 text-xs dark:border-navy-700">
                  <div className="font-medium">
                    {run.toolName} / {run.toolKind} / {run.status}
                  </div>
                  <div className="mt-1 text-slate-500">
                    ACL: {run.aclDecision?.reason || t('aios.unknown')};{' '}
                    {t('aios.wave7ConnectorAdminPanel.freshness')}:{' '}
                    {run.freshnessWarning || t('aios.wave7ConnectorAdminPanel.fresh')}
                  </div>
                  <div className="mt-1 text-slate-500">
                    OAuth: {run.sourceTrace?.accessState || t('aios.unknown')};{' '}
                    {t('aios.tokenExpiry')}:{' '}
                    {run.sourceTrace?.tokenExpiresAt ||
                      t('aios.wave7ConnectorAdminPanel.notTracked')}
                  </div>
                  {run.error && (
                    <div className="mt-1 text-danger-600">
                      {t('aios.wave7ConnectorAdminPanel.error')}: {run.error}
                    </div>
                  )}
                </div>
              ))}
              {runs.length === 0 && (
                <div className="text-sm text-slate-500">
                  {t('aios.wave7ConnectorAdminPanel.noRunsYet')}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Wave7ConnectorAdminPanel;
