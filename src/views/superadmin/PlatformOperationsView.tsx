import { AlertTriangle, Play, ShieldAlert } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { ConfirmDialog } from '../../components/MyWork/shared/ConfirmDialog';
import {
  getPlatformOperationTargets,
  runPlatformOperation,
  type PlatformTarget,
} from '../../services/superadminPlatformOperationsApi';

type ActionId = 'suspend' | 'reactivate' | 'purge' | 'lockdown' | 'reset_mfa';
type ActionDefinition = {
  id: ActionId;
  label: string;
  description: string;
  risk: 'high' | 'critical';
  targetType: 'organization' | 'user';
  path: (id: string) => string;
  purge?: boolean;
};
const ACTIONS: readonly ActionDefinition[] = [
  {
    id: 'reactivate',
    label: 'Reaktywuj organizację',
    description: 'Przywraca dostęp użytkowników organizacji.',
    risk: 'high',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/reactivate`,
  },
  {
    id: 'reset_mfa',
    label: 'Wymuś reset MFA',
    description: 'Usuwa bieżącą konfigurację MFA użytkownika i wymaga ponownej rejestracji.',
    risk: 'high',
    targetType: 'user',
    path: (id) => `/users/${encodeURIComponent(id)}/force-reset-mfa`,
  },
  {
    id: 'suspend',
    label: 'Zawieś organizację',
    description: 'Blokuje dostęp użytkowników organizacji.',
    risk: 'critical',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/suspend`,
  },
  {
    id: 'lockdown',
    label: 'Awaryjnie zablokuj organizację',
    description: 'Natychmiast uruchamia awaryjną blokadę tenanta.',
    risk: 'critical',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/lockdown`,
  },
  {
    id: 'purge',
    label: 'Zaplanuj trwałe usunięcie danych',
    description: 'Ustawia organizację w kolejce nieodwracalnego usunięcia wszystkich danych.',
    risk: 'critical',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/purge`,
    purge: true,
  },
];

type SessionResult = { at: string; action: string; target: string; result: string; reason: string };
const inputClass =
  'w-full rounded-lg border border-c-border bg-c-surface p-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';

export const PlatformOperationsView: React.FC = () => {
  const [organizations, setOrganizations] = useState<PlatformTarget[]>([]);
  const [users, setUsers] = useState<PlatformTarget[]>([]);
  const [selected, setSelected] = useState<Record<ActionId, string>>({
    suspend: '',
    reactivate: '',
    purge: '',
    lockdown: '',
    reset_mfa: '',
  });
  const [pending, setPending] = useState<ActionDefinition | null>(null);
  const [reason, setReason] = useState('');
  const [typedName, setTypedName] = useState('');
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targets = await getPlatformOperationTargets();
      setOrganizations(targets.organizations);
      setUsers(targets.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się pobrać celów operacji.');
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => void load(), [load]);

  const targetsFor = (action: ActionDefinition) =>
    action.targetType === 'organization' ? organizations : users;
  const pendingTarget = pending
    ? targetsFor(pending).find((target) => target.id === selected[pending.id])
    : undefined;
  const confirmationValid =
    reason.trim().length >= 3 && (!pending?.purge || typedName === pendingTarget?.name);
  const grouped = useMemo(
    () => ({
      high: ACTIONS.filter((item) => item.risk === 'high'),
      critical: ACTIONS.filter((item) => item.risk === 'critical'),
    }),
    []
  );

  const execute = async () => {
    if (!pending || !pendingTarget || !confirmationValid) return;
    const current = pending;
    const target = pendingTarget;
    const operatorReason = reason.trim();
    setPending(null);
    try {
      await runPlatformOperation(current.path(target.id), {
        confirmation: true,
        reason: operatorReason,
        ...(current.purge ? { confirmTenantName: typedName } : {}),
      });
      setResults((items) => [
        {
          at: new Date().toISOString(),
          action: current.label,
          target: target.name,
          result: 'Sukces',
          reason: operatorReason,
        },
        ...items,
      ]);
    } catch (cause: any) {
      const code = String(cause?.code || cause?.status || 'ERROR');
      const message = cause?.expectedName
        ? `Wpisana nazwa nie zgadza się. Oczekiwano: ${cause.expectedName}.`
        : cause instanceof Error
          ? cause.message
          : 'Błąd operacji';
      setResults((items) => [
        {
          at: new Date().toISOString(),
          action: current.label,
          target: target.name,
          result: `${code}: ${message}`,
          reason: operatorReason,
        },
        ...items,
      ]);
    } finally {
      setReason('');
      setTypedName('');
    }
  };

  if (loading)
    return (
      <p role="status" className="p-6 text-c-text-muted">
        Ładowanie celów operacji…
      </p>
    );
  if (error)
    return (
      <section role="alert" className="rounded-xl border border-c-danger p-5 text-c-danger">
        {error}
      </section>
    );
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-c-text">Operacje platformowe</h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          Zabezpieczone operacje P33. Każde wykonanie wymaga wskazanego celu, powodu i jawnego
          potwierdzenia.
        </p>
      </header>
      {(['high', 'critical'] as const).map((risk) => (
        <section key={risk}>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-c-text">
            {risk === 'critical' ? (
              <ShieldAlert className="h-5 w-5 text-c-danger" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-c-info" />
            )}
            {risk === 'critical' ? 'Ryzyko krytyczne' : 'Wysokie ryzyko'}
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {grouped[risk].map((action) => {
              const targets = targetsFor(action);
              return (
                <article
                  key={action.id}
                  className="rounded-2xl border border-c-border bg-c-surface p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-c-text">{action.label}</h4>
                      <p className="mt-1 text-sm text-c-text-secondary">{action.description}</p>
                    </div>
                    <span className="text-xs uppercase text-c-text-muted">{action.risk}</span>
                  </div>
                  <label className="mt-4 block text-sm text-c-text-secondary">
                    Cel
                    <select
                      className={`${inputClass} mt-1`}
                      value={selected[action.id]}
                      onChange={(event) =>
                        setSelected((state) => ({ ...state, [action.id]: event.target.value }))
                      }
                    >
                      <option value="">Wybierz…</option>
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name}
                          {target.status ? ` (${target.status})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!selected[action.id]}
                    onClick={() => setPending(action)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)] disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    Przejdź do potwierdzenia
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <section>
        <h3 className="font-semibold text-c-text">Ostatnie operacje w tej sesji</h3>
        {results.length === 0 ? (
          <p className="mt-2 text-sm text-c-text-muted">Brak wykonanych operacji.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {results.map((item, index) => (
              <li
                key={`${item.at}-${index}`}
                className="rounded-xl border border-c-border bg-c-surface p-3 text-sm text-c-text"
              >
                <time>{new Date(item.at).toLocaleString()}</time> · {item.action} · {item.target} ·{' '}
                {item.result}
                <p className="text-c-text-secondary">Powód: {item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog
        isOpen={Boolean(pending)}
        onCancel={() => {
          setPending(null);
          setReason('');
          setTypedName('');
        }}
        onConfirm={() => void execute()}
        title={pending?.label || 'Potwierdź operację'}
        description={
          pendingTarget
            ? `${pending?.description} Cel: ${pendingTarget.name}.${pending?.risk === 'critical' ? ' Operacja krytyczna może być trudna lub niemożliwa do odwrócenia.' : ''}`
            : ''
        }
        confirmLabel="Wykonaj operację"
        variant="danger"
        confirmDisabled={!confirmationValid}
      >
        <label className="mt-4 block text-sm text-c-text-secondary">
          Powód
          <textarea
            className={`${inputClass} mt-1`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </label>
        {pending?.purge && pendingTarget ? (
          <label className="mt-3 block text-sm text-c-text-secondary">
            Przepisz dokładnie: <strong>{pendingTarget.name}</strong>
            <input
              className={`${inputClass} mt-1`}
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
            />
          </label>
        ) : null}
      </ConfirmDialog>
    </div>
  );
};

export default PlatformOperationsView;
