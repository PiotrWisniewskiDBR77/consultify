import { UserMinus, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { getAdminGuests, revokeAdminGuest, type AdminGuest } from '../../services/adminGuestsApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
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
          label: t('admin.team.guests-external.day2Auto.text1'),
        },
        {
          id: 'email',
          label: 'E-mail',
        },
        {
          id: 'scope',
          label: t('admin.team.guests-external.day2Auto.text15'),
        },
        {
          id: 'granted',
          label: 'Przyznano',
        },
        {
          id: 'expires',
          label: t('admin.team.guests-external.day2Auto.text2'),
        },
        {
          id: t('admin.team.guests-external.day2Auto.text3'),
          label: t('admin.team.guests-external.day2Auto.text4'),
        },
      ],
      []
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
              ? `Projekt ${g.project_id}`
              : t('admin.team.guests-external.day2Auto.text5'),
            granted: new Date(g.granted_at).toLocaleString(),
            expires: g.expires_at ? new Date(g.expires_at).toLocaleString() : 'Bez terminu',
            status: expired ? t('admin.team.guests-external.day2Auto.text6') : g.status,
          };
        }),
      [data]
    );
  const revoke = async () => {
    if (!target) return;
    try {
      setData(await revokeAdminGuest(target.user_id));
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.team.guests-external.day2Auto.text7'));
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.team.guests-external.day2Auto.text8')}
        </h2>
        <p className="text-sm text-c-text-secondary">
          {t('admin.team.guests-external.day2Auto.text9')}
        </p>
      </div>
      {error && <div role="alert">{error}</div>}
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          destructive: {
            label: t('admin.team.guests-external.day2Auto.text10'),
            icon: UserMinus,
            onClick: () => setTarget(data.find((g) => g.user_id === row.id) || null),
          },
        })}
        empty={{
          icon: Users,
          title: t('admin.team.guests-external.day2Auto.text11'),
          description: t('admin.team.guests-external.day2Auto.text12'),
        }}
        persistKey="admin.guests"
      />
      <ConfirmDialog
        isOpen={!!target}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
        title={t('admin.team.guests-external.day2Auto.text13')}
        description={
          target
            ? t('admin.team.guests-external.day2Auto.text14', {
                v0: target.email,
              })
            : undefined
        }
        confirmLabel={t('admin.team.guests-external.day2Auto.text10')}
        variant="danger"
      />
    </div>
  );
};
