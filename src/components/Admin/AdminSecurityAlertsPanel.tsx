import { ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSecurityAlerts,
  resolveSecurityAlert,
  type SecurityAlert,
} from '../../services/adminSecurityAlertsApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
export const AdminSecurityAlertsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<SecurityAlert[]>([]),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await getSecurityAlerts());
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('admin.security.security-alerts.day2Auto.text1', {
              defaultValue: 'Błąd alertów',
            })
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const cols = useMemo<TableColumn[]>(
    () => [
      {
        id: 'type',
        label: 'Typ',
      },
      {
        id: 'severity',
        label: t('admin.security.security-alerts.day2Auto.text2', {
          defaultValue: 'Dotkliwość',
        }),
      },
      {
        id: 'user',
        label: t('admin.security.security-alerts.day2Auto.text3', {
          defaultValue: 'Użytkownik',
        }),
      },
      {
        id: 'ip',
        label: 'IP',
      },
      {
        id: 'time',
        label: 'Czas',
      },
      {
        id: t('admin.security.security-alerts.day2Auto.text4', {
          defaultValue: 'status',
        }),
        label: t('admin.security.security-alerts.day2Auto.text5', {
          defaultValue: 'Status',
        }),
      },
    ],
    []
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
          ? t('admin.security.security-alerts.day2Auto.text6', {
              defaultValue: 'Rozwiązany',
            })
          : 'Otwarty',
      })),
    [data]
  );
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-c-text">
        {t('admin.security.security-alerts.day2Auto.text7', {
          defaultValue: 'Alerty bezpieczeństwa',
        })}
      </h2>
      {error && <div role="alert">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-c-border p-4">
          {t('admin.security.security-alerts.day2Auto.text8', {
            defaultValue: 'Nierozwiązane:',
          })}
          {data.filter((a) => !a.resolved).length}
        </div>
        <div className="rounded-xl border border-c-border p-4">
          Wysokiego ryzyka: {data.filter((a) => ['critical', 'high'].includes(a.severity)).length}
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
                    label: t('admin.security.security-alerts.day2Auto.text9', {
                      defaultValue: 'Oznacz jako rozwiązane',
                    }),
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
          title: t('admin.security.security-alerts.day2Auto.text10', {
            defaultValue: 'Brak alertów',
          }),
          description: t('admin.security.security-alerts.day2Auto.text11', {
            defaultValue: 'Nie wykryto zdarzeń bezpieczeństwa.',
          }),
        }}
        persistKey="admin.securityAlerts"
      />
    </div>
  );
};
