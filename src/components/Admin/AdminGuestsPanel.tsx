import { UserMinus, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type AdminGuest, getAdminGuests, revokeAdminGuest } from '../../services/adminGuestsApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
export const AdminGuestsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminGuest[]>([]),
    [target, setTarget] = useState<AdminGuest | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAdminGuests()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const cols = useMemo<TableColumn[]>(
      () => [
        {
          id: 'guest',
          label: t('admin.team.guests-external.columns.guest'),
        },
        {
          id: 'email',
          label: t('admin.team.guests-external.columns.email'),
        },
        {
          id: 'scope',
          label: t('admin.team.guests-external.columns.scope'),
        },
        {
          id: 'granted',
          label: t('admin.team.guests-external.columns.granted'),
        },
        {
          id: 'expires',
          label: t('admin.team.guests-external.columns.expires'),
        },
        {
          id: 'status',
          label: t('admin.team.guests-external.columns.status'),
        },
      ],
      [t]
    ),
    rows = useMemo<TableRow[]>(
      () =>
        data.map((g) => {
          const expired = !!g.expires_at && new Date(g.expires_at) < new Date();
          return {
            id: g.user_id,
            guest: [g.first_name, g.last_name].filter(Boolean).join(' ') || g.email,
            email: g.email,
            scope: g.project_id
              ? t('admin.team.guests-external.scope.project', { projectId: g.project_id })
              : t('admin.team.guests-external.scope.organization'),
            granted: new Date(g.granted_at).toLocaleString(),
            expires: g.expires_at
              ? new Date(g.expires_at).toLocaleString()
              : t('admin.team.guests-external.noExpiry'),
            status: expired ? t('admin.team.guests-external.status.expired') : g.status,
          };
        }),
      [data, t]
    );
  const revoke = async () => {
    if (!target) return;
    try {
      setData(await revokeAdminGuest(target.user_id));
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.team.guests-external.revokeError'));
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.team.guests-external.title')}
        </h2>
        <p className="text-sm text-c-text-secondary">
          {t('admin.team.guests-external.description')}
        </p>
      </div>
      {error && <div role="alert">{error}</div>}
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          destructive: {
            label: t('admin.team.guests-external.actions.revoke'),
            icon: UserMinus,
            onClick: () => setTarget(data.find((g) => g.user_id === row.id) || null),
          },
        })}
        empty={{
          icon: Users,
          title: t('admin.team.guests-external.empty.title'),
          description: t('admin.team.guests-external.empty.description'),
        }}
        persistKey="admin.guests"
      />
      <ConfirmDialog
        isOpen={!!target}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
        title={t('admin.team.guests-external.revokeDialog.title')}
        description={
          target
            ? t('admin.team.guests-external.revokeDialog.description', {
                v0: target.email,
              })
            : undefined
        }
        confirmLabel={t('admin.team.guests-external.actions.revoke')}
        variant="danger"
      />
    </div>
  );
};
