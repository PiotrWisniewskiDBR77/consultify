import { AlertTriangle, Play, ShieldAlert } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '../../components/MyWork/shared/ConfirmDialog';
import {
  getPlatformOperationTargets,
  type PlatformTargetCatalog,
  type PlatformTarget,
  runPlatformOperation,
} from '../../services/superadminPlatformOperationsApi';

type ActionId =
  | 'suspend'
  | 'reactivate'
  | 'purge'
  | 'lockdown'
  | 'reset_mfa'
  | 'connector_kill'
  | 'worker_suspend';
type ActionDefinition = {
  id: ActionId;
  risk: 'high' | 'critical';
  targetType: 'organization' | 'user' | 'connector' | 'virtualWorker';
  path: (id: string) => string;
  purge?: boolean;
};
const ACTIONS: readonly ActionDefinition[] = [
  {
    id: 'reactivate',
    risk: 'high',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/reactivate`,
  },
  {
    id: 'reset_mfa',
    risk: 'high',
    targetType: 'user',
    path: (id) => `/users/${encodeURIComponent(id)}/force-reset-mfa`,
  },
  {
    id: 'suspend',
    risk: 'critical',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/suspend`,
  },
  {
    id: 'lockdown',
    risk: 'critical',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/lockdown`,
  },
  {
    id: 'purge',
    risk: 'critical',
    targetType: 'organization',
    path: (id) => `/tenants/${encodeURIComponent(id)}/purge`,
    purge: true,
  },
  {
    id: 'worker_suspend',
    risk: 'high',
    targetType: 'virtualWorker',
    path: (id) => `/virtual-workers/${encodeURIComponent(id)}/suspend`,
  },
  {
    id: 'connector_kill',
    risk: 'critical',
    targetType: 'connector',
    path: (id) => `/connectors/${encodeURIComponent(id)}/emergency-kill`,
  },
];

type SessionResult = { at: string; action: string; target: string; result: string; reason: string };
const inputClass =
  'w-full rounded-lg border border-c-border bg-c-surface p-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';

export const PlatformOperationsView: React.FC = () => {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState<PlatformTarget[]>([]);
  const [users, setUsers] = useState<PlatformTarget[]>([]);
  const [connectors, setConnectors] = useState<PlatformTarget[]>([]);
  const [virtualWorkers, setVirtualWorkers] = useState<PlatformTarget[]>([]);
  const [catalogErrors, setCatalogErrors] = useState<
    Partial<Record<PlatformTargetCatalog, boolean>>
  >({});
  const [selected, setSelected] = useState<Record<ActionId, string>>({
    suspend: '',
    reactivate: '',
    purge: '',
    lockdown: '',
    reset_mfa: '',
    connector_kill: '',
    worker_suspend: '',
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
      setConnectors(targets.connectors || []);
      setVirtualWorkers(targets.virtualWorkers || []);
      setCatalogErrors(targets.catalogErrors || {});
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('superadmin.platformOperations.errors.load')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  React.useEffect(() => void load(), [load]);

  const targetsFor = (action: ActionDefinition) => {
    if (action.targetType === 'organization') return organizations;
    if (action.targetType === 'user') return users;
    if (action.targetType === 'connector') return connectors;
    return virtualWorkers;
  };
  const catalogFor = (action: ActionDefinition): PlatformTargetCatalog => {
    if (action.targetType === 'organization') return 'organizations';
    if (action.targetType === 'user') return 'users';
    if (action.targetType === 'connector') return 'connectors';
    return 'virtualWorkers';
  };
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
          action: t(`superadmin.platformOperations.actions.${current.id}.label`),
          target: target.name,
          result: t('superadmin.platformOperations.session.success'),
          reason: operatorReason,
        },
        ...items,
      ]);
    } catch (cause: any) {
      const details = cause?.data && typeof cause.data === 'object' ? cause.data : cause;
      const code = String(details?.code || cause?.code || cause?.status || 'ERROR');
      const message = (() => {
        if (code === 'CONFIRMATION_REQUIRED' || cause?.status === 428)
          return t('superadmin.platformOperations.errors.confirmationRequired');
        if (code === 'REASON_REQUIRED')
          return t('superadmin.platformOperations.errors.reasonRequired');
        if (code === 'TYPE_TO_CONFIRM_FAILED' || details?.expectedName)
          return t('superadmin.platformOperations.errors.nameMismatch', {
            name: details?.expectedName || target.name,
          });
        if (cause?.status === 404 || code === 'NOT_FOUND')
          return t('superadmin.platformOperations.errors.notFound');
        if (cause?.status === 403 || code === 'FORBIDDEN')
          return t('superadmin.platformOperations.errors.forbidden');
        return cause instanceof Error
          ? cause.message
          : t('superadmin.platformOperations.errors.generic');
      })();
      setResults((items) => [
        {
          at: new Date().toISOString(),
          action: t(`superadmin.platformOperations.actions.${current.id}.label`),
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
        {t('superadmin.platformOperations.loading')}
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
        <h2 className="text-xl font-semibold text-c-text">
          {t('superadmin.platformOperations.title')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('superadmin.platformOperations.subtitle')}
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
            {t(`superadmin.platformOperations.risk.${risk}`)}
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
                      <h4 className="font-semibold text-c-text">
                        {t(`superadmin.platformOperations.actions.${action.id}.label`)}
                      </h4>
                      <p className="mt-1 text-sm text-c-text-secondary">
                        {t(`superadmin.platformOperations.actions.${action.id}.description`)}
                      </p>
                    </div>
                    <span className="text-xs uppercase text-c-text-muted">{action.risk}</span>
                  </div>
                  <label className="mt-4 block text-sm text-c-text-secondary">
                    {t('superadmin.platformOperations.target')}
                    <select
                      className={`${inputClass} mt-1`}
                      value={selected[action.id]}
                      onChange={(event) =>
                        setSelected((state) => ({ ...state, [action.id]: event.target.value }))
                      }
                    >
                      <option value="">{t('superadmin.platformOperations.choose')}</option>
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name}
                          {target.status ? ` (${target.status})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {targets.length === 0 ? (
                    <p
                      role={catalogErrors[catalogFor(action)] ? 'alert' : 'status'}
                      className={`mt-2 text-sm ${catalogErrors[catalogFor(action)] ? 'text-c-danger' : 'text-c-text-muted'}`}
                    >
                      {t(
                        catalogErrors[catalogFor(action)]
                          ? 'superadmin.platformOperations.catalogError'
                          : 'superadmin.platformOperations.noTargets'
                      )}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!selected[action.id]}
                    onClick={() => setPending(action)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)] disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    {t('superadmin.platformOperations.review')}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <section>
        <h3 className="font-semibold text-c-text">
          {t('superadmin.platformOperations.session.title')}
        </h3>
        {results.length === 0 ? (
          <p className="mt-2 text-sm text-c-text-muted">
            {t('superadmin.platformOperations.session.empty')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {results.map((item, index) => (
              <li
                key={`${item.at}-${index}`}
                className="rounded-xl border border-c-border bg-c-surface p-3 text-sm text-c-text"
              >
                <time>{new Date(item.at).toLocaleString()}</time> · {item.action} · {item.target} ·{' '}
                {item.result}
                <p className="text-c-text-secondary">
                  {t('superadmin.platformOperations.reason')}: {item.reason}
                </p>
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
        title={
          pending
            ? t(`superadmin.platformOperations.actions.${pending.id}.label`)
            : t('superadmin.platformOperations.confirmTitle')
        }
        description={
          pendingTarget
            ? `${t(`superadmin.platformOperations.actions.${pending?.id}.description`)} ${t('superadmin.platformOperations.target')}: ${pendingTarget.name}.${pending?.targetType === 'connector' ? ` ${t('superadmin.platformOperations.affectedTenants', { count: pendingTarget.affectedTenants || 0 })}` : ''}${pending?.risk === 'critical' ? ` ${t('superadmin.platformOperations.criticalWarning')}` : ''}`
            : ''
        }
        confirmLabel={t('superadmin.platformOperations.execute')}
        cancelLabel={t('superadmin.confirm.cancel')}
        variant="danger"
        confirmDisabled={!confirmationValid}
      >
        <label className="mt-4 block text-sm text-c-text-secondary">
          {t('superadmin.confirm.reasonLabel')}
          <textarea
            aria-label={t('superadmin.platformOperations.reason')}
            className={`${inputClass} mt-1`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </label>
        {pending?.purge && pendingTarget ? (
          <label className="mt-3 block text-sm text-c-text-secondary">
            {t('superadmin.platformOperations.typeExactly')}: <strong>{pendingTarget.name}</strong>
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
