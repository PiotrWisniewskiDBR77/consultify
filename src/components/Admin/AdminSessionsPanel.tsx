import { MonitorX } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AdminSession,
  getAdminSessions,
  revokeAdminSession,
} from '../../services/adminSessionsApi';
import { formatListDateTime } from '../../utils/listDateFormat';
import { summarizeUserAgent } from '../../utils/userAgentLabel';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
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
      setError(e instanceof Error ? e.message : t('admin.security.sessions.errors.load'));
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const cols = useMemo<TableColumn[]>(
    () => [
      {
        id: 'user',
        label: t('admin.security.sessions.columns.user'),
      },
      {
        id: 'device',
        label: t('admin.security.sessions.columns.device'),
        render: (row) => <span title={row.deviceRaw || undefined}>{row.device}</span>,
      },
      {
        id: 'ip',
        label: t('admin.security.sessions.columns.ip'),
      },
      {
        id: 'location',
        label: t('admin.security.sessions.columns.location'),
      },
      {
        id: 'active',
        label: t('admin.security.sessions.columns.lastActivity'),
      },
      {
        id: 'expires',
        label: t('admin.security.sessions.columns.expiresAt'),
      },
    ],
    [t]
  );
  const rows = useMemo<TableRow[]>(
    () =>
      data.map((s) => ({
        id: s.id,
        user: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.user_email,
        device:
          s.device_info ||
          summarizeUserAgent(s.user_agent, {
            unknown: t('admin.security.sessions.values.unknownDevice'),
            automationAgent: t('admin.security.sessions.values.automationAgent'),
          }),
        deviceRaw: s.device_info ? null : s.user_agent || null,
        ip: s.ip_address || t('admin.security.sessions.values.unknown'),
        location: s.location || t('admin.security.sessions.values.unknownLocation'),
        active: s.last_activity ? formatListDateTime(s.last_activity) : '—',
        expires: s.expires_at ? formatListDateTime(s.expires_at) : '—',
      })),
    [data, t]
  );
  const revoke = async () => {
    if (!target) return;
    try {
      setData(await revokeAdminSession(target.id));
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.security.sessions.errors.revoke'));
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-c-text">{t('admin.security.sessions.title')}</h2>
      {error && <div role="alert">{error}</div>}
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          destructive: {
            label: t('admin.security.sessions.actions.revoke'),
            icon: MonitorX,
            onClick: () => setTarget(data.find((s) => s.id === row.id) || null),
          },
        })}
        empty={{
          icon: MonitorX,
          title: t('admin.security.sessions.empty.title'),
          description: t('admin.security.sessions.empty.description'),
        }}
        persistKey="admin.sessions"
      />
      <ConfirmDialog
        isOpen={!!target}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
        title={t('admin.security.sessions.confirmRevoke.title')}
        description={t('admin.security.sessions.confirmRevoke.description')}
        confirmLabel={t('admin.security.sessions.actions.revoke')}
        variant="danger"
      />
    </div>
  );
};
