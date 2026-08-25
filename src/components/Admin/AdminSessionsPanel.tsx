import { MonitorX } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminSessions,
  revokeAdminSession,
  type AdminSession,
} from '../../services/adminSessionsApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
export const AdminSessionsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminSession[]>([]),
    [target, setTarget] = useState<AdminSession | null>(null),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await getAdminSessions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.security.sessions.day2Auto.text1'));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const cols = useMemo<TableColumn[]>(
    () => [
      {
        id: 'user',
        label: t('admin.security.sessions.day2Auto.text2'),
      },
      {
        id: 'device',
        label: t('admin.security.sessions.day2Auto.text3'),
      },
      {
        id: 'ip',
        label: 'IP',
      },
      {
        id: 'location',
        label: 'Lokalizacja',
      },
      {
        id: 'active',
        label: t('admin.security.sessions.day2Auto.text4'),
      },
      {
        id: 'expires',
        label: t('admin.security.sessions.day2Auto.text5'),
      },
    ],
    []
  );
  const rows = useMemo<TableRow[]>(
    () =>
      data.map((s) => ({
        id: s.id,
        user: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.user_email,
        device: s.device_info || s.user_agent || 'Nieznane',
        ip: s.ip_address || 'Nieznane',
        location: s.location || 'Nieznana',
        active: s.last_activity ? new Date(s.last_activity).toLocaleString() : '—',
        expires: s.expires_at ? new Date(s.expires_at).toLocaleString() : '—',
      })),
    [data]
  );
  const revoke = async () => {
    if (!target) return;
    try {
      setData(await revokeAdminSession(target.id));
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.security.sessions.day2Auto.text6'));
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-c-text">
        {t('admin.security.sessions.day2Auto.text7')}
      </h2>
      {error && <div role="alert">{error}</div>}
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          destructive: {
            label: t('admin.security.sessions.day2Auto.text8'),
            icon: MonitorX,
            onClick: () => setTarget(data.find((s) => s.id === row.id) || null),
          },
        })}
        empty={{
          icon: MonitorX,
          title: t('admin.security.sessions.day2Auto.text9'),
          description: t('admin.security.sessions.day2Auto.text10'),
        }}
        persistKey="admin.sessions"
      />
      <ConfirmDialog
        isOpen={!!target}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
        title={t('admin.security.sessions.day2Auto.text11')}
        description={t('admin.security.sessions.day2Auto.text12')}
        confirmLabel={t('admin.security.sessions.day2Auto.text8')}
        variant="danger"
      />
    </div>
  );
};
