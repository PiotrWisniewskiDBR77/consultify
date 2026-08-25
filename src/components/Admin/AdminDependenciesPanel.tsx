import { AlertTriangle, Boxes, CircleHelp } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AdminDependenciesResponse,
  type DependencyStatus,
  getAdminDependencies,
} from '../../services/adminDependenciesApi';

const statusColors: Record<DependencyStatus, string> = {
  healthy: 'var(--c-success)',
  degraded: 'var(--c-info)',
  failing: 'var(--c-danger)',
  unknown: 'var(--c-text-muted)',
};

export const AdminDependenciesPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminDependenciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminDependencies());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.dependencies.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);
  React.useEffect(() => void load(), [load]);

  if (loading) return <p className="text-sm text-c-text-muted">{t('common.loading')}</p>;
  if (error)
    return (
      <section role="alert" className="rounded-2xl border border-c-danger bg-c-surface p-5">
        <p className="text-sm text-c-text">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
        >
          {t('common.retry')}
        </button>
      </section>
    );

  const dependencies = data?.dependencies ?? [];
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-c-text">{t('admin.dependencies.title')}</h2>
        <p className="mt-1 text-sm text-c-text-secondary">{t('admin.dependencies.description')}</p>
      </header>
      {dependencies.length === 0 ? (
        <section className="rounded-2xl border border-c-border bg-c-surface p-5 text-center">
          <Boxes className="mx-auto h-8 w-8 text-c-text-muted" />
          <h3 className="mt-2 font-medium text-c-text">{t('admin.dependencies.empty.title')}</h3>
          <p className="mt-1 text-sm text-c-text-secondary">
            {t('admin.dependencies.empty.description')}
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {dependencies.map((dependency) => (
            <details
              key={dependency.dependencyId}
              className="rounded-2xl border border-c-border bg-c-surface p-5"
            >
              <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-c-text">{dependency.label}</h3>
                    <p className="text-xs text-c-text-muted">{dependency.kind}</p>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: statusColors[dependency.status] }}
                  >
                    {t(`admin.dependencies.status.${dependency.status}`)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-c-text-secondary">
                  {t('admin.dependencies.probeCount', { count: dependency.probeIds.length })} ·{' '}
                  {dependency.lastCheckedAt
                    ? new Date(dependency.lastCheckedAt).toLocaleString()
                    : t('admin.dependencies.neverChecked')}
                </p>
              </summary>
              <ul className="mt-3 space-y-1 border-t border-c-border-subtle pt-3 text-xs text-c-text-secondary">
                {dependency.probeIds.map((probeId) => (
                  <li key={probeId}>{probeId}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex gap-3">
          {data?.undeclaredProbes.length ? (
            <AlertTriangle className="h-5 w-5 text-c-info" />
          ) : (
            <CircleHelp className="h-5 w-5 text-c-text-muted" />
          )}
          <div>
            <h3 className="font-semibold text-c-text">
              {t('admin.dependencies.undeclared.title')}
            </h3>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t('admin.dependencies.undeclared.description')}
            </p>
            {data?.undeclaredProbes.length ? (
              <ul className="mt-3 space-y-1 text-sm text-c-text">
                {data.undeclaredProbes.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-c-text-muted">
                {t('admin.dependencies.undeclared.none')}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDependenciesPanel;
