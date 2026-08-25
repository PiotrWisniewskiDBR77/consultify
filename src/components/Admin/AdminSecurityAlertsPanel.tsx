import { ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getSecurityAlerts,
  resolveSecurityAlert,
  type SecurityAlert,
} from '../../services/adminSecurityAlertsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminSecurityAlertsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<SecurityAlert[]>([]),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await getSecurityAlerts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.security.security-alerts.errors.load'));
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const cols = useMemo<TableColumn[]>(
    () => [
      {
        id: 'type',
        label: t('admin.security.security-alerts.columns.type'),
      },
      {
        id: 'severity',
        label: t('admin.security.security-alerts.columns.severity'),
      },
      {
        id: 'user',
        label: t('admin.security.security-alerts.columns.user'),
      },
      {
        id: 'ip',
        label: t('admin.security.security-alerts.columns.ip'),
      },
      {
        id: 'time',
        label: t('admin.security.security-alerts.columns.time'),
      },
      {
        id: 'status',
        label: t('admin.security.security-alerts.columns.status'),
      },
    ],
    [t]
  );
  const rows = useMemo<TableRow[]>(
    () =>
      data.map((a) => ({
        id: a.id,
        type: a.event_type,
        severity: a.severity,
        user: a.user_email || '—',
        ip: a.ip_address || '—',
        time: new Date(a.created_at).toLocaleString(),
        status: a.resolved
          ? t('admin.security.security-alerts.status.resolved')
          : t('admin.security.security-alerts.status.open'),
      })),
    [data, t]
  );
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-c-text">
        {t('admin.security.security-alerts.title')}
      </h2>
      {error && <div role="alert">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-c-border p-4">
          {t('admin.security.security-alerts.metrics.unresolved', {
            count: data.filter((a) => !a.resolved).length,
          })}
        </div>
        <div className="rounded-xl border border-c-border p-4">
          {t('admin.security.security-alerts.metrics.highRisk', {
            count: data.filter((a) => ['critical', 'high'].includes(a.severity)).length,
          })}
        </div>
      </div>
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => {
          const a = data.find((x) => x.id === row.id);
          return a && !a.resolved
            ? {
                primary: [
                  {
                    id: 'resolve',
                    label: t('admin.security.security-alerts.actions.resolve'),
                    icon: ShieldAlert,
                    onClick: () =>
                      void resolveSecurityAlert(a.id)
                        .then(setData)
                        .catch((e) => setError(e.message)),
                  },
                ],
              }
            : {};
        }}
        empty={{
          icon: ShieldAlert,
          title: t('admin.security.security-alerts.empty.title'),
          description: t('admin.security.security-alerts.empty.description'),
        }}
        persistKey="admin.securityAlerts"
      />
    </div>
  );
};
