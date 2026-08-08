import { AlertTriangle, RefreshCw, Search, Wrench } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';
import { Api } from '@/services/api';

type RecoveryAction =
  'retry_failed_branch' | 'recover_expired_lease' | 'cancel_graph' | 'expire_stale_review';
interface OperationalSnapshot {
  correlationId: string;
  run: { state: string; goal: string };
  alerts: Array<{
    severity: string;
    code: string;
    targetId: string;
    safeAction: RecoveryAction | null;
  }>;
  metrics: Record<string, string | number | null>;
  recoveries: Array<{ recovery_id: string; action: string; actor_user_id: string }>;
}
interface AgentAdminSettings {
  version: number;
  in_app_enabled: boolean;
  email_enabled: boolean;
  calendar_enabled: boolean;
  cadence: 'manual' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  legal_hold: boolean;
  export_enabled: false;
  purge_enabled: false;
}

function dataOf<T>(value: unknown): T {
  return value && typeof value === 'object' && 'data' in value
    ? (value as { data: T }).data
    : (value as T);
}

function readableTechnicalKey(value: string): string {
  const normalized = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : value;
}

const OPERATION_LABELS: Record<string, { pl: string; en: string }> = {
  branchesFailed: { pl: 'Nieudane gałęzie', en: 'Failed branches' },
  toolInvocationsDenied: { pl: 'Odrzucone wywołania narzędzi', en: 'Denied tool invocations' },
  queueDepth: { pl: 'Elementy w kolejce', en: 'Queue depth' },
  EXPIRED_BRANCH_LEASE: { pl: 'Wygasła dzierżawa gałęzi', en: 'Branch lease expired' },
  LEASE_EXPIRED: { pl: 'Wygasła dzierżawa', en: 'Lease expired' },
};

export function agentOperationLabel(value: string, isPolish: boolean): string {
  return OPERATION_LABELS[value]?.[isPolish ? 'pl' : 'en'] ?? readableTechnicalKey(value);
}

export const AgentOperationsPanel: React.FC<{ initialCanonicalRunId?: string | null }> = ({
  initialCanonicalRunId,
}) => {
  const { i18n } = useTranslation();
  const pl = i18n.language.startsWith('pl');
  const [runId, setRunId] = useState(initialCanonicalRunId?.trim() ?? '');
  const [snapshot, setSnapshot] = useState<OperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveringTarget, setRecoveringTarget] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ forbidden: boolean; message: string } | null>(
    null
  );
  const [announcement, setAnnouncement] = useState('');
  const [settings, setSettings] = useState<AgentAdminSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const loadSettings = async () => {
    setSettingsBusy(true);
    try {
      setSettings(dataOf<AgentAdminSettings>(await Api.getAgentTenantSettings(null)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Agent settings failed');
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSettingsBusy(true);
    try {
      const saved = await Api.updateAgentTenantSettings({
        projectId: null,
        expectedVersion: settings.version,
        inAppEnabled: settings.in_app_enabled,
        emailEnabled: settings.email_enabled,
        calendarEnabled: settings.calendar_enabled,
        cadence: settings.cadence,
        timezone: settings.timezone,
        autoActions: {},
        legalHold: settings.legal_hold,
      });
      setSettings(dataOf<AgentAdminSettings>(saved));
      toast.success(pl ? 'Ustawienia Agenta zapisane.' : 'Agent settings saved.');
    } finally {
      setSettingsBusy(false);
    }
  };

  const activateAgent = async () => {
    setSettingsBusy(true);
    try {
      await Api.activateA06ForTenant(null, crypto.randomUUID());
      toast.success(pl ? 'Aktywowano 17 polityk A06.' : 'Activated 17 A06 policies.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Agent activation failed');
    } finally {
      setSettingsBusy(false);
    }
  };

  const load = async () => {
    if (!runId.trim()) return;
    setLoading(true);
    setErrorState(null);
    setAnnouncement(pl ? 'Wczytywanie diagnostyki…' : 'Loading diagnostics…');
    try {
      setSnapshot(
        dataOf<OperationalSnapshot>(await Api.getAgentRunOperationalSnapshot(runId.trim()))
      );
      setAnnouncement(pl ? 'Diagnostyka została wczytana.' : 'Diagnostics loaded.');
    } catch (error) {
      setSnapshot(null);
      const status = Number(
        (error as { response?: { status?: number }; status?: number })?.response?.status ??
          (error as { status?: number })?.status
      );
      setErrorState({
        forbidden: status === 401 || status === 403,
        message:
          error instanceof Error
            ? error.message
            : pl
              ? 'Diagnostyka jest niedostępna.'
              : 'Diagnostics are unavailable.',
      });
      setAnnouncement(pl ? 'Nie udało się wczytać diagnostyki.' : 'Failed to load diagnostics.');
      toast.error(error instanceof Error ? error.message : 'Operational snapshot failed');
    } finally {
      setLoading(false);
    }
  };

  const recover = async (alert: OperationalSnapshot['alerts'][number]) => {
    if (!alert.safeAction) return;
    const reason = window.prompt(
      pl ? 'Podaj uzasadnienie recovery:' : 'Provide a recovery reason:'
    );
    if (!reason?.trim()) return;
    setRecoveringTarget(alert.targetId);
    setErrorState(null);
    try {
      await Api.recoverAgentRunTarget(
        runId,
        {
          targetId: alert.targetId,
          action: alert.safeAction,
          reason: reason.trim(),
        },
        crypto.randomUUID()
      );
      toast.success(
        pl ? 'Recovery wykonane i zapisane w audycie.' : 'Recovery completed and audited.'
      );
      setAnnouncement(pl ? 'Bezpieczne odzyskiwanie zakończone.' : 'Safe recovery completed.');
      await load();
    } catch (error) {
      setErrorState({
        forbidden: false,
        message:
          error instanceof Error
            ? error.message
            : pl
              ? 'Odzyskiwanie nie powiodło się.'
              : 'Recovery failed.',
      });
      setAnnouncement(pl ? 'Bezpieczne odzyskiwanie nie powiodło się.' : 'Safe recovery failed.');
      toast.error(error instanceof Error ? error.message : 'Recovery failed');
    } finally {
      setRecoveringTarget(null);
    }
  };

  return (
    <section
      className="space-y-4"
      data-testid="agent-operations-panel"
      aria-labelledby="agent-operations-heading"
      aria-busy={loading || Boolean(recoveringTarget)}
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="rounded-xl border border-c-border bg-c-surface p-4">
        <h2
          id="agent-operations-heading"
          className="flex items-center gap-2 font-semibold text-c-text"
        >
          <Wrench size={18} />
          {pl ? 'Konsola operatora Agenta' : 'Agent operator console'}
        </h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <input
            aria-label={pl ? 'Kanoniczny identyfikator przebiegu' : 'Canonical run ID'}
            className="min-w-0 flex-1 rounded-lg border border-c-border bg-c-bg px-3 py-2 text-c-text"
            value={runId}
            onChange={(event) => setRunId(event.target.value)}
            placeholder={pl ? 'Kanoniczny identyfikator przebiegu' : 'Canonical run ID'}
          />
          <button
            type="submit"
            disabled={!runId.trim() || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3 py-2 text-sm text-c-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Search size={15} />
            {pl ? 'Diagnozuj' : 'Diagnose'}
          </button>
        </form>
      </div>
      <div
        className="rounded-xl border border-c-border bg-c-surface p-4"
        data-testid="agent-admin-settings"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-c-text">
              {pl ? 'Ustawienia administracyjne Agenta' : 'Agent admin settings'}
            </h3>
            <p className="text-xs text-c-text-muted">
              {pl
                ? 'Retencja: 30 dni szczegółów, 13 miesięcy agregatów. Eksport i purge są fail-closed; legal hold blokuje purge.'
                : 'Retention: 30 days detail, 13 months aggregate. Export and purge are fail-closed; legal hold blocks purge.'}
            </p>
          </div>
          <button
            type="button"
            disabled={settingsBusy}
            onClick={() => void loadSettings()}
            className="rounded-lg border border-c-border px-3 py-2 text-sm"
          >
            {pl ? 'Wczytaj' : 'Load'}
          </button>
        </div>
        {settings && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {(['in_app_enabled', 'email_enabled', 'calendar_enabled'] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-c-text">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })}
                  />
                  {key === 'in_app_enabled'
                    ? 'In-app'
                    : key === 'email_enabled'
                      ? 'Email'
                      : pl
                        ? 'Kalendarz'
                        : 'Calendar'}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-c-text">
              <input
                type="checkbox"
                checked={settings.legal_hold}
                onChange={(event) => setSettings({ ...settings, legal_hold: event.target.checked })}
              />
              Legal hold
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm text-c-text">
                <span className="mb-1 block text-xs text-c-text-muted">
                  {pl ? 'Częstotliwość' : 'Cadence'}
                </span>
                <select
                  aria-label={pl ? 'Częstotliwość automatyzacji' : 'Automation cadence'}
                  className="w-full rounded-lg border border-c-border bg-c-bg px-3 py-2"
                  value={settings.cadence}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      cadence: event.target.value as AgentAdminSettings['cadence'],
                    })
                  }
                >
                  <option value="manual">Manual</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="text-sm text-c-text">
                <span className="mb-1 block text-xs text-c-text-muted">Timezone</span>
                <input
                  aria-label="Timezone"
                  className="w-full rounded-lg border border-c-border bg-c-bg px-3 py-2"
                  value={settings.timezone}
                  onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
                />
              </label>
            </div>
            <p className="text-xs text-c-text-muted">
              {pl
                ? 'Auto-actions: OFF. Eksport: OFF. Purge: OFF.'
                : 'Auto-actions: OFF. Export: OFF. Purge: OFF.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={settingsBusy}
                onClick={() => void saveSettings()}
                className="rounded-lg bg-c-text px-3 py-2 text-sm text-c-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {pl ? 'Zapisz ustawienia' : 'Save settings'}
              </button>
              <button
                type="button"
                disabled={settingsBusy}
                onClick={() => void activateAgent()}
                className="rounded-lg border border-c-border px-3 py-2 text-sm text-c-text"
              >
                {pl ? 'Aktywuj Agenta' : 'Activate Agent'}
              </button>
            </div>
          </div>
        )}
      </div>
      {loading ? (
        <LoadingState template="list" rows={4} />
      ) : errorState ? (
        <EmptyState
          variant={errorState.forbidden ? 'forbidden' : 'error'}
          title={
            errorState.forbidden
              ? pl
                ? 'Brak dostępu do diagnostyki Przebiegu'
                : 'Run diagnostics access denied'
              : pl
                ? 'Nie udało się wczytać operacji'
                : 'Failed to load operations'
          }
          description={errorState.message}
          onRetry={errorState.forbidden ? undefined : load}
          primaryAction={
            errorState.forbidden
              ? {
                  label: pl ? 'Wyczyść Przebieg' : 'Clear Run',
                  onClick: () => {
                    setRunId('');
                    setErrorState(null);
                  },
                }
              : undefined
          }
        />
      ) : !snapshot ? (
        <EmptyState
          title={
            pl ? 'Podaj kanoniczny Przebieg do diagnostyki' : 'Enter a canonical Run to diagnose'
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl border border-c-border bg-c-surface p-4">
            <div>
              <div className="font-semibold text-c-text">{snapshot.run.goal}</div>
              <div className="text-sm text-c-text-muted">
                {snapshot.correlationId} · {snapshot.run.state}
              </div>
            </div>
            <button
              type="button"
              aria-label={pl ? 'Odśwież diagnostykę' : 'Refresh diagnostics'}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(snapshot.metrics).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-c-border bg-c-surface p-3">
                <div className="text-xs text-c-text-muted">{agentOperationLabel(key, pl)}</div>
                <div className="text-lg font-semibold text-c-text">{value ?? '—'}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {snapshot.alerts.map((alert) => (
              <div
                key={`${alert.code}-${alert.targetId}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-c-border bg-c-surface p-3"
                role={alert.severity === 'critical' ? 'alert' : 'status'}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <div>
                    <div className="text-sm font-medium text-c-text">
                      {agentOperationLabel(alert.code, pl)}
                    </div>
                    <div className="text-xs text-c-text-muted">{alert.targetId}</div>
                  </div>
                </div>
                {alert.safeAction && (
                  <button
                    type="button"
                    aria-label={`${pl ? 'Bezpieczne odzyskiwanie' : 'Safe recovery'}: ${agentOperationLabel(alert.code, pl)}`}
                    className="rounded-lg border border-c-border px-3 py-2 text-sm text-c-text"
                    disabled={Boolean(recoveringTarget)}
                    onClick={() => void recover(alert)}
                  >
                    {recoveringTarget === alert.targetId
                      ? pl
                        ? 'Odzyskiwanie…'
                        : 'Recovering…'
                      : pl
                        ? 'Bezpieczne odzyskiwanie'
                        : 'Safe recovery'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
