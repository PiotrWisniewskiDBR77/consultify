import React, { useEffect, useState } from 'react';
import { getAiSlaStatus, getTenantSlos, type Slo } from '../../services/adminSlaSloApi';
import { useTranslation } from 'react-i18next';
export const AdminSlaSloPanel: React.FC = () => {
  const { t } = useTranslation();
  const [slos, setSlos] = useState<Slo[]>([]);
  const [ai, setAi] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.allSettled([getTenantSlos(), getAiSlaStatus()])
      .then(([s, a]) => {
        if (s.status === 'fulfilled') setSlos(s.value);
        else
          setError(
            s.reason instanceof Error ? s.reason.message : t('admin.health.sla-slo.day2Auto.text1')
          );
        if (a.status === 'fulfilled') setAi(a.value);
      })
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">SLA / SLO</h2>
        <p className="text-sm text-c-text-secondary">{t('admin.health.sla-slo.day2Auto.text2')}</p>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-c-danger p-3 text-c-danger">
          {error}
        </div>
      )}
      {loading ? (
        <div role="status" className="py-8 text-center text-sm text-c-text-muted">
          {t('admin.health.sla-slo.day2Auto.text3')}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {slos.map((s) => (
              <article key={s.id} className="rounded-xl border border-c-border bg-c-surface p-4">
                <h3 className="font-semibold text-c-text">{s.slo_name}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-c-text-secondary">Cel</dt>
                    <dd>{s.target_percentage}%</dd>
                  </div>
                  <div>
                    <dt className="text-c-text-secondary">
                      {t('admin.health.sla-slo.day2Auto.text4')}
                    </dt>
                    <dd>
                      {s.current_percentage ?? t('admin.health.sla-slo.day2Auto.text5')}
                      {s.current_percentage == null ? '' : '%'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-c-text-secondary">
                      {t('admin.health.sla-slo.day2Auto.text6')}
                    </dt>
                    <dd>{s.budget_remaining ?? t('admin.health.sla-slo.day2Auto.text5')}</dd>
                  </div>
                  <div>
                    <dt className="text-c-text-secondary">Okno</dt>
                    <dd>
                      {s.window_days}
                      {t('admin.health.sla-slo.day2Auto.text7')}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          {slos.length === 0 && !error && (
            <div className="rounded-xl border border-c-border bg-c-surface p-5">
              {t('admin.health.sla-slo.day2Auto.text8')}
            </div>
          )}
          <section className="rounded-xl border border-c-border bg-c-surface p-4">
            <h3 className="font-semibold text-c-text">SLA AI</h3>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t('admin.health.sla-slo.day2Auto.text9')}
            </p>
            <p className="mt-2 text-xs text-c-text-muted">
              {t('admin.health.sla-slo.day2Auto.text10')}
              {ai ? 'odczytano' : t('admin.health.sla-slo.day2Auto.text11')}
            </p>
          </section>
        </>
      )}
    </div>
  );
};
