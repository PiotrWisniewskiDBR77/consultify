import { AlertTriangle, CheckCircle2, Plug, RefreshCw, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

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

export const Wave7ConnectorAdminPanel: React.FC = () => {
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
            {isPolish ? 'Wave 7 — Panel administracyjny konektorów' : 'Wave 7 Connector Admin'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isPolish
              ? 'Rejestr konektorów z kontrolą uprawnień, cykl życia OAuth/sesji, ślad źródłowy i bezpieczne wykonywanie narzędzi.'
              : 'Permission-aware connector registry, OAuth/session lifecycle, source trace and safe tool execution.'}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50 dark:border-navy-700"
        >
          <RefreshCw size={16} /> {isPolish ? 'Odśwież' : 'Refresh'}
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
            <Plug size={18} /> {isPolish ? 'Rejestruj konektor' : 'Register Connector'}
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
              <option value="connected">{isPolish ? 'Połączony' : 'Connected'}</option>
              <option value="stale">{isPolish ? 'Przestarzały' : 'Stale'}</option>
              <option value="disconnected">{isPolish ? 'Odłączony' : 'Disconnected'}</option>
              <option value="failed">{isPolish ? 'Błąd' : 'Failed'}</option>
            </select>
            <input
              value={projectIds}
              onChange={(event) => setProjectIds(event.target.value)}
              placeholder={isPolish ? 'Opcjonalne ID projektów ACL, oddzielone przecinkami' : 'Optional project ACL ids, comma separated'}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <button
              type="button"
              onClick={register}
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
            >
              {isPolish ? 'Zarejestruj konektor' : 'Register connector'}
            </button>
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-semibold">
            <ShieldAlert size={18} /> {isPolish ? 'Test wykonania narzędzia' : 'Tool Execution Test'}
          </h2>
          <div className="mt-4 space-y-3">
            <select
              value={selectedConnectorId}
              onChange={(event) => setSelectedConnectorId(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="">{isPolish ? 'Wybierz konektor' : 'Select connector'}</option>
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
              <option value="read">{isPolish ? 'Odczyt' : 'Read'}</option>
              <option value="search">{isPolish ? 'Wyszukiwanie' : 'Search'}</option>
              <option value="write">{isPolish ? 'Zapis (wymaga AIRun)' : 'Write (requires AIRun)'}</option>
              <option value="destructive">{isPolish ? 'Destrukcyjne (wymaga AIRun)' : 'Destructive (requires AIRun)'}</option>
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isPolish ? 'Zapytanie konektora' : 'Connector query'}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <input
              value={aiRunId}
              onChange={(event) => setAiRunId(event.target.value)}
              placeholder={isPolish ? 'ID AIRun dla narzędzi zapisu/destrukcyjnych' : 'AIRun id for write/destructive tools'}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <button
              type="button"
              onClick={executeTool}
              disabled={loading || !selectedConnectorId}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPolish ? 'Wykonaj kontrolowane narzędzie' : 'Execute governed tool'}
            </button>
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-semibold">
            <Plug size={18} /> {isPolish ? 'Powiązanie z realnym źródłem' : 'Real Source Binding'}
          </h2>
          <div className="mt-4 space-y-3">
            <input
              value={externalConnectorId}
              onChange={(event) => setExternalConnectorId(event.target.value)}
              placeholder={isPolish ? 'Istniejące ID tp_connectors' : 'Existing tp_connectors id'}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={linkConnector}
                disabled={loading || !selectedConnectorId}
                className="rounded-md border px-2 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
              >
                {isPolish ? 'Powiąż' : 'Link'}
              </button>
              <button
                type="button"
                onClick={reindexConnector}
                disabled={loading || !selectedConnectorId}
                className="rounded-md border px-2 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
              >
                {isPolish ? 'Reindeksuj' : 'Reindex'}
              </button>
              <button
                type="button"
                onClick={disconnectConnector}
                disabled={loading || !selectedConnectorId}
                className="rounded-md border border-rose-200 px-2 py-2 text-xs font-medium text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-200"
              >
                {isPolish ? 'Odłącz' : 'Disconnect'}
              </button>
            </div>
          </div>

          <h2 className="mt-6 flex items-center gap-2 font-semibold">
            <ShieldAlert size={18} /> {isPolish ? 'Cykl życia sesji OAuth' : 'OAuth Session Lifecycle'}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={reconnectConnector}
              disabled={loading || !selectedConnectorId}
              className="rounded-md border px-2 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
            >
              {isPolish ? 'Oznacz jako ponownie połączony' : 'Mark reconnected'}
            </button>
            <button
              type="button"
              onClick={revokeConnector}
              disabled={loading || !selectedConnectorId}
              className="rounded-md border border-rose-200 px-2 py-2 text-xs font-medium text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-200"
            >
              {isPolish ? 'Oznacz dostęp jako cofnięty' : 'Mark access revoked'}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">{isPolish ? 'Stan konektorów' : 'Connector Health'}</h2>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
              {[
                [isPolish ? 'Łącznie' : 'Total', health?.total ?? connectors.length],
                [isPolish ? 'Połączone' : 'Connected', health?.connected ?? 0],
                [isPolish ? 'Przestarzałe' : 'Stale', health?.stale ?? 0],
                [isPolish ? 'Błędy' : 'Failed', health?.failed ?? 0],
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
                    {isPolish ? 'Status' : 'Status'}: {connector.status}; {isPolish ? 'wiek aktualności' : 'freshness age'}:{' '}
                    {connector.freshnessAgeMinutes ?? (isPolish ? 'nieznany' : 'unknown')} min; TTL:{' '}
                    {connector.freshnessTtlMinutes ?? (isPolish ? 'nieznany' : 'unknown')} min
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {isPolish ? 'Dostęp OAuth' : 'OAuth access'}: {connector.accessState || connector.authState || (isPolish ? 'nieznany' : 'unknown')}; {isPolish ? 'wygaśnięcie tokenu' : 'token expiry'}: {connector.tokenExpiresAt || (isPolish ? 'nie zarejestrowano' : 'not recorded')}
                  </div>
                  {(connector.reconnectRequired ||
                    connector.tokenExpired ||
                    connector.accessRevokedAt) && (
                    <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      {isPolish ? 'Wymagane ponowne połączenie' : 'Reconnect required'}
                      {connector.accessRevokedAt
                        ? isPolish
                          ? `; dostęp cofnięty${connector.revokedReason ? ` (${connector.revokedReason})` : ''}`
                          : `; access revoked${connector.revokedReason ? ` (${connector.revokedReason})` : ''}`
                        : connector.tokenExpired
                          ? isPolish ? '; token wygasł' : '; token expired'
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
                    {isPolish ? 'Powiązanie źródła' : 'Source binding'}: {connector.tenantPolicy?.externalConnectorId || (isPolish ? 'tylko rejestr' : 'registry only')}
                  </div>
                  {connector.failureState && (
                    <div className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                      {isPolish ? 'Błąd' : 'Failure'}: {connector.failureState}
                    </div>
                  )}
                </div>
              ))}
              {connectors.length === 0 && (
                <div className="text-sm text-slate-500">
                  {isPolish ? 'Brak konektorów Wave 7.' : 'No Wave 7 connectors yet.'}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">{isPolish ? 'Audyt uruchomień konektora' : 'ConnectorRun Audit'}</h2>
            <div className="mt-3 space-y-2">
              {runs.map((run) => (
                <div key={run.runId} className="rounded-lg border p-3 text-xs dark:border-navy-700">
                  <div className="font-medium">
                    {run.toolName} / {run.toolKind} / {run.status}
                  </div>
                  <div className="mt-1 text-slate-500">
                    ACL: {run.aclDecision?.reason || (isPolish ? 'nieznany' : 'unknown')}; {isPolish ? 'aktualność' : 'freshness'}:{' '}
                    {run.freshnessWarning || (isPolish ? 'aktualne' : 'fresh')}
                  </div>
                  <div className="mt-1 text-slate-500">
                    OAuth: {run.sourceTrace?.accessState || (isPolish ? 'nieznany' : 'unknown')}; {isPolish ? 'wygaśnięcie tokenu' : 'token expiry'}:{' '}
                    {run.sourceTrace?.tokenExpiresAt || (isPolish ? 'nie śledzono' : 'not tracked')}
                  </div>
                  {run.error && <div className="mt-1 text-rose-600">{isPolish ? 'Błąd' : 'Error'}: {run.error}</div>}
                </div>
              ))}
              {runs.length === 0 && <div className="text-sm text-slate-500">{isPolish ? 'Brak uruchomień.' : 'No runs yet.'}</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Wave7ConnectorAdminPanel;
