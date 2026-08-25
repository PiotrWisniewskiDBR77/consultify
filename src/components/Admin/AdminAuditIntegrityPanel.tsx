import { ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Api } from '../../services/api';
import { useTranslation } from 'react-i18next';
export const AdminAuditIntegrityPanel: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Api.getTenantAdminAuditStats()
      .then(setStats)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.audit.integrity.day2Auto.text1')}
        </h2>
        <p className="text-sm text-c-text-secondary">{t('admin.audit.integrity.day2Auto.text2')}</p>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
        >
          {error}
        </div>
      )}
      {loading ? (
        <div role="status" className="py-8 text-center text-sm text-c-text-muted">
          {t('admin.audit.integrity.day2Auto.text3')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.audit.integrity.day2Auto.text4', {
              value: stats?.totalLogs ?? '—',
            })}
          </div>
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.audit.integrity.day2Auto.text5', {
              value: stats?.unresolvedCount ?? '—',
            })}
          </div>
          <div className="rounded-xl border border-c-border p-4">
            {t('admin.audit.integrity.day2Auto.text6', {
              value: stats?.highRiskCount ?? '—',
            })}
          </div>
        </div>
      )}
      <section className="rounded-xl border border-c-border p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <h3 className="font-semibold text-c-text">{t('admin.audit.integrity.day2Auto.text7')}</h3>
        </div>
        <p className="mt-2 text-sm text-c-text-secondary">
          {t('admin.audit.integrity.day2Auto.text8')}
        </p>
      </section>
      <section className="rounded-xl border border-c-border p-5">
        <h3 className="font-semibold text-c-text">{t('admin.audit.integrity.day2Auto.text10')}</h3>
        <p className="mt-2 text-sm text-c-text-secondary">
          {t('admin.audit.integrity.day2Auto.text9')}
        </p>
      </section>
    </div>
  );
};
