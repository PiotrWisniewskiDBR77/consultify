import { Activity, History } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Api } from '../../services/api';

export const AdminIncidentHistoryPanel: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Api.getHealthPanelSummary()
      .then(setSummary)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : t('admin.incidentHistory.errors.load'))
      )
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.incidentHistory.title', 'Historia incydentów')}
        </h2>
      </header>
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex gap-3">
          <History className="h-5 w-5 text-c-text-muted" />
          <p className="text-sm text-c-text-secondary">
            {t(
              'admin.incidentHistory.truth',
              'Tenantowy rejestr incydentów operacyjnych nie jest jeszcze prowadzony. Obecny rejestr incydentów działa na poziomie platformy i nie rozdziela zdarzeń per organizacja. Widok incydentów dla Twojej organizacji powstaje w ramach prac nad warstwą platformową.'
            )}
          </p>
        </div>
      </section>
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h3 className="font-semibold text-c-text">
          <Activity className="mr-2 inline h-5 w-5" />
          {t('admin.incidentHistory.current.title', 'Stan bieżący, nie historia')}
        </h3>
        {loading ? (
          <p role="status" className="mt-3 text-sm text-c-text-muted">
            {t('common.loading', 'Ładowanie…')}
          </p>
        ) : error ? (
          <p role="alert" className="mt-3 text-sm text-c-danger">
            {error}
          </p>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('admin.incidentHistory.current.total', 'Probe’y')}
              </dt>
              <dd className="text-xl text-c-text">{summary?.summary?.total ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('admin.incidentHistory.current.passed', 'Działa')}
              </dt>
              <dd className="text-xl text-c-text">{summary?.summary?.passed ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('admin.incidentHistory.current.failed', 'Błędy')}
              </dt>
              <dd className="text-xl text-c-text">{summary?.summary?.failed ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('admin.incidentHistory.current.unknown', 'Brak wyniku')}
              </dt>
              <dd className="text-xl text-c-text">{summary?.summary?.unknown ?? 0}</dd>
            </div>
          </dl>
        )}
        <Link
          className="mt-4 inline-block rounded-lg border border-c-border px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
          to="/admin/health/overview"
        >
          {t('admin.incidentHistory.current.link', 'Przejdź do przeglądu zdrowia')}
        </Link>
      </section>
    </div>
  );
};

export default AdminIncidentHistoryPanel;
